import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { getAlpacaClient, parseAlpacaWebSocketMessage } from "./alpaca";
import { createStrategy } from "./strategies";
import { getReinforcementLearningStrategy } from "./reinforcementLearning";
import { z } from "zod";
import { 
  insertApiKeySchema, 
  insertBotSettingsSchema, 
  insertSystemLogSchema, 
  OrderRequest,
  MarketData
} from "@shared/schema";

// Active WebSocket connections with user IDs
const activeConnections: Map<number, WebSocket[]> = new Map();

// Market data cache
const marketDataCache: Map<string, any> = new Map();

// Active trading bots by user
const activeBots: Map<number, NodeJS.Timeout> = new Map();

// Helper to broadcast to all connections for a user
function broadcastToUser(userId: number, data: any) {
  const connections = activeConnections.get(userId);
  if (!connections) return;

  const message = JSON.stringify(data);
  
  connections.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

// Handle alpaca websocket messages
async function handleAlpacaWebsocketMessage(userId: number, message: any) {
  try {
    // Get API key to check if we're in test mode
    const apiKey = await storage.getApiKeyByUserId(userId);
    const isTestMode = apiKey?.alpacaApiKey === 'TEST_KEY' || 
                       apiKey?.alpacaApiKey?.startsWith('TEST_');
                       
    // Handle both real Alpaca messages and our mock messages
    let marketData: MarketData | null = null;
    
    if (message.type === 'mock') {
      // For test mode with mock data
      marketData = message.data;
    } else {
      // For real Alpaca API data
      marketData = parseAlpacaWebSocketMessage(message);
    }
    
    if (!marketData) return;
    
    // Update market data cache
    marketDataCache.set(marketData.symbol, marketData);
    
    // Broadcast market data update to user
    broadcastToUser(userId, {
      type: 'marketData',
      data: marketData
    });
    
    // Update positions if any exist for this symbol
    const positions = await storage.getPositionsByUserId(userId);
    const position = positions.find(p => p.symbol === marketData!.symbol);
    
    if (position) {
      // Update position with new price data
      const updatedPosition = await storage.updatePosition(position.id, {
        currentPrice: marketData.price.toString(),
        marketValue: (parseFloat(position.qty) * marketData.price).toString(),
        unrealizedPl: (parseFloat(position.qty) * (marketData.price - parseFloat(position.entryPrice))).toString(),
        unrealizedPlPerc: (((marketData.price - parseFloat(position.entryPrice)) / parseFloat(position.entryPrice)) * 100).toString()
      });
      
      // Broadcast position update
      broadcastToUser(userId, {
        type: 'positionUpdate',
        data: updatedPosition
      });
      
      // In test mode, update performance metrics based on position changes
      if (isTestMode) {
        const metrics = await storage.getPerformanceMetricsByUserId(userId);
        if (metrics) {
          // Calculate total position value
          let totalPositionValue = 0;
          for (const pos of positions) {
            totalPositionValue += parseFloat(pos.marketValue);
          }
          
          // Calculate portfolio metrics
          const buyingPower = parseFloat(metrics.buyingPower);
          const newPortfolioValue = totalPositionValue + buyingPower;
          const portfolioChange = newPortfolioValue - 25000; // Initial capital
          const portfolioChangePerc = (portfolioChange / 25000) * 100;
          
          // Update performance metrics
          await storage.updatePerformanceMetrics(metrics.id, {
            portfolioValue: newPortfolioValue.toString(),
            portfolioChange: portfolioChange.toString(),
            portfolioChangePerc: portfolioChangePerc.toString()
          });
          
          // Get updated metrics and broadcast
          const updatedMetrics = await storage.getPerformanceMetricsByUserId(userId);
          if (updatedMetrics) {
            broadcastToUser(userId, {
              type: 'metricsUpdate',
              data: updatedMetrics
            });
          }
        }
      }
    }
    
    // Get bot settings
    const botSettings = await storage.getBotSettingsByUserId(userId);
    
    // If bot is active, analyze the data with the strategy
    if (botSettings?.isActive) {
      let signal;
      
      // Get historical data from cache (in a real implementation, this would be more sophisticated)
      const historicalData: MarketData[] = [];
      for (const [symbol, data] of marketDataCache.entries()) {
        if (symbol === marketData.symbol) {
          historicalData.push(data as MarketData);
        }
      }
      
      // Check if we should use RL strategy or traditional strategies
      if (botSettings.strategy === 'reinforcement') {
        // Use the reinforcement learning implementation
        const rlStrategy = getReinforcementLearningStrategy();
        
        // Update the RL model with the market data
        rlStrategy.updateMarketData(marketData.symbol, marketData);
        
        // Generate a signal using the RL model
        signal = rlStrategy.generateSignal(marketData.symbol, [marketData], historicalData);
        
        // Add test mode indicator to logs if needed
        const testMsg = isTestMode ? " (TEST MODE)" : "";
        
        // Log the RL signal
        await storage.createSystemLog({
          userId,
          level: 'SIGNAL',
          message: `AI Reinforcement Learning ${signal.action} signal for ${signal.symbol} (confidence: ${signal.confidence.toFixed(1)}%)${testMsg}`
        });
      } else {
        // Use traditional strategies
        const strategy = createStrategy(botSettings.strategy as any);
        signal = strategy.analyze(marketData.symbol, [marketData], historicalData);
        
        // Add test mode indicator to logs if needed
        const testMsg = isTestMode ? " (TEST MODE)" : "";
        
        // Log the traditional signal
        await storage.createSystemLog({
          userId,
          level: 'SIGNAL',
          message: `${strategy.getName()} ${signal.action} signal detected for ${signal.symbol} (confidence: ${signal.confidence.toFixed(1)}%)${testMsg}`
        });
      }
      
      // Broadcast the signal
      broadcastToUser(userId, {
        type: 'strategySignal',
        data: signal
      });
      
      // Execute trades based on the signal (in a real system, apply risk management here)
      if (signal.action !== 'hold' && signal.confidence > 70) {
        // Get API key to execute the trade
        const apiKey = await storage.getApiKeyByUserId(userId);
        
        if (apiKey) {
          const alpaca = getAlpacaClient(
            apiKey.alpacaApiKey, 
            apiKey.alpacaSecretKey, 
            apiKey.environment === 'paper'
          );
          
          // Get account information for position sizing with RL model
          const account = await alpaca.getAccount();
          const accountValue = parseFloat(account.portfolio_value);
          
          // Create order - either use RL position sizing or basic sizing
          let orderRequest: OrderRequest;
          
          if (botSettings.strategy === 'reinforcement') {
            // Get order request from RL model with position sizing
            const rlStrategy = getReinforcementLearningStrategy();
            const rlOrder = rlStrategy.signalToOrder(signal, accountValue);
            
            // If the RL model returns an order, use it, otherwise use default
            if (rlOrder) {
              orderRequest = rlOrder;
            } else {
              orderRequest = {
                symbol: signal.symbol,
                qty: 1, // Default if RL doesn't generate an order
                side: signal.action,
                type: 'market',
                time_in_force: 'gtc'
              };
            }
          } else {
            // Basic order for traditional strategies
            orderRequest = {
              symbol: signal.symbol,
              qty: 1, // This would be calculated based on position sizing and risk management
              side: signal.action,
              type: 'market',
              time_in_force: 'gtc'
            };
          }
          
          try {
            const order = await alpaca.submitOrder(orderRequest);
            
            // Log the order
            await storage.createSystemLog({
              userId,
              level: 'TRADE',
              message: `${order.side.toUpperCase()} order executed: ${order.qty} ${order.symbol} @ market price`
            });
            
            // Create trade record
            await storage.createTrade({
              userId,
              symbol: order.symbol,
              side: order.side,
              qty: parseFloat(order.qty),
              price: 0, // Will be updated when filled
              orderType: order.type,
              status: order.status
            });
            
            // Broadcast order status
            broadcastToUser(userId, {
              type: 'orderUpdate',
              data: order
            });
          } catch (error: any) {
            // Log the error
            await storage.createSystemLog({
              userId,
              level: 'ERROR',
              message: `Order execution failed: ${error.message}`
            });
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error handling Alpaca WebSocket message:', error);
  }
}

// Start the trading bot for a user
async function startTradingBot(userId: number) {
  // Stop existing bot if running
  stopTradingBot(userId);
  
  // Get API key and bot settings
  const apiKey = await storage.getApiKeyByUserId(userId);
  const botSettings = await storage.getBotSettingsByUserId(userId);
  
  if (!apiKey || !botSettings || !botSettings.isActive) return;
  
  // Check if we're in test mode
  const isTestMode = apiKey.alpacaApiKey === 'TEST_KEY' || 
                     apiKey.alpacaApiKey.startsWith('TEST_');
  
  // Initialize the reinforcement learning strategy if selected
  if (botSettings.strategy === 'reinforcement') {
    try {
      // Get the RL strategy instance
      const rlStrategy = getReinforcementLearningStrategy();
      
      // Set up the Alpaca client for the RL model
      const alpaca = getAlpacaClient(
        apiKey.alpacaApiKey,
        apiKey.alpacaSecretKey,
        apiKey.environment === 'paper'
      );
      
      // Set the Alpaca client in the RL strategy
      rlStrategy.setAlpacaClient(alpaca);
      
      // Try to load a pre-trained model
      await rlStrategy.loadModel().catch(err => {
        console.warn('No pre-trained RL model found, starting with untrained model:', err);
      });
      
      // Add test mode indicator to logs if needed
      const testMsg = isTestMode ? " (TEST MODE)" : "";
      
      // Log RL model initialization
      await storage.createSystemLog({
        userId,
        level: 'INFO',
        message: `Reinforcement learning model initialized${testMsg}`
      });
    } catch (error: any) {
      console.error('Error initializing reinforcement learning model:', error);
      
      // Log the error
      await storage.createSystemLog({
        userId,
        level: 'ERROR',
        message: `Error initializing RL model: ${error.message}`
      });
    }
  }
  
  // Log bot start with test mode indicator if needed
  const testMsg = isTestMode ? " (TEST MODE)" : "";
  await storage.createSystemLog({
    userId,
    level: 'INFO',
    message: `Bot started with ${botSettings.strategy} strategy${testMsg}`
  });
  
  // Broadcast bot status
  broadcastToUser(userId, {
    type: 'botStatus',
    data: { isActive: true, strategy: botSettings.strategy }
  });
  
  // Set update frequency based on trading frequency
  let updateInterval = 60000; // Default 1 minute
  
  switch (botSettings.tradingFrequency) {
    case 'low':
      updateInterval = 300000; // 5 minutes
      break;
    case 'medium':
      updateInterval = 60000; // 1 minute
      break;
    case 'high':
      updateInterval = 10000; // 10 seconds
      break;
  }
  
  // Start periodic updates
  const intervalId = setInterval(async () => {
    try {
      // Update account and position information
      const alpaca = getAlpacaClient(
        apiKey.alpacaApiKey, 
        apiKey.alpacaSecretKey, 
        apiKey.environment === 'paper'
      );
      
      // Get account information
      const account = await alpaca.getAccount();
      
      // Update performance metrics
      const existingMetrics = await storage.getPerformanceMetricsByUserId(userId);
      
      if (existingMetrics) {
        await storage.updatePerformanceMetrics(existingMetrics.id, {
          portfolioValue: parseFloat(account.portfolio_value),
          buyingPower: parseFloat(account.buying_power)
        });
      } else {
        await storage.createPerformanceMetrics({
          userId,
          portfolioValue: parseFloat(account.portfolio_value),
          buyingPower: parseFloat(account.buying_power),
          portfolioChange: 0,
          portfolioChangePerc: 0,
          sharpeRatio: 0,
          winLossRatio: 0,
          totalTrades: 0,
          profitableTrades: 0,
          profitableTradesPerc: 0,
          avgHoldingTime: 0
        });
      }
      
      // Get positions
      const positions = await alpaca.getPositions();
      
      // Update positions in storage
      for (const pos of positions) {
        const existingPosition = await storage.getPositionBySymbol(userId, pos.symbol);
        
        const positionData = {
          userId,
          symbol: pos.symbol,
          qty: parseFloat(pos.qty),
          entryPrice: parseFloat(pos.avg_entry_price),
          currentPrice: parseFloat(pos.current_price),
          marketValue: parseFloat(pos.market_value),
          unrealizedPl: parseFloat(pos.unrealized_pl),
          unrealizedPlPerc: parseFloat(pos.unrealized_plpc) * 100
        };
        
        if (existingPosition) {
          await storage.updatePosition(existingPosition.id, positionData);
        } else {
          await storage.createPosition(positionData);
        }
      }
      
      // Broadcast updated data
      const updatedPositions = await storage.getPositionsByUserId(userId);
      const updatedMetrics = await storage.getPerformanceMetricsByUserId(userId);
      
      broadcastToUser(userId, {
        type: 'accountUpdate',
        data: {
          account,
          positions: updatedPositions,
          metrics: updatedMetrics
        }
      });
    } catch (error: any) {
      console.error('Error in trading bot update:', error);
      
      // Log the error
      await storage.createSystemLog({
        userId,
        level: 'ERROR',
        message: `Bot update error: ${error.message}`
      });
    }
  }, updateInterval);
  
  // Store the interval ID
  activeBots.set(userId, intervalId);
}

// Stop the trading bot for a user
function stopTradingBot(userId: number) {
  const intervalId = activeBots.get(userId);
  
  if (intervalId) {
    clearInterval(intervalId);
    activeBots.delete(userId);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    let userId: number | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication
        if (data.type === 'auth' && data.userId) {
          userId = parseInt(data.userId);
          
          // Add connection to active connections
          if (!activeConnections.has(userId)) {
            activeConnections.set(userId, []);
          }
          
          activeConnections.get(userId)?.push(ws);
          
          // Send initial data
          const positions = await storage.getPositionsByUserId(userId);
          const trades = await storage.getTradesByUserId(userId, 10);
          const metrics = await storage.getPerformanceMetricsByUserId(userId);
          const logs = await storage.getSystemLogsByUserId(userId, 20);
          const botSettings = await storage.getBotSettingsByUserId(userId);
          const apiKey = await storage.getApiKeyByUserId(userId);
          
          ws.send(JSON.stringify({
            type: 'initialData',
            data: {
              positions,
              trades,
              metrics,
              logs,
              botSettings,
              hasApiKey: !!apiKey
            }
          }));
          
          // Connect to Alpaca websocket if API key exists
          if (apiKey) {
            // Check if we're in test mode
            const isTestMode = apiKey.alpacaApiKey === 'TEST_KEY' || 
                             apiKey.alpacaApiKey.startsWith('TEST_');
                             
            // Get the Alpaca client instance
            const alpaca = getAlpacaClient(
              apiKey.alpacaApiKey,
              apiKey.alpacaSecretKey,
              apiKey.environment === 'paper'
            );
            
            // In a real system, we would connect to Alpaca's actual websocket here
            // For test mode or simulation, generate mock market data
            if (isTestMode) {
              // Log that we're in test mode
              const testMsg = " (TEST MODE)";
              await storage.createSystemLog({
                userId,
                level: 'INFO',
                message: 'WebSocket connection established' + testMsg
              });
              
              // Generate mock market data for common crypto symbols
              const symbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'AVAXUSD'];
              const dataInterval = 5000; // 5 seconds interval
              
              // Create an interval to continuously generate market data
              const dataIntervalId = setInterval(() => {
                if (!activeConnections.has(userId)) {
                  clearInterval(dataIntervalId);
                  return;
                }
                
                // For each symbol, generate a mock data point
                symbols.forEach(symbol => {
                  const mockData = alpaca.generateMockMarketData(symbol);
                  
                  // Create a websocket message format
                  const message = {
                    type: 'mock',
                    data: mockData
                  };
                  
                  // Process the mock message through the same pipeline
                  handleAlpacaWebsocketMessage(userId, message);
                });
              }, dataInterval);
            } else {
              // Log connection (real mode)
              await storage.createSystemLog({
                userId,
                level: 'INFO',
                message: 'WebSocket connection established'
              });
            }
            
            // Start the trading bot if it's active
            if (botSettings?.isActive) {
              startTradingBot(userId);
            }
          }
        }
        // Handle other message types
        else if (userId) {
          if (data.type === 'startBot') {
            const botSettings = await storage.getBotSettingsByUserId(userId);
            
            if (botSettings) {
              await storage.updateBotSettings(botSettings.id, { isActive: true });
              startTradingBot(userId);
            }
          } else if (data.type === 'stopBot') {
            const botSettings = await storage.getBotSettingsByUserId(userId);
            
            if (botSettings) {
              await storage.updateBotSettings(botSettings.id, { isActive: false });
              stopTradingBot(userId);
              
              // Log bot stop
              await storage.createSystemLog({
                userId,
                level: 'INFO',
                message: 'Bot stopped'
              });
              
              // Broadcast bot status
              broadcastToUser(userId, {
                type: 'botStatus',
                data: { isActive: false }
              });
            }
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      if (userId) {
        // Remove connection from active connections
        const connections = activeConnections.get(userId);
        
        if (connections) {
          const index = connections.indexOf(ws);
          
          if (index !== -1) {
            connections.splice(index, 1);
          }
          
          if (connections.length === 0) {
            activeConnections.delete(userId);
          }
        }
      }
    });
  });

  // API Routes
  // Default user route - in a real app, this would be replaced with proper authentication
  app.get('/api/default-user', async (_req: Request, res: Response) => {
    let user = await storage.getUserByUsername('demo');
    
    if (!user) {
      user = await storage.createUser({
        username: 'demo',
        password: 'demo'
      });
      
      // Create default bot settings
      await storage.createBotSettings({
        userId: user.id,
        isActive: false,
        strategy: 'mean_reversion',
        riskLevel: 5,
        tradingFrequency: 'medium'
      });
      
      // Create initial log
      await storage.createSystemLog({
        userId: user.id,
        level: 'INFO',
        message: 'Trading bot initialized'
      });
      
      // Create initial performance metrics
      await storage.createPerformanceMetrics({
        userId: user.id,
        portfolioValue: 25000,
        buyingPower: 25000,
        portfolioChange: 0,
        portfolioChangePerc: 0,
        sharpeRatio: 0,
        winLossRatio: 0,
        totalTrades: 0,
        profitableTrades: 0,
        profitableTradesPerc: 0,
        avgHoldingTime: 0
      });
    }
    
    res.json({ userId: user.id });
  });
  
  // API Key routes
  app.post('/api/api-keys', async (req: Request, res: Response) => {
    try {
      const validatedData = insertApiKeySchema.parse(req.body);
      
      // Check if these are test mode API keys
      const isTestMode = validatedData.alpacaApiKey === 'TEST_KEY' || 
                         validatedData.alpacaApiKey.startsWith('TEST_');
      
      // In test mode, set both keys to TEST_KEY for consistency
      if (isTestMode) {
        validatedData.alpacaApiKey = 'TEST_KEY';
        validatedData.alpacaSecretKey = 'TEST_KEY';
        
        // Force paper trading in test mode
        if (validatedData.environment === 'live') {
          validatedData.environment = 'paper';
          console.log("Test mode only supports paper trading - switching to paper environment");
        }
      } else {
        // Test the real API keys with Alpaca
        try {
          const alpaca = getAlpacaClient(
            validatedData.alpacaApiKey, 
            validatedData.alpacaSecretKey, 
            validatedData.environment === 'paper'
          );
          
          await alpaca.getAccount();
        } catch (error) {
          console.error("API key validation error:", error);
          return res.status(400).json({ message: 'Invalid API keys' });
        }
      }
      
      // Check if user already has an API key
      const existingApiKey = await storage.getApiKeyByUserId(validatedData.userId);
      
      if (existingApiKey) {
        const updatedApiKey = await storage.updateApiKey(existingApiKey.id, validatedData);
        res.json(updatedApiKey);
      } else {
        const apiKey = await storage.createApiKey(validatedData);
        res.json(apiKey);
      }
      
      // Log API key update
      const modeMsg = isTestMode ? " (TEST MODE)" : "";
      await storage.createSystemLog({
        userId: validatedData.userId,
        level: 'INFO',
        message: `API keys ${existingApiKey ? 'updated' : 'configured'} for ${validatedData.environment} environment${modeMsg}`
      });
      
      // Broadcast API key status
      broadcastToUser(validatedData.userId, {
        type: 'apiKeyUpdate',
        data: { 
          hasApiKey: true, 
          environment: validatedData.environment, 
          isTestMode: isTestMode 
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Error saving API keys' });
      }
    }
  });
  
  app.get('/api/api-keys/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const apiKey = await storage.getApiKeyByUserId(userId);
    
    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }
    
    // Check if we're in test mode
    const isTestMode = apiKey.alpacaApiKey === 'TEST_KEY' || 
                       apiKey.alpacaApiKey.startsWith('TEST_');
    
    // Don't return the actual keys, just the environment and test mode status
    res.json({
      environment: apiKey.environment,
      hasApiKey: true,
      isTestMode: isTestMode
    });
  });
  
  // Bot settings routes
  app.post('/api/bot-settings', async (req: Request, res: Response) => {
    try {
      const validatedData = insertBotSettingsSchema.parse(req.body);
      
      // Check if user already has bot settings
      const existingSettings = await storage.getBotSettingsByUserId(validatedData.userId);
      
      let result;
      
      if (existingSettings) {
        result = await storage.updateBotSettings(existingSettings.id, validatedData);
      } else {
        result = await storage.createBotSettings(validatedData);
      }
      
      // Start or stop the bot based on isActive
      if (validatedData.isActive) {
        startTradingBot(validatedData.userId);
      } else {
        stopTradingBot(validatedData.userId);
      }
      
      // Log settings update
      await storage.createSystemLog({
        userId: validatedData.userId,
        level: 'INFO',
        message: `Bot settings updated: ${validatedData.isActive ? 'active' : 'inactive'}, strategy: ${validatedData.strategy}`
      });
      
      // Broadcast settings update
      broadcastToUser(validatedData.userId, {
        type: 'botSettingsUpdate',
        data: result
      });
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Error saving bot settings' });
      }
    }
  });
  
  app.get('/api/bot-settings/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const settings = await storage.getBotSettingsByUserId(userId);
    
    if (!settings) {
      return res.status(404).json({ message: 'Bot settings not found' });
    }
    
    res.json(settings);
  });
  
  // Position routes
  app.get('/api/positions/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const positions = await storage.getPositionsByUserId(userId);
    res.json(positions);
  });
  
  // Trade routes
  app.get('/api/trades/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const trades = await storage.getTradesByUserId(userId, limit);
    res.json(trades);
  });
  
  // Order submission
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const { userId, ...orderRequest } = req.body;
      
      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Validate order request
      const orderSchema = z.object({
        symbol: z.string(),
        qty: z.number().positive(),
        side: z.enum(['buy', 'sell']),
        type: z.enum(['market', 'limit', 'stop']),
        time_in_force: z.enum(['day', 'gtc', 'ioc']),
        limit_price: z.number().optional(),
        stop_price: z.number().optional(),
      });
      
      const validatedOrder = orderSchema.parse(orderRequest);
      
      // Get API key
      const apiKey = await storage.getApiKeyByUserId(parseInt(userId));
      
      if (!apiKey) {
        return res.status(400).json({ message: 'API key not configured' });
      }
      
      // Check if we're in test mode
      const isTestMode = apiKey.alpacaApiKey === 'TEST_KEY' || 
                          apiKey.alpacaApiKey.startsWith('TEST_');
      
      // Submit order to Alpaca (will use mock data in test mode)
      const alpaca = getAlpacaClient(
        apiKey.alpacaApiKey, 
        apiKey.alpacaSecretKey, 
        apiKey.environment === 'paper'
      );
      
      const order = await alpaca.submitOrder(validatedOrder);
      
      // Log the order with test mode indicator if needed
      const testMsg = isTestMode ? " (TEST MODE)" : "";
      await storage.createSystemLog({
        userId: parseInt(userId),
        level: 'TRADE',
        message: `Manual ${order.side.toUpperCase()} order submitted: ${order.qty} ${order.symbol} @ ${order.type} price${testMsg}`
      });
      
      // Create trade record
      await storage.createTrade({
        userId: parseInt(userId),
        symbol: order.symbol,
        side: order.side,
        qty: parseFloat(order.qty),
        price: 0, // Will be updated when filled
        orderType: order.type,
        status: order.status
      });
      
      // Broadcast order status
      broadcastToUser(parseInt(userId), {
        type: 'orderUpdate',
        data: order
      });
      
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid order data', errors: error.errors });
      } else {
        console.error('Error submitting order:', error);
        res.status(500).json({ message: 'Error submitting order' });
      }
    }
  });
  
  // Close position
  app.post('/api/positions/close', async (req: Request, res: Response) => {
    try {
      const { userId, symbol } = req.body;
      
      if (!userId || isNaN(parseInt(userId)) || !symbol) {
        return res.status(400).json({ message: 'Invalid request data' });
      }
      
      // Get API key
      const apiKey = await storage.getApiKeyByUserId(parseInt(userId));
      
      if (!apiKey) {
        return res.status(400).json({ message: 'API key not configured' });
      }
      
      // Check if we're in test mode
      const isTestMode = apiKey.alpacaApiKey === 'TEST_KEY' || 
                        apiKey.alpacaApiKey.startsWith('TEST_');
      
      // Close position through Alpaca client (will use mocked data in test mode)
      const alpaca = getAlpacaClient(
        apiKey.alpacaApiKey, 
        apiKey.alpacaSecretKey, 
        apiKey.environment === 'paper'
      );
      
      const result = await alpaca.closePosition(symbol);
      
      // Log the action
      const testMsg = isTestMode ? " (TEST MODE)" : "";
      await storage.createSystemLog({
        userId: parseInt(userId),
        level: 'TRADE',
        message: `Position closed: ${symbol}${testMsg}`
      });
      
      // Delete the position from storage
      const position = await storage.getPositionBySymbol(parseInt(userId), symbol);
      
      if (position) {
        await storage.deletePosition(position.id);
      }
      
      // Broadcast position update
      broadcastToUser(parseInt(userId), {
        type: 'positionClosed',
        data: { symbol }
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error closing position:', error);
      res.status(500).json({ message: 'Error closing position' });
    }
  });
  
  // Performance metrics
  app.get('/api/metrics/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const metrics = await storage.getPerformanceMetricsByUserId(userId);
    
    if (!metrics) {
      return res.status(404).json({ message: 'Metrics not found' });
    }
    
    res.json(metrics);
  });
  
  // System logs
  app.get('/api/logs/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const logs = await storage.getSystemLogsByUserId(userId, limit);
    res.json(logs);
  });
  
  app.post('/api/logs', async (req: Request, res: Response) => {
    try {
      const validatedData = insertSystemLogSchema.parse(req.body);
      const log = await storage.createSystemLog(validatedData);
      
      // Broadcast log
      broadcastToUser(validatedData.userId, {
        type: 'newLog',
        data: log
      });
      
      res.json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid log data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Error creating log' });
      }
    }
  });
  
  app.delete('/api/logs/:userId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    await storage.clearSystemLogs(userId);
    
    // Broadcast log clear
    broadcastToUser(userId, {
      type: 'logsClear'
    });
    
    res.json({ success: true });
  });

  return httpServer;
}

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { getAlpacaClient, parseAlpacaWebSocketMessage } from "./alpaca";
import { createStrategy } from "./strategies";
import { z } from "zod";
import { 
  insertApiKeySchema, 
  insertBotSettingsSchema, 
  insertSystemLogSchema, 
  OrderRequest
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
    const marketData = parseAlpacaWebSocketMessage(message);
    if (!marketData) return;
    
    // Update market data cache
    marketDataCache.set(marketData.symbol, marketData);
    
    // Broadcast market data update to user
    broadcastToUser(userId, {
      type: 'marketData',
      data: marketData
    });
    
    // Get bot settings
    const botSettings = await storage.getBotSettingsByUserId(userId);
    
    // If bot is active, analyze the data with the strategy
    if (botSettings?.isActive) {
      const strategy = createStrategy(botSettings.strategy as any);
      const historicalData = []; // In a real implementation, fetch historical data
      
      const signal = strategy.analyze(marketData.symbol, [marketData], historicalData);
      
      // Log the signal
      await storage.createSystemLog({
        userId,
        level: 'SIGNAL',
        message: `${strategy.getName()} ${signal.action} signal detected for ${signal.symbol} (confidence: ${signal.confidence.toFixed(1)}%)`
      });
      
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
          
          // Create order
          const orderRequest: OrderRequest = {
            symbol: signal.symbol,
            qty: 1, // This would be calculated based on position sizing and risk management
            side: signal.action,
            type: 'market',
            time_in_force: 'gtc'
          };
          
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
  
  // Log bot start
  await storage.createSystemLog({
    userId,
    level: 'INFO',
    message: `Bot started with ${botSettings.strategy} strategy`
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
            // In a real system, we would connect to Alpaca's websocket here
            // For this implementation, we'll simulate market data
            
            // Log connection
            await storage.createSystemLog({
              userId,
              level: 'INFO',
              message: 'WebSocket connection established'
            });
            
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
      
      // Test the API key
      try {
        const alpaca = getAlpacaClient(
          validatedData.alpacaApiKey, 
          validatedData.alpacaSecretKey, 
          validatedData.environment === 'paper'
        );
        
        await alpaca.getAccount();
      } catch (error) {
        return res.status(400).json({ message: 'Invalid API keys' });
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
      await storage.createSystemLog({
        userId: validatedData.userId,
        level: 'INFO',
        message: `API keys ${existingApiKey ? 'updated' : 'configured'} for ${validatedData.environment} environment`
      });
      
      // Broadcast API key status
      broadcastToUser(validatedData.userId, {
        type: 'apiKeyUpdate',
        data: { hasApiKey: true, environment: validatedData.environment }
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
    
    // Don't return the actual keys, just the environment
    res.json({
      environment: apiKey.environment,
      hasApiKey: true
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
      
      // Submit order to Alpaca
      const alpaca = getAlpacaClient(
        apiKey.alpacaApiKey, 
        apiKey.alpacaSecretKey, 
        apiKey.environment === 'paper'
      );
      
      const order = await alpaca.submitOrder(validatedOrder);
      
      // Log the order
      await storage.createSystemLog({
        userId: parseInt(userId),
        level: 'TRADE',
        message: `Manual ${order.side.toUpperCase()} order submitted: ${order.qty} ${order.symbol} @ ${order.type} price`
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
      
      // Close position
      const alpaca = getAlpacaClient(
        apiKey.alpacaApiKey, 
        apiKey.alpacaSecretKey, 
        apiKey.environment === 'paper'
      );
      
      const result = await alpaca.closePosition(symbol);
      
      // Log the action
      await storage.createSystemLog({
        userId: parseInt(userId),
        level: 'TRADE',
        message: `Position closed: ${symbol}`
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

import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';
import { TradingEnvironment } from './tradingEnvironment';
import { DQNAgent } from './dqnAgent';
import { DataProcessor } from './dataProcessor';
import { AlpacaClient } from '../alpaca';
import { MarketData, StrategySignal, OrderRequest } from '../../shared/schema';

/**
 * ReinforcementLearningTradingStrategy - Implementation of RL trading strategy
 * This class provides a Node.js implementation of the reinforcement learning
 * strategy that's compatible with our existing trading bot structure
 */
export class ReinforcementLearningTradingStrategy {
  private agent: DQNAgent | null = null;
  private env: TradingEnvironment | null = null;
  private symbols: string[];
  private alpacaClient: AlpacaClient | null = null;
  private initialCapital: number;
  private modelSavePath: string;
  private modelLoaded: boolean = false;
  private historicalDataLength: number;
  private technicalIndicators: Record<string, number[][]> = {};
  private lastSignals: Map<string, StrategySignal> = new Map();
  private marketData: Record<string, MarketData[]> = {};
  private isTraining: boolean = false;
  private predictionConfidenceThreshold: number = 0.3;
  private stateSize: number;
  
  /**
   * Constructor
   * @param symbols List of trading symbols to include
   * @param initialCapital Initial capital for simulation
   * @param modelSavePath Path to save/load model
   * @param historicalDataLength Amount of historical data to keep
   */
  constructor(
    symbols: string[],
    initialCapital: number = 10000,
    modelSavePath: string = './models',
    historicalDataLength: number = 100
  ) {
    this.symbols = symbols;
    this.initialCapital = initialCapital;
    this.modelSavePath = modelSavePath;
    this.historicalDataLength = historicalDataLength;
    
    // Each symbol has 8 technical indicators plus price and position
    // Plus 1 for cash position
    this.stateSize = symbols.length * 10 + 1;
    
    // Create directory for model if it doesn't exist
    if (!fs.existsSync(this.modelSavePath)) {
      fs.mkdirSync(this.modelSavePath, { recursive: true });
    }
    
    // Initialize environment
    this.env = new TradingEnvironment(symbols, initialCapital);
    
    // Initialize market data containers
    for (const symbol of symbols) {
      this.marketData[symbol] = [];
      this.technicalIndicators[symbol] = [];
    }
  }
  
  /**
   * Set Alpaca client for API access
   * @param client Alpaca client instance
   */
  public setAlpacaClient(client: AlpacaClient): void {
    this.alpacaClient = client;
  }
  
  /**
   * Initialize the reinforcement learning agent
   */
  private initializeAgent(): void {
    if (!this.env) return;
    
    this.agent = new DQNAgent(
      this.env,
      this.symbols,
      this.stateSize,
      0.95,   // gamma (discount factor)
      0.1,    // epsilon (exploration rate - lower for production)
      0.01,   // epsilonMin
      0.995,  // epsilonDecay
      0.0005, // learningRate
      32,     // batchSize
      200     // updateFrequency
    );
  }
  
  /**
   * Load a pre-trained model if available
   * @returns Promise resolving to boolean indicating success
   */
  public async loadModel(): Promise<boolean> {
    if (!this.agent) {
      this.initializeAgent();
    }
    
    const modelPath = path.join(this.modelSavePath, 'dqn_model_final');
    
    if (fs.existsSync(`${modelPath}.json`)) {
      try {
        await this.agent?.loadModel(modelPath);
        this.modelLoaded = true;
        console.log('Reinforcement learning model loaded successfully');
        return true;
      } catch (error) {
        console.error('Failed to load reinforcement learning model:', error);
      }
    }
    
    console.log('No pre-trained model found, using untrained model');
    return false;
  }
  
  /**
   * Update market data with new data point
   * @param symbol Trading symbol
   * @param data Market data point
   */
  public updateMarketData(symbol: string, data: MarketData): void {
    if (!this.symbols.includes(symbol)) return;
    
    // Add new data point
    this.marketData[symbol].push(data);
    
    // Limit array length
    if (this.marketData[symbol].length > this.historicalDataLength) {
      this.marketData[symbol] = this.marketData[symbol].slice(-this.historicalDataLength);
    }
    
    // Recalculate technical indicators whenever we get new data
    if (this.marketData[symbol].length >= 30) { // Need at least 30 data points for indicators
      this.technicalIndicators[symbol] = DataProcessor.calculateIndicators(this.marketData[symbol], symbol);
    }
  }
  
  /**
   * Generate trading signals based on reinforcement learning model
   * @param symbol Trading symbol
   * @param data Market data points
   * @param historicalData Optional historical data
   * @returns Strategy signal
   */
  public generateSignal(symbol: string, data: MarketData[], historicalData?: MarketData[]): StrategySignal {
    // If we don't have enough data or the model isn't loaded, return hold signal
    if (!this.modelLoaded || !this.agent || !this.env || data.length < 30) {
      return {
        symbol,
        action: 'hold',
        confidence: 0,
        timestamp: Date.now()
      };
    }
    
    try {
      // Update market data
      this.updateMarketData(symbol, data[data.length - 1]);
      
      // Check if we have enough data for all symbols
      for (const sym of this.symbols) {
        if (this.marketData[sym].length < 30) {
          return {
            symbol,
            action: 'hold',
            confidence: 0,
            timestamp: Date.now()
          };
        }
      }
      
      // Create state for the environment
      const state = this.createState();
      
      // Get action from the model
      const actions = this.agent.predict(state);
      
      // Find the action for this symbol
      const symbolIndex = this.symbols.indexOf(symbol);
      const action = actions[symbolIndex];
      
      // Convert to signal
      const signal = this.actionToSignal(symbol, action);
      
      // Store signal
      this.lastSignals.set(symbol, signal);
      
      return signal;
    } catch (error) {
      console.error(`Error generating RL signal for ${symbol}:`, error);
      return {
        symbol,
        action: 'hold',
        confidence: 0,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Convert reinforcement learning action to trading signal
   * @param symbol Trading symbol
   * @param action Action from RL model (-1, 0, 1)
   * @returns Trading signal
   */
  private actionToSignal(symbol: string, action: number): StrategySignal {
    // Map action to signal
    let signalAction: 'buy' | 'sell' | 'hold';
    let confidence: number;
    
    if (action > 0) {
      signalAction = 'buy';
      confidence = action; // Action strength represents confidence
    } else if (action < 0) {
      signalAction = 'sell';
      confidence = Math.abs(action);
    } else {
      signalAction = 'hold';
      confidence = 0.5; // Medium confidence for hold
    }
    
    // Only generate buy/sell signals if confidence exceeds threshold
    if (confidence < this.predictionConfidenceThreshold) {
      signalAction = 'hold';
    }
    
    return {
      symbol,
      action: signalAction,
      confidence,
      timestamp: Date.now()
    };
  }
  
  /**
   * Convert signal to order request
   * @param signal Trading signal
   * @param accountValue Current account value for position sizing
   * @returns Order request object or null if no order needed
   */
  public signalToOrder(signal: StrategySignal, accountValue: number): OrderRequest | null {
    if (signal.action === 'hold' || !this.alpacaClient) {
      return null;
    }
    
    // Simple position sizing based on account value and confidence
    // More sophisticated sizing would be implemented in production
    const positionSize = accountValue * 0.1 * signal.confidence;
    
    // Get latest price
    const marketData = this.marketData[signal.symbol];
    const latestPrice = marketData.length > 0 ? marketData[marketData.length - 1].price : 0;
    
    if (latestPrice <= 0) {
      return null;
    }
    
    // Calculate quantity
    const quantity = positionSize / latestPrice;
    
    // Only create order if quantity is significant
    if (quantity < 0.001) {
      return null;
    }
    
    return {
      symbol: signal.symbol,
      qty: Math.floor(quantity * 1000) / 1000, // Round to 3 decimal places
      side: signal.action,
      type: 'market',
      time_in_force: 'gtc'
    };
  }
  
  /**
   * Create state tensor from current market data
   * @returns Tensor representing the current state
   */
  private createState(): tf.Tensor {
    const stateData: number[] = [];
    
    // For each symbol, add price, indicators, and position
    for (const symbol of this.symbols) {
      const data = this.marketData[symbol];
      if (data.length === 0) continue;
      
      // Add current price
      const currentPrice = data[data.length - 1].price;
      stateData.push(currentPrice);
      
      // Add technical indicators
      const indicators = this.technicalIndicators[symbol];
      if (indicators.length > 0) {
        const latestIndicators = indicators[indicators.length - 1];
        stateData.push(...latestIndicators);
      } else {
        // If no indicators yet, add zeros
        stateData.push(...Array(8).fill(0));
      }
      
      // Add position (0 for now, would be updated in real implementation)
      stateData.push(0);
    }
    
    // Add cash position (normalized to 1.0 as a placeholder)
    stateData.push(1.0);
    
    return tf.tensor1d(stateData);
  }
  
  /**
   * Train the reinforcement learning model
   * @param epochs Number of training epochs
   * @returns Promise resolving once training is complete
   */
  public async trainModel(epochs: number = 50): Promise<void> {
    if (!this.agent || !this.env) {
      this.initializeAgent();
    }
    
    if (this.isTraining) {
      console.log('Model is already training');
      return;
    }
    
    this.isTraining = true;
    
    try {
      console.log(`Starting reinforcement learning training for ${epochs} epochs`);
      
      // Initialize environment with historical data
      const data = { ...this.marketData };
      
      // Prepare technical indicators
      const allIndicators: number[][] = [];
      
      for (const symbol of this.symbols) {
        if (this.technicalIndicators[symbol].length > 0) {
          allIndicators.push(...this.technicalIndicators[symbol]);
        }
      }
      
      if (allIndicators.length === 0) {
        console.error('Not enough data to train model');
        this.isTraining = false;
        return;
      }
      
      // Add data to environment
      this.env?.addMarketData(data, allIndicators);
      
      // Train agent
      await this.agent?.trainAgent(
        epochs,
        500, // Maximum steps per episode
        this.modelSavePath,
        5 // Log interval
      );
      
      this.modelLoaded = true;
      console.log('Reinforcement learning model training completed');
    } catch (error) {
      console.error('Error training reinforcement learning model:', error);
    } finally {
      this.isTraining = false;
    }
  }
  
  /**
   * Get last signal for a symbol
   * @param symbol Trading symbol
   * @returns Last signal or null if none
   */
  public getLastSignal(symbol: string): StrategySignal | null {
    return this.lastSignals.get(symbol) || null;
  }
  
  /**
   * Update the model with reward based on trade outcome
   * @param symbol Symbol traded
   * @param action Action taken
   * @param profitLoss Profit or loss from the trade
   */
  public updateModelWithReward(symbol: string, action: 'buy' | 'sell', profitLoss: number): void {
    // This would be implemented to update the model with real-world performance
    // But is beyond the scope of this initial implementation
    console.log(`Updating model with reward: ${symbol} ${action} ${profitLoss}`);
  }
}
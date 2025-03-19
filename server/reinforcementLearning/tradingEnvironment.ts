import * as tf from '@tensorflow/tfjs-node';
import { MarketData, AlpacaPosition, OrderRequest } from '../../shared/schema';

/**
 * TradingEnvironment - A reinforcement learning environment for crypto trading
 * This environment simulates the FinRL StockTradingEnv but adapted for cryptocurrencies and Node.js
 */
export class TradingEnvironment {
  private priceHistory: number[][];
  private techIndicators: number[][];
  private currentStep: number = 0;
  private currentPositions: Map<string, number> = new Map();
  private initialCapital: number;
  private cash: number;
  private symbols: string[];
  private positionValues: number[] = [];
  private lastPortfolioValue: number;
  private transactionCost: number;
  private rewardScaling: number;
  private maxSteps: number;
  
  /**
   * Constructor for TradingEnvironment
   * @param symbols List of cryptocurrency symbols
   * @param initialCapital Starting capital
   * @param transactionCost Cost as a percentage for transactions
   * @param rewardScaling Factor to scale rewards
   */
  constructor(
    symbols: string[],
    initialCapital: number = 10000,
    transactionCost: number = 0.0001, // 0.01% transaction cost
    rewardScaling: number = 1.0
  ) {
    this.symbols = symbols;
    this.initialCapital = initialCapital;
    this.cash = initialCapital;
    this.lastPortfolioValue = initialCapital;
    this.transactionCost = transactionCost;
    this.rewardScaling = rewardScaling;
    this.priceHistory = [];
    this.techIndicators = [];
    this.maxSteps = 0;
    
    // Initialize position for each symbol
    for (const symbol of symbols) {
      this.currentPositions.set(symbol, 0);
    }
  }
  
  /**
   * Add market data to the environment
   * @param marketData Historical market data for training
   * @param technicalIndicators Technical indicator data
   */
  public addMarketData(marketData: Record<string, MarketData[]>, technicalIndicators: number[][]): void {
    // Process price history
    this.priceHistory = this.symbols.map(symbol => {
      const data = marketData[symbol] || [];
      return data.map(d => d.price);
    });
    
    // Add technical indicators
    this.techIndicators = technicalIndicators;
    
    // Set max steps based on data length
    if (this.priceHistory.length > 0 && this.priceHistory[0].length > 0) {
      this.maxSteps = this.priceHistory[0].length - 1;
    }
    
    // Normalize the data
    this.normalizeData();
  }
  
  /**
   * Normalize price and indicator data
   */
  private normalizeData(): void {
    // Normalize using simple min-max scaling for each array
    for (let i = 0; i < this.priceHistory.length; i++) {
      const prices = this.priceHistory[i];
      if (prices.length === 0) continue;
      
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = max - min;
      
      if (range === 0) continue;
      
      this.priceHistory[i] = prices.map(price => (price - min) / range);
    }
    
    // Normalize technical indicators (simplified)
    if (this.techIndicators.length > 0) {
      const allValues = this.techIndicators.flat();
      if (allValues.length > 0) {
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const range = max - min;
        
        if (range > 0) {
          this.techIndicators = this.techIndicators.map(row => 
            row.map(value => (value - min) / range)
          );
        }
      }
    }
  }
  
  /**
   * Reset the environment to initial state
   * @returns Initial state observation
   */
  public reset(): tf.Tensor {
    this.currentStep = 0;
    this.cash = this.initialCapital;
    this.lastPortfolioValue = this.initialCapital;
    
    // Reset positions
    for (const symbol of this.symbols) {
      this.currentPositions.set(symbol, 0);
    }
    
    // Update position values
    this.positionValues = this.symbols.map(symbol => {
      const position = this.currentPositions.get(symbol) || 0;
      const price = this.getCurrentPrice(symbol);
      return position * price;
    });
    
    return this.getObservation();
  }
  
  /**
   * Step function that processes actions and returns new state, reward, done flag
   * @param actions Array of actions for each symbol (buy/hold/sell)
   * @returns Tuple of [new observation, reward, done flag]
   */
  public step(actions: number[]): [tf.Tensor, number, boolean] {
    if (this.currentStep >= this.maxSteps) {
      return [this.getObservation(), 0, true];
    }
    
    // Process actions for each symbol
    const costs: number[] = [];
    
    this.symbols.forEach((symbol, index) => {
      const action = actions[index];
      const currentPrice = this.getCurrentPrice(symbol);
      let currentPosition = this.currentPositions.get(symbol) || 0;
      
      // Determine the position change
      let positionChange = 0;
      
      // Action > 0 means buy, action < 0 means sell
      if (action > 0 && this.cash > 0) {
        // Buy action - use 5% of available cash
        const cashToSpend = this.cash * 0.05 * action;
        positionChange = cashToSpend / currentPrice;
        
        // Calculate transaction cost
        const cost = cashToSpend * this.transactionCost;
        costs.push(cost);
        
        // Update cash and position
        this.cash -= (cashToSpend + cost);
        currentPosition += positionChange;
      } else if (action < 0 && currentPosition > 0) {
        // Sell action - sell a percentage of current position
        positionChange = -currentPosition * Math.abs(action) * 0.05;
        
        // Calculate transaction cost and proceeds
        const proceeds = -positionChange * currentPrice;
        const cost = proceeds * this.transactionCost;
        costs.push(cost);
        
        // Update cash and position
        this.cash += (proceeds - cost);
        currentPosition += positionChange;
      }
      
      // Update position
      this.currentPositions.set(symbol, currentPosition);
    });
    
    // Move to next step
    this.currentStep++;
    
    // Calculate new portfolio value
    const newPortfolioValue = this.getPortfolioValue();
    
    // Calculate reward: % change in portfolio value
    const reward = ((newPortfolioValue - this.lastPortfolioValue) / this.lastPortfolioValue) * this.rewardScaling;
    
    // Apply transaction cost penalty
    const costPenalty = costs.reduce((sum, cost) => sum + cost, 0) * 0.1;
    const finalReward = reward - costPenalty;
    
    // Update last portfolio value
    this.lastPortfolioValue = newPortfolioValue;
    
    // Done if we've reached the end of data
    const done = this.currentStep >= this.maxSteps;
    
    return [this.getObservation(), finalReward, done];
  }
  
  /**
   * Get the current price of a symbol
   * @param symbol Trading symbol
   * @returns Current price
   */
  private getCurrentPrice(symbol: string): number {
    const symbolIndex = this.symbols.indexOf(symbol);
    if (symbolIndex === -1 || !this.priceHistory[symbolIndex]) return 0;
    
    // Get price at current step
    return this.priceHistory[symbolIndex][this.currentStep] || 0;
  }
  
  /**
   * Calculate current portfolio value
   * @returns Total portfolio value (cash + positions)
   */
  public getPortfolioValue(): number {
    let positionValue = 0;
    
    for (const symbol of this.symbols) {
      const position = this.currentPositions.get(symbol) || 0;
      const price = this.getCurrentPrice(symbol);
      positionValue += position * price;
    }
    
    return this.cash + positionValue;
  }
  
  /**
   * Get the current state observation for the agent
   * @returns Tensor representing the current state
   */
  private getObservation(): tf.Tensor {
    const stateData: number[] = [];
    
    // Cash position (normalized)
    stateData.push(this.cash / this.initialCapital);
    
    // Position information for each symbol
    for (let i = 0; i < this.symbols.length; i++) {
      const symbol = this.symbols[i];
      const position = this.currentPositions.get(symbol) || 0;
      const price = this.getCurrentPrice(symbol);
      
      // Add current price
      stateData.push(price);
      
      // Add position (normalized by initial capital)
      stateData.push(position * price / this.initialCapital);
      
      // Add technical indicators for this symbol at current step
      if (this.techIndicators.length > this.currentStep) {
        const indicators = this.techIndicators[this.currentStep];
        stateData.push(...indicators);
      }
    }
    
    return tf.tensor1d(stateData);
  }
  
  /**
   * Get current positions as Alpaca position objects
   * @returns Array of position objects
   */
  public getPositions(): AlpacaPosition[] {
    return this.symbols.map(symbol => {
      const position = this.currentPositions.get(symbol) || 0;
      const price = this.getCurrentPrice(symbol);
      const marketValue = position * price;
      
      return {
        asset_id: symbol,
        symbol: symbol,
        qty: position.toString(),
        avg_entry_price: '0', // Not tracking entry price in simple env
        market_value: marketValue.toString(),
        current_price: price.toString(),
        unrealized_pl: '0', // Not tracking PL in simple env
        unrealized_plpc: '0', // Not tracking PL % in simple env
        side: position > 0 ? 'long' : 'short'
      };
    });
  }
  
  /**
   * Generate an order request based on the model's action
   * @param symbol Trading symbol
   * @param action Model action value
   * @returns OrderRequest object
   */
  public actionToOrder(symbol: string, action: number): OrderRequest | null {
    if (action === 0) return null; // No action
    
    const side = action > 0 ? 'buy' : 'sell';
    const position = this.currentPositions.get(symbol) || 0;
    
    // Only sell if we have a position
    if (side === 'sell' && position <= 0) return null;
    
    // Calculate quantity based on action strength
    const price = this.getCurrentPrice(symbol);
    let qty: number;
    
    if (side === 'buy') {
      // Use 5% of available cash * action strength
      const cashToUse = this.cash * 0.05 * Math.abs(action);
      qty = cashToUse / price;
    } else {
      // Sell 5% of current position * action strength
      qty = position * 0.05 * Math.abs(action);
    }
    
    if (qty <= 0) return null;
    
    return {
      symbol,
      qty: Math.min(qty, 1000), // Cap quantity at 1000 for simulation
      side: side as 'buy' | 'sell',
      type: 'market',
      time_in_force: 'day'
    };
  }
}
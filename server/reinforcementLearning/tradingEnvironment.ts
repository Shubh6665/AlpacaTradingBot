import * as tf from '@tensorflow/tfjs-node';
import { MarketData, TradingStrategy, AlpacaPosition, OrderRequest } from '../../shared/schema';

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
    transactionCost: number = 0.001,
    rewardScaling: number = 1e-4
  ) {
    this.symbols = symbols;
    this.initialCapital = initialCapital;
    this.cash = initialCapital;
    this.transactionCost = transactionCost;
    this.rewardScaling = rewardScaling;
    this.priceHistory = [];
    this.techIndicators = [];
    this.maxSteps = 0;
    this.lastPortfolioValue = initialCapital;
    
    // Initialize positions with zero for each symbol
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
    // Process and normalize price history data
    const priceData: number[][] = [];
    
    // Assuming all symbols have the same number of data points
    const dataPoints = marketData[this.symbols[0]].length;
    this.maxSteps = dataPoints;
    
    // Organize by timestamp first
    for (let i = 0; i < dataPoints; i++) {
      const prices: number[] = [];
      for (const symbol of this.symbols) {
        prices.push(marketData[symbol][i].price);
      }
      priceData.push(prices);
    }
    
    this.priceHistory = priceData;
    this.techIndicators = technicalIndicators;
    
    // Normalize the data
    this.normalizeData();
  }

  /**
   * Normalize price and indicator data
   */
  private normalizeData(): void {
    // Normalize price data to make it suitable for the neural network
    const prices = tf.tensor2d(this.priceHistory);
    const meanPrices = prices.mean(0);
    const stdPrices = prices.sub(meanPrices).square().mean(0).sqrt();
    
    // Apply normalization
    const normalizedPrices = prices.sub(meanPrices).div(stdPrices);
    this.priceHistory = normalizedPrices.arraySync() as number[][];
    
    // Normalize technical indicators if they exist
    if (this.techIndicators.length > 0) {
      const indicators = tf.tensor2d(this.techIndicators);
      const meanIndicators = indicators.mean(0);
      const stdIndicators = indicators.sub(meanIndicators).square().mean(0).sqrt();
      
      // Apply normalization with small epsilon to avoid division by zero
      const epsilon = 1e-8;
      const normalizedIndicators = indicators.sub(meanIndicators).div(stdIndicators.add(epsilon));
      this.techIndicators = normalizedIndicators.arraySync() as number[][];
    }
  }

  /**
   * Reset the environment to initial state
   * @returns Initial state observation
   */
  public reset(): tf.Tensor {
    this.currentStep = 0;
    this.cash = this.initialCapital;
    this.positionValues = Array(this.symbols.length).fill(0);
    this.lastPortfolioValue = this.initialCapital;
    
    // Reset positions
    for (const symbol of this.symbols) {
      this.currentPositions.set(symbol, 0);
    }
    
    return this.getObservation();
  }

  /**
   * Step function that processes actions and returns new state, reward, done flag
   * @param actions Array of actions for each symbol (buy/hold/sell)
   * @returns Tuple of [new observation, reward, done flag]
   */
  public step(actions: number[]): [tf.Tensor, number, boolean] {
    const done = this.currentStep >= this.maxSteps - 1;
    
    // Apply actions (buy/hold/sell) for each symbol
    for (let i = 0; i < this.symbols.length; i++) {
      const symbol = this.symbols[i];
      const action = actions[i]; // -1 (sell), 0 (hold), 1 (buy)
      const currentPrice = this.getCurrentPrice(symbol);
      const currentPosition = this.currentPositions.get(symbol) || 0;
      
      if (action > 0 && this.cash > 0) { // Buy
        // Calculate how much to buy based on the action strength and available cash
        const buyAmount = Math.min(this.cash * Math.abs(action), this.cash);
        const quantity = buyAmount / currentPrice;
        const cost = buyAmount * (1 + this.transactionCost);
        
        // Update position and cash
        this.currentPositions.set(symbol, currentPosition + quantity);
        this.cash -= cost;
      } 
      else if (action < 0 && currentPosition > 0) { // Sell
        // Calculate how much to sell based on the action strength
        const sellRatio = Math.abs(action);
        const sellQuantity = currentPosition * sellRatio;
        const sellValue = sellQuantity * currentPrice;
        const proceeds = sellValue * (1 - this.transactionCost);
        
        // Update position and cash
        this.currentPositions.set(symbol, currentPosition - sellQuantity);
        this.cash += proceeds;
      }
      // If action is 0, hold the current position
    }
    
    // Move to next time step
    this.currentStep++;
    
    // Calculate reward (change in portfolio value)
    const newPortfolioValue = this.getPortfolioValue();
    const reward = ((newPortfolioValue - this.lastPortfolioValue) / this.lastPortfolioValue) * this.rewardScaling;
    this.lastPortfolioValue = newPortfolioValue;
    
    return [this.getObservation(), reward, done];
  }

  /**
   * Get the current price of a symbol
   * @param symbol Trading symbol
   * @returns Current price
   */
  private getCurrentPrice(symbol: string): number {
    const index = this.symbols.indexOf(symbol);
    return this.priceHistory[this.currentStep][index];
  }

  /**
   * Calculate current portfolio value
   * @returns Total portfolio value (cash + positions)
   */
  public getPortfolioValue(): number {
    let totalPositionValue = 0;
    
    for (const symbol of this.symbols) {
      const quantity = this.currentPositions.get(symbol) || 0;
      const price = this.getCurrentPrice(symbol);
      totalPositionValue += quantity * price;
    }
    
    return this.cash + totalPositionValue;
  }

  /**
   * Get the current state observation for the agent
   * @returns Tensor representing the current state
   */
  private getObservation(): tf.Tensor {
    // Create state representation: current price, indicators, current positions, cash
    const priceData = this.priceHistory[this.currentStep];
    
    // Get technical indicators for the current step if available
    const indicatorData = this.techIndicators.length > 0 
      ? this.techIndicators[this.currentStep] 
      : [];
    
    // Get normalized position values and cash
    const positions = this.symbols.map(symbol => this.currentPositions.get(symbol) || 0);
    const normalizedCash = [this.cash / this.initialCapital];
    
    // Combine all data for the state observation
    const stateData = [
      ...priceData,
      ...indicatorData,
      ...positions,
      ...normalizedCash
    ];
    
    return tf.tensor1d(stateData);
  }

  /**
   * Get current positions as Alpaca position objects
   * @returns Array of position objects
   */
  public getPositions(): AlpacaPosition[] {
    return this.symbols.map(symbol => {
      const quantity = this.currentPositions.get(symbol) || 0;
      const price = this.getCurrentPrice(symbol);
      const marketValue = quantity * price;
      
      return {
        asset_id: symbol,
        symbol: symbol,
        qty: quantity.toString(),
        avg_entry_price: price.toString(),
        market_value: marketValue.toString(),
        current_price: price.toString(),
        unrealized_pl: "0", // Not calculated in the simulation
        unrealized_plpc: "0", // Not calculated in the simulation
        side: quantity > 0 ? 'long' : 'short',
      };
    }).filter(position => parseFloat(position.qty) > 0);
  }

  /**
   * Generate an order request based on the model's action
   * @param symbol Trading symbol
   * @param action Model action value
   * @returns OrderRequest object
   */
  public actionToOrder(symbol: string, action: number): OrderRequest | null {
    if (action === 0) return null; // Hold action, no order needed
    
    const side = action > 0 ? 'buy' : 'sell';
    const currentPrice = this.getCurrentPrice(symbol);
    
    // Calculate quantity based on action strength and available resources
    let quantity = 0;
    if (side === 'buy') {
      const buyPower = this.cash * Math.abs(action);
      quantity = buyPower / currentPrice;
    } else {
      const currentPosition = this.currentPositions.get(symbol) || 0;
      quantity = currentPosition * Math.abs(action);
    }
    
    // Only create an order if the quantity is significant
    if (quantity < 0.001) return null;
    
    return {
      symbol,
      qty: Math.floor(quantity * 1000) / 1000, // Round to 3 decimal places
      side,
      type: 'market',
      time_in_force: 'gtc'
    };
  }
}
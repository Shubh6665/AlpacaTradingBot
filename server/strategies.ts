import { MarketData, StrategySignal } from "@shared/schema";

export type StrategyType = 'mean_reversion' | 'momentum' | 'ppo' | 'reinforcement';

// Base strategy interface
export interface TradingStrategy {
  type: StrategyType;
  analyze(symbol: string, data: MarketData[], historicalData?: MarketData[]): StrategySignal;
  getParameters(): Record<string, any>;
  setParameters(params: Record<string, any>): void;
  getName(): string;
  getDescription(): string;
}

// Mean Reversion Strategy
export class MeanReversionStrategy implements TradingStrategy {
  type: StrategyType = 'mean_reversion';
  private lookbackPeriod: number;
  private standardDeviations: number;
  private trendFilter: boolean;
  
  constructor(lookbackPeriod: number = 14, standardDeviations: number = 2.0, trendFilter: boolean = true) {
    this.lookbackPeriod = lookbackPeriod;
    this.standardDeviations = standardDeviations;
    this.trendFilter = trendFilter;
  }
  
  analyze(symbol: string, data: MarketData[], historicalData?: MarketData[]): StrategySignal {
    if (!historicalData || historicalData.length < this.lookbackPeriod) {
      return {
        symbol,
        action: 'hold',
        confidence: 0,
        timestamp: Date.now()
      };
    }
    
    // Calculate mean and standard deviation
    const prices = historicalData.map(d => d.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Current price
    const currentPrice = data[data.length - 1].price;
    
    // Calculate upper and lower bounds
    const upperBound = mean + (this.standardDeviations * stdDev);
    const lowerBound = mean - (this.standardDeviations * stdDev);
    
    // Check if price is outside the bands
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;
    
    if (currentPrice < lowerBound) {
      // Price is below lower band - potential buy signal
      action = 'buy';
      confidence = Math.min(Math.abs((currentPrice - lowerBound) / (mean - lowerBound)), 1) * 100;
    } else if (currentPrice > upperBound) {
      // Price is above upper band - potential sell signal
      action = 'sell';
      confidence = Math.min(Math.abs((currentPrice - upperBound) / (upperBound - mean)), 1) * 100;
    }
    
    // Apply trend filter if enabled
    if (this.trendFilter && action !== 'hold') {
      // Check last 3 periods for trend
      const recentPrices = prices.slice(-3);
      const isUptrend = recentPrices[2] > recentPrices[0];
      
      // Only buy in uptrends and sell in downtrends
      if ((action === 'buy' && !isUptrend) || (action === 'sell' && isUptrend)) {
        action = 'hold';
        confidence = 0;
      }
    }
    
    return {
      symbol,
      action,
      confidence,
      timestamp: Date.now()
    };
  }
  
  getParameters(): Record<string, any> {
    return {
      lookbackPeriod: this.lookbackPeriod,
      standardDeviations: this.standardDeviations,
      trendFilter: this.trendFilter
    };
  }
  
  setParameters(params: Record<string, any>): void {
    if (params.lookbackPeriod !== undefined) this.lookbackPeriod = params.lookbackPeriod;
    if (params.standardDeviations !== undefined) this.standardDeviations = params.standardDeviations;
    if (params.trendFilter !== undefined) this.trendFilter = params.trendFilter;
  }
  
  getName(): string {
    return 'Mean Reversion';
  }
  
  getDescription(): string {
    return 'Trading based on the principle that asset prices tend to revert to their historical mean over time.';
  }
}

// Momentum Strategy
export class MomentumStrategy implements TradingStrategy {
  type: StrategyType = 'momentum';
  private lookbackPeriod: number;
  private threshold: number;
  
  constructor(lookbackPeriod: number = 10, threshold: number = 0.03) {
    this.lookbackPeriod = lookbackPeriod;
    this.threshold = threshold;
  }
  
  analyze(symbol: string, data: MarketData[], historicalData?: MarketData[]): StrategySignal {
    if (!historicalData || historicalData.length < this.lookbackPeriod) {
      return {
        symbol,
        action: 'hold',
        confidence: 0,
        timestamp: Date.now()
      };
    }
    
    // Calculate momentum: current price compared to price lookbackPeriod ago
    const currentPrice = data[data.length - 1].price;
    const pastPrice = historicalData[historicalData.length - this.lookbackPeriod].price;
    const momentumChange = (currentPrice - pastPrice) / pastPrice;
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;
    
    if (momentumChange > this.threshold) {
      // Strong upward momentum - buy signal
      action = 'buy';
      confidence = Math.min(momentumChange / (this.threshold * 2), 1) * 100;
    } else if (momentumChange < -this.threshold) {
      // Strong downward momentum - sell signal
      action = 'sell';
      confidence = Math.min(Math.abs(momentumChange) / (this.threshold * 2), 1) * 100;
    }
    
    return {
      symbol,
      action,
      confidence,
      timestamp: Date.now()
    };
  }
  
  getParameters(): Record<string, any> {
    return {
      lookbackPeriod: this.lookbackPeriod,
      threshold: this.threshold
    };
  }
  
  setParameters(params: Record<string, any>): void {
    if (params.lookbackPeriod !== undefined) this.lookbackPeriod = params.lookbackPeriod;
    if (params.threshold !== undefined) this.threshold = params.threshold;
  }
  
  getName(): string {
    return 'Momentum';
  }
  
  getDescription(): string {
    return 'Strategy that capitalizes on the continuation of existing market trends.';
  }
}

// PPO (Percentage Price Oscillator) Strategy
export class PPOStrategy implements TradingStrategy {
  type: StrategyType = 'ppo';
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;
  private buyThreshold: number;
  private sellThreshold: number;
  
  constructor(
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9,
    buyThreshold: number = 0.2,
    sellThreshold: number = -0.2
  ) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.signalPeriod = signalPeriod;
    this.buyThreshold = buyThreshold;
    this.sellThreshold = sellThreshold;
  }
  
  // Exponential Moving Average
  private calculateEMA(prices: number[], period: number): number[] {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for the first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    
    ema.push(sum / period);
    
    // Calculate EMA for remaining periods
    for (let i = period; i < prices.length; i++) {
      ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
    
    return ema;
  }
  
  analyze(symbol: string, data: MarketData[], historicalData?: MarketData[]): StrategySignal {
    const requiredDataPoints = Math.max(this.fastPeriod, this.slowPeriod, this.signalPeriod) * 2;
    
    if (!historicalData || historicalData.length < requiredDataPoints) {
      return {
        symbol,
        action: 'hold',
        confidence: 0,
        timestamp: Date.now()
      };
    }
    
    // Extract prices from historical data
    const prices = [...historicalData.map(d => d.price), ...data.map(d => d.price)];
    
    // Calculate EMAs
    const fastEMA = this.calculateEMA(prices, this.fastPeriod);
    const slowEMA = this.calculateEMA(prices, this.slowPeriod);
    
    // Calculate PPO line: (fastEMA - slowEMA) / slowEMA * 100
    const ppoLine = [];
    for (let i = 0; i < fastEMA.length && i < slowEMA.length; i++) {
      ppoLine.push(((fastEMA[i] - slowEMA[i]) / slowEMA[i]) * 100);
    }
    
    // Calculate signal line (EMA of PPO line)
    const signalLine = this.calculateEMA(ppoLine, this.signalPeriod);
    
    // Calculate histogram (PPO line - signal line)
    const histogram = [];
    for (let i = 0; i < ppoLine.length && i < signalLine.length; i++) {
      histogram.push(ppoLine[i] - signalLine[i]);
    }
    
    // Get the last values
    const lastHistogram = histogram[histogram.length - 1];
    const prevHistogram = histogram[histogram.length - 2];
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;
    
    // Signal logic
    if (lastHistogram > this.buyThreshold && prevHistogram <= this.buyThreshold) {
      // Histogram crossed above threshold - buy signal
      action = 'buy';
      confidence = Math.min(lastHistogram / (this.buyThreshold * 2), 1) * 100;
    } else if (lastHistogram < this.sellThreshold && prevHistogram >= this.sellThreshold) {
      // Histogram crossed below threshold - sell signal
      action = 'sell';
      confidence = Math.min(Math.abs(lastHistogram) / (Math.abs(this.sellThreshold) * 2), 1) * 100;
    }
    
    return {
      symbol,
      action,
      confidence,
      timestamp: Date.now()
    };
  }
  
  getParameters(): Record<string, any> {
    return {
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      buyThreshold: this.buyThreshold,
      sellThreshold: this.sellThreshold
    };
  }
  
  setParameters(params: Record<string, any>): void {
    if (params.fastPeriod !== undefined) this.fastPeriod = params.fastPeriod;
    if (params.slowPeriod !== undefined) this.slowPeriod = params.slowPeriod;
    if (params.signalPeriod !== undefined) this.signalPeriod = params.signalPeriod;
    if (params.buyThreshold !== undefined) this.buyThreshold = params.buyThreshold;
    if (params.sellThreshold !== undefined) this.sellThreshold = params.sellThreshold;
  }
  
  getName(): string {
    return 'PPO (Percentage Price Oscillator)';
  }
  
  getDescription(): string {
    return 'Uses the difference between fast and slow exponential moving averages to identify market momentum.';
  }
}

// Reinforcement Learning Strategy (simplified implementation - in a real system, this would use a trained model)
export class ReinforcementLearningStrategy implements TradingStrategy {
  type: StrategyType = 'reinforcement';
  
  analyze(symbol: string, data: MarketData[], historicalData?: MarketData[]): StrategySignal {
    // This is a simplified placeholder. In a real RL system, this would use a trained model
    // that would take the current state and predict the best action.
    
    // For this implementation, we'll use a simple logic based on recent price movements
    if (!data || data.length < 2) {
      return {
        symbol,
        action: 'hold',
        confidence: 0,
        timestamp: Date.now()
      };
    }
    
    const lastPrice = data[data.length - 1].price;
    const previousPrice = data[data.length - 2].price;
    const priceChange = (lastPrice - previousPrice) / previousPrice;
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 50; // Middle confidence for RL strategy since it's simplified
    
    if (priceChange > 0.01) {
      action = 'buy';
    } else if (priceChange < -0.01) {
      action = 'sell';
    }
    
    return {
      symbol,
      action,
      confidence,
      timestamp: Date.now()
    };
  }
  
  getParameters(): Record<string, any> {
    return {
      // In a real RL system, this might return hyperparameters or model configuration
      modelType: 'simplified'
    };
  }
  
  setParameters(_params: Record<string, any>): void {
    // No parameters to set in this simplified implementation
  }
  
  getName(): string {
    return 'Reinforcement Learning';
  }
  
  getDescription(): string {
    return 'Uses machine learning to learn optimal trading strategies through interaction with the market.';
  }
}

// Strategy factory to create strategies by type
export function createStrategy(type: StrategyType): TradingStrategy {
  switch (type) {
    case 'mean_reversion':
      return new MeanReversionStrategy();
    case 'momentum':
      return new MomentumStrategy();
    case 'ppo':
      return new PPOStrategy();
    case 'reinforcement':
      return new ReinforcementLearningStrategy();
    default:
      return new MeanReversionStrategy();
  }
}

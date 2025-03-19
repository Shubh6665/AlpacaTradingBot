import * as tf from '@tensorflow/tfjs-node';
import * as dfd from 'danfojs-node';
import { MarketData } from '../../shared/schema';

/**
 * DataProcessor - Processing market data for reinforcement learning
 * Inspired by the FinRL data processor but adapted for cryptocurrencies and Node.js
 */
export class DataProcessor {
  /**
   * Calculate technical indicators from price data
   * @param marketData Historical market data
   * @param symbol Trading symbol
   * @returns Processed data with indicators
   */
  public static calculateIndicators(marketData: MarketData[], symbol: string): any[][] {
    // Convert to DataFrame for easier manipulation
    const data = {
      timestamp: marketData.map(d => d.timestamp),
      price: marketData.map(d => d.price),
      change: marketData.map(d => d.change),
      changePercent: marketData.map(d => d.changePercent)
    };
    
    const df = new dfd.DataFrame(data);
    
    // Add SMA indicators
    const sma5 = this.calculateSMA(df.column('price').values as number[], 5);
    const sma10 = this.calculateSMA(df.column('price').values as number[], 10);
    const sma20 = this.calculateSMA(df.column('price').values as number[], 20);
    
    // Add RSI indicator
    const rsi14 = this.calculateRSI(df.column('price').values as number[], 14);
    
    // Add MACD indicators
    const macdData = this.calculateMACD(df.column('price').values as number[]);
    
    // Add Bollinger Bands
    const bollinger = this.calculateBollingerBands(df.column('price').values as number[], 20, 2);
    
    // Combine indicators into a single array
    const indicators: number[][] = [];
    for (let i = 0; i < marketData.length; i++) {
      // Skip rows where we don't have all indicators yet (due to lookback periods)
      if (i < 20) {
        indicators.push([0, 0, 0, 0, 0, 0, 0, 0]);
        continue;
      }
      
      const row = [
        sma5[i] || 0,
        sma10[i] || 0,
        sma20[i] || 0,
        rsi14[i] || 50,  // Default RSI value
        macdData.macd[i] || 0,
        macdData.signal[i] || 0,
        bollinger.upper[i] || 0,
        bollinger.lower[i] || 0
      ];
      
      indicators[i] = row;
    }
    
    return indicators;
  }
  
  /**
   * Calculate Simple Moving Average
   * @param prices Array of price values
   * @param window Window size
   * @returns Array of SMA values
   */
  private static calculateSMA(prices: number[], window: number): number[] {
    const result: number[] = Array(prices.length).fill(0);
    
    for (let i = window - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += prices[i - j];
      }
      result[i] = sum / window;
    }
    
    return result;
  }
  
  /**
   * Calculate Relative Strength Index
   * @param prices Array of price values
   * @param window Window size
   * @returns Array of RSI values
   */
  private static calculateRSI(prices: number[], window: number): number[] {
    const result: number[] = Array(prices.length).fill(0);
    const gains: number[] = Array(prices.length).fill(0);
    const losses: number[] = Array(prices.length).fill(0);
    
    // Calculate gains and losses
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains[i] = change > 0 ? change : 0;
      losses[i] = change < 0 ? -change : 0;
    }
    
    // Calculate RSI
    for (let i = window; i < prices.length; i++) {
      const avgGain = gains.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0) / window;
      const avgLoss = losses.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0) / window;
      
      if (avgLoss === 0) {
        result[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }
    
    return result;
  }
  
  /**
   * Calculate Moving Average Convergence Divergence
   * @param prices Array of price values
   * @param fastPeriod Fast period (default: 12)
   * @param slowPeriod Slow period (default: 26)
   * @param signalPeriod Signal period (default: 9)
   * @returns Object containing MACD, signal, and histogram arrays
   */
  private static calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macd: number[]; signal: number[]; histogram: number[] } {
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    
    const macd: number[] = Array(prices.length).fill(0);
    
    // Calculate MACD line
    for (let i = slowPeriod - 1; i < prices.length; i++) {
      macd[i] = emaFast[i] - emaSlow[i];
    }
    
    // Calculate signal line (EMA of MACD)
    const signal = this.calculateEMA(macd, signalPeriod);
    
    // Calculate histogram
    const histogram = macd.map((value, i) => value - signal[i]);
    
    return { macd, signal, histogram };
  }
  
  /**
   * Calculate Exponential Moving Average
   * @param prices Array of price values
   * @param window Window size
   * @returns Array of EMA values
   */
  private static calculateEMA(prices: number[], window: number): number[] {
    const result: number[] = Array(prices.length).fill(0);
    const k = 2 / (window + 1);
    
    // Initialize EMA with SMA
    let sum = 0;
    for (let i = 0; i < window; i++) {
      sum += prices[i];
    }
    result[window - 1] = sum / window;
    
    // Calculate EMA
    for (let i = window; i < prices.length; i++) {
      result[i] = prices[i] * k + result[i - 1] * (1 - k);
    }
    
    return result;
  }
  
  /**
   * Calculate Bollinger Bands
   * @param prices Array of price values
   * @param window Window size (default: 20)
   * @param numStd Number of standard deviations (default: 2)
   * @returns Object containing middle, upper, and lower band arrays
   */
  private static calculateBollingerBands(
    prices: number[],
    window: number = 20,
    numStd: number = 2
  ): { middle: number[]; upper: number[]; lower: number[] } {
    const middle = this.calculateSMA(prices, window);
    const upper: number[] = Array(prices.length).fill(0);
    const lower: number[] = Array(prices.length).fill(0);
    
    for (let i = window - 1; i < prices.length; i++) {
      const windowSlice = prices.slice(i - window + 1, i + 1);
      const sum = windowSlice.reduce((a, b) => a + b, 0);
      const mean = sum / window;
      
      // Calculate standard deviation
      const squaredDiffs = windowSlice.map(price => Math.pow(price - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / window;
      const std = Math.sqrt(variance);
      
      upper[i] = middle[i] + numStd * std;
      lower[i] = middle[i] - numStd * std;
    }
    
    return { middle, upper, lower };
  }
  
  /**
   * Process market data for multiple symbols
   * @param marketDataMap Map of symbol to market data array
   * @returns Object with processed price and indicator arrays
   */
  public static processMarketData(marketDataMap: Record<string, MarketData[]>): {
    priceArrays: Record<string, number[]>;
    indicators: Record<string, number[][]>;
  } {
    const priceArrays: Record<string, number[]> = {};
    const indicators: Record<string, number[][]> = {};
    
    for (const [symbol, data] of Object.entries(marketDataMap)) {
      // Extract price data
      priceArrays[symbol] = data.map(d => d.price);
      
      // Calculate technical indicators
      indicators[symbol] = this.calculateIndicators(data, symbol);
    }
    
    return { priceArrays, indicators };
  }
  
  /**
   * Fetch historical market data from Alpaca API
   * This is a placeholder for the actual implementation
   * @param symbol Trading symbol
   * @param start Start date
   * @param end End date
   * @param timeframe Timeframe
   * @returns Promise resolving to market data array
   */
  public static async fetchHistoricalData(
    symbol: string,
    start: Date,
    end: Date,
    timeframe: string
  ): Promise<MarketData[]> {
    // This would be replaced with actual API calls to Alpaca
    // For now, it's a placeholder
    console.log(`Fetching historical data for ${symbol} from ${start} to ${end} with timeframe ${timeframe}`);
    
    // Return empty array for now
    return [];
  }
}
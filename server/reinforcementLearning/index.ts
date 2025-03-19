import { TradingEnvironment } from './tradingEnvironment';
import { DQNAgent } from './dqnAgent';
import { DataProcessor } from './dataProcessor';
import { ReinforcementLearningTradingStrategy } from './reinforcementLearningStrategy';

export {
  TradingEnvironment,
  DQNAgent,
  DataProcessor,
  ReinforcementLearningTradingStrategy
};

// Singleton instance for the application
let rlStrategy: ReinforcementLearningTradingStrategy | null = null;

/**
 * Initialize and get the singleton RL strategy instance
 * @param symbols Trading symbols
 * @param initialCapital Initial capital
 * @returns RL strategy instance
 */
export function getReinforcementLearningStrategy(
  symbols: string[] = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'AVAXUSD'],
  initialCapital: number = 10000
): ReinforcementLearningTradingStrategy {
  if (!rlStrategy) {
    // Create models directory inside the root directory
    const modelSavePath = './models';
    
    // Create strategy instance
    rlStrategy = new ReinforcementLearningTradingStrategy(
      symbols,
      initialCapital,
      modelSavePath,
      100 // historical data length
    );
    
    // Load model asynchronously
    rlStrategy.loadModel().catch(err => {
      console.error('Failed to load reinforcement learning model:', err);
    });
  }
  
  return rlStrategy;
}
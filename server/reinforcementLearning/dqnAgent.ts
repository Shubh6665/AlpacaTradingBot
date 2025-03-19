import * as tf from '@tensorflow/tfjs-node';
import { TradingEnvironment } from './tradingEnvironment';

/**
 * ReplayBuffer - Stores experience tuples for training
 */
class ReplayBuffer {
  private buffer: Array<{
    state: tf.Tensor;
    action: number[];
    reward: number;
    nextState: tf.Tensor;
    done: boolean;
  }>;
  private maxSize: number;
  
  constructor(maxSize: number = 10000) {
    this.buffer = [];
    this.maxSize = maxSize;
  }
  
  add(state: tf.Tensor, action: number[], reward: number, nextState: tf.Tensor, done: boolean): void {
    const experience = {
      state: state.clone(),
      action,
      reward,
      nextState: nextState.clone(),
      done
    };
    
    this.buffer.push(experience);
    
    // If buffer exceeds max size, remove oldest experiences
    if (this.buffer.length > this.maxSize) {
      const oldestExperience = this.buffer.shift();
      if (oldestExperience) {
        oldestExperience.state.dispose();
        oldestExperience.nextState.dispose();
      }
    }
  }
  
  sample(batchSize: number): Array<{
    state: tf.Tensor;
    action: number[];
    reward: number;
    nextState: tf.Tensor;
    done: boolean;
  }> {
    if (this.buffer.length < batchSize) {
      return this.buffer.map(exp => ({
        state: exp.state.clone(),
        action: [...exp.action],
        reward: exp.reward,
        nextState: exp.nextState.clone(),
        done: exp.done
      }));
    }
    
    const result = [];
    const bufferLength = this.buffer.length;
    
    // Sample randomly from buffer
    for (let i = 0; i < batchSize; i++) {
      const index = Math.floor(Math.random() * bufferLength);
      const exp = this.buffer[index];
      result.push({
        state: exp.state.clone(),
        action: [...exp.action],
        reward: exp.reward,
        nextState: exp.nextState.clone(),
        done: exp.done
      });
    }
    
    return result;
  }
  
  size(): number {
    return this.buffer.length;
  }
  
  clear(): void {
    // Dispose all tensors to prevent memory leaks
    this.buffer.forEach(exp => {
      exp.state.dispose();
      exp.nextState.dispose();
    });
    this.buffer = [];
  }
}

/**
 * DQNAgent - Deep Q-Network implementation for trading
 */
export class DQNAgent {
  private env: TradingEnvironment;
  private qNetwork: tf.LayersModel;
  private targetNetwork: tf.LayersModel;
  private replayBuffer: ReplayBuffer;
  private symbols: string[];
  private gamma: number; // Discount factor
  private epsilon: number; // Exploration rate
  private epsilonMin: number; // Minimum exploration rate
  private epsilonDecay: number; // Decay rate for epsilon
  private learningRate: number;
  private batchSize: number;
  private updateFrequency: number; // Update target network after this many steps
  private stateSize: number;
  private actionSize: number;
  private stepCount: number = 0;
  
  /**
   * Constructor for DQNAgent
   * @param env Trading environment
   * @param symbols List of trading symbols
   * @param stateSize Size of state input
   * @param gamma Discount factor
   * @param epsilon Initial exploration rate
   * @param epsilonMin Minimum exploration rate
   * @param epsilonDecay Decay rate for epsilon
   * @param learningRate Learning rate for the model
   * @param batchSize Batch size for training
   * @param updateFrequency Update target network after this many steps
   */
  constructor(
    env: TradingEnvironment,
    symbols: string[],
    stateSize: number,
    gamma: number = 0.95,
    epsilon: number = 1.0,
    epsilonMin: number = 0.01,
    epsilonDecay: number = 0.995,
    learningRate: number = 0.001,
    batchSize: number = 64,
    updateFrequency: number = 100
  ) {
    this.env = env;
    this.symbols = symbols;
    this.gamma = gamma;
    this.epsilon = epsilon;
    this.epsilonMin = epsilonMin;
    this.epsilonDecay = epsilonDecay;
    this.learningRate = learningRate;
    this.batchSize = batchSize;
    this.updateFrequency = updateFrequency;
    this.stateSize = stateSize;
    this.actionSize = symbols.length * 3; // For each symbol: buy, hold, sell
    this.replayBuffer = new ReplayBuffer();
    
    // Build networks
    this.qNetwork = this.buildModel();
    this.targetNetwork = this.buildModel();
    
    // Copy weights from Q network to target network
    this.updateTargetNetwork();
  }
  
  /**
   * Build the neural network model
   * @returns TensorFlow.js model
   */
  private buildModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [this.stateSize]
    }));
    
    // Hidden layers
    model.add(tf.layers.dense({
      units: 128,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    // Output layer - one output per action
    model.add(tf.layers.dense({
      units: this.actionSize,
      activation: 'linear'
    }));
    
    // Compile the model
    model.compile({
      optimizer: tf.train.adam(this.learningRate),
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  /**
   * Update the target network weights with Q-network weights
   */
  private updateTargetNetwork(): void {
    const weights = this.qNetwork.getWeights();
    this.targetNetwork.setWeights(weights.map(w => w.clone()));
  }
  
  /**
   * Choose an action based on current state with epsilon-greedy policy
   * @param state Current state observation
   * @returns Array of actions for each symbol
   */
  public act(state: tf.Tensor): number[] {
    // Use epsilon-greedy policy for exploration vs exploitation
    if (Math.random() < this.epsilon) {
      // Exploration: choose random actions
      return this.randomAction();
    } else {
      // Exploitation: choose best action based on Q-values
      return tf.tidy(() => {
        const stateTensor = state.expandDims(0);
        const qValues = this.qNetwork.predict(stateTensor) as tf.Tensor;
        
        // Convert to array for easier processing
        const qValuesArray = qValues.dataSync();
        const actions: number[] = [];
        
        // For each symbol, choose an action: -1 (sell), 0 (hold), 1 (buy)
        for (let i = 0; i < this.symbols.length; i++) {
          const symbolQValues = [
            qValuesArray[i * 3], // Buy
            qValuesArray[i * 3 + 1], // Hold
            qValuesArray[i * 3 + 2] // Sell
          ];
          
          // Find the action with the highest Q-value
          const maxIndex = symbolQValues.indexOf(Math.max(...symbolQValues));
          actions.push(maxIndex === 0 ? 1 : maxIndex === 2 ? -1 : 0); // Map to -1, 0, 1
        }
        
        return actions;
      });
    }
  }
  
  /**
   * Generate random actions for exploration
   * @returns Array of random actions for each symbol
   */
  private randomAction(): number[] {
    const actions: number[] = [];
    for (let i = 0; i < this.symbols.length; i++) {
      // Randomly choose between -1 (sell), 0 (hold), 1 (buy)
      const randomChoice = Math.floor(Math.random() * 3) - 1;
      actions.push(randomChoice);
    }
    return actions;
  }
  
  /**
   * Store experience in replay buffer
   * @param state Current state
   * @param action Action taken
   * @param reward Reward received
   * @param nextState Next state
   * @param done Whether episode is done
   */
  public remember(state: tf.Tensor, action: number[], reward: number, nextState: tf.Tensor, done: boolean): void {
    this.replayBuffer.add(state, action, reward, nextState, done);
  }
  
  /**
   * Train the model using experiences from replay buffer
   * @returns Training loss
   */
  public async train(): Promise<number> {
    // Skip if not enough experiences in buffer
    if (this.replayBuffer.size() < this.batchSize) {
      return 0;
    }
    
    // Sample a batch of experiences
    const batch = this.replayBuffer.sample(this.batchSize);
    
    // Prepare batch data
    const states = tf.concat(batch.map(exp => exp.state.expandDims(0)));
    const nextStates = tf.concat(batch.map(exp => exp.nextState.expandDims(0)));
    
    // Get Q values for current states
    const qValues = this.qNetwork.predict(states) as tf.Tensor;
    
    // Get Q values for next states from target network
    const targetQValues = this.targetNetwork.predict(nextStates) as tf.Tensor;
    
    // Prepare target Q values by combining current Q values with rewards
    const updatedQValues = tf.tidy(() => {
      const qValuesArray = qValues.arraySync() as number[][];
      const targetQValuesArray = targetQValues.arraySync() as number[][];
      
      // Update Q values for actions taken
      for (let i = 0; i < this.batchSize; i++) {
        for (let j = 0; j < this.symbols.length; j++) {
          // Get action index (convert -1, 0, 1 to 0, 1, 2)
          const actionIdx = batch[i].action[j] + 1;
          
          // Calculate target Q value
          const targetIdx = j * 3 + actionIdx;
          const reward = batch[i].reward;
          const nextQ = targetQValuesArray[i][targetIdx];
          const target = reward + (batch[i].done ? 0 : this.gamma * nextQ);
          
          // Update Q value for the action taken
          qValuesArray[i][targetIdx] = target;
        }
      }
      
      return tf.tensor(qValuesArray);
    });
    
    // Train the model
    const history = await this.qNetwork.fit(states, updatedQValues, {
      epochs: 1,
      batchSize: this.batchSize,
      verbose: 0
    });
    
    // Update target network periodically
    this.stepCount++;
    if (this.stepCount % this.updateFrequency === 0) {
      this.updateTargetNetwork();
    }
    
    // Decay epsilon
    if (this.epsilon > this.epsilonMin) {
      this.epsilon *= this.epsilonDecay;
    }
    
    // Clean up tensors
    states.dispose();
    nextStates.dispose();
    qValues.dispose();
    targetQValues.dispose();
    updatedQValues.dispose();
    
    return history.history.loss[0] as number;
  }
  
  /**
   * Save the model to file
   * @param path File path
   */
  public async saveModel(path: string): Promise<void> {
    await this.qNetwork.save(`file://${path}`);
  }
  
  /**
   * Load the model from file
   * @param path File path
   */
  public async loadModel(path: string): Promise<void> {
    this.qNetwork = await tf.loadLayersModel(`file://${path}`);
    this.targetNetwork = await tf.loadLayersModel(`file://${path}`);
    
    // Recompile the models
    this.qNetwork.compile({
      optimizer: tf.train.adam(this.learningRate),
      loss: 'meanSquaredError'
    });
    
    this.targetNetwork.compile({
      optimizer: tf.train.adam(this.learningRate),
      loss: 'meanSquaredError'
    });
  }
  
  /**
   * Train the agent on the environment
   * @param episodes Number of episodes to train
   * @param maxStepsPerEpisode Maximum steps per episode
   * @param savePath Path to save the model
   * @param logInterval Interval for logging progress
   * @returns Training history
   */
  public async trainAgent(
    episodes: number,
    maxStepsPerEpisode: number,
    savePath?: string,
    logInterval: number = 10
  ): Promise<{ episode: number; reward: number; loss: number }[]> {
    const history: { episode: number; reward: number; loss: number }[] = [];
    
    for (let episode = 0; episode < episodes; episode++) {
      let state = this.env.reset();
      let totalReward = 0;
      let totalLoss = 0;
      let steps = 0;
      
      // Run one episode
      while (steps < maxStepsPerEpisode) {
        // Choose action
        const action = this.act(state);
        
        // Take action
        const [nextState, reward, done] = this.env.step(action);
        
        // Remember experience
        this.remember(state, action, reward, nextState, done);
        
        // Train
        const loss = await this.train();
        totalLoss += loss;
        
        // Update state and reward
        state = nextState;
        totalReward += reward;
        steps++;
        
        // Break if done
        if (done) break;
      }
      
      // Save progress
      history.push({
        episode,
        reward: totalReward,
        loss: totalLoss / steps
      });
      
      // Log progress
      if (episode % logInterval === 0) {
        console.log(`Episode ${episode}/${episodes}, Reward: ${totalReward.toFixed(2)}, Avg Loss: ${(totalLoss / steps).toFixed(4)}, Epsilon: ${this.epsilon.toFixed(4)}`);
      }
      
      // Save model
      if (savePath && episode % 50 === 0) {
        await this.saveModel(`${savePath}/dqn_model_episode_${episode}`);
      }
    }
    
    // Final save
    if (savePath) {
      await this.saveModel(`${savePath}/dqn_model_final`);
    }
    
    return history;
  }
  
  /**
   * Use the agent to predict an action
   * @param state Current state
   * @returns Predicted action
   */
  public predict(state: tf.Tensor): number[] {
    return tf.tidy(() => {
      const stateTensor = state.expandDims(0);
      const qValues = this.qNetwork.predict(stateTensor) as tf.Tensor;
      
      // Convert to array for easier processing
      const qValuesArray = qValues.dataSync();
      const actions: number[] = [];
      
      // For each symbol, choose an action: -1 (sell), 0 (hold), 1 (buy)
      for (let i = 0; i < this.symbols.length; i++) {
        const symbolQValues = [
          qValuesArray[i * 3], // Buy
          qValuesArray[i * 3 + 1], // Hold
          qValuesArray[i * 3 + 2] // Sell
        ];
        
        // Find the action with the highest Q-value
        const maxIndex = symbolQValues.indexOf(Math.max(...symbolQValues));
        actions.push(maxIndex === 0 ? 1 : maxIndex === 2 ? -1 : 0); // Map to -1, 0, 1
      }
      
      return actions;
    });
  }
}
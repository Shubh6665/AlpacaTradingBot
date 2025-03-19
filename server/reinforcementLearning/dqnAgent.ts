import * as tf from '@tensorflow/tfjs-node';
import * as path from 'path';
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
    // Store tensors with keepDims to prevent garbage collection issues
    const entry = {
      state: state.clone(),
      action,
      reward,
      nextState: nextState.clone(),
      done
    };
    
    this.buffer.push(entry);
    
    // Remove oldest entry if buffer exceeds max size
    if (this.buffer.length > this.maxSize) {
      const oldestEntry = this.buffer.shift();
      if (oldestEntry) {
        oldestEntry.state.dispose();
        oldestEntry.nextState.dispose();
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
      return this.buffer;
    }
    
    const indices: Set<number> = new Set();
    while (indices.size < batchSize) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      indices.add(idx);
    }
    
    return Array.from(indices).map(idx => {
      const entry = this.buffer[idx];
      return {
        state: entry.state.clone(),
        action: entry.action,
        reward: entry.reward,
        nextState: entry.nextState.clone(),
        done: entry.done
      };
    });
  }
  
  size(): number {
    return this.buffer.length;
  }
  
  clear(): void {
    // Dispose all tensors
    this.buffer.forEach(entry => {
      entry.state.dispose();
      entry.nextState.dispose();
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
    batchSize: number = 32,
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
    this.actionSize = symbols.length; // One action per symbol
    
    // Initialize replay buffer
    this.replayBuffer = new ReplayBuffer(10000);
    
    // Build neural network models
    this.qNetwork = this.buildModel();
    this.targetNetwork = this.buildModel();
    
    // Initialize target network with Q-network weights
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
      units: 64,
      activation: 'relu',
      inputShape: [this.stateSize]
    }));
    
    // Hidden layers
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    // Output layer - one output per symbol for actions
    model.add(tf.layers.dense({
      units: this.actionSize,
      activation: 'tanh' // Using tanh for -1 to 1 range (sell/hold/buy)
    }));
    
    // Compile model
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
    const qWeights = this.qNetwork.getWeights();
    this.targetNetwork.setWeights(qWeights);
  }
  
  /**
   * Choose an action based on current state with epsilon-greedy policy
   * @param state Current state observation
   * @returns Array of actions for each symbol
   */
  public act(state: tf.Tensor): number[] {
    // Epsilon-greedy exploration
    if (Math.random() < this.epsilon) {
      return this.randomAction();
    }
    
    return tf.tidy(() => {
      // Get action values from Q-network
      const stateTensor = state.expandDims(0);
      const actionValues = this.qNetwork.predict(stateTensor) as tf.Tensor;
      
      // Convert to array
      const actions = actionValues.arraySync() as number[][];
      return actions[0];
    });
  }
  
  /**
   * Generate random actions for exploration
   * @returns Array of random actions for each symbol
   */
  private randomAction(): number[] {
    const actions: number[] = [];
    for (let i = 0; i < this.actionSize; i++) {
      // Random value between -1 and 1
      const randomAction = Math.random() * 2 - 1;
      actions.push(randomAction);
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
    if (this.replayBuffer.size() < this.batchSize) {
      return 0;
    }
    
    // Sample random batch from replay buffer
    const batch = this.replayBuffer.sample(this.batchSize);
    
    // Prepare batch data
    const states = tf.concat(batch.map(experience => experience.state.expandDims(0)));
    const nextStates = tf.concat(batch.map(experience => experience.nextState.expandDims(0)));
    
    // Calculate Q values for current states
    const qValues = this.qNetwork.predict(states) as tf.Tensor;
    
    // Calculate Q values for next states using target network
    const nextQValues = this.targetNetwork.predict(nextStates) as tf.Tensor;
    
    // Create array for updated target Q values
    const targetQValues = qValues.arraySync() as number[][];
    const nextQArray = nextQValues.arraySync() as number[][];
    
    // Update target Q values with Bellman equation
    batch.forEach((experience, i) => {
      for (let j = 0; j < this.actionSize; j++) {
        if (j === this.symbols.indexOf(this.symbols[j])) {
          // Only update the Q value for the action that was taken
          // for the corresponding symbol
          if (experience.done) {
            targetQValues[i][j] = experience.reward;
          } else {
            targetQValues[i][j] = experience.reward + this.gamma * nextQArray[i][j];
          }
        }
      }
    });
    
    // Train model with updated targets
    const targetTensor = tf.tensor(targetQValues);
    const history = await this.qNetwork.fit(states, targetTensor, {
      epochs: 1,
      batchSize: this.batchSize,
      verbose: 0
    });
    
    // Update epsilon with decay
    if (this.epsilon > this.epsilonMin) {
      this.epsilon *= this.epsilonDecay;
    }
    
    // Update target network periodically
    this.stepCount++;
    if (this.stepCount % this.updateFrequency === 0) {
      this.updateTargetNetwork();
    }
    
    // Clean up tensors
    states.dispose();
    nextStates.dispose();
    qValues.dispose();
    nextQValues.dispose();
    targetTensor.dispose();
    
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
    try {
      this.qNetwork = await tf.loadLayersModel(`file://${path}.json`);
      this.targetNetwork = await tf.loadLayersModel(`file://${path}.json`);
      console.log('Model loaded successfully');
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
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
    savePath: string,
    logInterval: number = 10
  ): Promise<{ episode: number; reward: number; loss: number; epsilon: number }[]> {
    const history: { episode: number; reward: number; loss: number; epsilon: number }[] = [];
    
    for (let episode = 0; episode < episodes; episode++) {
      let state = this.env.reset();
      let totalReward = 0;
      let losses: number[] = [];
      
      for (let step = 0; step < maxStepsPerEpisode; step++) {
        // Choose action
        const action = this.act(state);
        
        // Take action in environment
        const [nextState, reward, done] = this.env.step(action);
        
        // Store experience in replay buffer
        this.remember(state, action, reward, nextState, done);
        
        // Train model
        const loss = await this.train();
        losses.push(loss);
        
        // Update state and rewards
        state = nextState;
        totalReward += reward;
        
        if (done) break;
      }
      
      // Log progress
      if ((episode + 1) % logInterval === 0) {
        const avgLoss = losses.reduce((sum, val) => sum + val, 0) / losses.length;
        console.log(`Episode ${episode + 1}/${episodes}, Reward: ${totalReward.toFixed(2)}, Avg Loss: ${avgLoss.toFixed(6)}, Epsilon: ${this.epsilon.toFixed(4)}`);
        
        // Save model periodically
        const modelPath = path.join(savePath, `dqn_model_${episode + 1}`);
        await this.saveModel(modelPath);
      }
      
      // Record history
      history.push({
        episode: episode + 1,
        reward: totalReward,
        loss: losses.reduce((sum, val) => sum + val, 0) / losses.length,
        epsilon: this.epsilon
      });
    }
    
    // Save final model
    const finalModelPath = path.join(savePath, 'dqn_model_final');
    await this.saveModel(finalModelPath);
    
    return history;
  }
  
  /**
   * Use the agent to predict an action
   * @param state Current state
   * @returns Predicted action
   */
  public predict(state: tf.Tensor): number[] {
    return tf.tidy(() => {
      // Get action values from Q-network
      const stateTensor = state.expandDims(0);
      const actionValues = this.qNetwork.predict(stateTensor) as tf.Tensor;
      
      // Convert to array
      const actions = actionValues.arraySync() as number[][];
      return actions[0];
    });
  }
}
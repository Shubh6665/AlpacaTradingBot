import {
  User, InsertUser,
  ApiKey, InsertApiKey,
  BotSettings, InsertBotSettings,
  Position, InsertPosition,
  Trade, InsertTrade,
  PerformanceMetrics, InsertPerformanceMetrics,
  SystemLog, InsertSystemLog
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // API Keys operations
  getApiKeyByUserId(userId: number): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: number, apiKey: Partial<InsertApiKey>): Promise<ApiKey | undefined>;

  // Bot Settings operations
  getBotSettingsByUserId(userId: number): Promise<BotSettings | undefined>;
  createBotSettings(botSettings: InsertBotSettings): Promise<BotSettings>;
  updateBotSettings(id: number, botSettings: Partial<InsertBotSettings>): Promise<BotSettings | undefined>;

  // Positions operations
  getPositionsByUserId(userId: number): Promise<Position[]>;
  getPositionBySymbol(userId: number, symbol: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: number, position: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: number): Promise<boolean>;

  // Trades operations
  getTradesByUserId(userId: number, limit?: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;

  // Performance Metrics operations
  getPerformanceMetricsByUserId(userId: number): Promise<PerformanceMetrics | undefined>;
  createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics>;
  updatePerformanceMetrics(id: number, metrics: Partial<InsertPerformanceMetrics>): Promise<PerformanceMetrics | undefined>;

  // System Logs operations
  getSystemLogsByUserId(userId: number, limit?: number): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
  clearSystemLogs(userId: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private apiKeys: Map<number, ApiKey>;
  private botSettings: Map<number, BotSettings>;
  private positions: Map<number, Position>;
  private trades: Map<number, Trade>;
  private performanceMetrics: Map<number, PerformanceMetrics>;
  private systemLogs: Map<number, SystemLog>;
  private nextId: {
    users: number;
    apiKeys: number;
    botSettings: number;
    positions: number;
    trades: number;
    performanceMetrics: number;
    systemLogs: number;
  };

  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
    this.botSettings = new Map();
    this.positions = new Map();
    this.trades = new Map();
    this.performanceMetrics = new Map();
    this.systemLogs = new Map();
    this.nextId = {
      users: 1,
      apiKeys: 1,
      botSettings: 1,
      positions: 1,
      trades: 1,
      performanceMetrics: 1,
      systemLogs: 1
    };
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.nextId.users++;
    const newUser: User = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }

  // API Keys operations
  async getApiKeyByUserId(userId: number): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeys.values()).find(
      (apiKey) => apiKey.userId === userId
    );
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const id = this.nextId.apiKeys++;
    const now = new Date();
    const newApiKey: ApiKey = { ...apiKey, id, createdAt: now };
    this.apiKeys.set(id, newApiKey);
    return newApiKey;
  }

  async updateApiKey(id: number, apiKey: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const existingApiKey = this.apiKeys.get(id);
    if (!existingApiKey) return undefined;

    const updatedApiKey: ApiKey = { ...existingApiKey, ...apiKey };
    this.apiKeys.set(id, updatedApiKey);
    return updatedApiKey;
  }

  // Bot Settings operations
  async getBotSettingsByUserId(userId: number): Promise<BotSettings | undefined> {
    return Array.from(this.botSettings.values()).find(
      (settings) => settings.userId === userId
    );
  }

  async createBotSettings(botSettings: InsertBotSettings): Promise<BotSettings> {
    const id = this.nextId.botSettings++;
    const now = new Date();
    const newBotSettings: BotSettings = { ...botSettings, id, updatedAt: now };
    this.botSettings.set(id, newBotSettings);
    return newBotSettings;
  }

  async updateBotSettings(id: number, botSettings: Partial<InsertBotSettings>): Promise<BotSettings | undefined> {
    const existingBotSettings = this.botSettings.get(id);
    if (!existingBotSettings) return undefined;

    const now = new Date();
    const updatedBotSettings: BotSettings = { 
      ...existingBotSettings, 
      ...botSettings, 
      updatedAt: now 
    };
    this.botSettings.set(id, updatedBotSettings);
    return updatedBotSettings;
  }

  // Positions operations
  async getPositionsByUserId(userId: number): Promise<Position[]> {
    return Array.from(this.positions.values()).filter(
      (position) => position.userId === userId
    );
  }

  async getPositionBySymbol(userId: number, symbol: string): Promise<Position | undefined> {
    return Array.from(this.positions.values()).find(
      (position) => position.userId === userId && position.symbol === symbol
    );
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const id = this.nextId.positions++;
    const now = new Date();
    const newPosition: Position = { ...position, id, updatedAt: now };
    this.positions.set(id, newPosition);
    return newPosition;
  }

  async updatePosition(id: number, position: Partial<InsertPosition>): Promise<Position | undefined> {
    const existingPosition = this.positions.get(id);
    if (!existingPosition) return undefined;

    const now = new Date();
    const updatedPosition: Position = { 
      ...existingPosition, 
      ...position, 
      updatedAt: now 
    };
    this.positions.set(id, updatedPosition);
    return updatedPosition;
  }

  async deletePosition(id: number): Promise<boolean> {
    return this.positions.delete(id);
  }

  // Trades operations
  async getTradesByUserId(userId: number, limit?: number): Promise<Trade[]> {
    const trades = Array.from(this.trades.values())
      .filter((trade) => trade.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? trades.slice(0, limit) : trades;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = this.nextId.trades++;
    const now = new Date();
    const newTrade: Trade = { ...trade, id, timestamp: now };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  // Performance Metrics operations
  async getPerformanceMetricsByUserId(userId: number): Promise<PerformanceMetrics | undefined> {
    return Array.from(this.performanceMetrics.values()).find(
      (metrics) => metrics.userId === userId
    );
  }

  async createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const id = this.nextId.performanceMetrics++;
    const now = new Date();
    const newMetrics: PerformanceMetrics = { ...metrics, id, updatedAt: now };
    this.performanceMetrics.set(id, newMetrics);
    return newMetrics;
  }

  async updatePerformanceMetrics(id: number, metrics: Partial<InsertPerformanceMetrics>): Promise<PerformanceMetrics | undefined> {
    const existingMetrics = this.performanceMetrics.get(id);
    if (!existingMetrics) return undefined;

    const now = new Date();
    const updatedMetrics: PerformanceMetrics = { 
      ...existingMetrics, 
      ...metrics, 
      updatedAt: now 
    };
    this.performanceMetrics.set(id, updatedMetrics);
    return updatedMetrics;
  }

  // System Logs operations
  async getSystemLogsByUserId(userId: number, limit?: number): Promise<SystemLog[]> {
    const logs = Array.from(this.systemLogs.values())
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? logs.slice(0, limit) : logs;
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const id = this.nextId.systemLogs++;
    const now = new Date();
    const newLog: SystemLog = { ...log, id, timestamp: now };
    this.systemLogs.set(id, newLog);
    return newLog;
  }

  async clearSystemLogs(userId: number): Promise<boolean> {
    const logsToDelete = Array.from(this.systemLogs.entries())
      .filter(([_, log]) => log.userId === userId);
    
    for (const [id] of logsToDelete) {
      this.systemLogs.delete(id);
    }
    
    return true;
  }
}

export const storage = new MemStorage();

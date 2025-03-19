import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  alpacaApiKey: text("alpaca_api_key").notNull(),
  alpacaSecretKey: text("alpaca_secret_key").notNull(),
  environment: text("environment").notNull().default("paper"), // 'paper' or 'live'
  createdAt: timestamp("created_at").defaultNow(),
});

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  isActive: boolean("is_active").default(false),
  strategy: text("strategy").default("mean_reversion"), // mean_reversion, momentum, ppo, reinforcement
  riskLevel: integer("risk_level").default(5), // 1-10
  tradingFrequency: text("trading_frequency").default("medium"), // low, medium, high
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  symbol: text("symbol").notNull(),
  qty: numeric("qty").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  currentPrice: numeric("current_price").notNull(),
  marketValue: numeric("market_value").notNull(),
  unrealizedPl: numeric("unrealized_pl").notNull(),
  unrealizedPlPerc: numeric("unrealized_pl_perc").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' or 'sell'
  qty: numeric("qty").notNull(),
  price: numeric("price").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  orderType: text("order_type").notNull(), // 'market', 'limit', 'stop'
  status: text("status").notNull(), // 'filled', 'partially_filled', 'canceled'
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  portfolioValue: numeric("portfolio_value").notNull(),
  portfolioChange: numeric("portfolio_change"),
  portfolioChangePerc: numeric("portfolio_change_perc"),
  buyingPower: numeric("buying_power").notNull(),
  sharpeRatio: numeric("sharpe_ratio"),
  winLossRatio: numeric("win_loss_ratio"),
  totalTrades: integer("total_trades").default(0),
  profitableTrades: integer("profitable_trades").default(0),
  profitableTradesPerc: numeric("profitable_trades_perc"),
  avgHoldingTime: numeric("avg_holding_time"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  level: text("level").notNull(), // 'INFO', 'TRADE', 'SIGNAL', 'ERROR', 'WARNING'
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).pick({
  userId: true,
  alpacaApiKey: true,
  alpacaSecretKey: true,
  environment: true,
});

export const insertBotSettingsSchema = createInsertSchema(botSettings).pick({
  userId: true,
  isActive: true,
  strategy: true,
  riskLevel: true,
  tradingFrequency: true,
});

export const insertPositionSchema = createInsertSchema(positions).pick({
  userId: true,
  symbol: true,
  qty: true,
  entryPrice: true,
  currentPrice: true,
  marketValue: true,
  unrealizedPl: true,
  unrealizedPlPerc: true,
});

export const insertTradeSchema = createInsertSchema(trades).pick({
  userId: true,
  symbol: true,
  side: true,
  qty: true,
  price: true,
  orderType: true,
  status: true,
});

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).pick({
  userId: true,
  portfolioValue: true,
  portfolioChange: true,
  portfolioChangePerc: true,
  buyingPower: true,
  sharpeRatio: true,
  winLossRatio: true,
  totalTrades: true,
  profitableTrades: true,
  profitableTradesPerc: true,
  avgHoldingTime: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).pick({
  userId: true,
  level: true,
  message: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type BotSettings = typeof botSettings.$inferSelect;

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;

// Custom types for API responses
export type AccountInfo = {
  id: string;
  cash: string;
  portfolio_value: string;
  buying_power: string;
  equity: string;
  status: string;
};

export type MarketData = {
  symbol: string;
  price: number;
  timestamp: number;
  change: number;
  changePercent: number;
};

export type OrderRequest = {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  time_in_force: 'day' | 'gtc' | 'ioc';
  limit_price?: number;
  stop_price?: number;
};

export type OrderResponse = {
  id: string;
  client_order_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  qty: string;
  filled_qty: string;
  status: string;
  created_at: string;
  filled_at?: string;
  limit_price?: string;
  stop_price?: string;
};

export type AlpacaPosition = {
  asset_id: string;
  symbol: string;
  qty: string;
  avg_entry_price: string;
  market_value: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: 'long' | 'short';
};

export type StrategySignal = {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  timestamp: number;
};

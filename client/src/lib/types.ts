// This file contains additional types needed for the frontend

export type TradeSymbol = 'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'AVAXUSD';

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type TimeInForce = 'day' | 'gtc' | 'ioc';

export type TradingBotStatus = 'active' | 'inactive';

export type TradingFrequency = 'low' | 'medium' | 'high';

export type TradingStrategy = 'mean_reversion' | 'momentum' | 'ppo' | 'reinforcement';

export type ChartTimeframe = '1min' | '5min' | '15min' | '1hour' | '1day';

export type LogLevel = 'INFO' | 'TRADE' | 'SIGNAL' | 'ERROR' | 'WARNING';

export type LogEntry = {
  id: number;
  userId: number;
  level: LogLevel;
  message: string;
  timestamp: string;
};

export type IndicatorType = 'RSI' | 'MACD' | 'BOLLINGER';

export type Position = {
  id: number;
  userId: number;
  symbol: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPerc: number;
  updatedAt: string;
};

export type Trade = {
  id: number;
  userId: number;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  timestamp: string;
  orderType: OrderType;
  status: string;
};

export type PerformanceMetrics = {
  id: number;
  userId: number;
  portfolioValue: number;
  portfolioChange: number;
  portfolioChangePerc: number;
  buyingPower: number;
  sharpeRatio: number;
  winLossRatio: number;
  totalTrades: number;
  profitableTrades: number;
  profitableTradesPerc: number;
  avgHoldingTime: number;
  updatedAt: string;
};

export type BotSettings = {
  id: number;
  userId: number;
  isActive: boolean;
  strategy: TradingStrategy;
  riskLevel: number;
  tradingFrequency: TradingFrequency;
  updatedAt: string;
};

export type ApiKeyInfo = {
  environment: 'paper' | 'live';
  hasApiKey: boolean;
};

export type WebSocketMessage = {
  type: string;
  data?: any;
};

export type CandlestickData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketData = {
  symbol: string;
  price: number;
  timestamp: number;
  change: number;
  changePercent: number;
};

export type StrategyParameters = {
  [key: string]: any;
};

export type StrategySignal = {
  symbol: string;
  action: OrderSide | 'hold';
  confidence: number;
  timestamp: number;
};

export type InitialData = {
  positions: Position[];
  trades: Trade[];
  metrics: PerformanceMetrics;
  logs: LogEntry[];
  botSettings: BotSettings;
  hasApiKey: boolean;
};

import { 
  TradingStrategy, 
  TradeSymbol, 
  ChartTimeframe, 
  CandlestickData, 
  PerformanceMetrics, 
  Position 
} from './types';

// Format currency values for display
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Format percentage values for display
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '0.00%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

// Format crypto quantity values for display
export function formatCryptoQty(value: number | undefined | null, precision: number = 5): string {
  if (value === undefined || value === null) return '0';
  
  return value.toFixed(precision);
}

// Get color based on value (positive or negative)
export function getValueColor(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'text-text-primary';
  
  return value >= 0 ? 'text-success' : 'text-error';
}

// Format date/time for display
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  }).format(date);
}

// Format date only
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

// Format time only
export function formatTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  }).format(date);
}

// Get strategy description by type
export function getStrategyDescription(strategy: TradingStrategy): string {
  switch (strategy) {
    case 'mean_reversion':
      return 'Trading based on the principle that asset prices tend to revert to their historical mean over time.';
    case 'momentum':
      return 'Strategy that capitalizes on the continuation of existing market trends.';
    case 'ppo':
      return 'Uses the difference between fast and slow exponential moving averages to identify market momentum.';
    case 'reinforcement':
      return 'Uses machine learning to learn optimal trading strategies through interaction with the market.';
    default:
      return '';
  }
}

// Get timeframe duration in milliseconds
export function getTimeframeDuration(timeframe: ChartTimeframe): number {
  switch (timeframe) {
    case '1min':
      return 60 * 1000;
    case '5min':
      return 5 * 60 * 1000;
    case '15min':
      return 15 * 60 * 1000;
    case '1hour':
      return 60 * 60 * 1000;
    case '1day':
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

// Get start and end time for chart data based on timeframe
export function getChartTimeRange(timeframe: ChartTimeframe): { start: Date, end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (timeframe) {
    case '1min':
      start.setTime(end.getTime() - (60 * 60 * 1000)); // 1 hour ago
      break;
    case '5min':
      start.setTime(end.getTime() - (4 * 60 * 60 * 1000)); // 4 hours ago
      break;
    case '15min':
      start.setTime(end.getTime() - (12 * 60 * 60 * 1000)); // 12 hours ago
      break;
    case '1hour':
      start.setTime(end.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
      break;
    case '1day':
      start.setTime(end.getTime() - (90 * 24 * 60 * 60 * 1000)); // 90 days ago
      break;
  }
  
  return { start, end };
}

// Generate mock chart data for development
export function generateMockChartData(
  symbol: TradeSymbol,
  timeframe: ChartTimeframe,
  count: number = 100
): CandlestickData[] {
  const { start } = getChartTimeRange(timeframe);
  const interval = getTimeframeDuration(timeframe);
  
  // Base prices for different symbols
  const basePrices: Record<TradeSymbol, number> = {
    'BTCUSD': 37000,
    'ETHUSD': 1900,
    'SOLUSD': 100,
    'AVAXUSD': 28
  };
  
  const basePrice = basePrices[symbol] || 100;
  const volatility = basePrice * 0.02; // 2% volatility
  
  const data: CandlestickData[] = [];
  
  for (let i = 0; i < count; i++) {
    const time = new Date(start.getTime() + (i * interval)).getTime();
    const open = basePrice + (Math.random() - 0.5) * volatility * 2;
    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = (open + high + low) / 3 + (Math.random() - 0.5) * volatility;
    const volume = Math.floor(Math.random() * 100) + 50;
    
    data.push({ time, open, high, low, close, volume });
  }
  
  return data;
}

// Calculate performance metrics based on trade history
export function calculatePerformanceMetrics(
  trades: any[],
  positions: Position[]
): Partial<PerformanceMetrics> {
  // In a real application, these would be calculated based on real trading data
  
  const totalTrades = trades.length;
  const profitableTrades = trades.filter(t => {
    // Simplified calculation - in real app would compare entry and exit prices
    return t.side === 'sell' && Math.random() > 0.4; // Just for demo
  }).length;
  
  const winLossRatio = totalTrades > 0 ? profitableTrades / (totalTrades - profitableTrades) : 0;
  const profitableTradesPerc = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
  
  // Example calculation for Sharpe Ratio (simplified)
  const sharpeRatio = 1 + Math.random(); // Between 1 and 2
  
  // Example avg holding time in hours
  const avgHoldingTime = 4 + Math.random() * 3; // Between 4 and 7 hours
  
  return {
    totalTrades,
    profitableTrades,
    profitableTradesPerc,
    winLossRatio,
    sharpeRatio,
    avgHoldingTime
  };
}

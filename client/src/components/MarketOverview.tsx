import { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TradeSymbol, ChartTimeframe, MarketData } from '@/lib/types';
import { generateMockChartData, formatCurrency } from '@/lib/tradingUtils';

interface MarketOverviewProps {
  selectedSymbol: TradeSymbol;
  selectedTimeframe: ChartTimeframe;
  activeIndicators: string[];
  onSymbolChange: (symbol: TradeSymbol) => void;
  onTimeframeChange: (timeframe: ChartTimeframe) => void;
  onToggleIndicator: (indicator: string) => void;
  marketData?: MarketData;
}

export function MarketOverview({
  selectedSymbol,
  selectedTimeframe,
  activeIndicators,
  onSymbolChange,
  onTimeframeChange,
  onToggleIndicator,
  marketData
}: MarketOverviewProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Generate chart data when symbol or timeframe changes
  useEffect(() => {
    // In a real implementation, this would fetch data from the API
    const data = generateMockChartData(selectedSymbol, selectedTimeframe, 100);
    
    // Transform data format for Recharts
    const formattedData = data.map(item => ({
      time: new Date(item.time).toLocaleTimeString(),
      price: item.close,
      open: item.open,
      high: item.high,
      low: item.low,
      volume: item.volume
    }));
    
    setChartData(formattedData);
  }, [selectedSymbol, selectedTimeframe]);
  
  // Get current price and change data
  const currentPrice = marketData?.price || (chartData.length > 0 ? chartData[chartData.length - 1].price : 0);
  const priceChange = marketData?.change || 0;
  const priceChangePercent = marketData?.changePercent || 0;
  
  // Calculate indicator values (simplified for demo)
  const calculateRSI = () => {
    // In a real app, would calculate real RSI
    return chartData.map((item, index) => ({
      ...item,
      rsi: 50 + Math.sin(index / 10) * 20 // Placeholder RSI between 30-70
    }));
  };
  
  const calculateMACD = () => {
    // In a real app, would calculate real MACD
    return chartData.map((item, index) => ({
      ...item,
      macd: Math.sin(index / 15) * 2,
      signal: Math.sin((index / 15) + 1) * 2
    }));
  };
  
  const calculateBollinger = () => {
    // In a real app, would calculate real Bollinger bands
    const middleBand = chartData.map(item => item.price).reduce((a, b) => a + b, 0) / chartData.length;
    const stdDev = Math.sqrt(
      chartData.map(item => Math.pow(item.price - middleBand, 2))
        .reduce((a, b) => a + b, 0) / chartData.length
    ) * 2;
    
    return {
      upper: middleBand + stdDev,
      middle: middleBand,
      lower: middleBand - stdDev
    };
  };
  
  // Render indicators based on active selections
  const renderIndicators = () => {
    if (activeIndicators.includes('RSI') && chartData.length > 0) {
      const rsiData = calculateRSI();
      return (
        <div className="mt-4 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rsiData}>
              <YAxis domain={[0, 100]} hide={false} />
              <ReferenceLine y={70} stroke="#FF3B30" strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="#00C853" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="rsi" stroke="#FFC107" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    
    if (activeIndicators.includes('MACD') && chartData.length > 0) {
      const macdData = calculateMACD();
      return (
        <div className="mt-4 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={macdData}>
              <Line type="monotone" dataKey="macd" stroke="#2962FF" dot={false} />
              <Line type="monotone" dataKey="signal" stroke="#FF3B30" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    
    return null;
  };
  
  // Calculate Bollinger bands for main chart
  const bollingerBands = activeIndicators.includes('BOLLINGER') && chartData.length > 0 
    ? calculateBollinger() 
    : null;

  return (
    <div className="col-span-12 lg:col-span-8 bg-[#1E2130] rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-[#2D3748]">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-medium">Market Overview</h2>
          <div className="flex">
            <select
              className="bg-[#121722] border border-[#2D3748] rounded-l px-2 py-1 text-white text-sm"
              value={selectedSymbol}
              onChange={(e) => onSymbolChange(e.target.value as TradeSymbol)}
            >
              <option value="BTCUSD">BTC/USD</option>
              <option value="ETHUSD">ETH/USD</option>
              <option value="SOLUSD">SOL/USD</option>
              <option value="AVAXUSD">AVAX/USD</option>
            </select>
            <select
              className="bg-[#121722] border-l-0 border border-[#2D3748] rounded-r px-2 py-1 text-white text-sm"
              value={selectedTimeframe}
              onChange={(e) => onTimeframeChange(e.target.value as ChartTimeframe)}
            >
              <option value="1min">1m</option>
              <option value="5min">5m</option>
              <option value="15min">15m</option>
              <option value="1hour">1h</option>
              <option value="1day">1d</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-medium text-lg">{selectedSymbol.replace('USD', '/USD')}</h3>
            <div className="flex items-center">
              <span className="font-mono text-white text-lg">
                {formatCurrency(currentPrice)}
              </span>
              <span className={`ml-2 text-sm ${priceChangePercent >= 0 ? 'text-[#00C853]' : 'text-[#FF3B30]'}`}>
                {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              className={`bg-[#121722] border border-[#2D3748] px-3 py-1 rounded text-sm hover:bg-[#2962FF] hover:text-white transition-colors ${activeIndicators.includes('RSI') ? 'bg-[#2962FF] text-white' : 'text-[#B7BDC6]'}`}
              onClick={() => onToggleIndicator('RSI')}
            >
              RSI
            </button>
            <button
              className={`bg-[#121722] border border-[#2D3748] px-3 py-1 rounded text-sm hover:bg-[#2962FF] hover:text-white transition-colors ${activeIndicators.includes('MACD') ? 'bg-[#2962FF] text-white' : 'text-[#B7BDC6]'}`}
              onClick={() => onToggleIndicator('MACD')}
            >
              MACD
            </button>
            <button
              className={`bg-[#121722] border border-[#2D3748] px-3 py-1 rounded text-sm hover:bg-[#2962FF] hover:text-white transition-colors ${activeIndicators.includes('BOLLINGER') ? 'bg-[#2962FF] text-white' : 'text-[#B7BDC6]'}`}
              onClick={() => onToggleIndicator('BOLLINGER')}
            >
              Bollinger
            </button>
          </div>
        </div>
        
        <div className="chart-container bg-[#121722] rounded border border-[#2D3748] p-2 h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: '#B7BDC6' }} 
                  tickLine={{ stroke: '#2D3748' }}
                  axisLine={{ stroke: '#2D3748' }}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fill: '#B7BDC6' }} 
                  tickLine={{ stroke: '#2D3748' }}
                  axisLine={{ stroke: '#2D3748' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E2130', 
                    borderColor: '#2D3748',
                    color: '#FFFFFF'
                  }}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#2962FF" 
                  dot={false}
                  strokeWidth={2}
                />
                
                {bollingerBands && (
                  <>
                    <ReferenceLine y={bollingerBands.upper} stroke="#FFC107" strokeDasharray="3 3" />
                    <ReferenceLine y={bollingerBands.middle} stroke="#FFFFFF" strokeDasharray="3 3" />
                    <ReferenceLine y={bollingerBands.lower} stroke="#FFC107" strokeDasharray="3 3" />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-[#B7BDC6]">Loading chart data...</p>
            </div>
          )}
        </div>
        
        {renderIndicators()}
      </div>
    </div>
  );
}

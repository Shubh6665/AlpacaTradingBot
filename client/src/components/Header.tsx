import { formatCurrency } from '@/lib/tradingUtils';
import { PerformanceMetrics } from '@/lib/types';

interface HeaderProps {
  isConnected: boolean;
  isWebSocketConnected: boolean;
  metrics: PerformanceMetrics | null;
}

export function Header({ isConnected, isWebSocketConnected, metrics }: HeaderProps) {
  return (
    <header className="bg-[#1E2130] border-b border-[#2D3748] py-2 px-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Logo and title */}
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="text-[#2962FF] h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
            <h1 className="text-white font-medium ml-2 text-lg">Alpaca AI Trading Bot</h1>
          </div>
          {/* API Status */}
          <div className="flex items-center text-sm">
            <span className="flex items-center mr-3 text-[#B7BDC6]">
              <span 
                className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-[#00C853]' : 'bg-[#FF3B30]'} mr-1`}>
              </span>
              API: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span className="flex items-center text-[#B7BDC6]">
              <span 
                className={`inline-block w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-[#00C853]' : 'bg-[#FF3B30]'} mr-1`}>
              </span>
              WebSocket: {isWebSocketConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {/* Portfolio Summary */}
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-[#B7BDC6]">Portfolio Value</span>
            <span className="font-mono text-white font-medium">
              {formatCurrency(metrics?.portfolioValue || 0)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[#B7BDC6]">24h Change</span>
            <span className={`font-mono font-medium ${metrics?.portfolioChange && metrics.portfolioChange >= 0 ? 'text-[#00C853]' : 'text-[#FF3B30]'}`}>
              {formatCurrency(metrics?.portfolioChange || 0)} 
              ({metrics?.portfolioChangePerc ? (metrics.portfolioChangePerc > 0 ? '+' : '') + metrics.portfolioChangePerc.toFixed(2) : '0.00'}%)
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[#B7BDC6]">Buying Power</span>
            <span className="font-mono text-white font-medium">
              {formatCurrency(metrics?.buyingPower || 0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

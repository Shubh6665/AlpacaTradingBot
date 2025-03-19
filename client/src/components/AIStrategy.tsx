import { BotSettings } from '@/lib/types';
import { getStrategyDescription } from '@/lib/tradingUtils';

interface AIStrategyProps {
  botSettings: BotSettings | null;
}

export function AIStrategy({ botSettings }: AIStrategyProps) {
  // Strategy details based on selected strategy
  const getStrategyParameters = () => {
    switch (botSettings?.strategy) {
      case 'mean_reversion':
        return (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Lookback Period</span>
              <span className="text-white font-mono">14 days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Standard Deviation</span>
              <span className="text-white font-mono">2.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Trend Filter</span>
              <span className="text-white font-mono">Enabled</span>
            </div>
          </div>
        );
      case 'momentum':
        return (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Lookback Period</span>
              <span className="text-white font-mono">10 days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Threshold</span>
              <span className="text-white font-mono">3%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Volume Filter</span>
              <span className="text-white font-mono">Enabled</span>
            </div>
          </div>
        );
      case 'ppo':
        return (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Fast Period</span>
              <span className="text-white font-mono">12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Slow Period</span>
              <span className="text-white font-mono">26</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Signal Period</span>
              <span className="text-white font-mono">9</span>
            </div>
          </div>
        );
      case 'reinforcement':
        return (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Model Type</span>
              <span className="text-white font-mono">DQN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Features</span>
              <span className="text-white font-mono">Price, Volume, MACD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">Reward Function</span>
              <span className="text-white font-mono">Sharpe-based</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#B7BDC6]">No strategy selected</span>
            </div>
          </div>
        );
    }
  };

  // Next actions - in a real app, these would be based on actual signals
  const getNextActions = () => {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-[#B7BDC6]">BTC/USD</span>
          <span className="text-[#FFC107] font-mono">Hold</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#B7BDC6]">ETH/USD</span>
          <span className="text-[#00C853] font-mono">Buy Signal</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#B7BDC6]">SOL/USD</span>
          <span className="text-[#FF3B30] font-mono">Sell Signal</span>
        </div>
      </div>
    );
  };

  return (
    <div className="col-span-12 lg:col-span-6 bg-[#1E2130] rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-[#2D3748]">
        <h2 className="text-white font-medium">AI Strategy Insights</h2>
      </div>
      
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-white font-medium mb-2">
            Active Strategy: {botSettings?.strategy ? botSettings.strategy.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'None'}
          </h3>
          <p className="text-[#B7BDC6] text-sm">
            {botSettings?.strategy ? getStrategyDescription(botSettings.strategy) : 'No active strategy. Configure the bot to get started.'}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#121722] rounded p-3">
            <h4 className="text-white text-sm font-medium mb-2">Strategy Parameters</h4>
            {getStrategyParameters()}
          </div>
          
          <div className="bg-[#121722] rounded p-3">
            <h4 className="text-white text-sm font-medium mb-2">Next Actions</h4>
            {getNextActions()}
          </div>
        </div>
      </div>
    </div>
  );
}

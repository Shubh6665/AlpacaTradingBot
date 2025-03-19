import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BotSettings, TradingStrategy, TradingFrequency, PerformanceMetrics } from '@/lib/types';
import { ApiKeyModal } from './ApiKeyModal';

interface SidebarProps {
  botSettings: BotSettings | null;
  metrics: PerformanceMetrics | null;
  apiKeyInfo: { hasApiKey: boolean; environment: 'paper' | 'live' } | null;
  onBotToggle: (active: boolean) => void;
  onStrategyChange: (strategy: TradingStrategy) => void;
  onRiskLevelChange: (level: number) => void;
  onTradingFrequencyChange: (frequency: TradingFrequency) => void;
  onSaveApiKey: (apiKey: string, secretKey: string, environment: 'paper' | 'live') => void;
  isSavingApiKey: boolean;
  isSavingSettings: boolean;
}

export function Sidebar({
  botSettings,
  metrics,
  apiKeyInfo,
  onBotToggle,
  onStrategyChange,
  onRiskLevelChange,
  onTradingFrequencyChange,
  onSaveApiKey,
  isSavingApiKey,
  isSavingSettings
}: SidebarProps) {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const handleBotToggle = (checked: boolean) => {
    if (!apiKeyInfo?.hasApiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }
    onBotToggle(checked);
  };

  return (
    <aside className="w-64 bg-[#1E2130] border-r border-[#2D3748] flex flex-col">
      {/* Control Panel */}
      <div className="p-4 border-b border-[#2D3748]">
        <h2 className="text-white font-medium mb-4">Trading Controls</h2>
        
        {/* Main Trading Switch */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-[#B7BDC6]">Bot Status</span>
          <Switch
            checked={botSettings?.isActive || false}
            onCheckedChange={handleBotToggle}
            disabled={isSavingSettings}
            className={botSettings?.isActive ? 'data-[state=checked]:bg-[#00C853]' : 'data-[state=unchecked]:bg-[#FF3B30]'}
          />
        </div>
        
        {/* Strategy Selector */}
        <div className="mb-4">
          <label className="block text-[#B7BDC6] mb-1 text-sm">Strategy</label>
          <Select
            value={botSettings?.strategy || 'mean_reversion'}
            onValueChange={(value) => onStrategyChange(value as TradingStrategy)}
            disabled={isSavingSettings}
          >
            <SelectTrigger className="w-full bg-[#121722] border-[#2D3748] text-white">
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E2130] border-[#2D3748] text-white">
              <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
              <SelectItem value="momentum">Momentum</SelectItem>
              <SelectItem value="ppo">PPO</SelectItem>
              <SelectItem value="reinforcement">Reinforcement Learning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Risk Level */}
        <div className="mb-4">
          <label className="block text-[#B7BDC6] mb-1 text-sm">Risk Level</label>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[botSettings?.riskLevel || 5]}
            onValueChange={(values) => onRiskLevelChange(values[0])}
            disabled={isSavingSettings}
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-[#B7BDC6] mt-1">
            <span>Conservative</span>
            <span>Moderate</span>
            <span>Aggressive</span>
          </div>
        </div>
        
        {/* Trading Frequency */}
        <div className="mb-4">
          <label className="block text-[#B7BDC6] mb-1 text-sm">Trading Frequency</label>
          <Select
            value={botSettings?.tradingFrequency || 'medium'}
            onValueChange={(value) => onTradingFrequencyChange(value as TradingFrequency)}
            disabled={isSavingSettings}
          >
            <SelectTrigger className="w-full bg-[#121722] border-[#2D3748] text-white">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E2130] border-[#2D3748] text-white">
              <SelectItem value="low">Low (1-2 trades/day)</SelectItem>
              <SelectItem value="medium">Medium (5-10 trades/day)</SelectItem>
              <SelectItem value="high">High (10+ trades/day)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* API Configuration */}
      <div className="p-4 border-b border-[#2D3748]">
        <h2 className="text-white font-medium mb-3">API Configuration</h2>
        
        <div className="mb-3">
          <label className="block text-[#B7BDC6] mb-1 text-sm">Environment</label>
          <div className="flex">
            <button 
              className={`flex-1 ${apiKeyInfo?.environment === 'paper' ? 'bg-[#2962FF] text-white' : 'bg-[#121722] text-[#B7BDC6]'} py-1 rounded-l text-xs font-medium`}
              onClick={() => {
                // Always use TEST_KEY for paper trading
                onSaveApiKey('TEST_KEY', 'TEST_KEY', 'paper');
              }}
            >
              Paper Trading
            </button>
            <button 
              className={`flex-1 ${apiKeyInfo?.environment === 'live' ? 'bg-[#2962FF] text-white' : 'bg-[#121722] text-[#B7BDC6]'} py-1 rounded-r text-xs`}
              onClick={() => {
                // Always show modal for live trading to get real API keys
                setIsApiKeyModalOpen(true);
              }}
            >
              Live Trading
            </button>
          </div>
        </div>
        
        <button 
          className="w-full bg-[#121722] border border-[#2D3748] text-white py-1.5 rounded text-sm hover:bg-[#2962FF] hover:border-[#2962FF] transition-colors"
          onClick={() => setIsApiKeyModalOpen(true)}
        >
          {apiKeyInfo?.hasApiKey ? 'Update API Keys' : 'Configure API Keys'}
        </button>
      </div>
      
      {/* Performance Metrics */}
      <div className="p-4 flex-1">
        <h2 className="text-white font-medium mb-3">Performance Metrics</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-[#B7BDC6] text-sm">Sharpe Ratio</span>
            <span className="text-white font-mono">{metrics?.sharpeRatio?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B7BDC6] text-sm">Win/Loss Ratio</span>
            <span className="text-white font-mono">{metrics?.winLossRatio?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B7BDC6] text-sm">Total Trades</span>
            <span className="text-white font-mono">{metrics?.totalTrades || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B7BDC6] text-sm">Profitable Trades</span>
            <span className="text-[#00C853] font-mono">
              {metrics?.profitableTrades || 0} ({metrics?.profitableTradesPerc?.toFixed(1) || '0.0'}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B7BDC6] text-sm">Avg. Holding Time</span>
            <span className="text-white font-mono">{metrics?.avgHoldingTime?.toFixed(1) || '0.0'}h</span>
          </div>
        </div>
      </div>
      
      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={onSaveApiKey}
        isSaving={isSavingApiKey}
        environment={apiKeyInfo?.environment || 'paper'}
      />
    </aside>
  );
}

import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BotSettings, TradingStrategy, TradingFrequency } from '@/lib/types';

interface TradingControlsProps {
  botSettings: BotSettings | null;
  onBotToggle: (active: boolean) => void;
  onStrategyChange: (strategy: TradingStrategy) => void;
  onRiskLevelChange: (level: number) => void;
  onTradingFrequencyChange: (frequency: TradingFrequency) => void;
  isSavingSettings: boolean;
}

export function TradingControls({
  botSettings,
  onBotToggle,
  onStrategyChange,
  onRiskLevelChange,
  onTradingFrequencyChange,
  isSavingSettings
}: TradingControlsProps) {
  return (
    <div>
      <h2 className="text-white font-medium mb-4">Trading Controls</h2>
      
      {/* Main Trading Switch */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-[#B7BDC6]">Bot Status</span>
        <Switch
          checked={botSettings?.isActive || false}
          onCheckedChange={onBotToggle}
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
  );
}

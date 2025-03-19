import { useState, useEffect } from 'react';
import { useDefaultUser, useAlpaca } from '@/hooks/useAlpaca';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MarketOverview } from '@/components/MarketOverview';
import { OrderForm } from '@/components/OrderForm';
import { PositionsTable } from '@/components/PositionsTable';
import { TradeHistory } from '@/components/TradeHistory';
import { AIStrategy } from '@/components/AIStrategy';
import { SystemLogs } from '@/components/SystemLogs';
import { ApiLinks } from '@/components/ApiLinks';
import { TradeSymbol, ChartTimeframe, TradingStrategy, TradingFrequency } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { userId, isLoading: isLoadingUser } = useDefaultUser();
  const { toast } = useToast();
  
  const {
    connected,
    positions,
    trades,
    metrics,
    logs,
    botSettings,
    apiKeyInfo,
    marketData,
    isDataLoaded,
    startBot,
    stopBot,
    saveApiKey,
    isSavingApiKey,
    saveBotSettings,
    isSavingBotSettings,
    submitOrder,
    isSubmittingOrder,
    closePosition,
    isClosingPosition,
    clearLogs,
    isClearingLogs
  } = useAlpaca(userId);

  // UI state
  const [selectedSymbol, setSelectedSymbol] = useState<TradeSymbol>('BTCUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('15min');
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);

  // Handle bot toggle
  const handleBotToggle = (active: boolean) => {
    if (!botSettings) return;
    
    saveBotSettings({
      isActive: active,
      strategy: botSettings.strategy,
      riskLevel: botSettings.riskLevel,
      tradingFrequency: botSettings.tradingFrequency
    });
    
    if (active) {
      startBot();
      toast({
        title: "Bot Started",
        description: `Trading bot started with ${botSettings.strategy} strategy.`,
      });
    } else {
      stopBot();
      toast({
        title: "Bot Stopped",
        description: "Trading bot has been stopped.",
      });
    }
  };

  // Handle strategy change
  const handleStrategyChange = (strategy: TradingStrategy) => {
    if (!botSettings) return;
    
    saveBotSettings({
      isActive: botSettings.isActive,
      strategy,
      riskLevel: botSettings.riskLevel,
      tradingFrequency: botSettings.tradingFrequency
    });
    
    toast({
      title: "Strategy Updated",
      description: `Strategy changed to ${strategy}.`,
    });
  };

  // Handle risk level change
  const handleRiskLevelChange = (level: number) => {
    if (!botSettings) return;
    
    saveBotSettings({
      isActive: botSettings.isActive,
      strategy: botSettings.strategy,
      riskLevel: level,
      tradingFrequency: botSettings.tradingFrequency
    });
  };

  // Handle trading frequency change
  const handleTradingFrequencyChange = (frequency: TradingFrequency) => {
    if (!botSettings) return;
    
    saveBotSettings({
      isActive: botSettings.isActive,
      strategy: botSettings.strategy,
      riskLevel: botSettings.riskLevel,
      tradingFrequency: frequency
    });
    
    toast({
      title: "Frequency Updated",
      description: `Trading frequency set to ${frequency}.`,
    });
  };

  // Handle API key save
  const handleSaveApiKey = (apiKey: string, secretKey: string, environment: 'paper' | 'live') => {
    saveApiKey({ apiKey, secretKey, environment });
    
    toast({
      title: "API Keys Saved",
      description: `API keys configured for ${environment} environment.`,
    });
  };

  // Handle indicator toggle
  const handleToggleIndicator = (indicator: string) => {
    setActiveIndicators(prev => 
      prev.includes(indicator) 
        ? prev.filter(i => i !== indicator) 
        : [...prev, indicator]
    );
  };

  // Handle position close
  const handleClosePosition = (symbol: string) => {
    closePosition({ symbol });
    
    toast({
      title: "Position Closed",
      description: `Closed position for ${symbol}.`,
    });
  };

  // Loading state
  if (isLoadingUser || !isDataLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121722]">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-[#2962FF] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-[#B7BDC6] text-lg">Loading trading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header 
        isConnected={connected} 
        isWebSocketConnected={connected}
        metrics={metrics}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          botSettings={botSettings}
          metrics={metrics}
          apiKeyInfo={apiKeyInfo}
          onBotToggle={handleBotToggle}
          onStrategyChange={handleStrategyChange}
          onRiskLevelChange={handleRiskLevelChange}
          onTradingFrequencyChange={handleTradingFrequencyChange}
          onSaveApiKey={handleSaveApiKey}
          isSavingApiKey={isSavingApiKey}
          isSavingSettings={isSavingBotSettings}
        />
        
        <main className="flex-1 overflow-y-auto p-4 grid grid-cols-12 gap-4">
          <MarketOverview
            selectedSymbol={selectedSymbol}
            selectedTimeframe={selectedTimeframe}
            activeIndicators={activeIndicators}
            onSymbolChange={setSelectedSymbol}
            onTimeframeChange={setSelectedTimeframe}
            onToggleIndicator={handleToggleIndicator}
            marketData={marketData[selectedSymbol]}
          />
          
          <OrderForm 
            onSubmitOrder={submitOrder} 
            isSubmitting={isSubmittingOrder} 
            userId={userId}
          />
          
          <PositionsTable 
            positions={positions} 
            onClosePosition={handleClosePosition}
            isClosingPosition={isClosingPosition}
          />
          
          <TradeHistory trades={trades} />
          
          <div className="col-span-12 grid grid-cols-12 gap-4">
            <AIStrategy botSettings={botSettings} />
            <SystemLogs 
              logs={logs} 
              onClearLogs={clearLogs}
              isClearing={isClearingLogs}
            />
          </div>
          
          <ApiLinks />
        </main>
      </div>
    </div>
  );
}

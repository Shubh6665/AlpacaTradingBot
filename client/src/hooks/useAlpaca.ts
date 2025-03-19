import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from './useWebSocket';
import {
  Position, 
  Trade, 
  PerformanceMetrics, 
  BotSettings, 
  LogEntry,
  TradingStrategy,
  TradingFrequency,
  OrderSide,
  OrderType,
  TimeInForce,
  ApiKeyInfo,
  MarketData,
  InitialData
} from '@/lib/types';

export function useAlpaca(userId: number | null) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const queryClient = useQueryClient();
  
  // Connect to WebSocket
  const { connected, sendMessage, addMessageListener } = useWebSocket(userId);
  
  // Handle WebSocket messages
  useEffect(() => {
    if (!connected) return;
    
    const removeListener = addMessageListener((message) => {
      if (message.type === 'initialData') {
        const data = message.data as InitialData;
        setPositions(data.positions || []);
        setTrades(data.trades || []);
        setMetrics(data.metrics || null);
        setLogs(data.logs || []);
        setBotSettings(data.botSettings || null);
        setApiKeyInfo({ hasApiKey: data.hasApiKey, environment: 'paper' });
        setIsDataLoaded(true);
      } else if (message.type === 'marketData') {
        const data = message.data as MarketData;
        setMarketData(prev => ({
          ...prev,
          [data.symbol]: data
        }));
      } else if (message.type === 'accountUpdate') {
        if (message.data.positions) setPositions(message.data.positions);
        if (message.data.metrics) setMetrics(message.data.metrics);
      } else if (message.type === 'newLog') {
        setLogs(prev => [message.data, ...prev].slice(0, 100));
      } else if (message.type === 'logsClear') {
        setLogs([]);
      } else if (message.type === 'botSettingsUpdate') {
        setBotSettings(message.data);
      } else if (message.type === 'apiKeyUpdate') {
        setApiKeyInfo(message.data);
      } else if (message.type === 'orderUpdate') {
        // Refresh trades list
        fetchTrades();
      } else if (message.type === 'positionClosed') {
        setPositions(prev => prev.filter(p => p.symbol !== message.data.symbol));
      } else if (message.type === 'strategySignal') {
        // Update latest strategy signals
        // In a real app, you might want to store these signals
      }
    });
    
    return () => {
      removeListener();
    };
  }, [connected, addMessageListener]);
  
  // Get initial data from API if not loaded yet
  useEffect(() => {
    if (userId && !isDataLoaded) {
      fetchPositions();
      fetchTrades();
      fetchMetrics();
      fetchLogs();
      fetchBotSettings();
      fetchApiKeyInfo();
    }
  }, [userId, isDataLoaded]);
  
  // API request handlers
  const fetchPositions = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/positions/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  }, [userId]);
  
  const fetchTrades = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/trades/${userId}?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data);
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  }, [userId]);
  
  const fetchMetrics = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/metrics/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [userId]);
  
  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/logs/${userId}?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }, [userId]);
  
  const fetchBotSettings = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/bot-settings/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setBotSettings(data);
      }
    } catch (error) {
      console.error('Error fetching bot settings:', error);
    }
  }, [userId]);
  
  const fetchApiKeyInfo = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/api-keys/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setApiKeyInfo(data);
      } else if (response.status === 404) {
        setApiKeyInfo({ hasApiKey: false, environment: 'paper' });
      }
    } catch (error) {
      console.error('Error fetching API key info:', error);
    }
  }, [userId]);
  
  // Bot control actions
  const startBot = useCallback(() => {
    if (!connected || !userId) return false;
    
    return sendMessage({ type: 'startBot' });
  }, [connected, userId, sendMessage]);
  
  const stopBot = useCallback(() => {
    if (!connected || !userId) return false;
    
    return sendMessage({ type: 'stopBot' });
  }, [connected, userId, sendMessage]);
  
  // API key mutation
  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ apiKey, secretKey, environment }: { apiKey: string, secretKey: string, environment: 'paper' | 'live' }) => {
      if (!userId) throw new Error('User ID is required');
      
      try {
        const response = await apiRequest('POST', '/api/api-keys', {
          userId,
          alpacaApiKey: apiKey,
          alpacaSecretKey: secretKey,
          environment
        });
        
        return response.json();
      } catch (error) {
        console.error("Error saving API keys:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      fetchApiKeyInfo();
    },
    onError: (error) => {
      console.error("API Key mutation error:", error);
    }
  });
  
  // Bot settings mutation
  const saveBotSettingsMutation = useMutation({
    mutationFn: async ({ 
      isActive, 
      strategy, 
      riskLevel, 
      tradingFrequency 
    }: { 
      isActive: boolean, 
      strategy: TradingStrategy, 
      riskLevel: number, 
      tradingFrequency: TradingFrequency 
    }) => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await apiRequest('POST', '/api/bot-settings', {
        userId,
        isActive,
        strategy,
        riskLevel,
        tradingFrequency
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-settings'] });
      fetchBotSettings();
    }
  });
  
  // Order submission mutation
  const submitOrderMutation = useMutation({
    mutationFn: async ({ 
      symbol, 
      qty, 
      side, 
      type, 
      timeInForce, 
      limitPrice, 
      stopPrice 
    }: { 
      symbol: string, 
      qty: number, 
      side: OrderSide, 
      type: OrderType, 
      timeInForce: TimeInForce, 
      limitPrice?: number, 
      stopPrice?: number 
    }) => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await apiRequest('POST', '/api/orders', {
        userId,
        symbol,
        qty,
        side,
        type,
        time_in_force: timeInForce,
        limit_price: limitPrice,
        stop_price: stopPrice
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      fetchTrades();
      fetchPositions();
      fetchMetrics();
    }
  });
  
  // Close position mutation
  const closePositionMutation = useMutation({
    mutationFn: async ({ symbol }: { symbol: string }) => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await apiRequest('POST', '/api/positions/close', {
        userId,
        symbol
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      fetchPositions();
      fetchTrades();
      fetchMetrics();
    }
  });
  
  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await apiRequest('DELETE', `/api/logs/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      setLogs([]);
    }
  });
  
  // Add log mutation
  const addLogMutation = useMutation({
    mutationFn: async ({ level, message }: { level: string, message: string }) => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await apiRequest('POST', '/api/logs', {
        userId,
        level,
        message
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      setLogs(prev => [data, ...prev].slice(0, 100));
    }
  });
  
  return {
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
    saveApiKey: saveApiKeyMutation.mutate,
    isSavingApiKey: saveApiKeyMutation.isPending,
    saveBotSettings: saveBotSettingsMutation.mutate,
    isSavingBotSettings: saveBotSettingsMutation.isPending,
    submitOrder: submitOrderMutation.mutate,
    isSubmittingOrder: submitOrderMutation.isPending,
    closePosition: closePositionMutation.mutate,
    isClosingPosition: closePositionMutation.isPending,
    clearLogs: clearLogsMutation.mutate,
    isClearingLogs: clearLogsMutation.isPending,
    addLog: addLogMutation.mutate,
    isAddingLog: addLogMutation.isPending,
    fetchPositions,
    fetchTrades,
    fetchMetrics,
    fetchLogs,
    fetchBotSettings,
    fetchApiKeyInfo
  };
}

// Hook to get the default user ID
export function useDefaultUser() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/default-user'],
    staleTime: Infinity,
  });
  
  return {
    userId: data?.userId || null,
    isLoading,
    error
  };
}

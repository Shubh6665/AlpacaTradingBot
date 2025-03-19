import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketMessage } from '@/lib/types';

export function useWebSocket(userId: number | null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!userId) return;
    
    // Close existing socket if any
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        setConnected(true);
        setError(null);
        
        // Send authentication
        socket.send(JSON.stringify({
          type: 'auth',
          userId
        }));
      };
      
      socket.onclose = () => {
        setConnected(false);
        
        // Attempt to reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
      
      socket.onerror = (event) => {
        setError('WebSocket connection error');
        console.error('WebSocket error:', event);
      };
    } catch (err) {
      setError('Failed to connect to WebSocket');
      console.error('WebSocket connection failed:', err);
    }
  }, [userId]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setConnected(false);
  }, []);
  
  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  // Add message listener
  const addMessageListener = useCallback((callback: (message: any) => void) => {
    if (!socketRef.current) return () => {};
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    
    socketRef.current.addEventListener('message', handleMessage);
    
    return () => {
      if (socketRef.current) {
        socketRef.current.removeEventListener('message', handleMessage);
      }
    };
  }, []);
  
  // Connect on mount and reconnect when userId changes
  useEffect(() => {
    if (userId) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);
  
  return {
    connected,
    error,
    sendMessage,
    addMessageListener,
    connect,
    disconnect
  };
}

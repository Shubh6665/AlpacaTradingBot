import { AccountInfo, AlpacaPosition, OrderRequest, OrderResponse, MarketData } from "@shared/schema";

// Flag to enable test mode for development
const ENABLE_TEST_MODE = false;

export class AlpacaClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private dataUrl: string;
  private isTestMode: boolean;

  constructor(apiKey: string, secretKey: string, isPaper: boolean = true) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = isPaper
      ? "https://paper-api.alpaca.markets/v2"
      : "https://api.alpaca.markets";
    this.dataUrl = "https://data.alpaca.markets";
    
    // Check if we're using test mode
    // In test mode, allow hardcoded keys like 'TEST_KEY' to pass validation
    this.isTestMode = ENABLE_TEST_MODE && 
      (this.apiKey === 'TEST_KEY' || this.apiKey.startsWith('TEST_'));
  }

  private async makeRequest(
    endpoint: string,
    method: string = "GET",
    data?: any,
    isData: boolean = false
  ): Promise<any> {
    // If in test mode, return mock data
    if (this.isTestMode) {
      return this.getMockData(endpoint, method, data);
    }
    
    const url = `${isData ? this.dataUrl : this.baseUrl}${endpoint}`;
    
    const headers = {
      "APCA-API-KEY-ID": this.apiKey,
      "APCA-API-SECRET-KEY": this.secretKey,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API Error: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Alpaca API request failed:", error);
      throw error;
    }
  }
  
  // Generate mock data for testing
  private getMockData(endpoint: string, method: string, data?: any): any {
    // Mock account data
    if (endpoint === "/v2/account") {
      return {
        id: "mock-account-id",
        cash: "10000.00",
        portfolio_value: "15000.00",
        buying_power: "10000.00",
        equity: "15000.00",
        status: "ACTIVE"
      };
    }
    
    // Mock order submission
    if (endpoint === "/v2/orders" && method === "POST") {
      const order = data as OrderRequest;
      return {
        id: `mock-order-${Date.now()}`,
        client_order_id: `mock-client-order-${Date.now()}`,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        qty: order.qty.toString(),
        filled_qty: "0",
        status: "new",
        created_at: new Date().toISOString(),
        limit_price: order.limit_price?.toString(),
        stop_price: order.stop_price?.toString()
      };
    }
    
    // Mock positions
    if (endpoint === "/v2/positions") {
      if (method === "DELETE") {
        // Simulate close all positions
        return [];
      }
      
      // Return mock positions
      return [
        {
          asset_id: "mock-asset-btc",
          symbol: "BTCUSD",
          qty: "0.05",
          avg_entry_price: "25000.00",
          market_value: "1300.00",
          current_price: "26000.00",
          unrealized_pl: "50.00",
          unrealized_plpc: "0.038",
          side: "long"
        },
        {
          asset_id: "mock-asset-eth",
          symbol: "ETHUSD",
          qty: "1.2",
          avg_entry_price: "1600.00",
          market_value: "1980.00",
          current_price: "1650.00",
          unrealized_pl: "60.00",
          unrealized_plpc: "0.031",
          side: "long"
        }
      ];
    }
    
    // Mock a single position
    if (endpoint.startsWith("/v2/positions/")) {
      const symbol = endpoint.split("/").pop();
      return {
        asset_id: `mock-asset-${symbol?.toLowerCase()}`,
        symbol: symbol,
        qty: "1.0",
        avg_entry_price: symbol === "BTCUSD" ? "25000.00" : "1600.00",
        market_value: symbol === "BTCUSD" ? "26000.00" : "1650.00",
        current_price: symbol === "BTCUSD" ? "26000.00" : "1650.00",
        unrealized_pl: "50.00",
        unrealized_plpc: "0.02",
        side: "long"
      };
    }
    
    // Mock orders list
    if (endpoint.startsWith("/v2/orders") && method === "GET") {
      return [
        {
          id: "mock-order-1",
          client_order_id: "mock-client-order-1",
          symbol: "BTCUSD",
          side: "buy",
          type: "market",
          qty: "0.1",
          filled_qty: "0.1",
          status: "filled",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          filled_at: new Date(Date.now() - 3590000).toISOString()
        }
      ];
    }
    
    // By default return an empty object
    return {};
  }

  // Account endpoints
  async getAccount(): Promise<AccountInfo> {
    try {
      // Add a paper trading check to ensure proper endpoint usage
      const isPaper = this.baseUrl.includes("paper-api");
      const url = `${isPaper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets"}/v2/account`;
      
      const response = await fetch(url, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Alpaca API Error: ${response.status} - ${await response.text()}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Account validation error:", error);
      throw error;
    }
  }

  // Market Data endpoints
  async getLatestQuote(symbol: string): Promise<any> {
    return this.makeRequest(`/v2/stocks/${symbol}/quotes/latest`, "GET", undefined, true);
  }

  async getBars(
    symbol: string,
    timeframe: string = "1D",
    start: string,
    end: string,
    limit: number = 100
  ): Promise<any> {
    const params = new URLSearchParams({
      symbols: symbol,
      timeframe,
      start,
      end,
      limit: limit.toString(),
    });
    
    return this.makeRequest(`/v2/stocks/bars?${params.toString()}`, "GET", undefined, true);
  }

  // Order endpoints
  async submitOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    return this.makeRequest("/v2/orders", "POST", orderRequest);
  }

  async getOrders(status: string = "all", limit: number = 100): Promise<OrderResponse[]> {
    const params = new URLSearchParams({
      status,
      limit: limit.toString(),
    });
    
    return this.makeRequest(`/v2/orders?${params.toString()}`);
  }

  async getOrder(orderId: string): Promise<OrderResponse> {
    return this.makeRequest(`/v2/orders/${orderId}`);
  }

  async cancelOrder(orderId: string): Promise<void> {
    return this.makeRequest(`/v2/orders/${orderId}`, "DELETE");
  }

  async cancelAllOrders(): Promise<void> {
    return this.makeRequest("/v2/orders", "DELETE");
  }

  // Position endpoints
  async getPositions(): Promise<AlpacaPosition[]> {
    return this.makeRequest("/v2/positions");
  }

  async getPosition(symbol: string): Promise<AlpacaPosition> {
    return this.makeRequest(`/v2/positions/${symbol}`);
  }

  async closePosition(symbol: string): Promise<OrderResponse> {
    return this.makeRequest(`/v2/positions/${symbol}`, "DELETE");
  }

  async closeAllPositions(): Promise<OrderResponse[]> {
    return this.makeRequest("/v2/positions", "DELETE");
  }

  // WebSocket connection string
  getWebSocketUrl(): string {
    // In test mode, we don't need a real WebSocket URL
    if (this.isTestMode) {
      return 'ws://localhost:8080/mock';
    }
    
    const environment = this.baseUrl.includes("paper") ? "paper" : "live";
    return `wss://${environment}-api.alpaca.markets/stream`;
  }

  getCryptoWebSocketUrl(): string {
    // In test mode, we don't need a real WebSocket URL
    if (this.isTestMode) {
      return 'ws://localhost:8080/mock-crypto';
    }
    
    return "wss://stream.data.alpaca.markets/v1beta1/crypto";
  }

  // Websocket authentication payload
  getWebSocketAuthPayload(): any {
    return {
      action: "auth",
      key: this.apiKey,
      secret: this.secretKey,
    };
  }
  
  // Generate mock WebSocket data for testing
  generateMockMarketData(symbol: string): MarketData {
    // Use a sine wave pattern to generate price movements for mock data
    const now = Date.now();
    const basePrice = symbol === 'BTCUSD' ? 26000 : 
                     symbol === 'ETHUSD' ? 1650 : 
                     symbol === 'SOLUSD' ? 110 : 65; // Default for AVAX
                     
    // Generate a sine wave with some randomness
    const hourOfDay = new Date().getHours() + new Date().getMinutes() / 60;
    const dailyCycle = Math.sin(hourOfDay / 24 * Math.PI * 2);
    const randomness = (Math.random() - 0.5) * 0.01; // Small random component
    
    // Calculate price change as a percentage of the base price
    const changePercent = dailyCycle * 0.02 + randomness; // Max +/- 2% plus randomness
    const change = basePrice * changePercent;
    const price = basePrice + change;
    
    return {
      symbol,
      price,
      timestamp: now,
      change,
      changePercent
    };
  }

  // Subscribe to market data via websocket
  getWebSocketSubscribePayload(streams: string[]): any {
    return {
      action: "subscribe",
      trades: streams.map(symbol => `T.${symbol}`),
      quotes: streams.map(symbol => `Q.${symbol}`),
      bars: streams.map(symbol => `B.${symbol}`),
    };
  }

  // Market status
  async getMarketClock(): Promise<any> {
    return this.makeRequest("/v2/clock");
  }

  async getMarketCalendar(start?: string, end?: string): Promise<any> {
    const params = new URLSearchParams();
    if (start) params.append("start", start);
    if (end) params.append("end", end);
    
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.makeRequest(`/v2/calendar${queryString}`);
  }

  // Assets
  async getAssets(status: string = 'active'): Promise<any> {
    return this.makeRequest(`/v2/assets?status=${status}`);
  }
}

// Singleton instance with environment variables
let alpacaInstance: AlpacaClient | null = null;

export function getAlpacaClient(apiKey?: string, secretKey?: string, isPaper: boolean = true): AlpacaClient {
  // Always create a new instance if explicit credentials are provided
  if (apiKey && secretKey) {
    return new AlpacaClient(apiKey, secretKey, isPaper);
  }
  
  // Use singleton for environment variables or test mode
  if (!alpacaInstance) {
    const envApiKey = process.env.APCA-API-KEY || "TEST_KEY";
    const envSecretKey = process.env.APCA-API-SECRET-KEY || "TEST_SECRET";
    
    alpacaInstance = new AlpacaClient(envApiKey, envSecretKey, isPaper);
  }
  
  return alpacaInstance;
}

// Parse websocket messages
export function parseAlpacaWebSocketMessage(message: any): MarketData | null {
  try {
    // Handle mock data format (direct MarketData objects)
    if (message && message.type === 'mock' && message.data) {
      return message.data as MarketData;
    }
    
    if (!message || !message.data) return null;
    
    const data = message.data;
    
    // Check if it's a bar update
    if (message.stream && message.stream.startsWith('B.')) {
      const symbol = message.stream.split('.')[1];
      return {
        symbol,
        price: parseFloat(data.c),
        timestamp: new Date(data.t).getTime(),
        change: 0, // Calculate these based on previous data
        changePercent: 0,
      };
    }
    
    // Check if it's a trade update
    if (message.stream && message.stream.startsWith('T.')) {
      const symbol = message.stream.split('.')[1];
      return {
        symbol,
        price: parseFloat(data.p),
        timestamp: new Date(data.t).getTime(),
        change: 0,
        changePercent: 0,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing Alpaca WebSocket message:", error);
    return null;
  }
}

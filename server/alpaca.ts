import { AccountInfo, AlpacaPosition, OrderRequest, OrderResponse, MarketData } from "@shared/schema";

export class AlpacaClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private dataUrl: string;

  constructor(apiKey: string, secretKey: string, isPaper: boolean = true) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = isPaper
      ? "https://paper-api.alpaca.markets"
      : "https://api.alpaca.markets";
    this.dataUrl = "https://data.alpaca.markets";
  }

  private async makeRequest(
    endpoint: string,
    method: string = "GET",
    data?: any,
    isData: boolean = false
  ): Promise<any> {
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

  // Account endpoints
  async getAccount(): Promise<AccountInfo> {
    return this.makeRequest("/v2/account");
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
    const environment = this.baseUrl.includes("paper") ? "paper" : "live";
    return `wss://${environment}-api.alpaca.markets/stream`;
  }

  getCryptoWebSocketUrl(): string {
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
  if (!alpacaInstance) {
    const envApiKey = apiKey || process.env.ALPACA_API_KEY || "";
    const envSecretKey = secretKey || process.env.ALPACA_SECRET_KEY || "";
    
    if (!envApiKey || !envSecretKey) {
      throw new Error("Alpaca API credentials are not configured");
    }
    
    alpacaInstance = new AlpacaClient(envApiKey, envSecretKey, isPaper);
  }
  
  return alpacaInstance;
}

// Parse websocket messages
export function parseAlpacaWebSocketMessage(message: any): MarketData | null {
  try {
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

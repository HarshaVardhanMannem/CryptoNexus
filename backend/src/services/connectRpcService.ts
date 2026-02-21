import { ConnectRouter } from '@bufbuild/connect';
import { expressConnectMiddleware } from '@bufbuild/connect-express';
import { createTickerScraper } from '../playwright/scraper';
import { TickerService } from '../../gen/proto/ticker_connect';
import { TickerRequest, PriceUpdate } from '../../gen/proto/ticker_pb';
import { CONFIG } from '../config/constants';

class ConnectRpcService {
  private subscriptions = new Map<string, Set<string>>(); // symbol -> clientIds
  private scrapers = new Map<string, any>(); // symbol -> scraper
  private priceCallbacks = new Map<string, (price: number, timestamp: string) => void>(); // symbol -> callback
  private clientStreams = new Map<string, any>(); // clientId -> stream context
  private clientSymbols = new Map<string, string>(); // clientId -> symbol
  private lastPriceBySymbol = new Map<string, PriceUpdate>(); // symbol -> last PriceUpdate
  private cleanupTimers = new Map<string, NodeJS.Timeout>(); // symbol -> timer

  constructor() {
    console.log('[ConnectRpcService] ConnectRPC service initialized');
  }

  private normalizeSymbol(input: string): string {
    return (input || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  // Create the middleware with our service implementation
  createMiddleware() {
    return expressConnectMiddleware({
      routes: (router: ConnectRouter) => {
        router.service(TickerService, {
          // Server streaming for real-time price updates
          subscribeTicker: async function* (this: ConnectRpcService, request: TickerRequest, context: any) {
            const service = this as ConnectRpcService;
            const symbol = service.normalizeSymbol(request.symbol);
            
            // Get client ID from headers or generate one
            const clientId = context.header?.get?.('x-client-id') || 
                           context.request?.headers?.['x-client-id'] || 
                           `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`[ConnectRpcService] Client ${clientId} subscribing to ${symbol}`);
            
            // Add client to symbol subscription
            if (!service.subscriptions.has(symbol)) {
              service.subscriptions.set(symbol, new Set());
            }
            service.subscriptions.get(symbol)!.add(clientId);

            // Start scraping only if there is no cached price for this symbol
            const hasCachedPrice = service.lastPriceBySymbol.has(service.normalizeSymbol(symbol));
            if (!hasCachedPrice) {
              // Cancel any pending cleanup for this symbol (rapid reconnect)
              const pending = service.cleanupTimers.get(symbol);
              if (pending) {
                clearTimeout(pending);
                service.cleanupTimers.delete(symbol);
              }
              await service.startScraping(symbol);
            }

            // Store the stream context and symbol for this client
            service.clientStreams.set(clientId, context);
            service.clientSymbols.set(clientId, symbol);

            try {
              // Yield price updates from the stream
              yield* service.createPriceStream(symbol, clientId);
            } catch (error) {
              console.error(`[ConnectRpcService] Error in stream for ${symbol}:`, error);
              // Clean up on error
              await service.handleClientDisconnect(clientId);
              throw error;
            }
          }.bind(this),

          // Simple RPC to unsubscribe
          unsubscribeTicker: async (request: TickerRequest, context: any) => {
            const symbol = this.normalizeSymbol(request.symbol);
            const clientId = context.header?.get?.('x-client-id') || 
                           context.request?.headers?.['x-client-id'];

            if (!clientId) {
              throw new Error('Missing x-client-id header for unsubscribe');
            }

            console.log(`[ConnectRpcService] Client ${clientId} unsubscribing from ${symbol}`);

            await this.handleClientDisconnect(clientId);

            // Return success response
            return new PriceUpdate({
              symbol,
              price: 0,
              isoTimestamp: new Date().toISOString()
            });
          }
        });
      }
    });
  }

  private async *createPriceStream(symbol: string, clientId: string): AsyncGenerator<PriceUpdate> {
    console.log(`[ConnectRpcService] Creating price stream for ${symbol} (client: ${clientId})`);
    
    // Create a promise that resolves when the client disconnects
    // If the transport does not provide a signal, this promise will never resolve,
    // and the stream will only progress on price updates (desired behavior).
    const disconnectPromise = new Promise<void>((resolve) => {
      const stream = this.clientStreams.get(clientId);
      if (stream && stream.signal) {
        // Listen for client disconnect
        stream.signal.addEventListener('abort', () => {
          console.log(`[ConnectRpcService] Client ${clientId} disconnected from ${symbol}`);
          resolve();
        });
      } else {
        console.warn(`[ConnectRpcService] No abort signal for client ${clientId}; stream will rely on price updates.`);
        // Intentionally do not resolve; this keeps the race waiting for price updates only.
      }
    });

    try {
      // Create a queue for price updates
      const priceQueue: PriceUpdate[] = [];
      let resolveNextPrice: ((value: PriceUpdate) => void) | null = null;
      
      // Set up callback for price updates
      const priceCallback = (price: number, isoTimestamp: string) => {
        const priceUpdate = new PriceUpdate({
          symbol,
          price,
          isoTimestamp
        });
        
        if (resolveNextPrice) {
          resolveNextPrice(priceUpdate);
          resolveNextPrice = null;
        } else {
          priceQueue.push(priceUpdate);
        }
      };
      
      // Store callback for this client
      this.priceCallbacks.set(`${symbol}-${clientId}`, priceCallback);

      // If we have a cached last price for this symbol, yield it immediately
      const cached = this.lastPriceBySymbol.get(this.normalizeSymbol(symbol));
      if (cached) {
        console.log(`[ConnectRpcService] Sending cached price for ${symbol} to client ${clientId}: $${cached.price}`);
        yield cached;
      } else {
        // No cached price; wait for first live update
        console.log(`[ConnectRpcService] Stream established for ${symbol}, waiting for first price update`);
      }

      while (true) {
        // Get next price update or wait for disconnect
        let nextPrice: PriceUpdate;
        
        if (priceQueue.length > 0) {
          nextPrice = priceQueue.shift()!;
        } else {
          const pricePromise = new Promise<PriceUpdate>((resolve) => {
            resolveNextPrice = resolve;
          });
          
          const result = await Promise.race([pricePromise, disconnectPromise]);
          
          if (result === undefined) {
            // Client disconnected
            console.log(`[ConnectRpcService] Client ${clientId} disconnected, stopping stream for ${symbol}`);
            break;
          }
          
          nextPrice = result as PriceUpdate;
        }
        
        // Yield the price update
        yield nextPrice;
      }
    } finally {
      // Cleanup when stream ends
      await this.handleClientDisconnect(clientId);
    }
  }

  private async handleClientDisconnect(clientId: string) {
    console.log(`[ConnectRpcService] Handling client disconnect for ${clientId}`);
    
    const symbol = this.clientSymbols.get(clientId);
    if (!symbol) {
      console.warn(`[ConnectRpcService] No symbol found for client ${clientId}`);
      return;
    }

    // Remove client from symbol subscription
    const clients = this.subscriptions.get(symbol);
    if (clients) {
      clients.delete(clientId);
      console.log(`[ConnectRpcService] Removed client ${clientId} from ${symbol} subscription`);

      // If no more clients for this symbol, clean up immediately
      if (clients.size === 0) {
        console.log(`[ConnectRpcService] No more clients for ${symbol}, performing immediate cleanup`);
        const existing = this.cleanupTimers.get(symbol);
        if (existing) {
          clearTimeout(existing);
          this.cleanupTimers.delete(symbol);
        }
        await this.stopScraping(symbol);
        this.subscriptions.delete(symbol);
      }
    }

    // Clean up client-specific data
    this.clientStreams.delete(clientId);
    this.clientSymbols.delete(clientId);
    this.priceCallbacks.delete(`${symbol}-${clientId}`);
    
    console.log(`[ConnectRpcService] Cleaned up client ${clientId} for symbol ${symbol}`);
  }

  private async startScraping(symbol: string) {
    console.log(`[ConnectRpcService] Starting scraping for ${symbol}`);

    try {
      const scraper = await createTickerScraper(symbol);

      const priceCallback = (price: number, isoTimestamp: string) => {
        console.log(`[ConnectRpcService] Price update for ${symbol}: $${price} at ${isoTimestamp}`);
        // Update cache for this symbol on every change
        const cachedUpdate = new PriceUpdate({ symbol: this.normalizeSymbol(symbol), price, isoTimestamp });
        this.lastPriceBySymbol.set(this.normalizeSymbol(symbol), cachedUpdate);
        
        // Notify all callbacks for this symbol
        for (const [key, callback] of this.priceCallbacks) {
          if (key.startsWith(`${this.normalizeSymbol(symbol)}-`)) {
            callback(price, isoTimestamp);
          }
        }
      };

      this.scrapers.set(symbol, scraper);

      // Start the scraper
      scraper.start(priceCallback);

    } catch (error) {
      console.error(`[ConnectRpcService] Error starting scraper for ${symbol}:`, error);
      throw error;
    }
  }

  private async stopScraping(symbol: string) {
    const normalized = this.normalizeSymbol(symbol);
    console.log(`[ConnectRpcService] Stopping scraping for ${normalized}`);

    const scraper = this.scrapers.get(normalized) || this.scrapers.get(symbol);
    if (scraper) {
      await scraper.stop();
      this.scrapers.delete(normalized);
      this.scrapers.delete(symbol);
      console.log(`[ConnectRpcService] Scraper stopped and browser closed for ${normalized}`);
    }

    // Clean up callbacks for this symbol
    for (const key of Array.from(this.priceCallbacks.keys())) {
      if (key.startsWith(`${normalized}-`) || key.startsWith(`${symbol}-`)) {
        this.priceCallbacks.delete(key);
      }
    }

    // Clear cached price for this symbol
    this.lastPriceBySymbol.delete(normalized);
    this.lastPriceBySymbol.delete(symbol);
  }

  public getStats() {
    return {
      connectedClients: this.clientStreams.size,
      activeSubscriptions: this.subscriptions.size,
      symbols: Array.from(this.subscriptions.keys()),
      activeScrapers: this.scrapers.size
    };
  }
}

export { ConnectRpcService };

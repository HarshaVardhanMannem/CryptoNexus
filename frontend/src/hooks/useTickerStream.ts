import { useEffect, useRef, useState } from 'react';
import { createConnectTransport } from '@bufbuild/connect-web';
import { createPromiseClient } from '@bufbuild/connect';
import { TickerService } from '../../gen/proto/ticker_connect';
import { TickerRequest } from '../../gen/proto/ticker_pb';
import { CONFIG } from '../config/constants';

// Local type definitions
type PriceUpdate = {
  symbol: string;
  price: number;
  isoTimestamp: string;
};

export function useTickerStream(baseUrl = CONFIG.DEFAULT_API_URL) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const streamsRef = useRef<Map<string, AbortController>>(new Map());
  const clientIdsRef = useRef<Map<string, string>>(new Map());
  const clientRef = useRef<any>(null);

  function normalizeSymbol(input: string): string {
    return (input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function addUpdate(update: PriceUpdate) {
    console.log(`[useTickerStream] Received price update for ${update.symbol}: $${update.price}`);
    setPrices((prev) => ({ ...prev, [update.symbol]: update }));
  }

  // Create ConnectRPC client once and reuse
  useEffect(() => {
    const transport = createConnectTransport({
      baseUrl,
      useHttpGet: false, // Server streaming requires POST requests
    });
        
    clientRef.current = createPromiseClient(TickerService, transport);
    console.log('[useTickerStream] ConnectRPC client initialized');

    return () => {
      // Clean up any active streams
      streamsRef.current.forEach((controller) => {
        controller.abort();
      });
      streamsRef.current.clear();
      subscriptionsRef.current.clear();
    };
  }, [baseUrl]);

  async function subscribe(rawSymbol: string) {
    const symbol = normalizeSymbol(rawSymbol);
    console.log('[useTickerStream] subscribing to', symbol);
        
    // Prevent duplicate subscriptions
    if (subscriptionsRef.current.has(symbol)) {
      console.log(`[useTickerStream] Already subscribed to ${symbol}`);
      return;
    }
        
    // Add to local subscriptions
    subscriptionsRef.current.add(symbol);
        
    // Reset error and set initial loading state
    setErrors((prev) => {
      const clone = { ...prev };
      delete clone[symbol];
      return clone;
    });
    setPrices((prev) => ({ ...prev, [symbol]: null }));

    // Create abort controller for this stream
    const abortController = new AbortController();
    streamsRef.current.set(symbol, abortController);

    try {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }

      // Create server stream for real-time updates
      const request = new TickerRequest({ symbol });
      const clientId = clientIdsRef.current.get(symbol) || `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      clientIdsRef.current.set(symbol, clientId);
            
      const stream = clientRef.current.subscribeTicker(request, {
        signal: abortController.signal,
        headers: {
          'x-client-id': clientId
        }
      });

      console.log(`[useTickerStream] Started stream for ${symbol} with client ID: ${clientId}`);

      // Process stream
      for await (const response of stream) {
        // Check if we're still subscribed (user might have unsubscribed)
        if (!subscriptionsRef.current.has(symbol)) {
          console.log(`[useTickerStream] No longer subscribed to ${symbol}, breaking stream`);
          break;
        }

        if (response.symbol && response.price !== undefined && response.isoTimestamp) {
          addUpdate({
            symbol: normalizeSymbol(response.symbol),
            price: response.price,
            isoTimestamp: response.isoTimestamp
          });
        }
      }

    } catch (error) {
      // Check if error is due to abort (user unsubscribed)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[useTickerStream] Stream for ${symbol} was aborted`);
        return;
      }

      console.error(`[useTickerStream] Error subscribing to ${symbol}:`, error);
            
      // Clean up on error
      subscriptionsRef.current.delete(symbol);
      streamsRef.current.delete(symbol);
      setPrices((prev) => {
        const clone = { ...prev };
        delete clone[symbol];
        return clone;
      });

      // Surface a user-friendly error message in UI
      setErrors((prev) => ({
        ...prev,
        [symbol]: 'Invalid or unsupported symbol. Please recheck and try again.'
      }));
    }
  }

  async function unsubscribe(symbol: string) {
    console.log('[useTickerStream] unsubscribing from', symbol);
        
    // Remove from local subscriptions
    subscriptionsRef.current.delete(symbol);
        
    // Abort the stream
    const controller = streamsRef.current.get(symbol);
    if (controller) {
      controller.abort();
      streamsRef.current.delete(symbol);
    }

    try {
      if (!clientRef.current) {
        console.warn('Client not initialized for unsubscribe');
        return;
      }

      const request = new TickerRequest({ symbol });
      const clientId = clientIdsRef.current.get(symbol);
      if (!clientId) {
        console.warn(`[useTickerStream] Missing clientId for ${symbol} during unsubscribe; skipping backend call`);
      } else {
        await clientRef.current.unsubscribeTicker(request, {
          headers: {
            'x-client-id': clientId
          }
        });
      }
            
    } catch (error) {
      console.error(`[useTickerStream] Error unsubscribing from ${symbol}:`, error);
    }

    // Remove from local state
    setPrices((prev) => {
      const clone = { ...prev };
      delete clone[symbol];
      return clone;
    });

    // Clear any error for this symbol
    setErrors((prev) => {
      const clone = { ...prev };
      delete clone[symbol];
      return clone;
    });

    // Remove stored clientId after unsubscribe
    clientIdsRef.current.delete(symbol);
  }

  return { prices, errors, subscribe, unsubscribe };
}
import { chromium, Browser, BrowserContext } from 'playwright';
import { CONFIG, BROWSER_ARGS } from '../config/constants';

let browser: Browser | null = null;
// Track last-used time per context for simple LRU eviction when under pressure
const activeContexts = new Map<string, { ctx: BrowserContext; lastUsed: number }>();
const MAX_CONTEXTS = 16; // soft cap on concurrent contexts

export async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  
  // Launch in headed mode (headed = not headless) as required
  browser = await chromium.launch({ 
    headless: false, 
    args: [...BROWSER_ARGS]
  });
  
  console.log('[browserManager] Launched browser (headed mode) for scalable resource sharing.');
  
  // Handle browser crashes
  browser.on('disconnected', () => {
    console.log('[browserManager] Browser disconnected, will restart on next request');
    browser = null;
    activeContexts.clear();
  });
  
  return browser;
}

export async function getContextForSymbol(symbol: string): Promise<BrowserContext> {
  const existing = activeContexts.get(symbol);
  if (existing) {
    const pages = existing.ctx.pages();
    const isClosed = typeof (existing.ctx as any).isClosed === 'function' ? (existing.ctx as any).isClosed() : false;
    if (pages.length && !isClosed) {
      existing.lastUsed = Date.now();
      console.log(`[browserManager] Reusing existing context for ${symbol}`);
      return existing.ctx;
    }
    activeContexts.delete(symbol);
  }

  // Enforce LRU eviction if over capacity
  if (activeContexts.size >= MAX_CONTEXTS) {
    let lruKey: string | null = null;
    let oldest = Number.POSITIVE_INFINITY;
    for (const [key, { lastUsed }] of activeContexts.entries()) {
      if (lastUsed < oldest) {
        oldest = lastUsed;
        lruKey = key;
      }
    }
    if (lruKey) {
      const res = activeContexts.get(lruKey);
      try {
        if (res) await res.ctx.close();
      } catch (err) {
        console.error(`[browserManager] Error closing LRU context for ${lruKey}:`, err);
      } finally {
        activeContexts.delete(lruKey);
        console.log(`[browserManager] Closed LRU context for ${lruKey}`);
      }
    }
  }
  
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: CONFIG.VIEWPORT,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Preload some common resources to reduce latency
    bypassCSP: true,
    ignoreHTTPSErrors: true
  });
  
  activeContexts.set(symbol, { ctx: context, lastUsed: Date.now() });
  
  // Clean up context when it's closed
  context.on('close', () => {
    activeContexts.delete(symbol);
    console.log(`[browserManager] Context for ${symbol} closed and cleaned up`);
  });
  
  console.log(`[browserManager] Created new context for ${symbol}`);
  return context;
}

export async function closeContextForSymbol(symbol: string) {
  const res = activeContexts.get(symbol);
  if (res) {
    await res.ctx.close();
    activeContexts.delete(symbol);
    console.log(`[browserManager] Closed context for ${symbol}`);
  }
}

export async function closeBrowser() {
  // Close all active contexts first
  for (const [symbol, res] of activeContexts) {
    try {
      await res.ctx.close();
    } catch (err) {
      console.error(`[browserManager] Error closing context for ${symbol}:`, err);
    }
  }
  activeContexts.clear();
  
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[browserManager] Browser closed and all resources cleaned up.');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[browserManager] Received SIGINT, cleaning up browser resources...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[browserManager] Received SIGTERM, cleaning up browser resources...');
  await closeBrowser();
  process.exit(0);
});

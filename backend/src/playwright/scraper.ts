import { BrowserContext, Page } from 'playwright';
import { getContextForSymbol, closeContextForSymbol } from './browserManager';
import { CONFIG, PRICE_SELECTORS } from '../config/constants';

export type PriceCallback = (price: number, isoTs: string) => void;

export async function createTickerScraper(symbol: string) {
  const context: BrowserContext = await getContextForSymbol(symbol);
  const page: Page = await context.newPage();

  const url = `${CONFIG.TRADINGVIEW_BASE_URL}/${symbol}/?exchange=${CONFIG.DEFAULT_EXCHANGE}`;
  console.log(`[scraper] Opening ${url} for ${symbol}`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_LOAD_TIMEOUT });
    console.log(`[scraper] Successfully loaded TradingView page for ${symbol}`);
    // Validate that this looks like a real TradingView symbol page by waiting
    // briefly for any known price selector. If none appear, treat as invalid symbol/URL.
    try {
      const waiters = PRICE_SELECTORS.map((sel) => page.waitForSelector(sel, { timeout: 5000 })).map(p => p.catch(() => null));
      const results = await Promise.all(waiters);
      const anyFound = results.some((res) => !!res);
      if (!anyFound) {
        const title = await page.title().catch(() => '');
        throw new Error(`Price selectors not found (title: ${title || 'unknown'}). Possibly invalid symbol or unsupported exchange.`);
      }
    } catch (e) {
      console.error(`[scraper] Validation failed for ${symbol}:`, e);
      await page.close();
      throw e;
    }
  } catch (error) {
    console.error(`[scraper] Failed to load TradingView page for ${symbol}:`, error);
    await page.close();
    throw error;
  }

  let alive = true;
  let lastPrice: number | null = null;

  async function readPriceFromSelectors(): Promise<number | null> {
    if (page.isClosed()) return null;
    const selectorPromises = PRICE_SELECTORS.map(async (sel) => {
      try {
        const el = await page.$(sel);
        if (!el) return null;
        const text = (await el.innerText()).replace(/,/g, '').trim();
        const parsed = parseFloat(text);
        if (!isNaN(parsed) && parsed > CONFIG.MIN_PRICE_RANGE && parsed < CONFIG.MAX_PRICE_RANGE) {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    });
    const results = await Promise.allSettled(selectorPromises);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value !== null) return r.value;
    }
    return null;
  }

  async function readPrice(): Promise<number | null> {
    if (page.isClosed()) return null;
    const selectorPrice = await readPriceFromSelectors();
    if (selectorPrice !== null) return selectorPrice;
    // Advanced fallback: search for price-like patterns in the DOM
    try {
      const price = await page.evaluate((ranges: { minRange: number; maxRange: number }) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = (node as any).textContent?.trim() || '';
          const priceMatch = text.match(/\$?(\d{1,4}(?:,\d{3})*(?:\.\d{1,8})?)/);
          if (priceMatch) {
            const priceStr = priceMatch[1].replace(/,/g, '');
            const price = parseFloat(priceStr);
            if (price > ranges.minRange && price < ranges.maxRange) {
              return price;
            }
          }
        }
        return null;
      }, { minRange: CONFIG.MIN_PRICE_RANGE, maxRange: CONFIG.MAX_PRICE_RANGE });
      if (price && price > 0) return price;
    } catch (err) {
      console.error(`[scraper] Error in advanced price detection for ${symbol}:`, err);
    }
    return null;
  }

  async function start(callback: PriceCallback) {
    console.log(`[scraper] Started scraping ${symbol}`);
    
    try {
      // Try to get price immediately after page load using only selectors (high confidence)
      let immediatePrice = await readPriceFromSelectors();
      if (immediatePrice !== null) {
        console.log(`[scraper] Got immediate price ${immediatePrice} for ${symbol}`);
        const isoTs = new Date().toISOString();
        callback(immediatePrice, isoTs);
      }

      // Wait for page to settle a bit (reduced delay)
      await page.waitForTimeout(CONFIG.PAGE_SETTLE_DELAY);

      while (alive) {
        // Check if page is still valid before proceeding
        if (page.isClosed()) {
          console.log(`[scraper] Page closed for ${symbol}, stopping scraper`);
          break;
        }

        try {
          const price = await readPrice();
          if (price !== null) {
            const isoTs = new Date().toISOString();
            // Only emit if changed (or first time)
            if (lastPrice === null || price !== lastPrice) {
              lastPrice = price;
              callback(price, isoTs);
            }
          }
        } catch (err) {
          if (page.isClosed()) {
            console.log(`[scraper] Page closed for ${symbol}, stopping scraper`);
            break;
          }
          console.error(`[scraper] Error reading price for ${symbol}:`, err);
        }
        
        // Check alive status before waiting. Use a plain timer so teardown doesn't throw.
        if (alive) {
          await new Promise((resolve) => setTimeout(resolve, CONFIG.POLL_INTERVAL));
        }
      }
    } catch (err) {
      console.error(`[scraper] Fatal error in scraping loop for ${symbol}:`, err);
    } finally {
      console.log(`[scraper] Scraping loop ended for ${symbol}`);
    }
  }

  async function stop() {
    console.log(`[scraper] Stopping scraper for ${symbol}`);
    alive = false;
    
    try {
      if (!page.isClosed()) {
        await page.close();
      }
      console.log(`[scraper] Page closed for ${symbol}`);
    } catch (err) {
      console.error(`[scraper] Error closing page for ${symbol}:`, err);
    }

    try {
      await closeContextForSymbol(symbol);
      console.log(`[scraper] Context closed for ${symbol}`);
    } catch (err) {
      console.error(`[scraper] Error closing context for ${symbol}:`, err);
    }
  }

  return { start, stop };
}

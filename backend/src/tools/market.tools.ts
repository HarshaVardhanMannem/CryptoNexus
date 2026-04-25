import axios from 'axios';
import { ToolDefinition } from './types';
import { toCoinGeckoId, toTradingViewSymbol } from '../utils/symbols';
import { createTickerScraper } from '../playwright/scraper';

/**
 * Fetch current price + market data from CoinGecko (free, no key).
 */
const fetchCoinPrice: ToolDefinition = {
    name: 'fetch_coin_price',
    description: 'Fetch current price, 24h change, volume, and market cap for a cryptocurrency from CoinGecko.',
    source: 'CoinGecko',
    endpointFor: ({ symbol }) => `https://api.coingecko.com/api/v3/coins/${toCoinGeckoId(symbol)}`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'The crypto ticker symbol, e.g. BTC, ETH, SOL',
            },
        },
        required: ['symbol'],
    },
    async execute({ symbol }) {
        const coinId = toCoinGeckoId(symbol);
        const { data } = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${coinId}`,
            {
                params: {
                    localization: false,
                    tickers: false,
                    community_data: false,
                    developer_data: false,
                },
                timeout: 10000,
            }
        );

        const md = data.market_data;
        return {
            symbol: symbol.toUpperCase(),
            name: data.name,
            currentPrice: md.current_price?.usd ?? null,
            priceChange24h: md.price_change_percentage_24h ?? null,
            priceChange7d: md.price_change_percentage_7d ?? null,
            priceChange30d: md.price_change_percentage_30d ?? null,
            high24h: md.high_24h?.usd ?? null,
            low24h: md.low_24h?.usd ?? null,
            volume24h: md.total_volume?.usd ?? null,
            marketCap: md.market_cap?.usd ?? null,
            circulatingSupply: md.circulating_supply ?? null,
            ath: md.ath?.usd ?? null,
            athChangePercentage: md.ath_change_percentage?.usd ?? null,
            timestamp: new Date().toISOString(),
        };
    },
};

/**
 * Fetch live price from TradingView via Playwright scraper.
 */
const fetchLivePrice: ToolDefinition = {
    name: 'fetch_live_price',
    description: 'Scrape the real-time price from TradingView for a crypto pair. Slower but gives the most up-to-date price.',
    source: 'TradingView',
    endpointFor: ({ symbol }) => `https://www.tradingview.com/symbols/${toTradingViewSymbol(symbol)}`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'The crypto ticker, e.g. BTC, ETH',
            },
        },
        required: ['symbol'],
    },
    async execute({ symbol }) {
        const tvSymbol = toTradingViewSymbol(symbol);

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('TradingView scrape timed out after 25s')), 25000);
            try {
                const scraper = await createTickerScraper(tvSymbol);
                scraper.start((price, timestamp) => {
                    clearTimeout(timeout);
                    scraper.stop().catch(() => { });
                    resolve({
                        symbol: symbol.toUpperCase(),
                        livePrice: price,
                        source: 'TradingView',
                        scrapedAt: timestamp,
                    });
                });
            } catch (err: any) {
                clearTimeout(timeout);
                reject(err);
            }
        });
    },
};

/**
 * Fetch OHLCV history from CoinGecko for technical analysis.
 */
const fetchPriceHistory: ToolDefinition = {
    name: 'fetch_price_history',
    description: 'Fetch historical daily prices (OHLCV) for a cryptocurrency. Use this to calculate technical indicators like RSI, MACD, moving averages.',
    source: 'CoinGecko',
    endpointFor: ({ symbol }) => `https://api.coingecko.com/api/v3/coins/${toCoinGeckoId(symbol)}/market_chart`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'The crypto ticker symbol, e.g. BTC, ETH',
            },
            days: {
                type: 'number',
                description: 'Number of days of history to fetch (1-365). Default 30.',
            },
        },
        required: ['symbol'],
    },
    async execute({ symbol, days = 30 }) {
        const coinId = toCoinGeckoId(symbol);
        const { data } = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
            {
                params: { vs_currency: 'usd', days: Math.min(days, 365) },
                timeout: 10000,
            }
        );

        const prices: number[] = (data.prices || []).map((p: number[]) => p[1]);
        const volumes: number[] = (data.total_volumes || []).map((v: number[]) => v[1]);

        // Calculate real technical indicators from actual data
        const rsi = calculateRSI(prices, 14);
        const sma50 = sma(prices, Math.min(50, prices.length));
        const sma200 = sma(prices, Math.min(200, prices.length));
        const ema12 = ema(prices, 12);
        const ema26 = ema(prices, 26);
        const macdLine = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
        const currentPrice = prices[prices.length - 1] ?? null;

        // Bollinger Bands (20-period SMA, 2 std devs)
        const bb = bollingerBands(prices, 20, 2);

        return {
            symbol: symbol.toUpperCase(),
            dataPoints: prices.length,
            currentPrice,
            indicators: {
                rsi,
                macd: macdLine !== null ? {
                    value: round(macdLine),
                    signal: round(sma(prices.slice(-9), 9) || 0),
                    histogram: round(macdLine - (sma(prices.slice(-9), 9) || 0)),
                } : null,
                movingAverages: {
                    sma50: sma50 !== null ? round(sma50) : null,
                    sma200: sma200 !== null ? round(sma200) : null,
                    ema12: ema12 !== null ? round(ema12) : null,
                    ema26: ema26 !== null ? round(ema26) : null,
                },
                bollingerBands: bb,
            },
            priceRange: {
                high: round(Math.max(...prices)),
                low: round(Math.min(...prices)),
            },
            avgVolume24h: volumes.length > 0 ? round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : null,
            trend: currentPrice && sma50 ? (currentPrice > sma50 ? 'above_sma50' : 'below_sma50') : 'unknown',
            timestamp: new Date().toISOString(),
        };
    },
};

// --- Helper functions for real indicator calculations ---

function round(n: number, decimals = 2): number {
    return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function sma(data: number[], period: number): number | null {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(data: number[], period: number): number | null {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let emaVal = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
        emaVal = data[i] * k + emaVal * (1 - k);
    }
    return emaVal;
}

function calculateRSI(prices: number[], period = 14): number | null {
    if (prices.length < period + 1) return null;
    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return round(100 - 100 / (1 + rs));
}

function bollingerBands(prices: number[], period = 20, stdDevMultiplier = 2) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, p) => sum + (p - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
        upper: round(mean + stdDevMultiplier * stdDev),
        middle: round(mean),
        lower: round(mean - stdDevMultiplier * stdDev),
    };
}

export const marketTools: ToolDefinition[] = [fetchCoinPrice, fetchPriceHistory, fetchLivePrice];

import axios from 'axios';
import { ToolDefinition } from './types';

/**
 * Fetch crypto news from CoinDesk RSS feed.
 */
const fetchCryptoNews: ToolDefinition = {
    name: 'fetch_crypto_news',
    description: 'Fetch the latest crypto news headlines from CoinDesk. Returns article titles, sources, and publish dates. Use this to understand current market narratives.',
    source: 'CoinDesk RSS + CoinGecko',
    endpointFor: () => 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    parameters: {
        type: 'object',
        properties: {
            maxArticles: {
                type: 'number',
                description: 'Maximum number of articles to return (default 10)',
            },
        },
        required: [],
    },
    async execute({ maxArticles = 10 }) {
        const articles: Array<{ title: string; url: string; source: string; publishedAt: string }> = [];

        try {
            const response = await axios.get('https://www.coindesk.com/arc/outboundfeeds/rss/', {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });

            const items = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];

            for (let i = 0; i < Math.min(items.length, maxArticles); i++) {
                const item = items[i];
                const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                    item.match(/<title>(.*?)<\/title>/);
                const linkMatch = item.match(/<link>(.*?)<\/link>/);
                const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
                const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                    item.match(/<description>(.*?)<\/description>/);

                if (titleMatch) {
                    articles.push({
                        title: titleMatch[1],
                        url: linkMatch?.[1] || '',
                        source: 'CoinDesk',
                        publishedAt: pubDateMatch?.[1] || new Date().toISOString(),
                    });
                }
            }
        } catch (err: any) {
            console.warn('[fetch_crypto_news] CoinDesk fetch failed:', err.message);
        }

        // Try CoinGecko status updates as a second source
        try {
            const { data } = await axios.get('https://api.coingecko.com/api/v3/status_updates', {
                params: { per_page: 5 },
                timeout: 5000,
            });

            for (const update of (data.status_updates || []).slice(0, 5)) {
                articles.push({
                    title: update.title || update.description?.slice(0, 100) || 'Status Update',
                    url: update.url || '',
                    source: `CoinGecko - ${update.project?.name || 'Unknown'}`,
                    publishedAt: update.created_at || new Date().toISOString(),
                });
            }
        } catch {
            // Non-critical, skip
        }

        return {
            articles,
            totalFound: articles.length,
            fetchedAt: new Date().toISOString(),
        };
    },
};

/**
 * Fetch trending coins and top gainers/losers.
 */
const fetchMarketTrending: ToolDefinition = {
    name: 'fetch_market_trending',
    description: 'Fetch trending cryptocurrencies and market movers from CoinGecko. Shows what coins are getting the most attention right now.',
    source: 'CoinGecko',
    endpointFor: () => 'https://api.coingecko.com/api/v3/search/trending',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    async execute() {
        const [trendingRes, globalRes] = await Promise.allSettled([
            axios.get('https://api.coingecko.com/api/v3/search/trending', { timeout: 8000 }),
            axios.get('https://api.coingecko.com/api/v3/global', { timeout: 8000 }),
        ]);

        const trending = trendingRes.status === 'fulfilled'
            ? (trendingRes.value.data.coins || []).map((c: any) => ({
                name: c.item.name,
                symbol: c.item.symbol,
                marketCapRank: c.item.market_cap_rank,
                priceChange24h: c.item.data?.price_change_percentage_24h?.usd,
            }))
            : [];

        const globalData = globalRes.status === 'fulfilled' ? globalRes.value.data.data : null;

        return {
            trending,
            globalMetrics: globalData ? {
                totalMarketCap: globalData.total_market_cap?.usd,
                totalVolume24h: globalData.total_volume?.usd,
                btcDominance: globalData.market_cap_percentage?.btc,
                ethDominance: globalData.market_cap_percentage?.eth,
                marketCapChange24h: globalData.market_cap_change_percentage_24h_usd,
                activeCryptocurrencies: globalData.active_cryptocurrencies,
            } : null,
            fetchedAt: new Date().toISOString(),
        };
    },
};

/**
 * Fetch Fear & Greed Index.
 */
const fetchFearGreedIndex: ToolDefinition = {
    name: 'fetch_fear_greed_index',
    description: 'Fetch the current Crypto Fear & Greed Index. Values: 0-25 = Extreme Fear, 25-45 = Fear, 45-55 = Neutral, 55-75 = Greed, 75-100 = Extreme Greed.',
    source: 'Alternative.me',
    endpointFor: () => 'https://api.alternative.me/fng/',
    parameters: {
        type: 'object',
        properties: {
            days: {
                type: 'number',
                description: 'Number of days of history (default 7)',
            },
        },
        required: [],
    },
    async execute({ days = 7 }) {
        try {
            const { data } = await axios.get('https://api.alternative.me/fng/', {
                params: { limit: days },
                timeout: 5000,
            });

            return {
                current: data.data?.[0] ? {
                    value: parseInt(data.data[0].value),
                    label: data.data[0].value_classification,
                    timestamp: new Date(parseInt(data.data[0].timestamp) * 1000).toISOString(),
                } : null,
                history: (data.data || []).map((d: any) => ({
                    value: parseInt(d.value),
                    label: d.value_classification,
                    date: new Date(parseInt(d.timestamp) * 1000).toISOString(),
                })),
            };
        } catch (err: any) {
            return { error: err.message, current: null, history: [] };
        }
    },
};

export const newsTools: ToolDefinition[] = [fetchCryptoNews, fetchMarketTrending, fetchFearGreedIndex];

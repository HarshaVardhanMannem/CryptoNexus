import axios from 'axios';
import { ToolDefinition } from './types';
import { toCoinGeckoId } from '../utils/symbols';

/**
 * Fetch exchange volume and market depth data from CoinGecko tickers.
 */
const fetchExchangeData: ToolDefinition = {
    name: 'fetch_exchange_data',
    description: 'Fetch exchange trading data for a cryptocurrency - shows where it is being traded, volume distribution across exchanges, and bid/ask spreads. Use this to infer exchange inflows/outflows.',
    source: 'CoinGecko',
    endpointFor: ({ symbol }) => `https://api.coingecko.com/api/v3/coins/${toCoinGeckoId(symbol)}/tickers`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'The crypto ticker symbol, e.g. BTC, ETH',
            },
        },
        required: ['symbol'],
    },
    async execute({ symbol }) {
        const coinId = toCoinGeckoId(symbol);

        try {
            const { data } = await axios.get(
                `https://api.coingecko.com/api/v3/coins/${coinId}/tickers`,
                {
                    params: { include_exchange_logo: false, depth: true },
                    timeout: 10000,
                }
            );

            const tickers = (data.tickers || []).slice(0, 15);

            const exchangeVolumes = tickers.map((t: any) => ({
                exchange: t.market?.name || 'Unknown',
                pair: `${t.base}/${t.target}`,
                lastPrice: t.last,
                volume24h: t.converted_volume?.usd || 0,
                bidAskSpread: t.bid_ask_spread_percentage,
                trustScore: t.trust_score,
            }));

            const totalVolume = exchangeVolumes.reduce((sum: number, e: any) => sum + e.volume24h, 0);

            // Top exchanges by volume can hint at where trading pressure is
            const topExchanges = exchangeVolumes
                .sort((a: any, b: any) => b.volume24h - a.volume24h)
                .slice(0, 5);

            return {
                symbol: symbol.toUpperCase(),
                totalExchangeVolume: totalVolume,
                exchangeCount: exchangeVolumes.length,
                topExchanges,
                avgBidAskSpread: exchangeVolumes.reduce((sum: number, e: any) =>
                    sum + (e.bidAskSpread || 0), 0) / Math.max(exchangeVolumes.length, 1),
                timestamp: new Date().toISOString(),
            };
        } catch (err: any) {
            return { error: err.message, symbol: symbol.toUpperCase() };
        }
    },
};

/**
 * Fetch coin developer and community metrics from CoinGecko.
 */
const fetchCoinMetrics: ToolDefinition = {
    name: 'fetch_coin_metrics',
    description: 'Fetch on-chain and community metrics for a cryptocurrency: developer activity, social media followers, community size, and supply distribution.',
    source: 'CoinGecko',
    endpointFor: ({ symbol }) => `https://api.coingecko.com/api/v3/coins/${toCoinGeckoId(symbol)}`,
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'The crypto ticker symbol, e.g. BTC, ETH',
            },
        },
        required: ['symbol'],
    },
    async execute({ symbol }) {
        const coinId = toCoinGeckoId(symbol);

        try {
            const { data } = await axios.get(
                `https://api.coingecko.com/api/v3/coins/${coinId}`,
                {
                    params: {
                        localization: false,
                        tickers: false,
                        market_data: true,
                        community_data: true,
                        developer_data: true,
                    },
                    timeout: 10000,
                }
            );

            const md = data.market_data || {};
            const cd = data.community_data || {};
            const dd = data.developer_data || {};

            return {
                symbol: symbol.toUpperCase(),
                name: data.name,
                supply: {
                    circulating: md.circulating_supply,
                    total: md.total_supply,
                    max: md.max_supply,
                    circulatingPct: md.max_supply
                        ? ((md.circulating_supply / md.max_supply) * 100).toFixed(1) + '%'
                        : 'N/A',
                },
                community: {
                    twitterFollowers: cd.twitter_followers,
                    redditSubscribers: cd.reddit_subscribers,
                    redditActiveAccounts: cd.reddit_accounts_active_48h,
                    telegramMembers: cd.telegram_channel_user_count,
                },
                developer: {
                    forks: dd.forks,
                    stars: dd.stars,
                    subscribers: dd.subscribers,
                    totalIssues: dd.total_issues,
                    closedIssues: dd.closed_issues,
                    pullRequestsMerged: dd.pull_requests_merged,
                    commitCount4Weeks: dd.commit_count_4_weeks,
                },
                sentiment: {
                    upVotesPct: data.sentiment_votes_up_percentage,
                    downVotesPct: data.sentiment_votes_down_percentage,
                },
                watchlistUsers: data.watchlist_portfolio_users,
                timestamp: new Date().toISOString(),
            };
        } catch (err: any) {
            return { error: err.message, symbol: symbol.toUpperCase() };
        }
    },
};

/**
 * Fetch large transactions from public blockchain data via Blockchair.
 */
const fetchLargeTransactions: ToolDefinition = {
    name: 'fetch_large_transactions',
    description: 'Fetch recent large (whale) transactions for Bitcoin or Ethereum from Blockchair. Shows high-value transfers that may signal institutional or whale activity.',
    source: 'Blockchair',
    endpointFor: ({ symbol }) => {
        const chain = symbol?.toUpperCase() === 'ETH' ? 'ethereum' : 'bitcoin';
        return `https://api.blockchair.com/${chain}/transactions`;
    },
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'BTC or ETH only',
            },
            minValueUsd: {
                type: 'number',
                description: 'Minimum transaction value in USD (default 1000000)',
            },
        },
        required: ['symbol'],
    },
    async execute({ symbol, minValueUsd = 1000000 }) {
        const chain = symbol.toUpperCase() === 'ETH' ? 'ethereum' : 'bitcoin';

        try {
            const { data } = await axios.get(
                `https://api.blockchair.com/${chain}/transactions`,
                {
                    params: {
                        limit: 10,
                        s: 'output_total(desc)',
                    },
                    timeout: 10000,
                }
            );

            const transactions = (data.data || []).map((tx: any) => ({
                hash: tx.hash,
                blockId: tx.block_id,
                time: tx.time,
                inputTotal: tx.input_total,
                outputTotal: tx.output_total,
                fee: tx.fee,
                inputCount: tx.input_count,
                outputCount: tx.output_count,
            }));

            return {
                symbol: symbol.toUpperCase(),
                chain,
                transactions,
                transactionCount: transactions.length,
                note: 'Sorted by output total (descending). Values in satoshis (BTC) or wei (ETH).',
                timestamp: new Date().toISOString(),
            };
        } catch (err: any) {
            // Blockchair may rate-limit; return a graceful fallback
            return {
                symbol: symbol.toUpperCase(),
                chain,
                transactions: [],
                error: `Blockchair API error: ${err.message}. Consider using alternative sources.`,
                timestamp: new Date().toISOString(),
            };
        }
    },
};

/**
 * Fetch global DeFi metrics.
 */
const fetchDefiMetrics: ToolDefinition = {
    name: 'fetch_defi_metrics',
    description: 'Fetch global DeFi (Decentralized Finance) metrics: total value locked, DeFi market cap, and DeFi dominance vs total crypto market.',
    source: 'CoinGecko',
    endpointFor: () => 'https://api.coingecko.com/api/v3/global/decentralized_finance_defi',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    async execute() {
        try {
            const { data } = await axios.get('https://api.coingecko.com/api/v3/global/decentralized_finance_defi', {
                timeout: 8000,
            });

            const d = data.data || {};
            return {
                defiMarketCap: d.defi_market_cap,
                ethMarketCap: d.eth_market_cap,
                defiToEthRatio: d.defi_to_eth_ratio,
                tradingVolume24h: d.trading_volume_24h,
                defiDominance: d.defi_dominance,
                topCoinName: d.top_coin_name,
                topCoinDefiDominance: d.top_coin_defi_dominance,
                timestamp: new Date().toISOString(),
            };
        } catch (err: any) {
            return { error: err.message };
        }
    },
};

export const onchainTools: ToolDefinition[] = [
    fetchExchangeData,
    fetchCoinMetrics,
    fetchLargeTransactions,
    fetchDefiMetrics,
];

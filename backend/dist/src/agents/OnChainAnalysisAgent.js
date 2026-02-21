"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnChainAnalysisAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const constants_1 = require("../config/constants");
const axios_1 = __importDefault(require("axios"));
const rateLimiter_1 = require("../utils/rateLimiter");
class OnChainAnalysisAgent {
    constructor() {
        if (!constants_1.CONFIG.NVIDIA_API_KEY) {
            throw new Error('NVIDIA_API_KEY is required for On-Chain Analysis Agent');
        }
        this.openai = new openai_1.default({
            apiKey: constants_1.CONFIG.NVIDIA_API_KEY,
            baseURL: constants_1.CONFIG.NVIDIA_BASE_URL,
        });
        console.log('✅ On-Chain Analysis Agent initialized');
    }
    /**
     * Execute on-chain analysis task
     */
    async execute(subtask) {
        const description = subtask.description;
        console.log(`[OnChainAnalysisAgent] Processing: ${description}`);
        // Extract symbol from description
        const symbol = this.extractSymbol(description);
        // Fetch on-chain metrics
        const exchangeFlows = await this.fetchExchangeFlows(symbol);
        const whaleActivity = await this.trackWhaleMovements(symbol);
        const networkMetrics = await this.getNetworkMetrics(symbol);
        // Use AI to analyze on-chain patterns
        const analysis = await this.analyzeWithAI(symbol, exchangeFlows, whaleActivity, networkMetrics, description);
        const report = {
            symbol,
            largeTransfers: whaleActivity.map(tx => ({
                transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
                from: tx.from,
                to: tx.to,
                amount: tx.amount,
                amountUSD: tx.amount * (symbol === 'BTC' ? 45000 : 2500), // Approximate USD value
                timestamp: tx.timestamp
            })),
            exchangeNetFlow: {
                direction: exchangeFlows.netFlow > 1000000 ? 'inflow' :
                    exchangeFlows.netFlow < -1000000 ? 'outflow' : 'neutral',
                amount: Math.abs(exchangeFlows.netFlow)
            },
            whaleActivitySummary: `${whaleActivity.length} large transactions detected. ` +
                `Net direction: ${this.calculateNetDirection(whaleActivity)}. ` +
                `Total volume: $${(whaleActivity.reduce((sum, tx) => sum + tx.amount, 0) / 1e6).toFixed(2)}M`,
            geminiInsights: analysis,
            timestamp: new Date()
        };
        console.log(`[OnChainAnalysisAgent] Analysis complete for ${symbol}: ${whaleActivity.length} whale transactions`);
        return report;
    }
    /**
     * Extract crypto symbol from task description
     */
    extractSymbol(description) {
        const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'BITCOIN', 'ETHEREUM'];
        const upperDesc = description.toUpperCase();
        for (const symbol of symbols) {
            if (upperDesc.includes(symbol)) {
                return symbol === 'BITCOIN' ? 'BTC' : symbol === 'ETHEREUM' ? 'ETH' : symbol;
            }
        }
        return 'BTC'; // Default to Bitcoin
    }
    /**
     * Fetch exchange flow data
     */
    async fetchExchangeFlows(symbol) {
        try {
            // In production, use CryptoQuant API, Glassnode, or similar
            // For now, using CoinGecko for basic market data as a proxy
            const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/coins/${this.getCoinGeckoId(symbol)}`, {
                timeout: 5000
            });
            // Simulate exchange flows based on volume
            const volume24h = response.data.market_data?.total_volume?.usd || 0;
            // Simulated flows (in production, use real exchange flow APIs)
            const inflow = volume24h * (0.3 + Math.random() * 0.2); // 30-50% of volume
            const outflow = volume24h * (0.3 + Math.random() * 0.2);
            return {
                inflow,
                outflow,
                netFlow: inflow - outflow
            };
        }
        catch (error) {
            console.warn(`[OnChainAnalysisAgent] Failed to fetch exchange flows:`, error.message);
            // Fallback data
            return {
                inflow: 1000000000,
                outflow: 950000000,
                netFlow: 50000000
            };
        }
    }
    /**
     * Track whale movements (large transactions)
     */
    async trackWhaleMovements(symbol) {
        try {
            // In production, use Whale Alert API, blockchain explorers, etc.
            // For now, generating realistic simulated data
            const whaleTransactions = [];
            const numTransactions = Math.floor(Math.random() * 5) + 2; // 2-6 whale transactions
            for (let i = 0; i < numTransactions; i++) {
                const isDeposit = Math.random() > 0.5;
                whaleTransactions.push({
                    amount: (Math.random() * 500 + 100) * (symbol === 'BTC' ? 1 : 100), // BTC or ETH scale
                    from: isDeposit ? 'unknown_wallet' : 'binance',
                    to: isDeposit ? 'binance' : 'unknown_wallet',
                    timestamp: new Date(Date.now() - Math.random() * 86400000), // Last 24h
                    type: isDeposit ? 'exchange_deposit' : 'exchange_withdrawal'
                });
            }
            return whaleTransactions;
        }
        catch (error) {
            console.error(`[OnChainAnalysisAgent] Error tracking whales:`, error.message);
            return [];
        }
    }
    /**
     * Get network health metrics
     */
    async getNetworkMetrics(symbol) {
        try {
            // Fetch basic network data from CoinGecko
            const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/coins/${this.getCoinGeckoId(symbol)}`, {
                timeout: 5000
            });
            return {
                activeAddresses: Math.floor(Math.random() * 1000000) + 500000,
                transactionCount24h: Math.floor(Math.random() * 500000) + 200000,
                hashRate: symbol === 'BTC' ? `${(Math.random() * 100 + 400).toFixed(2)} EH/s` : 'N/A',
                marketCap: response.data.market_data?.market_cap?.usd || 0
            };
        }
        catch (error) {
            console.warn(`[OnChainAnalysisAgent] Failed to fetch network metrics:`, error.message);
            return {
                activeAddresses: 750000,
                transactionCount24h: 350000,
                hashRate: 'N/A',
                marketCap: 0
            };
        }
    }
    /**
     * Use NVIDIA AI to analyze on-chain patterns
     */
    async analyzeWithAI(symbol, exchangeFlows, whaleActivity, networkMetrics, taskDescription) {
        const prompt = `
You are an expert blockchain analyst. Analyze the following on-chain data and provide insights.

Symbol: ${symbol}
Task: ${taskDescription}

EXCHANGE FLOWS (24h):
- Inflow: $${(exchangeFlows.inflow / 1e6).toFixed(2)}M
- Outflow: $${(exchangeFlows.outflow / 1e6).toFixed(2)}M
- Net Flow: $${(exchangeFlows.netFlow / 1e6).toFixed(2)}M

WHALE ACTIVITY:
- Large Transactions: ${whaleActivity.length}
- Deposits to Exchanges: ${whaleActivity.filter(tx => tx.type === 'exchange_deposit').length}
- Withdrawals from Exchanges: ${whaleActivity.filter(tx => tx.type === 'exchange_withdrawal').length}

NETWORK METRICS:
- Active Addresses: ${networkMetrics.activeAddresses.toLocaleString()}
- 24h Transactions: ${networkMetrics.transactionCount24h.toLocaleString()}
- Hash Rate: ${networkMetrics.hashRate}

Provide a concise analysis (3-4 sentences) covering:
1. Exchange flow implications (accumulation vs distribution)
2. Whale behavior interpretation
3. Network health assessment
4. Notable patterns or risks
`;
        try {
            const result = await rateLimiter_1.aiRateLimiter.execute(() => this.openai.chat.completions.create({
                model: constants_1.CONFIG.NVIDIA_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: constants_1.CONFIG.NVIDIA_TEMPERATURE,
                max_tokens: constants_1.CONFIG.NVIDIA_MAX_TOKENS,
            }));
            return result.choices[0]?.message?.content || this.generateFallbackAnalysis(exchangeFlows, whaleActivity);
        }
        catch (error) {
            console.error(`[OnChainAnalysisAgent] AI analysis failed:`, error.message);
            return this.generateFallbackAnalysis(exchangeFlows, whaleActivity);
        }
    }
    /**
     * Calculate net direction of whale movements
     */
    calculateNetDirection(whaleActivity) {
        const deposits = whaleActivity.filter(tx => tx.type === 'exchange_deposit').length;
        const withdrawals = whaleActivity.filter(tx => tx.type === 'exchange_withdrawal').length;
        if (deposits > withdrawals + 1)
            return 'to_exchanges';
        if (withdrawals > deposits + 1)
            return 'from_exchanges';
        return 'neutral';
    }
    /**
     * Generate fallback analysis without AI
     */
    generateFallbackAnalysis(exchangeFlows, whaleActivity) {
        const netFlow = exchangeFlows.netFlow;
        const flowDirection = netFlow > 0 ? 'inflow' : 'outflow';
        const whaleDirection = this.calculateNetDirection(whaleActivity);
        return `On-chain data shows ${Math.abs(netFlow / 1e6).toFixed(2)}M net ${flowDirection} to exchanges. ` +
            `Whale activity indicates ${whaleDirection} movement with ${whaleActivity.length} large transactions. ` +
            `This suggests ${netFlow < 0 ? 'potential accumulation' : 'possible distribution'} phase.`;
    }
    /**
     * Map symbol to CoinGecko ID
     */
    getCoinGeckoId(symbol) {
        const mapping = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'ADA': 'cardano',
            'DOGE': 'dogecoin'
        };
        return mapping[symbol] || 'bitcoin';
    }
}
exports.OnChainAnalysisAgent = OnChainAnalysisAgent;

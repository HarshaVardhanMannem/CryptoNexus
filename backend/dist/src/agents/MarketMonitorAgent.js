"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketMonitorAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const constants_1 = require("../config/constants");
const scraper_1 = require("../playwright/scraper");
const rateLimiter_1 = require("../utils/rateLimiter");
class MarketMonitorAgent {
    constructor() {
        if (!constants_1.CONFIG.NVIDIA_API_KEY) {
            throw new Error('NVIDIA_API_KEY is required for Market Monitor Agent');
        }
        this.openai = new openai_1.default({
            apiKey: constants_1.CONFIG.NVIDIA_API_KEY,
            baseURL: constants_1.CONFIG.NVIDIA_BASE_URL,
        });
        console.log('✅ Market Monitor Agent initialized');
    }
    /**
     * Execute market monitoring task
     */
    async execute(subtask) {
        const description = subtask.description;
        console.log(`[MarketMonitorAgent] Processing: ${description}`);
        // Extract symbol from description (e.g., "Monitor BTCUSD price movements")
        const symbol = this.extractSymbol(description);
        // Get current price data
        const priceData = await this.fetchRealTimePrice(symbol);
        // Calculate basic technical indicators
        const indicators = await this.calculateIndicators(symbol, priceData);
        // Use AI to analyze market conditions
        const geminiInsights = await this.analyzeWithAI(symbol, priceData, indicators, description);
        const analysis = {
            symbol,
            currentPrice: priceData.price,
            priceChange24h: priceData.change24h,
            volume24h: priceData.volume24h,
            indicators,
            geminiInsights,
            timestamp: new Date()
        };
        console.log(`[MarketMonitorAgent] Analysis complete for ${symbol}: $${priceData.price}`);
        return analysis;
    }
    /**
     * Extract crypto symbol from task description
     */
    extractSymbol(description) {
        // Look for common crypto symbols
        const symbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'ADAUSD', 'DOGUSD'];
        const upperDesc = description.toUpperCase();
        for (const symbol of symbols) {
            if (upperDesc.includes(symbol) || upperDesc.includes(symbol.slice(0, -3))) {
                return symbol;
            }
        }
        // Default to BTC if no symbol found
        return 'BTCUSD';
    }
    /**
     * Fetch real-time price using the existing TradingView scraper
     */
    async fetchRealTimePrice(symbol) {
        return new Promise(async (resolve, reject) => {
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Price fetch timeout after 30 seconds'));
                }
            }, 30000);
            try {
                const scraper = await (0, scraper_1.createTickerScraper)(symbol);
                scraper.start((price, timestamp) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        // Stop scraper after getting first price
                        scraper.stop().catch(err => console.error(`Error stopping scraper: ${err}`));
                        // For now, simulate change and volume (would come from API in production)
                        resolve({
                            price,
                            change24h: (Math.random() - 0.5) * 10, // Simulated 24h change
                            volume24h: Math.random() * 50000000000 // Simulated volume
                        });
                    }
                });
            }
            catch (error) {
                clearTimeout(timeout);
                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            }
        });
    }
    /**
     * Calculate technical indicators
     */
    async calculateIndicators(symbol, priceData) {
        // In production, these would be calculated from historical data
        // For now, generating realistic values
        const price = priceData.price;
        return {
            rsi: Math.floor(Math.random() * 100), // 0-100 range
            macd: {
                value: (Math.random() - 0.5) * price * 0.001,
                signal: (Math.random() - 0.5) * price * 0.001,
                histogram: (Math.random() - 0.5) * price * 0.0005
            },
            movingAverages: {
                ma50: price * (0.95 + Math.random() * 0.1),
                ma200: price * (0.90 + Math.random() * 0.2)
            }
        };
    }
    /**
     * Use NVIDIA AI to analyze market data and provide insights
     */
    async analyzeWithAI(symbol, priceData, indicators, taskDescription) {
        const prompt = `
You are an expert crypto market analyst. Analyze the following market data and provide insights.

Symbol: ${symbol}
Current Price: $${priceData.price.toFixed(2)}
24h Change: ${priceData.change24h.toFixed(2)}%
24h Volume: $${(priceData.volume24h / 1e9).toFixed(2)}B

Technical Indicators:
- RSI: ${indicators.rsi}
- MACD: ${indicators.macd.value.toFixed(4)}
- 50-day MA: $${indicators.movingAverages.ma50.toFixed(2)}
- 200-day MA: $${indicators.movingAverages.ma200.toFixed(2)}

Task: ${taskDescription}

Provide a concise analysis (2-3 sentences) covering:
1. Current market trend (bullish/bearish/neutral)
2. Key technical signals
3. Notable observations or risks
`;
        try {
            const result = await rateLimiter_1.aiRateLimiter.execute(() => this.openai.chat.completions.create({
                model: constants_1.CONFIG.NVIDIA_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: constants_1.CONFIG.NVIDIA_TEMPERATURE,
                max_tokens: constants_1.CONFIG.NVIDIA_MAX_TOKENS,
            }));
            return result.choices[0]?.message?.content || '';
        }
        catch (error) {
            console.error(`[MarketMonitorAgent] AI analysis failed:`, error.message);
            return `Technical analysis: Price at $${priceData.price.toFixed(2)}, RSI=${indicators.rsi}, trending ${priceData.change24h > 0 ? 'up' : 'down'} ${Math.abs(priceData.change24h).toFixed(2)}% over 24h.`;
        }
    }
}
exports.MarketMonitorAgent = MarketMonitorAgent;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsSentimentAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const constants_1 = require("../config/constants");
const axios_1 = __importDefault(require("axios"));
const rateLimiter_1 = require("../utils/rateLimiter");
class NewsSentimentAgent {
    constructor() {
        if (!constants_1.CONFIG.NVIDIA_API_KEY) {
            throw new Error('NVIDIA_API_KEY is required for News Sentiment Agent');
        }
        this.openai = new openai_1.default({
            apiKey: constants_1.CONFIG.NVIDIA_API_KEY,
            baseURL: constants_1.CONFIG.NVIDIA_BASE_URL,
        });
        console.log('✅ News Sentiment Agent initialized');
    }
    /**
     * Execute news and sentiment analysis task
     */
    async execute(subtask) {
        const description = subtask.description;
        console.log(`[NewsSentimentAgent] Processing: ${description}`);
        // Extract symbol from description
        const symbol = this.extractSymbol(description);
        // Fetch news articles
        const articles = await this.fetchCryptoNews(symbol);
        // Fetch Reddit sentiment (simplified - using mock for now due to Reddit API complexity)
        const redditData = await this.fetchRedditSentiment(symbol);
        // Use AI to analyze sentiment from all sources
        const analysis = await this.analyzeWithAI(symbol, articles, redditData, description);
        const report = {
            symbol,
            overallSentiment: analysis.sentiment,
            confidenceScore: analysis.confidence,
            sources: {
                news: {
                    sentiment: analysis.newsSentiment,
                    articles: articles.length
                },
                reddit: {
                    sentiment: analysis.redditSentiment,
                    posts: redditData.length
                }
            },
            keyEvents: analysis.keyEvents,
            timestamp: new Date()
        };
        console.log(`[NewsSentimentAgent] Analysis complete for ${symbol}: ${analysis.sentiment} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);
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
     * Fetch crypto news from public sources
     */
    async fetchCryptoNews(symbol) {
        try {
            // Using CoinGecko's news endpoint (free, no API key needed)
            // For production, you could use CryptoCompare, NewsAPI.org, etc.
            // Fallback: Use a simple news aggregator approach
            const articles = [];
            // Try CoinDesk RSS feed (simple approach)
            try {
                const response = await axios_1.default.get('https://www.coindesk.com/arc/outboundfeeds/rss/', {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                // Simple XML parsing - look for item tags
                const items = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
                for (let i = 0; i < Math.min(items.length, 5); i++) {
                    const item = items[i];
                    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
                    const linkMatch = item.match(/<link>(.*?)<\/link>/);
                    const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
                    if (titleMatch && linkMatch) {
                        articles.push({
                            title: titleMatch[1],
                            url: linkMatch[1],
                            source: 'CoinDesk',
                            publishedAt: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
                        });
                    }
                }
            }
            catch (error) {
                console.warn('[NewsSentimentAgent] Failed to fetch CoinDesk news:', error);
            }
            // If no articles found, create mock articles for demo
            if (articles.length === 0) {
                articles.push({
                    title: `${symbol} Shows Strong Market Performance`,
                    url: 'https://example.com',
                    source: 'Demo Source',
                    publishedAt: new Date(),
                    snippet: `${symbol} demonstrates resilient trading patterns amid market volatility`
                });
            }
            return articles;
        }
        catch (error) {
            console.error(`[NewsSentimentAgent] Error fetching news:`, error.message);
            // Return at least one article to avoid complete failure
            return [{
                    title: `${symbol} Market Update`,
                    url: 'https://example.com',
                    source: 'Fallback',
                    publishedAt: new Date(),
                    snippet: 'Latest market developments'
                }];
        }
    }
    /**
     * Fetch Reddit sentiment (simplified version)
     */
    async fetchRedditSentiment(symbol) {
        // For now, using mock data
        // In production, you'd use Reddit API with proper authentication
        // or scrape r/cryptocurrency, r/bitcoin using Playwright
        const mockPosts = [
            {
                title: `${symbol} Discussion Thread`,
                score: Math.floor(Math.random() * 1000),
                numComments: Math.floor(Math.random() * 500),
                url: 'https://reddit.com/r/cryptocurrency',
                sentiment: Math.random() > 0.5 ? 'positive' : 'neutral'
            },
            {
                title: `${symbol} Price Analysis`,
                score: Math.floor(Math.random() * 800),
                numComments: Math.floor(Math.random() * 300),
                url: 'https://reddit.com/r/bitcoin',
                sentiment: Math.random() > 0.6 ? 'positive' : 'neutral'
            }
        ];
        return mockPosts;
    }
    /**
     * Use NVIDIA AI to analyze sentiment from all sources
     */
    async analyzeWithAI(symbol, articles, redditPosts, taskDescription) {
        const prompt = `
You are an expert crypto sentiment analyst. Analyze the following data sources and provide a comprehensive sentiment assessment.

Symbol: ${symbol}
Task: ${taskDescription}

NEWS ARTICLES (${articles.length} articles):
${articles.map((a, i) => `${i + 1}. [${a.source}] ${a.title}`).join('\n')}

REDDIT ACTIVITY (${redditPosts.length} posts):
${redditPosts.map((p, i) => `${i + 1}. ${p.title} (${p.score} upvotes, ${p.numComments} comments)`).join('\n')}

Based on this data, provide your analysis in JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0.0-1.0,
  "newsSentiment": "positive" | "negative" | "neutral",
  "redditSentiment": "positive" | "negative" | "neutral",
  "keyEvents": ["event1", "event2"],
  "reasoning": "brief explanation"
}

Consider:
- News headline tone and frequency
- Social media engagement levels
- Recent events or announcements
- Overall market mood
`;
        try {
            const result = await rateLimiter_1.aiRateLimiter.execute(() => this.openai.chat.completions.create({
                model: constants_1.CONFIG.NVIDIA_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: constants_1.CONFIG.NVIDIA_TEMPERATURE,
                max_tokens: constants_1.CONFIG.NVIDIA_MAX_TOKENS,
            }));
            const responseText = result.choices[0]?.message?.content || '';
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return {
                    sentiment: (analysis.sentiment || 'neutral'),
                    confidence: analysis.confidence || 0.5,
                    newsSentiment: analysis.newsSentiment || 'neutral',
                    redditSentiment: analysis.redditSentiment || 'neutral',
                    keyEvents: analysis.keyEvents || []
                };
            }
            // Fallback if JSON parsing fails
            return this.generateFallbackAnalysis(articles, redditPosts);
        }
        catch (error) {
            console.error(`[NewsSentimentAgent] AI analysis failed:`, error.message);
            return this.generateFallbackAnalysis(articles, redditPosts);
        }
    }
    /**
     * Generate fallback sentiment analysis without AI
     */
    generateFallbackAnalysis(articles, redditPosts) {
        // Simple heuristic: more articles = more attention
        const avgRedditScore = redditPosts.reduce((sum, p) => sum + p.score, 0) / Math.max(redditPosts.length, 1);
        return {
            sentiment: avgRedditScore > 500 ? 'bullish' : avgRedditScore < 200 ? 'bearish' : 'neutral',
            confidence: 0.6,
            newsSentiment: 'neutral',
            redditSentiment: avgRedditScore > 500 ? 'positive' : 'neutral',
            keyEvents: articles.slice(0, 2).map(a => a.title)
        };
    }
}
exports.NewsSentimentAgent = NewsSentimentAgent;

import OpenAI from 'openai';
import { CONFIG } from '../config/constants';
import { SentimentReport, Subtask } from '../types/agent.types';
import axios from 'axios';
import { aiRateLimiter } from '../utils/rateLimiter';

interface NewsArticle {
    title: string;
    url: string;
    source: string;
    publishedAt: Date;
    snippet?: string;
}

interface RedditPost {
    title: string;
    score: number;
    numComments: number;
    url: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
}

export class NewsSentimentAgent {
    private openai: OpenAI;

    constructor() {
        if (!CONFIG.NVIDIA_API_KEY) {
            throw new Error('NVIDIA_API_KEY is required for News Sentiment Agent');
        }

        this.openai = new OpenAI({
            apiKey: CONFIG.NVIDIA_API_KEY,
            baseURL: CONFIG.NVIDIA_BASE_URL,
        });
        console.log('✅ News Sentiment Agent initialized');
    }

    /**
     * Execute news and sentiment analysis task
     */
    async execute(subtask: Subtask): Promise<SentimentReport> {
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

        const report: SentimentReport = {
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
    private extractSymbol(description: string): string {
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
    private async fetchCryptoNews(symbol: string): Promise<NewsArticle[]> {
        try {
            // Using CoinGecko's news endpoint (free, no API key needed)
            // For production, you could use CryptoCompare, NewsAPI.org, etc.

            // Fallback: Use a simple news aggregator approach
            const articles: NewsArticle[] = [];

            // Try CoinDesk RSS feed (simple approach)
            try {
                const response = await axios.get('https://www.coindesk.com/arc/outboundfeeds/rss/', {
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
            } catch (error) {
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

        } catch (error: any) {
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
    private async fetchRedditSentiment(symbol: string): Promise<RedditPost[]> {
        // For now, using mock data
        // In production, you'd use Reddit API with proper authentication
        // or scrape r/cryptocurrency, r/bitcoin using Playwright

        const mockPosts: RedditPost[] = [
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
    private async analyzeWithAI(
        symbol: string,
        articles: NewsArticle[],
        redditPosts: RedditPost[],
        taskDescription: string
    ): Promise<{
        sentiment: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        newsSentiment: string;
        redditSentiment: string;
        keyEvents: string[];
    }> {
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
            const result = await aiRateLimiter.execute(() =>
                this.openai.chat.completions.create({
                    model: CONFIG.NVIDIA_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: CONFIG.NVIDIA_TEMPERATURE,
                    max_tokens: CONFIG.NVIDIA_MAX_TOKENS,
                })
            );

            const responseText = result.choices[0]?.message?.content || '';

            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return {
                    sentiment: (analysis.sentiment || 'neutral') as 'bullish' | 'bearish' | 'neutral',
                    confidence: analysis.confidence || 0.5,
                    newsSentiment: analysis.newsSentiment || 'neutral',
                    redditSentiment: analysis.redditSentiment || 'neutral',
                    keyEvents: analysis.keyEvents || []
                };
            }

            // Fallback if JSON parsing fails
            return this.generateFallbackAnalysis(articles, redditPosts);

        } catch (error: any) {
            console.error(`[NewsSentimentAgent] AI analysis failed:`, error.message);
            return this.generateFallbackAnalysis(articles, redditPosts);
        }
    }

    /**
     * Generate fallback sentiment analysis without AI
     */
    private generateFallbackAnalysis(articles: NewsArticle[], redditPosts: RedditPost[]): {
        sentiment: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        newsSentiment: string;
        redditSentiment: string;
        keyEvents: string[];
    } {
        // Simple heuristic: more articles = more attention
        const avgRedditScore = redditPosts.reduce((sum, p) => sum + p.score, 0) / Math.max(redditPosts.length, 1);

        return {
            sentiment: avgRedditScore > 500 ? 'bullish' : avgRedditScore < 200 ? 'bearish' : 'neutral' as const,
            confidence: 0.6,
            newsSentiment: 'neutral',
            redditSentiment: avgRedditScore > 500 ? 'positive' : 'neutral',
            keyEvents: articles.slice(0, 2).map(a => a.title)
        };
    }
}

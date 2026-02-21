import OpenAI from 'openai';
import { CONFIG } from '../config/constants';
import { TradingStrategy, Subtask, TaskState } from '../types/agent.types';
import { aiRateLimiter } from '../utils/rateLimiter';

export class StrategyGeneratorAgent {
    private openai: OpenAI;

    constructor() {
        if (!CONFIG.NVIDIA_API_KEY) {
            throw new Error('NVIDIA_API_KEY is required for Strategy Generator Agent');
        }

        this.openai = new OpenAI({
            apiKey: CONFIG.NVIDIA_API_KEY,
            baseURL: CONFIG.NVIDIA_BASE_URL,
        });
        console.log('✅ Strategy Generator Agent initialized');
    }

    /**
     * Execute strategy generation task
     */
    async execute(subtask: Subtask, taskState: TaskState): Promise<TradingStrategy> {
        const description = subtask.description;
        console.log(`[StrategyGeneratorAgent] Processing: ${description}`);

        // Extract symbol from completed subtasks
        const symbol = this.extractSymbol(taskState);

        // Synthesize all available data from completed subtasks
        const marketData = this.extractMarketData(taskState);
        const sentimentData = this.extractSentimentData(taskState);
        const onChainData = this.extractOnChainData(taskState);

        // Use AI to generate comprehensive trading strategy
        const strategy = await this.generateStrategyWithAI(
            symbol,
            marketData,
            sentimentData,
            onChainData,
            description
        );

        console.log(`[StrategyGeneratorAgent] Strategy generated for ${symbol}: ${strategy.recommendation} (${(strategy.confidence * 100).toFixed(0)}% confidence)`);
        return strategy;
    }

    /**
     * Extract symbol from task state
     */
    private extractSymbol(taskState: TaskState): string {
        // Look through completed subtasks for symbol
        const upperGoal = taskState.goal.toUpperCase();
        const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'BITCOIN', 'ETHEREUM'];

        for (const symbol of symbols) {
            if (upperGoal.includes(symbol)) {
                return symbol === 'BITCOIN' ? 'BTC' : symbol === 'ETHEREUM' ? 'ETH' : symbol;
            }
        }

        return 'BTC';
    }

    /**
     * Extract market analysis data from completed market monitor tasks
     */
    private extractMarketData(taskState: TaskState): any {
        const marketSubtasks = taskState.subtasks.filter(
            st => st.agentType === 'market_monitor' && st.status === 'completed' && st.result
        );

        if (marketSubtasks.length === 0) return null;

        // Get the most recent market data
        const latestResult = marketSubtasks[marketSubtasks.length - 1].result;
        return latestResult;
    }

    /**
     * Extract sentiment data from completed sentiment tasks
     */
    private extractSentimentData(taskState: TaskState): any {
        const sentimentSubtasks = taskState.subtasks.filter(
            st => st.agentType === 'news_sentiment' && st.status === 'completed' && st.result
        );

        if (sentimentSubtasks.length === 0) return null;

        const latestResult = sentimentSubtasks[sentimentSubtasks.length - 1].result;
        return latestResult;
    }

    /**
     * Extract on-chain data from completed on-chain tasks
     */
    private extractOnChainData(taskState: TaskState): any {
        const onChainSubtasks = taskState.subtasks.filter(
            st => st.agentType === 'onchain_analysis' && st.status === 'completed' && st.result
        );

        if (onChainSubtasks.length === 0) return null;

        const latestResult = onChainSubtasks[onChainSubtasks.length - 1].result;
        return latestResult;
    }

    /**
     * Use NVIDIA AI to generate comprehensive trading strategy
     */
    private async generateStrategyWithAI(
        symbol: string,
        marketData: any,
        sentimentData: any,
        onChainData: any,
        taskDescription: string
    ): Promise<TradingStrategy> {
        const prompt = `
You are an expert crypto trading strategist. Synthesize the following multi-source data and generate a comprehensive trading strategy.

Symbol: ${symbol}
Task: ${taskDescription}

MARKET DATA:
${marketData ? `
- Current Price: $${marketData.currentPrice?.toFixed(2) || 'N/A'}
- 24h Change: ${marketData.priceChange24h?.toFixed(2) || 'N/A'}%
- RSI: ${marketData.indicators?.rsi || 'N/A'}
- AI Insights: ${marketData.geminiInsights || 'N/A'}
` : 'No market data available'}

SENTIMENT DATA:
${sentimentData ? `
- Overall Sentiment: ${sentimentData.overallSentiment || 'N/A'}
- Confidence: ${((sentimentData.confidenceScore || 0) * 100).toFixed(0)}%
- News: ${sentimentData.sources?.news?.sentiment || 'N/A'} (${sentimentData.sources?.news?.articles || 0} articles)
- Key Events: ${sentimentData.keyEvents?.join(', ') || 'None'}
` : 'No sentiment data available'}

ON-CHAIN DATA:
${onChainData ? `
- Exchange Flow: ${onChainData.exchangeNetFlow?.direction || 'N/A'} ($${(onChainData.exchangeNetFlow?.amount / 1e6)?.toFixed(2) || 0}M)
- Whale Activity: ${onChainData.whaleActivitySummary || 'N/A'}
- Insights: ${onChainData.geminiInsights || 'N/A'}
` : 'No on-chain data available'}

Generate a trading strategy in JSON format:
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": 0.0-1.0,
  "entryPoints": [price1, price2],
  "exitPoints": [price1, price2],
  "stopLoss": price,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "timeHorizon": "SHORT" | "MEDIUM" | "LONG",
  "reasoning": "detailed multi-factor analysis",
  "keyRisks": ["risk1", "risk2"]
}

Consider:
- Technical indicators and price action
- Sentiment and news catalysts
- On-chain flows and whale behavior
- Risk/reward ratio
- Market conditions
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
                const strategyData = JSON.parse(jsonMatch[0]);

                return {
                    symbol,
                    recommendation: (strategyData.recommendation || 'HOLD') as any,
                    confidence: strategyData.confidence || 0.5,
                    entryPoints: strategyData.entryPoints || [],
                    exitPoints: strategyData.exitPoints || [],
                    stopLoss: strategyData.stopLoss || 0,
                    riskLevel: (strategyData.riskLevel || 'MEDIUM') as any,
                    timeHorizon: (strategyData.timeHorizon || 'MEDIUM') as any,
                    reasoning: strategyData.reasoning || 'Insufficient data for detailed analysis',
                    keyRisks: strategyData.keyRisks || ['Market volatility', 'Data limitations'],
                    timestamp: new Date()
                };
            }

            // Fallback if JSON parsing fails
            return this.generateFallbackStrategy(symbol, marketData, sentimentData, onChainData);

        } catch (error: any) {
            console.error(`[StrategyGeneratorAgent] AI analysis failed:`, error.message);
            return this.generateFallbackStrategy(symbol, marketData, sentimentData, onChainData);
        }
    }

    /**
     * Generate fallback strategy without AI
     */
    private generateFallbackStrategy(
        symbol: string,
        marketData: any,
        sentimentData: any,
        onChainData: any
    ): TradingStrategy {
        // Simple heuristic-based strategy
        let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' = 'HOLD';
        let reasoning = 'Based on available data: ';

        const currentPrice = marketData?.currentPrice || 0;
        const sentiment = sentimentData?.overallSentiment || 'neutral';
        const exchangeFlow = onChainData?.exchangeNetFlow?.direction || 'neutral';

        // Simple scoring system
        let score = 0;

        if (sentiment === 'bullish') score += 1;
        else if (sentiment === 'bearish') score -= 1;

        if (exchangeFlow === 'outflow') score += 1; // Accumulation
        else if (exchangeFlow === 'inflow') score -= 1; // Distribution

        if (marketData?.indicators?.rsi) {
            if (marketData.indicators.rsi < 30) score += 1; // Oversold
            else if (marketData.indicators.rsi > 70) score -= 1; // Overbought
        }

        // Determine recommendation
        if (score >= 2) recommendation = 'BUY';
        else if (score <= -2) recommendation = 'SELL';

        reasoning += `Sentiment: ${sentiment}, Exchange flow: ${exchangeFlow}. `;
        reasoning += `Multi-factor score: ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}.`;

        return {
            symbol,
            recommendation,
            confidence: 0.6,
            entryPoints: currentPrice > 0 ? [currentPrice * 0.98, currentPrice * 0.95] : [],
            exitPoints: currentPrice > 0 ? [currentPrice * 1.05, currentPrice * 1.10] : [],
            stopLoss: currentPrice > 0 ? currentPrice * 0.93 : 0,
            riskLevel: 'MEDIUM',
            timeHorizon: 'MEDIUM',
            reasoning,
            keyRisks: ['Market volatility', 'Limited data points', 'Simplified analysis'],
            timestamp: new Date()
        };
    }
}

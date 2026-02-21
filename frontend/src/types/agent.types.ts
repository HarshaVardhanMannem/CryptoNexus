// Agent Types - matching backend types

export enum TaskStatus {
    PLANNING = 'planning',
    EXECUTING = 'executing',
    REASONING = 'reasoning',
    VERIFYING = 'verifying',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export enum AgentType {
    COORDINATOR = 'coordinator',
    MARKET_MONITOR = 'market_monitor',
    NEWS_SENTIMENT = 'news_sentiment',
    ONCHAIN_ANALYSIS = 'onchain_analysis',
    STRATEGY_GENERATOR = 'strategy_generator',
    VISUALIZATION = 'visualization'
}

export interface Subtask {
    id: string;
    name: string;
    description: string;
    agentType: AgentType;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    result?: any;
    error?: string;
}

export interface TaskState {
    taskId: string;
    goal: string;
    subtasks: Subtask[];
    context: string[];
    status: TaskStatus;
    startTime: Date;
    endTime?: Date;
    currentAgent?: AgentType;
    result?: {
        synthesis?: string;
        verification?: {
            isValid: boolean;
            confidenceScore: number;
            issues: string[];
            recommendations: string[];
        };
    };
    error?: string;
}

export interface MarketAnalysis {
    symbol: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h?: number;
    indicators?: {
        rsi?: number;
        macd?: { value: number; signal: number; histogram: number };
        bollingerBands?: { upper: number; middle: number; lower: number };
    };
    geminiInsights?: string;
    timestamp: Date;
}

export interface SentimentReport {
    symbol: string;
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    confidenceScore: number;
    sources: {
        news?: { sentiment: string; articles: number };
        reddit?: { sentiment: string; posts: number };
        twitter?: { sentiment: string; tweets: number };
    };
    keyEvents: string[];
    timestamp: Date;
}

export interface OnChainReport {
    symbol: string;
    largeTransfers: Array<{
        transactionHash: string;
        from: string;
        to: string;
        amount: number;
        amountUSD: number;
        timestamp: Date;
    }>;
    exchangeNetFlow: {
        direction: 'inflow' | 'outflow' | 'neutral';
        amount: number;
    };
    whaleActivitySummary: string;
    geminiInsights?: string;
    timestamp: Date;
}

export interface TradingStrategy {
    symbol: string;
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: number;
    entryPoints: number[];
    exitPoints: number[];
    stopLoss: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    timeHorizon: 'SHORT' | 'MEDIUM' | 'LONG';
    reasoning: string;
    keyRisks: string[];
    timestamp: Date;
}

export interface AnalysisResponse {
    success: boolean;
    taskId: string;
    status: string;
    message?: string;
    subtasksPlanned?: number;
    checkpoints?: number;
}

export interface StatusResponse {
    taskId: string;
    goal: string;
    status: TaskStatus;
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
    subtasks: Subtask[];
    result?: {
        synthesis?: string;
        verification?: {
            isValid: boolean;
            confidenceScore: number;
            issues: string[];
            recommendations: string[];
        };
    };
    currentAgent?: AgentType;
    startTime: Date;
    endTime?: Date;
}

import { motion } from 'framer-motion';
import {
    Brain,
    TrendingUp,
    Newspaper,
    Link2,
    Lightbulb,
    Check,
    X,
    Loader2,
    Clock
} from 'lucide-react';
import { AgentType, Subtask } from '../types/agent.types';

interface AgentCardProps {
    subtask: Subtask;
    index: number;
}

const AGENT_CONFIG = {
    [AgentType.COORDINATOR]: {
        icon: Brain,
        color: '#6366f1',
        label: 'Coordinator'
    },
    [AgentType.MARKET_MONITOR]: {
        icon: TrendingUp,
        color: '#22c55e',
        label: 'Market Monitor'
    },
    [AgentType.NEWS_SENTIMENT]: {
        icon: Newspaper,
        color: '#eab308',
        label: 'News & Sentiment'
    },
    [AgentType.ONCHAIN_ANALYSIS]: {
        icon: Link2,
        color: '#3b82f6',
        label: 'On-Chain Analysis'
    },
    [AgentType.STRATEGY_GENERATOR]: {
        icon: Lightbulb,
        color: '#a855f7',
        label: 'Strategy Generator'
    },
    [AgentType.VISUALIZATION]: {
        icon: TrendingUp,
        color: '#ec4899',
        label: 'Visualization'
    }
};

const STATUS_CONFIG = {
    pending: {
        icon: Clock,
        color: '#71717a',
        bg: 'rgba(113, 113, 122, 0.15)',
        label: 'Pending'
    },
    in_progress: {
        icon: Loader2,
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.15)',
        label: 'In Progress'
    },
    completed: {
        icon: Check,
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.15)',
        label: 'Completed'
    },
    failed: {
        icon: X,
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        label: 'Failed'
    }
};

export default function AgentCard({ subtask, index }: AgentCardProps) {
    const agentConfig = AGENT_CONFIG[subtask.agentType] || AGENT_CONFIG[AgentType.COORDINATOR];
    const statusConfig = STATUS_CONFIG[subtask.status];

    const AgentIcon = agentConfig.icon;
    const StatusIcon = statusConfig.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card"
            style={{
                borderLeft: `3px solid ${agentConfig.color}`
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Agent Icon */}
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: `${agentConfig.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}
                >
                    <AgentIcon size={24} color={agentConfig.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0
                        }}>
                            {subtask.name}
                        </h3>

                        {/* Status Badge */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: statusConfig.bg,
                                border: `1px solid ${statusConfig.color}30`,
                                fontSize: '12px',
                                fontWeight: 600,
                                color: statusConfig.color
                            }}
                        >
                            <StatusIcon
                                size={14}
                                className={subtask.status === 'in_progress' ? 'spin' : ''}
                            />
                            {statusConfig.label}
                        </div>
                    </div>

                    {/* Description */}
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.5',
                        marginBottom: '12px'
                    }}>
                        {subtask.description}
                    </p>

                    {/* Result Preview */}
                    {subtask.status === 'completed' && subtask.result && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: 'rgba(34, 197, 94, 0.05)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            {renderResult(subtask)}
                        </motion.div>
                    )}

                    {/* Error */}
                    {subtask.status === 'failed' && subtask.error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: 'rgba(239, 68, 68, 0.05)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                color: 'var(--danger)'
                            }}
                        >
                            <strong>Error:</strong> {subtask.error}
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function renderResult(subtask: Subtask): React.ReactNode {
    const result = subtask.result;

    // Market Monitor Result
    if (result.currentPrice !== undefined) {
        return (
            <div>
                <div><strong>Price:</strong> ${result.currentPrice?.toFixed(2)}</div>
                {result.priceChange24h && (
                    <div style={{ color: result.priceChange24h > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        <strong>24h Change:</strong> {result.priceChange24h > 0 ? '+' : ''}{result.priceChange24h.toFixed(2)}%
                    </div>
                )}
                {result.indicators?.rsi && <div><strong>RSI:</strong> {result.indicators.rsi}</div>}
            </div>
        );
    }

    // Sentiment Result
    if (result.overallSentiment) {
        return (
            <div>
                <div><strong>Sentiment:</strong> {result.overallSentiment}</div>
                {result.confidenceScore && (
                    <div><strong>Confidence:</strong> {(result.confidenceScore * 100).toFixed(0)}%</div>
                )}
            </div>
        );
    }

    // On-Chain Result
    if (result.largeTransfers !== undefined) {
        return (
            <div>
                <div><strong>Whale Transactions:</strong> {result.largeTransfers?.length || 0}</div>
                {result.exchangeNetFlow && (
                    <div><strong>Exchange Flow:</strong> {result.exchangeNetFlow.direction}</div>
                )}
            </div>
        );
    }

    // Strategy Result
    if (result.recommendation) {
        return (
            <div>
                <div><strong>Recommendation:</strong> {result.recommendation}</div>
                {result.confidence && (
                    <div><strong>Confidence:</strong> {(result.confidence * 100).toFixed(0)}%</div>
                )}
            </div>
        );
    }

    return <div>Analysis completed successfully</div>;
}

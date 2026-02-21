import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Target, Shield, Clock, AlertTriangle } from 'lucide-react';
import { TradingStrategy } from '../types/agent.types';

interface StrategyDisplayProps {
    strategy: TradingStrategy;
}

const RECOMMENDATION_CONFIG = {
    STRONG_BUY: {
        icon: TrendingUp,
        color: '#22c55e',
        bg: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
        label: 'Strong Buy',
        emoji: '🚀'
    },
    BUY: {
        icon: TrendingUp,
        color: '#22c55e',
        bg: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
        label: 'Buy',
        emoji: '📈'
    },
    HOLD: {
        icon: Minus,
        color: '#eab308',
        bg: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
        label: 'Hold',
        emoji: '⏸️'
    },
    SELL: {
        icon: TrendingDown,
        color: '#ef4444',
        bg: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
        label: 'Sell',
        emoji: '📉'
    },
    STRONG_SELL: {
        icon: TrendingDown,
        color: '#ef4444',
        bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        label: 'Strong Sell',
        emoji: '⚠️'
    }
};

const RISK_CONFIG = {
    LOW: { color: '#22c55e', label: 'Low Risk' },
    MEDIUM: { color: '#eab308', label: 'Medium Risk' },
    HIGH: { color: '#ef4444', label: 'High Risk' }
};

const TIMEFRAME_CONFIG = {
    SHORT: { label: 'Short Term', duration: '1-7 days' },
    MEDIUM: { label: 'Medium Term', duration: '1-4 weeks' },
    LONG: { label: 'Long Term', duration: '1-3 months' }
};

export default function StrategyDisplay({ strategy }: StrategyDisplayProps) {
    const recommendationConfig = RECOMMENDATION_CONFIG[strategy.recommendation];
    const riskConfig = RISK_CONFIG[strategy.riskLevel];
    const timeframeConfig = TIMEFRAME_CONFIG[strategy.timeHorizon];

    const RecommendationIcon = recommendationConfig.icon;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="glass-card"
            style={{ padding: '32px' }}
        >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                    Trading Strategy Generated
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Based on multi-source analysis for {strategy.symbol}
                </p>
            </div>

            {/* Recommendation Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    background: recommendationConfig.bg,
                    borderRadius: '16px',
                    padding: '32px',
                    textAlign: 'center',
                    marginBottom: '32px',
                    boxShadow: `0 8px 32px ${recommendationConfig.color}40`
                }}
            >
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                    {recommendationConfig.emoji}
                </div>
                <h3 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', color: 'white' }}>
                    {recommendationConfig.label}
                </h3>
                <div style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Confidence: {(strategy.confidence * 100).toFixed(0)}%
                </div>

                {/* Confidence Bar */}
                <div style={{
                    marginTop: '16px',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${strategy.confidence * 100}%` }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        style={{
                            height: '100%',
                            background: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '4px'
                        }}
                    />
                </div>
            </motion.div>

            {/* Key Metrics Grid */}
            <div className="grid grid-3" style={{ marginBottom: '32px' }}>
                {/* Risk Level */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    style={{
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: `1px solid ${riskConfig.color}30`
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Shield size={20} color={riskConfig.color} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            Risk Level
                        </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: riskConfig.color }}>
                        {riskConfig.label}
                    </div>
                </motion.div>

                {/* Time Horizon */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    style={{
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Clock size={20} color="var(--primary)" />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            Time Horizon
                        </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                        {timeframeConfig.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {timeframeConfig.duration}
                    </div>
                </motion.div>

                {/* Stop Loss */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    style={{
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Target size={20} color="var(--danger)" />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            Stop Loss
                        </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--danger)' }}>
                        ${strategy.stopLoss.toFixed(2)}
                    </div>
                </motion.div>
            </div>

            {/* Entry & Exit Points */}
            <div className="grid grid-2" style={{ marginBottom: '32px' }}>
                {/* Entry Points */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 }}
                    style={{
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                    }}
                >
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--success)' }}>
                        Entry Points
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {strategy.entryPoints.map((price, i) => (
                            <div key={i} style={{
                                padding: '8px 12px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: 'var(--success)'
                            }}>
                                ${price.toFixed(2)}
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Exit Points */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                    }}
                >
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--primary)' }}>
                        Exit Points (Take Profit)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {strategy.exitPoints.map((price, i) => (
                            <div key={i} style={{
                                padding: '8px 12px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: 'var(--primary)'
                            }}>
                                ${price.toFixed(2)}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Reasoning */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                style={{
                    padding: '20px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    marginBottom: '20px'
                }}
            >
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Analysis & Reasoning
                </h4>
                <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                    {strategy.reasoning}
                </p>
            </motion.div>

            {/* Key Risks */}
            {strategy.keyRisks.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    style={{
                        padding: '20px',
                        background: 'rgba(239, 68, 68, 0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <AlertTriangle size={20} color="var(--danger)" />
                        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--danger)', margin: 0 }}>
                            Key Risks to Monitor
                        </h4>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {strategy.keyRisks.map((risk, i) => (
                            <li key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                {risk}
                            </li>
                        ))}
                    </ul>
                </motion.div>
            )}
        </motion.div>
    );
}

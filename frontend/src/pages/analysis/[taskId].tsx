import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { getTaskStatus, pollTaskStatus } from '../../lib/api';
import { StatusResponse } from '../../types/agent.types';
import AgentCard from '../../components/AgentCard';
import StrategyDisplay from '../../components/StrategyDisplay';


export default function AnalysisPage() {
    const router = useRouter();
    const { taskId } = router.query;

    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!taskId || typeof taskId !== 'string') return;

        // Start polling
        pollTaskStatus(
            taskId,
            (update) => {
                setStatus(update);
                setLoading(false);
            },
            2000 // Poll every 2 seconds
        ).catch((err) => {
            setError(err.message || 'Failed to fetch analysis status');
            setLoading(false);
        });
    }, [taskId]);

    if (loading && !status) {
        return (
            <div style={styles.loadingContainer}>
                <Loader2 size={48} className="spin" color="var(--primary)" />
                <p style={styles.loadingText}>Loading analysis...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.errorContainer}>
                <XCircle size={48} color="var(--danger)" />
                <h2 style={{ marginTop: '16px' }}>Error</h2>
                <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
                <button className="btn btn-primary" onClick={() => router.push('/')} style={{ marginTop: '24px' }}>
                    Go Back
                </button>
            </div>
        );
    }

    if (!status) return null;

    const isCompleted = status.status === 'completed';
    const isFailed = status.status === 'failed';
    const isInProgress = !isCompleted && !isFailed;

    // Extract strategy from subtasks
    const strategySubtask = status.subtasks.find(t => t.agentType === 'strategy_generator' && t.result);
    const strategy = strategySubtask?.result;

    return (
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
            {/* Back Button */}
            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="btn btn-secondary"
                onClick={() => router.push('/')}
                style={{
                    marginBottom: '32px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                <ArrowLeft size={16} />
                New Analysis
            </motion.button>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: '40px' }}
            >
                <h1 style={styles.title}>
                    {status.goal}
                </h1>

                <div style={styles.statusBar}>
                    <div style={styles.statusInfo}>
                        <span style={styles.statusLabel}>Status:</span>
                        <StatusBadge status={status.status} />
                    </div>

                    <div style={styles.progressInfo}>
                        <span style={styles.progressText}>
                            {status.progress.completed} / {status.progress.total} agents completed
                        </span>
                        <div style={styles.progressBarContainer}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${status.progress.percentage}%` }}
                                transition={{ duration: 0.5 }}
                                style={{
                                    ...styles.progressBar,
                                    background: isCompleted ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--primary)'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Agent Cards */}
            <div style={{ marginBottom: '40px' }}>
                <h2 style={styles.sectionTitle}>Agent Activity</h2>
                <div className="grid">
                    <AnimatePresence>
                        {status.subtasks.map((subtask, index) => (
                            <AgentCard key={subtask.id} subtask={subtask} index={index} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Strategy Display */}
            {isCompleted && strategy && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '40px' }}
                >
                    <h2 style={styles.sectionTitle}>Trading Strategy</h2>
                    <StrategyDisplay strategy={strategy} />
                </motion.div>
            )}

            {/* Synthesis Results */}
            {isCompleted && status.result?.synthesis && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '40px' }}
                >
                    <h2 style={styles.sectionTitle}>AI Synthesis</h2>
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <p style={{
                            fontSize: '15px',
                            lineHeight: '1.8',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {status.result.synthesis}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Verification */}
            {isCompleted && status.result?.verification && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h2 style={styles.sectionTitle}>Quality Verification</h2>
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '24px',
                            marginBottom: '24px'
                        }}>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                    Validity
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: status.result.verification.isValid ? 'var(--success)' : 'var(--danger)'
                                }}>
                                    {status.result.verification.isValid ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                    {status.result.verification.isValid ? 'Valid' : 'Invalid'}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                    Confidence Score
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                    {(status.result.verification.confidenceScore * 100).toFixed(0)}%
                                </div>
                                <div style={{
                                    marginTop: '8px',
                                    height: '6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${status.result.verification.confidenceScore * 100}%`,
                                        background: 'var(--primary)',
                                        borderRadius: '3px'
                                    }} />
                                </div>
                            </div>
                        </div>

                        {status.result.verification.issues.length > 0 && (
                            <div>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                                    Issues Found
                                </h4>
                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    {status.result.verification.issues.map((issue, i) => (
                                        <li key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            {issue}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {status.result.verification.recommendations.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                                    Recommendations
                                </h4>
                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    {status.result.verification.recommendations.map((rec, i) => (
                                        <li key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Loading State */}
            {isInProgress && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={styles.inProgressMessage}
                >
                    <Loader2 size={24} className="spin" color="var(--primary)" />
                    <span>Analysis in progress... This may take 2-3 minutes</span>
                </motion.div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { color: string; bg: string; icon: any }> = {
        planning: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Clock },
        executing: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', icon: Loader2 },
        reasoning: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', icon: Loader2 },
        verifying: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', icon: Loader2 },
        completed: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: CheckCircle },
        failed: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle },
    };

    const statusConfig = config[status] || config.executing;
    const Icon = statusConfig.icon;

    return (
        <div className="badge" style={{
            background: statusConfig.bg,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.color}30`
        }}>
            <Icon size={14} className={status === 'executing' || status === 'reasoning' || status === 'verifying' ? 'spin' : ''} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
    );
}

const styles = {
    loadingContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
    },
    loadingText: {
        fontSize: '16px',
        color: 'var(--text-secondary)',
    },
    errorContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center' as const,
    },
    title: {
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '24px',
        lineHeight: '1.3',
    },
    statusBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '32px',
        flexWrap: 'wrap' as const,
    },
    statusInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    statusLabel: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        fontWeight: 600,
    },
    progressInfo: {
        flex: 1,
        minWidth: '200px',
    },
    progressText: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
        display: 'block',
    },
    progressBarContainer: {
        height: '8px',
        background: 'var(--bg-secondary)',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 0.5s ease',
    },
    sectionTitle: {
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '24px',
    },
    inProgressMessage: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
        background: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        fontSize: '16px',
        color: 'var(--text-secondary)',
        marginTop: '40px',
    },
};

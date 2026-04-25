import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, ArrowLeft, CheckCircle2, XCircle, Clock, Database, Cpu, AlertTriangle, Download } from 'lucide-react';
import {
    listObservabilityTasks,
    getObservabilityStats,
    downloadObservabilityTaskExport,
    downloadObservabilityAllExport,
    type ObservabilityTaskRow,
    type ObservabilityStats,
} from '../../lib/api';

export default function ObservabilityIndex() {
    const [tasks, setTasks] = useState<ObservabilityTaskRow[]>([]);
    const [stats, setStats] = useState<ObservabilityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadingAll, setDownloadingAll] = useState(false);

    const handleDownloadOne = async (taskId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDownloadingId(taskId);
        try {
            await downloadObservabilityTaskExport(taskId);
        } catch (err: any) {
            setError(err.message || 'Download failed');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadAll = async () => {
        setDownloadingAll(true);
        try {
            await downloadObservabilityAllExport();
        } catch (err: any) {
            setError(err.message || 'Bulk download failed');
        } finally {
            setDownloadingAll(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const [tasksRes, statsRes] = await Promise.all([
                    listObservabilityTasks(100),
                    getObservabilityStats(),
                ]);
                if (!mounted) return;
                setTasks(tasksRes.tasks);
                setStats(statsRes);
                setLoading(false);
            } catch (e: any) {
                if (!mounted) return;
                setError(e.message || 'Failed to load observability data');
                setLoading(false);
            }
        };
        load();
        const interval = setInterval(load, 5000);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    return (
        <div style={{ minHeight: '100vh', padding: '40px 0' }}>
            <div className="container">
                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', marginBottom: 24 }}>
                    <ArrowLeft size={16} /> Back
                </Link>

                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Activity size={28} color="#6366f1" />
                        </div>
                        <div>
                            <h1 className="text-gradient" style={{ fontSize: 36, fontWeight: 700, margin: 0 }}>
                                Observability
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                Every agent tool call, data source, and LLM invocation — stored and queryable.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {error && <div style={errorStyle}>{error}</div>}

                {stats && <StatsPanel stats={stats} />}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '32px 0 16px' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Recent Tasks</h2>
                    {tasks.length > 0 && (
                        <button
                            onClick={handleDownloadAll}
                            disabled={downloadingAll}
                            title="Download every step response across all tasks as a single JSON file"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '8px 12px', borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'rgba(99,102,241,0.1)',
                                color: 'var(--text-primary)',
                                cursor: downloadingAll ? 'progress' : 'pointer',
                                fontSize: 12, fontWeight: 500,
                                opacity: downloadingAll ? 0.6 : 1,
                            }}
                        >
                            <Download size={14} />
                            {downloadingAll ? 'Exporting…' : 'Download all step responses'}
                        </button>
                    )}
                </div>

                {loading && tasks.length === 0 && (
                    <div className="glass-card" style={{ textAlign: 'center', padding: 48 }}>Loading…</div>
                )}

                {!loading && tasks.length === 0 && (
                    <div className="glass-card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                        No tasks yet. Run an analysis to start populating the timeline.
                    </div>
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                    {tasks.map((t) => (
                        <Link key={t.task_id} href={`/observability/${t.task_id}`} style={{ textDecoration: 'none' }}>
                            <motion.div
                                whileHover={{ y: -2 }}
                                className="glass-card"
                                style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto auto', gap: 16, alignItems: 'center', cursor: 'pointer' }}
                            >
                                <StatusIcon status={t.status} />
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                                        {t.goal}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span>{new Date(t.started_at).toLocaleString()}</span>
                                        {t.duration_ms != null && <span>{formatDuration(t.duration_ms)}</span>}
                                        <span>{t.subtask_count} subtasks</span>
                                        <span>{t.tool_call_count} tool calls</span>
                                        <span>{t.llm_call_count} LLM calls</span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDownloadOne(t.task_id, e)}
                                    disabled={downloadingId === t.task_id}
                                    title="Download this task's step responses as JSON"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '6px 10px', borderRadius: 6,
                                        border: '1px solid var(--border)',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        cursor: downloadingId === t.task_id ? 'progress' : 'pointer',
                                        fontSize: 12,
                                    }}
                                >
                                    <Download size={14} />
                                    {downloadingId === t.task_id ? '…' : 'JSON'}
                                </button>
                                <StatusBadge status={t.status} />
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatsPanel({ stats }: { stats: ObservabilityStats }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <StatCard icon={<Activity size={18} />} label="Total Tasks" value={stats.tasks.total} tone="primary" />
            <StatCard icon={<CheckCircle2 size={18} />} label="Completed" value={stats.tasks.completed} tone="success" />
            <StatCard icon={<XCircle size={18} />} label="Failed" value={stats.tasks.failed} tone={stats.tasks.failed > 0 ? 'danger' : 'muted'} />
            <StatCard icon={<Database size={18} />} label="Tool Calls" value={stats.toolCalls.total} sub={`${stats.toolCalls.errors} errors`} tone="primary" />
            <StatCard icon={<Cpu size={18} />} label="LLM Calls" value={stats.llmCalls.total} sub={`${stats.llmCalls.totalTokens.toLocaleString()} tokens`} tone="primary" />

            {stats.bySource.length > 0 && (
                <div className="glass-card" style={{ gridColumn: '1 / -1', padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Traffic by Source
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {stats.bySource.map((s) => (
                            <div key={s.source} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, alignItems: 'center', fontSize: 13 }}>
                                <span style={{ fontWeight: 500 }}>{s.source}</span>
                                <span style={{ color: 'var(--text-tertiary)' }}>{s.count} calls</span>
                                <span style={{ color: 'var(--text-tertiary)' }}>{Math.round(s.avg_ms)} ms avg</span>
                                <span style={{ color: s.errors > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                                    {s.errors > 0 ? `${s.errors} errors` : 'ok'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number; sub?: string; tone: 'primary' | 'success' | 'danger' | 'muted' }) {
    const color =
        tone === 'success' ? 'var(--success)' :
            tone === 'danger' ? 'var(--danger)' :
                tone === 'muted' ? 'var(--text-tertiary)' : 'var(--primary-light)';
    return (
        <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 8 }}>
                {icon}
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function StatusIcon({ status }: { status: string }) {
    if (status === 'completed') return <CheckCircle2 size={20} color="var(--success)" />;
    if (status === 'failed') return <XCircle size={20} color="var(--danger)" />;
    if (status === 'running') return <Clock size={20} color="var(--warning)" className="spin" />;
    return <AlertTriangle size={20} color="var(--text-tertiary)" />;
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; fg: string }> = {
        completed: { bg: 'rgba(34,197,94,0.15)', fg: 'var(--success)' },
        failed: { bg: 'rgba(239,68,68,0.15)', fg: 'var(--danger)' },
        running: { bg: 'rgba(234,179,8,0.15)', fg: 'var(--warning)' },
    };
    const style = map[status] || { bg: 'rgba(255,255,255,0.05)', fg: 'var(--text-tertiary)' };
    return (
        <span style={{
            padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: style.bg, color: style.fg, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>{status}</span>
    );
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const errorStyle: React.CSSProperties = {
    padding: 12,
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: 'var(--danger)',
    fontSize: 14,
    marginBottom: 16,
};

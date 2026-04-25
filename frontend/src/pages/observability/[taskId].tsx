import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Activity, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
    Database, Cpu, ExternalLink, AlertTriangle, Wrench, Download,
} from 'lucide-react';
import {
    getObservabilityTask,
    getObservabilityLlmCall,
    downloadObservabilityTaskExport,
    type ObservabilityTaskRow,
    type ObservabilitySubtaskRow,
    type ObservabilityToolCallRow,
    type ObservabilityLlmCallRow,
} from '../../lib/api';

export default function ObservabilityTaskDetail() {
    const router = useRouter();
    const { taskId } = router.query;
    const [task, setTask] = useState<ObservabilityTaskRow | null>(null);
    const [subtasks, setSubtasks] = useState<ObservabilitySubtaskRow[]>([]);
    const [toolCalls, setToolCalls] = useState<ObservabilityToolCallRow[]>([]);
    const [llmCalls, setLlmCalls] = useState<ObservabilityLlmCallRow[]>([]);
    const [error, setError] = useState('');
    const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');

    const handleDownload = async () => {
        if (typeof taskId !== 'string') return;
        setDownloading(true);
        setDownloadError('');
        try {
            await downloadObservabilityTaskExport(taskId);
        } catch (e: any) {
            setDownloadError(e.message || 'Download failed');
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        if (typeof taskId !== 'string') return;
        let mounted = true;
        const load = async () => {
            try {
                const data = await getObservabilityTask(taskId);
                if (!mounted) return;
                setTask(data.task);
                setSubtasks(data.subtasks);
                setToolCalls(data.toolCalls);
                setLlmCalls(data.llmCalls);
            } catch (e: any) {
                if (!mounted) return;
                setError(e.message);
            }
        };
        load();
        const interval = setInterval(() => {
            if (task?.status === 'running' || !task) load();
        }, 2000);
        return () => { mounted = false; clearInterval(interval); };
    }, [taskId, task?.status]);

    if (error) {
        return (
            <div style={{ padding: 40 }}>
                <div className="container">
                    <Link href="/observability" style={backLink}>
                        <ArrowLeft size={16} /> Back to observability
                    </Link>
                    <div style={{ marginTop: 24, padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--danger)' }}>
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    if (!task) {
        return <div style={{ padding: 40 }}><div className="container">Loading…</div></div>;
    }

    const toggleExpanded = (id: string) => {
        setExpandedCalls((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <div style={{ minHeight: '100vh', padding: '40px 0' }}>
            <div className="container">
                <Link href="/observability" style={backLink}>
                    <ArrowLeft size={16} /> All tasks
                </Link>

                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                        <StatusIcon status={task.status} size={32} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
                                Task {task.task_id.slice(0, 8)}
                            </div>
                            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{task.goal}</h1>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                <span>Started {new Date(task.started_at).toLocaleString()}</span>
                                {task.duration_ms != null && <span>Duration {formatDuration(task.duration_ms)}</span>}
                                <span>{task.subtask_count} subtasks</span>
                                <span>{toolCalls.length} tool calls</span>
                                <span>{llmCalls.length} LLM calls</span>
                            </div>
                        </div>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            title="Download every step response (subtasks, tool calls, full LLM prompts and responses) as JSON"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px', borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'rgba(99,102,241,0.1)',
                                color: 'var(--text-primary)',
                                cursor: downloading ? 'progress' : 'pointer',
                                fontSize: 13, fontWeight: 500,
                                opacity: downloading ? 0.6 : 1,
                            }}
                        >
                            <Download size={16} />
                            {downloading ? 'Downloading…' : 'Download all steps'}
                        </button>
                    </div>
                    {downloadError && (
                        <div style={{ marginTop: 12, padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--danger)', fontSize: 12 }}>
                            {downloadError}
                        </div>
                    )}
                    {task.error && (
                        <div style={{ marginTop: 16, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 13 }}>
                            <strong>Error:</strong> {task.error}
                        </div>
                    )}
                </motion.div>

                <h2 style={sectionHeading}>Pipeline</h2>
                <div style={{ display: 'grid', gap: 16 }}>
                    {subtasks.map((st) => {
                        const stCalls = toolCalls.filter((tc) => tc.subtask_id === st.subtask_id);
                        const stLlm = llmCalls.filter((l) => l.subtask_id === st.subtask_id);
                        return (
                            <SubtaskBlock
                                key={st.subtask_id}
                                subtask={st}
                                toolCalls={stCalls}
                                llmCalls={stLlm}
                                expandedCalls={expandedCalls}
                                onToggle={toggleExpanded}
                            />
                        );
                    })}

                    {/* Coordinator-level LLM calls (planning, synthesis, verification) */}
                    <CoordinatorCallsBlock
                        llmCalls={llmCalls.filter((l) => !l.subtask_id)}
                    />
                </div>
            </div>
        </div>
    );
}

function SubtaskBlock({
    subtask,
    toolCalls,
    llmCalls,
    expandedCalls,
    onToggle,
}: {
    subtask: ObservabilitySubtaskRow;
    toolCalls: ObservabilityToolCallRow[];
    llmCalls: ObservabilityLlmCallRow[];
    expandedCalls: Set<string>;
    onToggle: (id: string) => void;
}) {
    return (
        <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <StatusIcon status={subtask.status} size={20} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{subtask.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {subtask.agent_type}
                        {subtask.duration_ms != null && <> · {formatDuration(subtask.duration_ms)}</>}
                        · {toolCalls.length} tool calls · {llmCalls.length} LLM calls
                    </div>
                </div>
                <StatusBadge status={subtask.status} />
            </div>

            {subtask.error && (
                <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
                    {subtask.error}
                </div>
            )}

            {toolCalls.length === 0 && llmCalls.length === 0 && (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13, fontStyle: 'italic' }}>No recorded calls yet.</div>
            )}

            <div style={{ display: 'grid', gap: 8 }}>
                {toolCalls.map((tc) => (
                    <ToolCallRow key={tc.tool_call_id} call={tc} expanded={expandedCalls.has(tc.tool_call_id)} onToggle={() => onToggle(tc.tool_call_id)} />
                ))}
                {llmCalls.map((l) => (
                    <LlmCallRow key={l.llm_call_id} call={l} />
                ))}
            </div>
        </div>
    );
}

function CoordinatorCallsBlock({ llmCalls }: { llmCalls: ObservabilityLlmCallRow[] }) {
    if (llmCalls.length === 0) return null;
    return (
        <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Cpu size={18} color="var(--primary-light)" />
                <div style={{ fontSize: 15, fontWeight: 600 }}>Coordinator LLM Calls</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>(planning · synthesis · verification)</div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
                {llmCalls.map((l) => <LlmCallRow key={l.llm_call_id} call={l} />)}
            </div>
        </div>
    );
}

function ToolCallRow({ call, expanded, onToggle }: { call: ObservabilityToolCallRow; expanded: boolean; onToggle: () => void }) {
    const isError = call.status === 'error';
    return (
        <div style={{
            border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
            borderRadius: 8,
            background: isError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
        }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%', border: 'none', background: 'transparent',
                    padding: 12, display: 'grid', gridTemplateColumns: '18px auto 1fr auto auto', gap: 12,
                    alignItems: 'center', cursor: 'pointer', color: 'inherit', textAlign: 'left',
                }}
            >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Wrench size={16} color={isError ? 'var(--danger)' : 'var(--primary-light)'} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>
                        {call.tool_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Database size={11} /> {call.source}
                        </span>
                        {call.endpoint && (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                                <ExternalLink size={11} style={{ display: 'inline', marginRight: 4 }} />
                                {call.endpoint}
                            </span>
                        )}
                    </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{call.duration_ms}ms</span>
                <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 10,
                    background: isError ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: isError ? 'var(--danger)' : 'var(--success)',
                }}>{call.status}</span>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}
                    >
                        <div style={{ padding: 12, display: 'grid', gap: 12 }}>
                            {call.error && (
                                <InfoRow label="Error" value={call.error} tone="danger" />
                            )}
                            <InfoRow
                                label="Arguments"
                                value={<JsonBlock value={call.arguments} />}
                            />
                            <InfoRow
                                label="Result"
                                value={<JsonBlock value={call.result} />}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, fontSize: 12 }}>
                                <Meta label="Timestamp" value={new Date(call.timestamp).toLocaleString()} />
                                <Meta label="Tool call ID" value={call.tool_call_id.slice(0, 16) + '…'} />
                                {call.request_bytes != null && <Meta label="Req bytes" value={String(call.request_bytes)} />}
                                {call.response_bytes != null && <Meta label="Res bytes" value={formatBytes(call.response_bytes)} />}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function LlmCallRow({ call }: { call: ObservabilityLlmCallRow }) {
    const [open, setOpen] = useState(false);
    const [full, setFull] = useState<{ prompt: string; response: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next && !full) {
            try {
                setLoading(true);
                const data = await getObservabilityLlmCall(call.llm_call_id);
                setFull({ prompt: data.prompt ?? '', response: data.response ?? '' });
            } catch { /* ignore */ }
            finally { setLoading(false); }
        }
    };

    return (
        <div style={{
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'rgba(99,102,241,0.05)', overflow: 'hidden',
        }}>
            <button
                onClick={toggle}
                style={{
                    width: '100%', border: 'none', background: 'transparent',
                    padding: 12, display: 'grid', gridTemplateColumns: '18px auto 1fr auto auto', gap: 12,
                    alignItems: 'center', cursor: 'pointer', color: 'inherit', textAlign: 'left',
                }}
            >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Cpu size={16} color="var(--primary-light)" />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                        {call.purpose} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>· {call.model}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {call.provider}
                        {call.total_tokens != null && <> · {call.total_tokens} tokens ({call.prompt_tokens ?? 0} in / {call.completion_tokens ?? 0} out)</>}
                    </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{call.duration_ms}ms</span>
                <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 10,
                    background: call.status === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: call.status === 'ok' ? 'var(--success)' : 'var(--danger)',
                }}>{call.status}</span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}
                    >
                        <div style={{ padding: 12, display: 'grid', gap: 12 }}>
                            {loading && <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loading prompt/response…</div>}
                            {full && (
                                <>
                                    <InfoRow label="Prompt (truncated)" value={<pre style={preStyle}>{full.prompt || '—'}</pre>} />
                                    <InfoRow label="Response (truncated)" value={<pre style={preStyle}>{full.response || '—'}</pre>} />
                                </>
                            )}
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                {new Date(call.timestamp).toLocaleString()} · id {call.llm_call_id.slice(0, 16)}…
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function JsonBlock({ value }: { value: any }) {
    const str = React.useMemo(() => {
        try { return JSON.stringify(value, null, 2); }
        catch { return String(value); }
    }, [value]);
    return <pre style={preStyle}>{str}</pre>;
}

function InfoRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'danger' }) {
    return (
        <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: tone === 'danger' ? 'var(--danger)' : 'var(--text-tertiary)', marginBottom: 4 }}>
                {label}
            </div>
            <div>{value}</div>
        </div>
    );
}

function Meta({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{value}</div>
        </div>
    );
}

function StatusIcon({ status, size = 20 }: { status: string; size?: number }) {
    if (status === 'completed') return <CheckCircle2 size={size} color="var(--success)" />;
    if (status === 'failed') return <XCircle size={size} color="var(--danger)" />;
    if (status === 'running' || status === 'in_progress') return <Clock size={size} color="var(--warning)" className="spin" />;
    return <AlertTriangle size={size} color="var(--text-tertiary)" />;
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; fg: string }> = {
        completed: { bg: 'rgba(34,197,94,0.15)', fg: 'var(--success)' },
        failed: { bg: 'rgba(239,68,68,0.15)', fg: 'var(--danger)' },
        running: { bg: 'rgba(234,179,8,0.15)', fg: 'var(--warning)' },
        in_progress: { bg: 'rgba(234,179,8,0.15)', fg: 'var(--warning)' },
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

function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

const backLink: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-secondary)',
};

const sectionHeading: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    margin: '24px 0 12px',
};

const preStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)',
    padding: 12,
    borderRadius: 6,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 12,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 400,
    overflow: 'auto',
};

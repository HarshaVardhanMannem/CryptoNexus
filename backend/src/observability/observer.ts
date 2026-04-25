import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getObservabilityStore } from './store';
import { getJsonlRecorder } from './jsonlRecorder';
import type { ObservabilityEvent } from './types';

/**
 * Observer — the single sink every part of the system calls into.
 * Fans out each event to:
 *   1. SQLite (durable, queryable)
 *   2. JSONL file (audit trail)
 *   3. EventEmitter (live SSE subscribers)
 *   4. console.log (visible in stdout mirror)
 *
 * Consumers (routes, SSE) subscribe via observer.on('event', listener).
 */
class Observer extends EventEmitter {
    record(event: ObservabilityEvent): void {
        try {
            getObservabilityStore().record(event);
        } catch (err: any) {
            console.warn('[observability] SQLite write failed:', err.message);
        }
        try {
            getJsonlRecorder().record(event);
        } catch { /* already logged inside */ }

        // Short stdout line for humans watching logs
        const preview = summarize(event);
        console.log(`[obs] ${preview}`);

        this.emit('event', event);
    }

    /** Helper: build a new event id for callers */
    newId(): string {
        return uuidv4();
    }
}

function summarize(e: ObservabilityEvent): string {
    switch (e.eventType) {
        case 'task_started':
            return `task_started task=${e.taskId.slice(0, 8)} goal="${e.goal.slice(0, 60)}"`;
        case 'task_planned':
            return `task_planned task=${e.taskId.slice(0, 8)} subtasks=${e.subtaskCount}`;
        case 'task_completed':
            return `task_completed task=${e.taskId.slice(0, 8)} dur=${e.durationMs}ms tools=${e.totalToolCalls} llm=${e.totalLlmCalls}`;
        case 'task_failed':
            return `task_failed task=${e.taskId.slice(0, 8)} err="${e.error.slice(0, 80)}"`;
        case 'subtask_started':
            return `subtask_started task=${e.taskId.slice(0, 8)} agent=${e.agentType} name="${e.name.slice(0, 40)}"`;
        case 'subtask_completed':
            return `subtask_completed task=${e.taskId.slice(0, 8)} sub=${e.subtaskId.slice(0, 8)} dur=${e.durationMs}ms tools=${e.toolCallCount}`;
        case 'subtask_failed':
            return `subtask_failed task=${e.taskId.slice(0, 8)} sub=${e.subtaskId.slice(0, 8)} err="${e.error.slice(0, 60)}"`;
        case 'tool_call':
            return `tool_call ${e.toolName} source=${e.source} status=${e.status} dur=${e.durationMs}ms`;
        case 'llm_call':
            return `llm_call purpose=${e.purpose} model=${e.model} dur=${e.durationMs}ms tokens=${e.totalTokens ?? '?'}`;
        case 'phase_change':
            return `phase_change task=${e.taskId.slice(0, 8)} -> ${e.phase}`;
        default:
            return JSON.stringify(e).slice(0, 120);
    }
}

export const observer = new Observer();
export type { ObservabilityEvent };

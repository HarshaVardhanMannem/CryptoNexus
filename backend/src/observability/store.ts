import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
    ObservabilityEvent,
    TaskStartedEvent,
    TaskPlannedEvent,
    TaskCompletedEvent,
    TaskFailedEvent,
    SubtaskStartedEvent,
    SubtaskCompletedEvent,
    SubtaskFailedEvent,
    ToolCallEvent,
    LlmCallEvent,
} from './types';

/**
 * SQLite-backed store for observability events.
 *
 * Tables:
 *   - tasks       one row per agent task
 *   - subtasks    one row per subtask (belongs to task)
 *   - tool_calls  one row per tool invocation (belongs to subtask)
 *   - llm_calls   one row per LLM completion (may belong to subtask or task-level)
 *   - events      raw append-only event log (every event, full JSON)
 */
export class ObservabilityStore {
    private db: Database.Database;

    constructor(dbPath?: string) {
        const resolved = dbPath || path.resolve(process.cwd(), 'data', 'observability.db');
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        this.db = new Database(resolved);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.initSchema();
        console.log(`[observability] SQLite store ready: ${resolved}`);
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                goal TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_ms INTEGER,
                error TEXT,
                subtask_count INTEGER DEFAULT 0,
                tool_call_count INTEGER DEFAULT 0,
                llm_call_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS subtasks (
                subtask_id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                agent_type TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_ms INTEGER,
                error TEXT,
                tool_call_count INTEGER DEFAULT 0,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            );

            CREATE TABLE IF NOT EXISTS tool_calls (
                tool_call_id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                subtask_id TEXT,
                agent_type TEXT,
                tool_name TEXT NOT NULL,
                source TEXT NOT NULL,
                endpoint TEXT,
                arguments_json TEXT,
                result_json TEXT,
                status TEXT NOT NULL,
                error TEXT,
                duration_ms INTEGER NOT NULL,
                request_bytes INTEGER,
                response_bytes INTEGER,
                timestamp TEXT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id),
                FOREIGN KEY(subtask_id) REFERENCES subtasks(subtask_id)
            );

            CREATE TABLE IF NOT EXISTS llm_calls (
                llm_call_id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                subtask_id TEXT,
                agent_type TEXT,
                purpose TEXT NOT NULL,
                model TEXT NOT NULL,
                provider TEXT NOT NULL,
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                total_tokens INTEGER,
                duration_ms INTEGER NOT NULL,
                status TEXT NOT NULL,
                error TEXT,
                prompt TEXT,
                response TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            );

            CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                subtask_id TEXT,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tool_calls_task ON tool_calls(task_id);
            CREATE INDEX IF NOT EXISTS idx_tool_calls_subtask ON tool_calls(subtask_id);
            CREATE INDEX IF NOT EXISTS idx_tool_calls_source ON tool_calls(source);
            CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
            CREATE INDEX IF NOT EXISTS idx_llm_calls_task ON llm_calls(task_id);
            CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_started ON tasks(started_at);
        `);
    }

    record(event: ObservabilityEvent): void {
        this.db.prepare(
            `INSERT OR REPLACE INTO events (event_id, task_id, subtask_id, event_type, payload_json, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
            event.eventId,
            event.taskId,
            event.subtaskId ?? null,
            event.eventType,
            JSON.stringify(event),
            event.timestamp
        );

        switch (event.eventType) {
            case 'task_started': this.applyTaskStarted(event); break;
            case 'task_planned': this.applyTaskPlanned(event); break;
            case 'task_completed': this.applyTaskCompleted(event); break;
            case 'task_failed': this.applyTaskFailed(event); break;
            case 'subtask_started': this.applySubtaskStarted(event); break;
            case 'subtask_completed': this.applySubtaskCompleted(event); break;
            case 'subtask_failed': this.applySubtaskFailed(event); break;
            case 'tool_call': this.applyToolCall(event); break;
            case 'llm_call': this.applyLlmCall(event); break;
        }
    }

    private applyTaskStarted(e: TaskStartedEvent) {
        this.db.prepare(
            `INSERT OR REPLACE INTO tasks (task_id, goal, status, started_at)
             VALUES (?, ?, 'running', ?)`
        ).run(e.taskId, e.goal, e.timestamp);
    }

    private applyTaskPlanned(e: TaskPlannedEvent) {
        this.db.prepare(
            `UPDATE tasks SET subtask_count = ? WHERE task_id = ?`
        ).run(e.subtaskCount, e.taskId);
    }

    private applyTaskCompleted(e: TaskCompletedEvent) {
        this.db.prepare(
            `UPDATE tasks SET status = 'completed', ended_at = ?, duration_ms = ?,
             tool_call_count = ?, llm_call_count = ? WHERE task_id = ?`
        ).run(e.timestamp, e.durationMs, e.totalToolCalls, e.totalLlmCalls, e.taskId);
    }

    private applyTaskFailed(e: TaskFailedEvent) {
        this.db.prepare(
            `UPDATE tasks SET status = 'failed', ended_at = ?, duration_ms = ?, error = ?
             WHERE task_id = ?`
        ).run(e.timestamp, e.durationMs, e.error, e.taskId);
    }

    private applySubtaskStarted(e: SubtaskStartedEvent) {
        this.db.prepare(
            `INSERT OR REPLACE INTO subtasks (subtask_id, task_id, name, description, agent_type, status, started_at)
             VALUES (?, ?, ?, ?, ?, 'running', ?)`
        ).run(e.subtaskId, e.taskId, e.name, e.description, e.agentType, e.timestamp);
    }

    private applySubtaskCompleted(e: SubtaskCompletedEvent) {
        this.db.prepare(
            `UPDATE subtasks SET status = 'completed', ended_at = ?, duration_ms = ?, tool_call_count = ?
             WHERE subtask_id = ?`
        ).run(e.timestamp, e.durationMs, e.toolCallCount, e.subtaskId);
    }

    private applySubtaskFailed(e: SubtaskFailedEvent) {
        this.db.prepare(
            `UPDATE subtasks SET status = 'failed', ended_at = ?, duration_ms = ?, error = ?
             WHERE subtask_id = ?`
        ).run(e.timestamp, e.durationMs, e.error, e.subtaskId);
    }

    private applyToolCall(e: ToolCallEvent) {
        this.db.prepare(
            `INSERT OR REPLACE INTO tool_calls
             (tool_call_id, task_id, subtask_id, agent_type, tool_name, source, endpoint,
              arguments_json, result_json, status, error, duration_ms,
              request_bytes, response_bytes, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            e.toolCallId, e.taskId, e.subtaskId ?? null, e.agentType ?? null,
            e.toolName, e.source, e.endpoint ?? null,
            JSON.stringify(e.arguments), JSON.stringify(e.result),
            e.status, e.error ?? null, e.durationMs,
            e.requestBytes ?? null, e.responseBytes ?? null, e.timestamp
        );
    }

    private applyLlmCall(e: LlmCallEvent) {
        this.db.prepare(
            `INSERT OR REPLACE INTO llm_calls
             (llm_call_id, task_id, subtask_id, agent_type, purpose, model, provider,
              prompt_tokens, completion_tokens, total_tokens, duration_ms,
              status, error, prompt, response, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            e.llmCallId, e.taskId, e.subtaskId ?? null, e.agentType ?? null,
            e.purpose, e.model, e.provider,
            e.promptTokens ?? null, e.completionTokens ?? null, e.totalTokens ?? null,
            e.durationMs, e.status, e.error ?? null,
            e.prompt ?? null, e.response ?? null, e.timestamp
        );
    }

    // --- Query methods used by the observability routes ---

    listTasks(limit = 50): any[] {
        return this.db.prepare(
            `SELECT * FROM tasks ORDER BY started_at DESC LIMIT ?`
        ).all(limit);
    }

    getTask(taskId: string): any | undefined {
        return this.db.prepare(`SELECT * FROM tasks WHERE task_id = ?`).get(taskId);
    }

    getSubtasks(taskId: string): any[] {
        return this.db.prepare(
            `SELECT * FROM subtasks WHERE task_id = ? ORDER BY started_at ASC`
        ).all(taskId);
    }

    getToolCalls(taskId: string, subtaskId?: string): any[] {
        if (subtaskId) {
            return this.db.prepare(
                `SELECT * FROM tool_calls WHERE task_id = ? AND subtask_id = ? ORDER BY timestamp ASC`
            ).all(taskId, subtaskId);
        }
        return this.db.prepare(
            `SELECT * FROM tool_calls WHERE task_id = ? ORDER BY timestamp ASC`
        ).all(taskId);
    }

    getLlmCalls(taskId: string): any[] {
        return this.db.prepare(
            `SELECT llm_call_id, task_id, subtask_id, agent_type, purpose, model, provider,
                    prompt_tokens, completion_tokens, total_tokens, duration_ms,
                    status, error, timestamp
             FROM llm_calls WHERE task_id = ? ORDER BY timestamp ASC`
        ).all(taskId);
    }

    getLlmCall(llmCallId: string): any | undefined {
        return this.db.prepare(`SELECT * FROM llm_calls WHERE llm_call_id = ?`).get(llmCallId);
    }

    /**
     * Full LLM call rows for a task — includes prompt and response payloads.
     * Heavier than getLlmCalls(); use only for export/download.
     */
    getLlmCallsFull(taskId: string): any[] {
        return this.db.prepare(
            `SELECT * FROM llm_calls WHERE task_id = ? ORDER BY timestamp ASC`
        ).all(taskId);
    }

    getEvents(taskId: string): any[] {
        return this.db.prepare(
            `SELECT event_id, event_type, payload_json, timestamp
             FROM events WHERE task_id = ? ORDER BY timestamp ASC`
        ).all(taskId);
    }

    stats(): any {
        const totalTasks = this.db.prepare(`SELECT COUNT(*) as c FROM tasks`).get() as { c: number };
        const completed = this.db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'completed'`).get() as { c: number };
        const failed = this.db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'failed'`).get() as { c: number };
        const totalToolCalls = this.db.prepare(`SELECT COUNT(*) as c FROM tool_calls`).get() as { c: number };
        const errorToolCalls = this.db.prepare(`SELECT COUNT(*) as c FROM tool_calls WHERE status = 'error'`).get() as { c: number };
        const totalLlmCalls = this.db.prepare(`SELECT COUNT(*) as c FROM llm_calls`).get() as { c: number };
        const tokens = this.db.prepare(`SELECT COALESCE(SUM(total_tokens), 0) as t FROM llm_calls`).get() as { t: number };

        const bySource = this.db.prepare(
            `SELECT source, COUNT(*) as count, AVG(duration_ms) as avg_ms,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
             FROM tool_calls GROUP BY source ORDER BY count DESC`
        ).all();

        const byTool = this.db.prepare(
            `SELECT tool_name, source, COUNT(*) as count, AVG(duration_ms) as avg_ms
             FROM tool_calls GROUP BY tool_name, source ORDER BY count DESC`
        ).all();

        return {
            tasks: { total: totalTasks.c, completed: completed.c, failed: failed.c },
            toolCalls: { total: totalToolCalls.c, errors: errorToolCalls.c },
            llmCalls: { total: totalLlmCalls.c, totalTokens: tokens.t },
            bySource,
            byTool,
        };
    }

    close(): void {
        this.db.close();
    }
}

// Singleton
let storeInstance: ObservabilityStore | null = null;
export function getObservabilityStore(): ObservabilityStore {
    if (!storeInstance) {
        storeInstance = new ObservabilityStore();
    }
    return storeInstance;
}

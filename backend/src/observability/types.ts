/**
 * Observability event types — every significant moment in an agent task run.
 * All events carry taskId so they can be joined back to a task.
 *
 * Flow: task_started -> planning_complete -> subtask_started
 *       -> (llm_call | tool_call)* -> subtask_completed
 *       -> synthesis / verification llm_calls -> task_completed
 */

export type EventType =
    | 'task_started'
    | 'task_planned'
    | 'task_completed'
    | 'task_failed'
    | 'subtask_started'
    | 'subtask_completed'
    | 'subtask_failed'
    | 'tool_call'
    | 'llm_call'
    | 'phase_change';

export interface BaseEvent {
    eventId: string;
    eventType: EventType;
    taskId: string;
    subtaskId?: string;
    agentType?: string;
    timestamp: string; // ISO string
}

export interface TaskStartedEvent extends BaseEvent {
    eventType: 'task_started';
    goal: string;
}

export interface TaskPlannedEvent extends BaseEvent {
    eventType: 'task_planned';
    subtaskCount: number;
    subtasks: Array<{ id: string; name: string; agentType: string }>;
}

export interface TaskCompletedEvent extends BaseEvent {
    eventType: 'task_completed';
    durationMs: number;
    totalToolCalls: number;
    totalLlmCalls: number;
}

export interface TaskFailedEvent extends BaseEvent {
    eventType: 'task_failed';
    error: string;
    durationMs: number;
}

export interface SubtaskStartedEvent extends BaseEvent {
    eventType: 'subtask_started';
    subtaskId: string;
    name: string;
    description: string;
    agentType: string;
}

export interface SubtaskCompletedEvent extends BaseEvent {
    eventType: 'subtask_completed';
    subtaskId: string;
    durationMs: number;
    toolCallCount: number;
}

export interface SubtaskFailedEvent extends BaseEvent {
    eventType: 'subtask_failed';
    subtaskId: string;
    error: string;
    durationMs: number;
}

/**
 * A single tool invocation — the core observability record.
 * Captures what the agent asked for, where the data came from, and what came back.
 */
export interface ToolCallEvent extends BaseEvent {
    eventType: 'tool_call';
    toolCallId: string;
    toolName: string;
    source: string;              // e.g. "CoinGecko", "TradingView", "CoinDesk RSS"
    endpoint?: string;           // e.g. "https://api.coingecko.com/api/v3/coins/bitcoin"
    arguments: Record<string, any>;
    result: any;
    status: 'ok' | 'error';
    error?: string;
    durationMs: number;
    requestBytes?: number;
    responseBytes?: number;
}

export interface LlmCallEvent extends BaseEvent {
    eventType: 'llm_call';
    llmCallId: string;
    purpose: string;             // e.g. "planning", "synthesis", "verification", "agent_loop"
    model: string;
    provider: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    durationMs: number;
    status: 'ok' | 'error';
    error?: string;
    prompt?: string;             // truncated for storage
    response?: string;           // truncated for storage
}

export interface PhaseChangeEvent extends BaseEvent {
    eventType: 'phase_change';
    phase: string;               // e.g. "planning", "executing", "reasoning", "verifying"
}

export type ObservabilityEvent =
    | TaskStartedEvent
    | TaskPlannedEvent
    | TaskCompletedEvent
    | TaskFailedEvent
    | SubtaskStartedEvent
    | SubtaskCompletedEvent
    | SubtaskFailedEvent
    | ToolCallEvent
    | LlmCallEvent
    | PhaseChangeEvent;

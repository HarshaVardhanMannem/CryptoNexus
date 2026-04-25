import type OpenAI from 'openai';

/**
 * A tool that an agent can invoke during its reasoning loop.
 *
 * `parameters` uses the JSON-Schema subset that OpenAI function-calling accepts.
 * `execute` receives the parsed arguments object and returns a JSON-serialisable result.
 * `source` identifies the upstream data origin (CoinGecko, TradingView, etc.) for observability.
 * `endpointFor` optionally derives the concrete endpoint hit for a given argument set.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    source: string;
    endpointFor?: (args: Record<string, any>) => string;
    parameters: Record<string, any>; // JSON Schema
    execute: (args: Record<string, any>) => Promise<any>;
}

/**
 * Result of a single tool invocation, stored for observability.
 */
export interface ToolCallRecord {
    id: string;
    toolName: string;
    source: string;
    endpoint?: string;
    arguments: Record<string, any>;
    result: any;
    status: 'ok' | 'error';
    error?: string;
    durationMs: number;
    requestBytes?: number;
    responseBytes?: number;
    timestamp: Date;
}

/**
 * Outcome of a full agent-loop run (planning + N tool calls + final answer).
 */
export interface AgentLoopResult {
    answer: any;           // The parsed final answer from the LLM
    toolCalls: ToolCallRecord[];
    totalTokens: number;
    iterations: number;
}

/**
 * Convert our ToolDefinition[] to the format OpenAI SDK expects.
 */
export function toOpenAITools(
    tools: ToolDefinition[]
): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map((t) => ({
        type: 'function' as const,
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));
}

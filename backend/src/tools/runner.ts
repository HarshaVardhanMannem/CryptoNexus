import OpenAI from 'openai';
import { CONFIG } from '../config/constants';
import { ToolDefinition, ToolCallRecord, AgentLoopResult, toOpenAITools } from './types';
import { aiRateLimiter } from '../utils/rateLimiter';
import { observer } from '../observability';
import { v4 as uuidv4 } from 'uuid';

const MAX_ITERATIONS = 10;

/**
 * Run an agent tool-calling loop.
 *
 * Every tool invocation and every LLM completion is recorded to the observer,
 * tagged with taskId / subtaskId / agentType so they can be reconstructed into
 * a full execution timeline later.
 */
export async function runAgentLoop(opts: {
    openai: OpenAI;
    systemPrompt: string;
    userPrompt: string;
    tools: ToolDefinition[];
    /** Optional context messages to prepend (e.g., prior agent results) */
    contextMessages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    onToolCall?: (record: ToolCallRecord) => void;
    /** Observability context — passed through to events */
    taskId?: string;
    subtaskId?: string;
    agentType?: string;
    /** Purpose label for the llm_call events produced in this loop */
    llmPurpose?: string;
}): Promise<AgentLoopResult> {
    const {
        openai, systemPrompt, userPrompt, tools, contextMessages, onToolCall,
        taskId, subtaskId, agentType, llmPurpose,
    } = opts;

    const toolMap = new Map<string, ToolDefinition>();
    for (const t of tools) {
        toolMap.set(t.name, t);
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...(contextMessages || []),
        { role: 'user', content: userPrompt },
    ];

    const openaiTools = toOpenAITools(tools);
    const allToolCalls: ToolCallRecord[] = [];
    let totalTokens = 0;
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        const llmStart = Date.now();
        let response: OpenAI.Chat.Completions.ChatCompletion;
        try {
            response = await aiRateLimiter.execute(() =>
                openai.chat.completions.create({
                    model: CONFIG.LLM_MODEL,
                    messages,
                    tools: openaiTools.length > 0 ? openaiTools : undefined,
                    temperature: CONFIG.LLM_TEMPERATURE,
                    max_tokens: CONFIG.LLM_MAX_TOKENS,
                })
            );
        } catch (err: any) {
            recordLlmCall({
                taskId, subtaskId, agentType,
                purpose: llmPurpose || 'agent_loop',
                durationMs: Date.now() - llmStart,
                status: 'error',
                error: err.message || String(err),
            });
            throw err;
        }
        const llmDuration = Date.now() - llmStart;

        totalTokens += response.usage?.total_tokens || 0;
        const choice = response.choices[0];

        recordLlmCall({
            taskId, subtaskId, agentType,
            purpose: llmPurpose || 'agent_loop',
            durationMs: llmDuration,
            status: 'ok',
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens,
            promptPreview: JSON.stringify(messages).slice(0, 4000),
            responsePreview: (choice.message.content || '').slice(0, 4000),
        });

        // If the LLM finished with a regular message, we're done
        if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
            const content = choice.message.content || '';
            let answer: any;
            try {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) ||
                    content.match(/(\{[\s\S]*\})/) ||
                    content.match(/(\[[\s\S]*\])/);
                answer = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : content;
            } catch {
                answer = content;
            }

            return { answer, toolCalls: allToolCalls, totalTokens, iterations };
        }

        // Process tool calls
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls!) {
            const toolDef = toolMap.get(toolCall.function.name);

            if (!toolDef) {
                const errorResult = { error: `Unknown tool: ${toolCall.function.name}` };
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(errorResult),
                });
                continue;
            }

            let args: Record<string, any>;
            try {
                args = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
                args = {};
            }

            const endpoint = toolDef.endpointFor?.(args);
            const requestBytes = byteLength(args);
            const start = Date.now();
            let result: any;
            let status: 'ok' | 'error' = 'ok';
            let errorMsg: string | undefined;
            try {
                result = await toolDef.execute(args);
                if (result && typeof result === 'object' && 'error' in result && result.error) {
                    status = 'error';
                    errorMsg = String(result.error);
                }
            } catch (err: any) {
                status = 'error';
                errorMsg = err.message || 'Tool execution failed';
                result = { error: errorMsg };
            }
            const durationMs = Date.now() - start;
            const responseBytes = byteLength(result);

            const record: ToolCallRecord = {
                id: toolCall.id,
                toolName: toolCall.function.name,
                source: toolDef.source,
                endpoint,
                arguments: args,
                result,
                status,
                error: errorMsg,
                durationMs,
                requestBytes,
                responseBytes,
                timestamp: new Date(),
            };

            allToolCalls.push(record);
            onToolCall?.(record);

            if (taskId) {
                observer.record({
                    eventId: uuidv4(),
                    eventType: 'tool_call',
                    taskId,
                    subtaskId,
                    agentType,
                    timestamp: record.timestamp.toISOString(),
                    toolCallId: record.id,
                    toolName: record.toolName,
                    source: record.source,
                    endpoint: record.endpoint,
                    arguments: record.arguments,
                    result: record.result,
                    status: record.status,
                    error: record.error,
                    durationMs: record.durationMs,
                    requestBytes: record.requestBytes,
                    responseBytes: record.responseBytes,
                });
            }

            console.log(`    [tool] ${toolCall.function.name} <- ${toolDef.source} (${durationMs}ms, ${status})`);

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            });
        }
    }

    return {
        answer: { error: 'Max iterations reached', partialContext: allToolCalls.map(tc => tc.result) },
        toolCalls: allToolCalls,
        totalTokens,
        iterations,
    };
}

function byteLength(v: any): number {
    try {
        return Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v), 'utf8');
    } catch {
        return 0;
    }
}

function recordLlmCall(opts: {
    taskId?: string;
    subtaskId?: string;
    agentType?: string;
    purpose: string;
    durationMs: number;
    status: 'ok' | 'error';
    error?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    promptPreview?: string;
    responsePreview?: string;
}) {
    if (!opts.taskId) return;
    observer.record({
        eventId: uuidv4(),
        eventType: 'llm_call',
        taskId: opts.taskId,
        subtaskId: opts.subtaskId,
        agentType: opts.agentType,
        timestamp: new Date().toISOString(),
        llmCallId: uuidv4(),
        purpose: opts.purpose,
        model: CONFIG.LLM_MODEL,
        provider: CONFIG.LLM_PROVIDER,
        promptTokens: opts.promptTokens,
        completionTokens: opts.completionTokens,
        totalTokens: opts.totalTokens,
        durationMs: opts.durationMs,
        status: opts.status,
        error: opts.error,
        prompt: opts.promptPreview,
        response: opts.responsePreview,
    });
}

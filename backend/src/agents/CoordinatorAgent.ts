import OpenAI from 'openai';
import { CONFIG } from '../config/constants';
import {
    TaskState,
    TaskStatus,
    Subtask,
    Checkpoint,
    AgentType,
} from '../types/agent.types';
import { v4 as uuidv4 } from 'uuid';
import { MarketMonitorAgent } from './MarketMonitorAgent';
import { NewsSentimentAgent } from './NewsSentimentAgent';
import { OnChainAnalysisAgent } from './OnChainAnalysisAgent';
import { StrategyGeneratorAgent } from './StrategyGeneratorAgent';
import { aiRateLimiter } from '../utils/rateLimiter';
import { extractSymbol } from '../utils/symbols';
import { EventEmitter } from 'events';
import type { ToolCallRecord } from '../tools';
import { getLLMClient } from '../config/llmClient';
import { observer } from '../observability';

export class CoordinatorAgent extends EventEmitter {
    private openai: OpenAI;
    private activeTasks: Map<string, TaskState> = new Map();
    private marketMonitorAgent: MarketMonitorAgent;
    private newsSentimentAgent: NewsSentimentAgent;
    private onChainAnalysisAgent: OnChainAnalysisAgent;
    private strategyGeneratorAgent: StrategyGeneratorAgent;

    constructor() {
        super();

        this.openai = getLLMClient();

        this.marketMonitorAgent = new MarketMonitorAgent();
        this.newsSentimentAgent = new NewsSentimentAgent();
        this.onChainAnalysisAgent = new OnChainAnalysisAgent();
        this.strategyGeneratorAgent = new StrategyGeneratorAgent();

        console.log('[CoordinatorAgent] Initialized with parallel execution support');
    }

    /**
     * Start a marathon task in the background. Returns the taskId immediately.
     * Listen to events for progress updates.
     */
    startMarathonTask(goal: string): string {
        const taskId = uuidv4();

        const taskState: TaskState = {
            taskId,
            goal,
            subtasks: [],
            context: [],
            status: TaskStatus.PLANNING,
            startTime: new Date(),
            checkpoints: [],
            selfCorrectionAttempts: 0,
        };

        this.activeTasks.set(taskId, taskState);

        // Run in background - don't await
        this.executeMarathonTask(taskState).catch((err) => {
            console.error(`[CoordinatorAgent] Task ${taskId} fatal error:`, err.message);
            taskState.status = TaskStatus.FAILED;
            taskState.error = err.message;
            taskState.endTime = new Date();
            this.emitProgress(taskState, 'task_failed');
        });

        return taskId;
    }

    private async executeMarathonTask(taskState: TaskState): Promise<void> {
        const { taskId } = taskState;
        console.log(`[CoordinatorAgent] Starting task ${taskId}: ${taskState.goal}`);
        this.emitProgress(taskState, 'task_started');

        observer.record({
            eventId: uuidv4(),
            eventType: 'task_started',
            taskId,
            timestamp: new Date().toISOString(),
            goal: taskState.goal,
        });

        try {
            // Phase 1: Planning
            console.log('[CoordinatorAgent] Phase 1: Planning...');
            this.emitPhase(taskState, 'planning');
            await this.planTask(taskState);
            this.saveCheckpoint(taskState, 'Planning completed');
            this.emitProgress(taskState, 'planning_complete');

            observer.record({
                eventId: uuidv4(),
                eventType: 'task_planned',
                taskId,
                timestamp: new Date().toISOString(),
                subtaskCount: taskState.subtasks.length,
                subtasks: taskState.subtasks.map((st) => ({
                    id: st.id, name: st.name, agentType: st.agentType,
                })),
            });

            // Phase 2: Parallel Execution
            console.log('[CoordinatorAgent] Phase 2: Executing subtasks...');
            taskState.status = TaskStatus.EXECUTING;
            this.emitPhase(taskState, 'executing');
            this.emitProgress(taskState, 'execution_started');
            await this.executeSubtasksParallel(taskState);

            // Phase 3: Strategy + Synthesis
            console.log('[CoordinatorAgent] Phase 3: Generating strategy & synthesis...');
            taskState.status = TaskStatus.REASONING;
            this.emitPhase(taskState, 'reasoning');
            this.emitProgress(taskState, 'reasoning_started');
            await this.synthesizeInsights(taskState);

            // Phase 4: Verification
            console.log('[CoordinatorAgent] Phase 4: Verifying...');
            taskState.status = TaskStatus.VERIFYING;
            this.emitPhase(taskState, 'verifying');
            this.emitProgress(taskState, 'verification_started');
            await this.verifyFindings(taskState);

            // Done
            taskState.status = TaskStatus.COMPLETED;
            taskState.endTime = new Date();
            this.saveCheckpoint(taskState, 'Task completed');
            this.emitProgress(taskState, 'task_completed');

            const durationMs = taskState.endTime.getTime() - taskState.startTime.getTime();
            const toolCalls = taskState.subtasks.reduce(
                (n, st: any) => n + (st.toolCallCount || 0),
                0
            );
            observer.record({
                eventId: uuidv4(),
                eventType: 'task_completed',
                taskId,
                timestamp: new Date().toISOString(),
                durationMs,
                totalToolCalls: toolCalls,
                totalLlmCalls: 0,
            });

            console.log(`[CoordinatorAgent] Task ${taskId} completed in ${this.getTaskDuration(taskState)}`);
        } catch (error: any) {
            console.error(`[CoordinatorAgent] Task ${taskId} failed:`, error.message);
            taskState.status = TaskStatus.FAILED;
            taskState.error = error.message;
            taskState.endTime = new Date();
            this.emitProgress(taskState, 'task_failed');

            const durationMs = taskState.endTime.getTime() - taskState.startTime.getTime();
            observer.record({
                eventId: uuidv4(),
                eventType: 'task_failed',
                taskId,
                timestamp: new Date().toISOString(),
                error: error.message || String(error),
                durationMs,
            });
        }
    }

    private emitPhase(taskState: TaskState, phase: string): void {
        observer.record({
            eventId: uuidv4(),
            eventType: 'phase_change',
            taskId: taskState.taskId,
            timestamp: new Date().toISOString(),
            phase,
        });
    }

    /**
     * Phase 1: Use AI to plan subtasks
     */
    private async planTask(taskState: TaskState): Promise<void> {
        const symbol = extractSymbol(taskState.goal);

        const planningPrompt = `
You are a crypto analysis coordinator. Break down this goal into subtasks.

Goal: "${taskState.goal}"
Detected symbol: ${symbol}

Create subtasks as a JSON array. Each subtask should specify which agent handles it.
Available agents: market_monitor, news_sentiment, onchain_analysis, strategy_generator

Rules:
- Always include at least one market_monitor task for price/technical data
- Always include at least one news_sentiment task for sentiment data
- Always include at least one onchain_analysis task for on-chain data
- Always include exactly one strategy_generator task (must run LAST, after data collection)
- Be specific about what each task should analyze

Return ONLY a JSON array:
[
  { "name": "task name", "description": "what to analyze for ${symbol}", "agentType": "market_monitor" },
  ...
]`;

        const planStart = Date.now();
        const result = await aiRateLimiter.execute(() =>
            this.openai.chat.completions.create({
                model: CONFIG.LLM_MODEL,
                messages: [{ role: 'user', content: planningPrompt }],
                temperature: CONFIG.LLM_TEMPERATURE,
                max_tokens: CONFIG.LLM_MAX_TOKENS,
            })
        );

        const responseText = result.choices[0]?.message?.content || '';
        observer.record({
            eventId: uuidv4(),
            eventType: 'llm_call',
            taskId: taskState.taskId,
            agentType: 'coordinator',
            timestamp: new Date().toISOString(),
            llmCallId: uuidv4(),
            purpose: 'planning',
            model: CONFIG.LLM_MODEL,
            provider: CONFIG.LLM_PROVIDER,
            promptTokens: result.usage?.prompt_tokens,
            completionTokens: result.usage?.completion_tokens,
            totalTokens: result.usage?.total_tokens,
            durationMs: Date.now() - planStart,
            status: 'ok',
            prompt: planningPrompt.slice(0, 4000),
            response: responseText.slice(0, 4000),
        });
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);

        let subtaskPlans: any[];
        if (jsonMatch) {
            subtaskPlans = JSON.parse(jsonMatch[0]);
        } else {
            // Fallback: create a default plan
            subtaskPlans = this.createDefaultPlan(symbol);
        }

        // Ensure strategy_generator is present and comes last
        const hasStrategy = subtaskPlans.some((p: any) => p.agentType === 'strategy_generator');
        if (!hasStrategy) {
            subtaskPlans.push({
                name: `Generate ${symbol} Trading Strategy`,
                description: `Synthesize all collected data for ${symbol} and generate an actionable trading strategy with entry/exit points`,
                agentType: 'strategy_generator',
            });
        }

        taskState.subtasks = subtaskPlans.map((plan: any) => ({
            id: uuidv4(),
            name: plan.name,
            description: plan.description,
            agentType: plan.agentType as AgentType,
            status: 'pending' as const,
        }));

        taskState.context.push(`Planning completed: ${taskState.subtasks.length} subtasks for ${symbol}`);
        console.log(`[CoordinatorAgent] Planned ${taskState.subtasks.length} subtasks`);
    }

    /**
     * Phase 2: Execute data-collection subtasks in PARALLEL, then strategy sequentially.
     */
    private async executeSubtasksParallel(taskState: TaskState): Promise<void> {
        // Separate data-collection tasks from strategy task
        const dataTasks = taskState.subtasks.filter(
            (st) => st.agentType !== AgentType.STRATEGY_GENERATOR
        );
        const strategyTasks = taskState.subtasks.filter(
            (st) => st.agentType === AgentType.STRATEGY_GENERATOR
        );

        // Run all data tasks in parallel
        console.log(`[CoordinatorAgent] Running ${dataTasks.length} data tasks in parallel...`);

        const dataPromises = dataTasks.map((subtask) => this.executeSubtask(subtask, taskState));
        const results = await Promise.allSettled(dataPromises);

        // Log results
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`[CoordinatorAgent] Data task "${dataTasks[i].name}" failed:`, r.reason?.message || r.reason);
            }
        });

        this.saveCheckpoint(taskState, 'Data collection completed');
        this.emitProgress(taskState, 'data_collection_complete');

        // Self-correction: check if too many tasks failed
        const failures = dataTasks.filter((st) => st.status === 'failed').length;
        if (failures >= dataTasks.length && dataTasks.length > 0) {
            throw new Error('All data collection tasks failed');
        }

        if (failures > 0 && taskState.selfCorrectionAttempts < CONFIG.MAX_SELF_CORRECTION_ATTEMPTS) {
            console.log(`[CoordinatorAgent] ${failures} tasks failed, attempting self-correction...`);
            taskState.selfCorrectionAttempts++;
            await this.retryFailedTasks(taskState);
        }

        // Run strategy tasks sequentially (they depend on collected data)
        for (const subtask of strategyTasks) {
            await this.executeSubtask(subtask, taskState);
        }
    }

    private async executeSubtask(subtask: Subtask, taskState: TaskState): Promise<void> {
        console.log(`  -> Executing: ${subtask.name} (${subtask.agentType})`);
        subtask.status = 'in_progress';
        subtask.startTime = new Date();
        taskState.currentAgent = subtask.agentType;
        this.emitProgress(taskState, 'subtask_started', { subtaskId: subtask.id });

        observer.record({
            eventId: uuidv4(),
            eventType: 'subtask_started',
            taskId: taskState.taskId,
            subtaskId: subtask.id,
            agentType: subtask.agentType,
            timestamp: subtask.startTime.toISOString(),
            name: subtask.name,
            description: subtask.description,
        });

        let toolCallCount = 0;
        const onToolCall = (record: ToolCallRecord) => {
            toolCallCount++;
            this.emitProgress(taskState, 'tool_call', {
                subtaskId: subtask.id,
                agentType: subtask.agentType,
                toolCallId: record.id,
                toolName: record.toolName,
                source: record.source,
                endpoint: record.endpoint,
                arguments: record.arguments,
                status: record.status,
                error: record.error,
                durationMs: record.durationMs,
                requestBytes: record.requestBytes,
                responseBytes: record.responseBytes,
                timestamp: record.timestamp.toISOString(),
            });
        };

        const ctx = { taskId: taskState.taskId };

        try {
            let result: any;
            switch (subtask.agentType) {
                case AgentType.MARKET_MONITOR:
                    result = await this.marketMonitorAgent.execute(subtask, onToolCall, ctx);
                    break;
                case AgentType.NEWS_SENTIMENT:
                    result = await this.newsSentimentAgent.execute(subtask, onToolCall, ctx);
                    break;
                case AgentType.ONCHAIN_ANALYSIS:
                    result = await this.onChainAnalysisAgent.execute(subtask, onToolCall, ctx);
                    break;
                case AgentType.STRATEGY_GENERATOR:
                    result = await this.strategyGeneratorAgent.execute(subtask, taskState, onToolCall);
                    break;
                default:
                    result = { status: 'unsupported_agent', agentType: subtask.agentType };
            }

            subtask.result = result;
            subtask.status = 'completed';
            subtask.endTime = new Date();
            (subtask as any).toolCallCount = toolCallCount;
            taskState.context.push(`${subtask.name}: ${JSON.stringify(result).slice(0, 300)}`);
            this.emitProgress(taskState, 'subtask_completed', { subtaskId: subtask.id });

            observer.record({
                eventId: uuidv4(),
                eventType: 'subtask_completed',
                taskId: taskState.taskId,
                subtaskId: subtask.id,
                agentType: subtask.agentType,
                timestamp: subtask.endTime.toISOString(),
                durationMs: subtask.endTime.getTime() - (subtask.startTime?.getTime() ?? 0),
                toolCallCount,
            });
        } catch (error: any) {
            console.error(`  [FAIL] ${subtask.name}:`, error.message);
            subtask.status = 'failed';
            subtask.error = error.message;
            subtask.endTime = new Date();
            this.emitProgress(taskState, 'subtask_failed', { subtaskId: subtask.id, error: error.message });

            observer.record({
                eventId: uuidv4(),
                eventType: 'subtask_failed',
                taskId: taskState.taskId,
                subtaskId: subtask.id,
                agentType: subtask.agentType,
                timestamp: subtask.endTime.toISOString(),
                durationMs: subtask.endTime.getTime() - (subtask.startTime?.getTime() ?? 0),
                error: error.message || String(error),
            });
        }
    }

    /**
     * Retry failed data-collection tasks (self-correction).
     */
    private async retryFailedTasks(taskState: TaskState): Promise<void> {
        const failedTasks = taskState.subtasks.filter(
            (st) => st.status === 'failed' && st.agentType !== AgentType.STRATEGY_GENERATOR
        );

        console.log(`[CoordinatorAgent] Retrying ${failedTasks.length} failed tasks...`);

        for (const subtask of failedTasks) {
            subtask.status = 'pending';
            subtask.error = undefined;
            await this.executeSubtask(subtask, taskState);
        }
    }

    /**
     * Phase 3: Synthesize all collected data
     */
    private async synthesizeInsights(taskState: TaskState): Promise<void> {
        const synthesisPrompt = `
You are an expert crypto analyst. Synthesize the following multi-agent data into a unified analysis.

Goal: "${taskState.goal}"

Data collected by agents:
${taskState.context.join('\n\n')}

Provide a comprehensive synthesis (500-800 words) covering:
1. Key findings across all data sources
2. Correlations between price, sentiment, and on-chain activity
3. Risk factors and contradictory signals
4. Confidence-weighted predictions
5. Actionable recommendations

Be specific and cite the data you received.`;

        const synthStart = Date.now();
        const result = await aiRateLimiter.execute(() =>
            this.openai.chat.completions.create({
                model: CONFIG.LLM_MODEL,
                messages: [{ role: 'user', content: synthesisPrompt }],
                temperature: CONFIG.LLM_TEMPERATURE,
                max_tokens: CONFIG.LLM_MAX_TOKENS,
            })
        );

        const insights = result.choices[0]?.message?.content || 'No insights generated';
        observer.record({
            eventId: uuidv4(),
            eventType: 'llm_call',
            taskId: taskState.taskId,
            agentType: 'coordinator',
            timestamp: new Date().toISOString(),
            llmCallId: uuidv4(),
            purpose: 'synthesis',
            model: CONFIG.LLM_MODEL,
            provider: CONFIG.LLM_PROVIDER,
            promptTokens: result.usage?.prompt_tokens,
            completionTokens: result.usage?.completion_tokens,
            totalTokens: result.usage?.total_tokens,
            durationMs: Date.now() - synthStart,
            status: 'ok',
            prompt: synthesisPrompt.slice(0, 4000),
            response: insights.slice(0, 4000),
        });

        taskState.result = {
            ...taskState.result,
            synthesis: insights,
            timestamp: new Date(),
        };

        taskState.context.push(`Synthesis completed`);
        console.log('[CoordinatorAgent] Insights synthesized');
    }

    /**
     * Phase 4: Verify findings
     */
    private async verifyFindings(taskState: TaskState): Promise<void> {
        const verificationPrompt = `
You are a critical analyst reviewing crypto market analysis.

Analysis to verify:
${taskState.result?.synthesis || ''}

Verify:
1. Logical consistency
2. Overconfident predictions without evidence
3. Missing data or gaps
4. Suggested corrections

Return JSON:
{
  "isValid": true/false,
  "confidenceScore": 0.0-1.0,
  "issues": ["issue1"],
  "recommendations": ["rec1"]
}`;

        const verifyStart = Date.now();
        const result = await aiRateLimiter.execute(() =>
            this.openai.chat.completions.create({
                model: CONFIG.LLM_MODEL,
                messages: [{ role: 'user', content: verificationPrompt }],
                temperature: CONFIG.LLM_TEMPERATURE,
                max_tokens: CONFIG.LLM_MAX_TOKENS,
            })
        );

        const responseText = result.choices[0]?.message?.content || '';
        observer.record({
            eventId: uuidv4(),
            eventType: 'llm_call',
            taskId: taskState.taskId,
            agentType: 'coordinator',
            timestamp: new Date().toISOString(),
            llmCallId: uuidv4(),
            purpose: 'verification',
            model: CONFIG.LLM_MODEL,
            provider: CONFIG.LLM_PROVIDER,
            promptTokens: result.usage?.prompt_tokens,
            completionTokens: result.usage?.completion_tokens,
            totalTokens: result.usage?.total_tokens,
            durationMs: Date.now() - verifyStart,
            status: 'ok',
            prompt: verificationPrompt.slice(0, 4000),
            response: responseText.slice(0, 4000),
        });
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const verification = JSON.parse(jsonMatch[0]);
                if (taskState.result) {
                    taskState.result.verification = verification;
                }
                console.log(`[CoordinatorAgent] Verification: confidence=${verification.confidenceScore}`);
            } catch {
                console.warn('[CoordinatorAgent] Could not parse verification JSON');
            }
        }
    }

    private createDefaultPlan(symbol: string): any[] {
        return [
            {
                name: `${symbol} Market Analysis`,
                description: `Fetch current price, technical indicators, and market data for ${symbol}`,
                agentType: 'market_monitor',
            },
            {
                name: `${symbol} News & Sentiment`,
                description: `Analyze latest crypto news and sentiment for ${symbol}`,
                agentType: 'news_sentiment',
            },
            {
                name: `${symbol} On-Chain Analysis`,
                description: `Analyze on-chain metrics, exchange flows, and whale activity for ${symbol}`,
                agentType: 'onchain_analysis',
            },
            {
                name: `${symbol} Trading Strategy`,
                description: `Generate a comprehensive trading strategy for ${symbol} based on all collected data`,
                agentType: 'strategy_generator',
            },
        ];
    }

    private saveCheckpoint(taskState: TaskState, description: string): void {
        const checkpoint: Checkpoint = {
            id: uuidv4(),
            timestamp: new Date(),
            taskStatus: taskState.status,
            completedSubtasks: taskState.subtasks.filter((t) => t.status === 'completed').length,
            totalSubtasks: taskState.subtasks.length,
            context: [...taskState.context],
            metadata: { description },
        };
        taskState.checkpoints.push(checkpoint);
    }

    private emitProgress(taskState: TaskState, event: string, extra?: Record<string, any>): void {
        this.emit('progress', {
            taskId: taskState.taskId,
            event,
            status: taskState.status,
            subtasks: taskState.subtasks.map((st) => ({
                id: st.id,
                name: st.name,
                status: st.status,
                agentType: st.agentType,
            })),
            progress: {
                completed: taskState.subtasks.filter((t) => t.status === 'completed').length,
                total: taskState.subtasks.length,
            },
            ...extra,
            timestamp: new Date().toISOString(),
        });
    }

    private getTaskDuration(taskState: TaskState): string {
        if (!taskState.endTime) return 'In progress';
        const ms = taskState.endTime.getTime() - taskState.startTime.getTime();
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    getTaskStatus(taskId: string): TaskState | undefined {
        return this.activeTasks.get(taskId);
    }
}

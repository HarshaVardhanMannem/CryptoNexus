import OpenAI from 'openai';
import { CONFIG } from '../config/constants';
import {
    TaskState,
    TaskStatus,
    Subtask,
    Checkpoint,
    AgentType,
    MarketAnalysis,
    SentimentReport,
    OnChainReport,
    TradingStrategy
} from '../types/agent.types';
import { v4 as uuidv4 } from 'uuid';
import { MarketMonitorAgent } from './MarketMonitorAgent';
import { NewsSentimentAgent } from './NewsSentimentAgent';
import { OnChainAnalysisAgent } from './OnChainAnalysisAgent';
import { StrategyGeneratorAgent } from './StrategyGeneratorAgent';
import { aiRateLimiter } from '../utils/rateLimiter';


export class CoordinatorAgent {
    private openai: OpenAI;
    private activeTasks: Map<string, TaskState> = new Map();
    private marketMonitorAgent: MarketMonitorAgent;
    private newsSentimentAgent: NewsSentimentAgent;
    private onChainAnalysisAgent: OnChainAnalysisAgent;
    private strategyGeneratorAgent: StrategyGeneratorAgent;

    constructor() {
        if (!CONFIG.NVIDIA_API_KEY) {
            throw new Error('NVIDIA_API_KEY is required for Coordinator Agent');
        }

        this.openai = new OpenAI({
            apiKey: CONFIG.NVIDIA_API_KEY,
            baseURL: CONFIG.NVIDIA_BASE_URL,
        });

        // Initialize specialized agents
        this.marketMonitorAgent = new MarketMonitorAgent();
        this.newsSentimentAgent = new NewsSentimentAgent();
        this.onChainAnalysisAgent = new OnChainAnalysisAgent();
        this.strategyGeneratorAgent = new StrategyGeneratorAgent();

        console.log('✅ Coordinator Agent initialized with NVIDIA Nemotron');
    }

    /**
     * Main entry point: Execute a marathon task that spans hours
     */
    async executeMarathonTask(goal: string): Promise<TaskState> {
        const taskId = uuidv4();
        console.log(`🚀 Starting Marathon Task: ${taskId}`);
        console.log(`📋 Goal: ${goal}`);

        const taskState: TaskState = {
            taskId,
            goal,
            subtasks: [],
            context: [],
            status: TaskStatus.PLANNING,
            startTime: new Date(),
            checkpoints: [],
            selfCorrectionAttempts: 0
        };

        this.activeTasks.set(taskId, taskState);

        try {
            // Phase 1: Planning with AI
            console.log('🧠 Phase 1: Planning with NVIDIA Nemotron...');
            await this.planTask(taskState);
            await this.saveCheckpoint(taskState, 'Planning completed');

            // Phase 2: Autonomous Execution
            console.log('⚙️  Phase 2: Executing subtasks...');
            taskState.status = TaskStatus.EXECUTING;
            await this.executeSubtasks(taskState);

            // Phase 3: Deep Reasoning
            console.log('💡 Phase 3: Synthesizing insights...');
            taskState.status = TaskStatus.REASONING;
            await this.synthesizeInsights(taskState);

            // Phase 4: Verification
            console.log('✓ Phase 4: Verifying findings...');
            taskState.status = TaskStatus.VERIFYING;
            await this.verifyFindings(taskState);

            // Mark as completed
            taskState.status = TaskStatus.COMPLETED;
            taskState.endTime = new Date();
            await this.saveCheckpoint(taskState, 'Task completed successfully');

            console.log(`✅ Task ${taskId} completed in ${this.getTaskDuration(taskState)}`);
            return taskState;

        } catch (error: any) {
            console.error(`❌ Task ${taskId} failed:`, error.message);
            taskState.status = TaskStatus.FAILED;
            taskState.error = error.message;
            taskState.endTime = new Date();
            return taskState;
        }
    }

    /**
     * Phase 1: Use AI to break down the goal into actionable subtasks
     */
    private async planTask(taskState: TaskState): Promise<void> {
        const planningPrompt = `
You are an expert crypto market analyst coordinator. Your task is to create a detailed execution plan.

User Goal: "${taskState.goal}"

Create a comprehensive analysis plan with the following structure:
1. Market Monitoring Tasks - What price data, volume, and technical indicators to track
2. News & Sentiment Tasks - What news sources and social media to scrape
3. On-Chain Analysis Tasks - What blockchain data to examine (whale movements, exchange flows)
4. Strategy Generation Tasks - How to synthesize all data into actionable insights

For each task, specify:
- Task name
- Description
- Which specialized agent should handle it (market_monitor, news_sentiment, onchain_analysis, strategy_generator)
- Expected duration

Return your plan as a JSON array of subtasks following this schema:
[
  {
    "name": "string",
    "description": "string",
    "agentType": "market_monitor" | "news_sentiment" | "onchain_analysis" | "strategy_generator",
    "estimatedDurationMinutes": number
  }
]

Important: Be specific about crypto symbols to analyze, timeframes, and data sources.
`;

        const result = await aiRateLimiter.execute(() =>
            this.openai.chat.completions.create({
                model: CONFIG.NVIDIA_MODEL,
                messages: [{ role: 'user', content: planningPrompt }],
                temperature: CONFIG.NVIDIA_TEMPERATURE,
                max_tokens: CONFIG.NVIDIA_MAX_TOKENS,
            })
        );
        const responseText = result.choices[0]?.message?.content || '';

        // Extract JSON from the response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error('Failed to generate valid task plan');
        }

        const subtaskPlans = JSON.parse(jsonMatch[0]);

        // Convert to Subtask objects
        taskState.subtasks = subtaskPlans.map((plan: any) => ({
            id: uuidv4(),
            name: plan.name,
            description: plan.description,
            agentType: plan.agentType as AgentType,
            status: 'pending' as const
        }));

        taskState.context.push(`Planning completed: ${taskState.subtasks.length} subtasks identified`);
        console.log(`📝 Generated ${taskState.subtasks.length} subtasks`);
    }

    /**
     * Phase 2: Execute each subtask using specialized agents
     */
    private async executeSubtasks(taskState: TaskState): Promise<void> {
        for (const subtask of taskState.subtasks) {
            console.log(`  → Executing: ${subtask.name} (${subtask.agentType})`);
            subtask.status = 'in_progress';
            subtask.startTime = new Date();
            taskState.currentAgent = subtask.agentType;

            try {
                // Dispatch to the appropriate agent
                const result = await this.dispatchToAgent(subtask, taskState);

                subtask.result = result;
                subtask.status = 'completed';
                subtask.endTime = new Date();

                // Add to context
                taskState.context.push(`${subtask.name}: ${JSON.stringify(result).slice(0, 200)}...`);

                // Self-correction check after each subtask
                const shouldAdjust = await this.evaluateProgress(taskState);
                if (shouldAdjust.needsAdjustment && taskState.selfCorrectionAttempts < CONFIG.MAX_SELF_CORRECTION_ATTEMPTS) {
                    console.log(`🔄 Self-correction triggered: ${shouldAdjust.reason}`);
                    await this.adjustPlan(taskState, shouldAdjust.reason || 'Unknown reason');
                    taskState.selfCorrectionAttempts++;
                }

            } catch (error: any) {
                console.error(`  ❌ Subtask failed: ${error.message}`);
                subtask.status = 'failed';
                subtask.error = error.message;
                subtask.endTime = new Date();
            }

            // Periodic checkpoints
            if (taskState.subtasks.filter(t => t.status === 'completed').length % 3 === 0) {
                await this.saveCheckpoint(taskState, `Completed ${subtask.name}`);
            }
        }
    }

    /**
     * Dispatch subtask to the appropriate specialized agent
     */
    private async dispatchToAgent(subtask: Subtask, taskState: TaskState): Promise<any> {
        // For now, simulate agent calls - these will be replaced with actual implementations
        console.log(`    [${subtask.agentType}] Processing: ${subtask.description}`);

        switch (subtask.agentType) {
            case AgentType.MARKET_MONITOR:
                return await this.marketMonitorAgent.execute(subtask);

            case AgentType.NEWS_SENTIMENT:
                return await this.newsSentimentAgent.execute(subtask);

            case AgentType.ONCHAIN_ANALYSIS:
                return await this.onChainAnalysisAgent.execute(subtask);

            case AgentType.STRATEGY_GENERATOR:
                return await this.strategyGeneratorAgent.execute(subtask, taskState);

            default:
                return { status: 'Not implemented yet', subtask: subtask.name };
        }
    }

    /**
     * Phase 3: Use AI to synthesize all collected data into insights
     */
    private async synthesizeInsights(taskState: TaskState): Promise<void> {
        const synthesisPrompt = `
You are an expert crypto analyst. Review all the data collected from multiple agents and synthesize key insights.

Original Goal: "${taskState.goal}"

Data Collected:
${taskState.context.join('\n')}

Provide a comprehensive synthesis that includes:
1. Key findings across all data sources
2. Correlations between price movements, sentiment, and on-chain activity
3. Risk factors and contradictory signals
4. Confidence-weighted predictions
5. Actionable recommendations

Be specific, quantitative, and cite the data sources.
`;

        const result = await aiRateLimiter.execute(() =>
            this.openai.chat.completions.create({
                model: CONFIG.NVIDIA_MODEL,
                messages: [{ role: 'user', content: synthesisPrompt }],
                temperature: CONFIG.NVIDIA_TEMPERATURE,
                max_tokens: CONFIG.NVIDIA_MAX_TOKENS,
            })
        );
        const insights = result.choices[0]?.message?.content || 'No insights generated';

        taskState.result = {
            synthesis: insights,
            timestamp: new Date()
        };

        taskState.context.push(`Synthesis completed: ${insights.slice(0, 300)}...`);
        console.log('💡 Insights synthesized');
    }

    /**
     * Phase 4: Verify findings for consistency and quality
     */
    private async verifyFindings(taskState: TaskState): Promise<void> {
        const verificationPrompt = `
You are a critical analyst reviewing crypto market analysis for accuracy and consistency.

Analysis to verify:
${JSON.stringify(taskState.result?.synthesis || '', null, 2)}

Based on the data:
${taskState.context.slice(-5).join('\n')}

Perform verification:
1. Check for logical inconsistencies
2. Identify overconfident predictions without sufficient evidence
3. Highlight missing data or gaps in analysis
4. Suggest corrections if needed

Return a JSON object with:
{
  "isValid": boolean,
  "confidenceScore": number (0-1),
  "issues": string[],
  "recommendations": string[]
}
`;

        const result = await aiRateLimiter.execute(() =>
            this.openai.chat.completions.create({
                model: CONFIG.NVIDIA_MODEL,
                messages: [{ role: 'user', content: verificationPrompt }],
                temperature: CONFIG.NVIDIA_TEMPERATURE,
                max_tokens: CONFIG.NVIDIA_MAX_TOKENS,
            })
        );
        const responseText = result.choices[0]?.message?.content || '';

        // Extract JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const verification = JSON.parse(jsonMatch[0]);

            if (taskState.result) {
                taskState.result.verification = verification;
            }

            console.log(`✓ Verification complete - Confidence: ${verification.confidenceScore}`);
        }
    }

    /**
     * Evaluate if the current progress needs adjustment
     */
    private async evaluateProgress(taskState: TaskState): Promise<{ needsAdjustment: boolean; reason?: string }> {
        // Simple heuristic: check if recent subtasks are failing
        const recentSubtasks = taskState.subtasks.slice(-3);
        const failures = recentSubtasks.filter(t => t.status === 'failed').length;

        if (failures >= 2) {
            return {
                needsAdjustment: true,
                reason: 'Multiple recent subtask failures detected'
            };
        }

        // Could add more sophisticated checks with AI evaluation
        return { needsAdjustment: false };
    }

    /**
     * Adjust the execution plan based on new information
     */
    private async adjustPlan(taskState: TaskState, reason: string): Promise<void> {
        console.log(`  🔄 Adjusting plan due to: ${reason}`);

        const adjustmentPrompt = `
The current analysis plan needs adjustment.

Original Goal: "${taskState.goal}"
Reason for adjustment: "${reason}"
Current progress: ${taskState.context.slice(-3).join('; ')}

Generate 1-2 new subtasks to address the issue. Return as JSON array with same schema as before.
`;

        const result = await this.openai.chat.completions.create({
            model: CONFIG.NVIDIA_MODEL,
            messages: [{ role: 'user', content: adjustmentPrompt }],
            temperature: CONFIG.NVIDIA_TEMPERATURE,
            max_tokens: CONFIG.NVIDIA_MAX_TOKENS,
        });
        const responseText = result.choices[0]?.message?.content || '';

        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const newSubtasks = JSON.parse(jsonMatch[0]);

            // Add new subtasks
            newSubtasks.forEach((plan: any) => {
                taskState.subtasks.push({
                    id: uuidv4(),
                    name: plan.name,
                    description: plan.description,
                    agentType: plan.agentType as AgentType,
                    status: 'pending' as const
                });
            });

            taskState.context.push(`Plan adjusted: Added ${newSubtasks.length} corrective subtasks`);
        }
    }

    /**
     * Save a checkpoint for long-running tasks
     */
    private async saveCheckpoint(taskState: TaskState, description: string): Promise<void> {
        const checkpoint: Checkpoint = {
            id: uuidv4(),
            timestamp: new Date(),
            taskStatus: taskState.status,
            completedSubtasks: taskState.subtasks.filter(t => t.status === 'completed').length,
            totalSubtasks: taskState.subtasks.length,
            context: [...taskState.context],
            metadata: { description }
        };

        taskState.checkpoints.push(checkpoint);
        console.log(`💾 Checkpoint saved: ${description}`);
    }

    /**
     * Get human-readable task duration
     */
    private getTaskDuration(taskState: TaskState): string {
        if (!taskState.endTime) return 'In progress';

        const durationMs = taskState.endTime.getTime() - taskState.startTime.getTime();
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);

        return `${minutes}m ${seconds}s`;
    }

    /**
     * Get task status for monitoring
     */
    getTaskStatus(taskId: string): TaskState | undefined {
        return this.activeTasks.get(taskId);
    }

}

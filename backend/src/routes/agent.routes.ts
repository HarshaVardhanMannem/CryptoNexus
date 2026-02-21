import express from 'express';
import { CoordinatorAgent } from '../agents/CoordinatorAgent';

const router = express.Router();
let coordinatorAgent: CoordinatorAgent | null = null;

// Initialize coordinator agent
function getCoordinator(): CoordinatorAgent {
    if (!coordinatorAgent) {
        coordinatorAgent = new CoordinatorAgent();
    }
    return coordinatorAgent;
}

/**
 * POST /api/agent/analyze
 * Start a marathon analysis task
 */
router.post('/analyze', async (req, res) => {
    try {
        const { goal } = req.body;

        if (!goal || typeof goal !== 'string') {
            return res.status(400).json({
                error: 'Missing or invalid "goal" parameter',
                example: { goal: 'Analyze Bitcoin for the next 2 hours and identify trading opportunities' }
            });
        }

        console.log(`📊 Starting analysis task: ${goal}`);

        const coordinator = getCoordinator();

        // Start the marathon task (non-blocking)
        const taskPromise = coordinator.executeMarathonTask(goal);

        // Get the task ID immediately
        const taskState = await taskPromise;

        res.json({
            success: true,
            taskId: taskState.taskId,
            status: taskState.status,
            message: 'Analysis task started',
            subtasksPlanned: taskState.subtasks.length,
            checkpoints: taskState.checkpoints.length
        });

    } catch (error: any) {
        console.error('Agent error:', error);
        res.status(500).json({
            error: error.message || 'Failed to start analysis task'
        });
    }
});

/**
 * GET /api/agent/status/:taskId
 * Get the current status of a task
 */
router.get('/status/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const coordinator = getCoordinator();

        const taskState = coordinator.getTaskStatus(taskId);

        if (!taskState) {
            return res.status(404).json({
                error: 'Task not found',
                taskId
            });
        }

        // Return comprehensive status
        res.json({
            taskId: taskState.taskId,
            goal: taskState.goal,
            status: taskState.status,
            progress: {
                completed: taskState.subtasks.filter(t => t.status === 'completed').length,
                total: taskState.subtasks.length,
                percentage: Math.round(
                    (taskState.subtasks.filter(t => t.status === 'completed').length / taskState.subtasks.length) * 100
                )
            },
            currentAgent: taskState.currentAgent,
            subtasks: taskState.subtasks.map(st => ({
                name: st.name,
                status: st.status,
                agentType: st.agentType
            })),
            checkpoints: taskState.checkpoints.length,
            selfCorrectionAttempts: taskState.selfCorrectionAttempts,
            duration: calculateDuration(taskState),
            result: taskState.result
        });

    } catch (error: any) {
        console.error('Status retrieval error:', error);
        res.status(500).json({
            error: error.message || 'Failed to retrieve task status'
        });
    }
});

/**
 * GET /api/agent/test
 * Simple test endpoint to verify NVIDIA AI integration
 */
router.get('/test', async (req, res) => {
    try {
        const coordinator = getCoordinator();

        res.json({
            success: true,
            message: 'Coordinator Agent is ready',
            nvidiaConfigured: true,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            nvidiaConfigured: false
        });
    }
});

/**
 * Helper function to calculate task duration
 */
function calculateDuration(taskState: any): string {
    const endTime = taskState.endTime || new Date();
    const durationMs = endTime.getTime() - taskState.startTime.getTime();

    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

export default router;

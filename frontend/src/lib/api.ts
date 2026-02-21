// API service for backend communication

import type { AnalysisResponse, StatusResponse } from '../types/agent.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Test if backend is ready
 */
export async function testConnection(): Promise<{
    success: boolean;
    message: string;
    geminiConfigured: boolean;
    timestamp: string;
}> {
    const response = await fetch(`${API_BASE_URL}/api/agent/test`);

    if (!response.ok) {
        throw new ApiError(response.status, 'Failed to connect to backend');
    }

    return response.json();
}

/**
 * Start a new analysis task
 */
export async function startAnalysis(goal: string): Promise<AnalysisResponse> {
    const response = await fetch(`${API_BASE_URL}/api/agent/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ goal }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new ApiError(response.status, error.message || 'Failed to start analysis');
    }

    return response.json();
}

/**
 * Get task status and results
 */
export async function getTaskStatus(taskId: string): Promise<StatusResponse> {
    const response = await fetch(`${API_BASE_URL}/api/agent/status/${taskId}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new ApiError(404, 'Task not found');
        }
        throw new ApiError(response.status, 'Failed to fetch task status');
    }

    return response.json();
}

/**
 * Poll task status until completion
 */
export async function pollTaskStatus(
    taskId: string,
    onUpdate?: (status: StatusResponse) => void,
    interval: number = 2000
): Promise<StatusResponse> {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const status = await getTaskStatus(taskId);

                if (onUpdate) {
                    onUpdate(status);
                }

                if (status.status === 'completed' || status.status === 'failed') {
                    resolve(status);
                } else {
                    setTimeout(poll, interval);
                }
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}

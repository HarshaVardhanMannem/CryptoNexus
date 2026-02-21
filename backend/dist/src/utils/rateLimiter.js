"use strict";
/**
 * Smart Rate Limiter for AI API calls
 *
 * Handles:
 * - NVIDIA API rate limiting
 * - Automatic queuing and spacing
 * - Exponential backoff on errors
 * - No functionality loss
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRateLimiter = exports.AIRateLimiter = void 0;
class AIRateLimiter {
    constructor() {
        this.queue = [];
        this.requestTimes = [];
        this.processing = false;
        // Configuration
        this.MAX_REQUESTS_PER_MINUTE = 5;
        this.MINUTE_MS = 60 * 1000;
        this.MIN_DELAY_MS = 500; // Minimum delay between requests
        this.MAX_RETRIES = 3;
    }
    /**
     * Execute an AI API call with automatic rate limiting
     */
    async execute(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn,
                resolve,
                reject,
                retries: 0
            });
            this.processQueue();
        });
    }
    /**
     * Process queued requests with rate limiting
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;
        while (this.queue.length > 0) {
            // Wait if we need to respect rate limits
            await this.waitForRateLimit();
            const request = this.queue.shift();
            if (!request)
                break;
            try {
                const result = await request.fn();
                request.resolve(result);
                // Record successful request time
                this.requestTimes.push(Date.now());
                this.cleanOldRequestTimes();
            }
            catch (error) {
                // Check if it's a quota/rate limit error
                if (this.isRateLimitError(error)) {
                    console.log(`[RateLimiter] Rate limit hit, retrying request (attempt ${request.retries + 1}/${this.MAX_RETRIES})`);
                    if (request.retries < this.MAX_RETRIES) {
                        // Re-queue with retry count
                        request.retries++;
                        this.queue.unshift(request); // Put back at front
                        // Wait based on retry info or exponential backoff
                        const waitTime = this.getRetryDelay(error, request.retries);
                        console.log(`[RateLimiter] Waiting ${waitTime}ms before retry...`);
                        await this.sleep(waitTime);
                    }
                    else {
                        console.log(`[RateLimiter] Max retries reached, failing request`);
                        request.reject(error);
                    }
                }
                else {
                    // Non-rate-limit error, just reject
                    request.reject(error);
                }
            }
        }
        this.processing = false;
    }
    /**
     * Wait if necessary to respect rate limits
     */
    async waitForRateLimit() {
        this.cleanOldRequestTimes();
        // If we've hit the limit, wait until we can make another request
        if (this.requestTimes.length >= this.MAX_REQUESTS_PER_MINUTE) {
            const oldestRequest = this.requestTimes[0];
            const timeSinceOldest = Date.now() - oldestRequest;
            const waitTime = Math.max(0, this.MINUTE_MS - timeSinceOldest + 100); // +100ms buffer
            if (waitTime > 0) {
                console.log(`[RateLimiter] Rate limit reached (${this.requestTimes.length}/${this.MAX_REQUESTS_PER_MINUTE}). Waiting ${Math.ceil(waitTime / 1000)}s...`);
                await this.sleep(waitTime);
                this.cleanOldRequestTimes();
            }
        }
        // Always add a minimum delay between requests
        await this.sleep(this.MIN_DELAY_MS);
    }
    /**
     * Remove request times older than 1 minute
     */
    cleanOldRequestTimes() {
        const now = Date.now();
        this.requestTimes = this.requestTimes.filter(time => now - time < this.MINUTE_MS);
    }
    /**
     * Check if error is a rate limit error
     */
    isRateLimitError(error) {
        const errorStr = JSON.stringify(error).toLowerCase();
        return (errorStr.includes('quota') ||
            errorStr.includes('rate') ||
            errorStr.includes('resource_exhausted') ||
            errorStr.includes('429') ||
            errorStr.includes('overloaded') ||
            errorStr.includes('503'));
    }
    /**
     * Get retry delay from error or use exponential backoff
     */
    getRetryDelay(error, retryCount) {
        // Try to extract retry delay from error
        try {
            const errorObj = typeof error === 'string' ? JSON.parse(error) : error;
            const retryInfo = errorObj?.error?.details?.find((d) => d['@type']?.includes('RetryInfo'));
            if (retryInfo?.retryDelay) {
                const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
                return seconds * 1000;
            }
        }
        catch (e) {
            // Ignore parse errors
        }
        // Exponential backoff: 2s, 4s, 8s, etc.
        return Math.min(2 ** retryCount * 2000, 30000); // Max 30s
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get current queue status (for monitoring)
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            requestsInLastMinute: this.requestTimes.length,
            maxRequestsPerMinute: this.MAX_REQUESTS_PER_MINUTE,
            processing: this.processing
        };
    }
}
exports.AIRateLimiter = AIRateLimiter;
// Global singleton instance
exports.aiRateLimiter = new AIRateLimiter();

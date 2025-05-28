/**
 * Rate Limiting System
 *
 * Implements rate limiting for CoinGecko API requests to stay within free tier limits
 */

import type { RateLimitConfig } from './types';
import { createRateLimitConfig } from './config';

/**
 * Global rate limit state
 */
let rateLimitState: RateLimitConfig = createRateLimitConfig();

/**
 * Queue for pending requests when rate limited
 */
interface PendingRequest {
	resolve: () => void;
	timestamp: number;
}

const requestQueue: PendingRequest[] = [];

/**
 * Resets the rate limit counter if we're in a new time window
 */
function resetIfNewWindow(): void {
	const now = Date.now();

	if (now >= rateLimitState.resetTime) {
		rateLimitState.requestCount = 0;
		rateLimitState.resetTime = now + rateLimitState.windowMs;
	}
}

/**
 * Processes queued requests that can now be executed
 */
function processQueue(): void {
	while (requestQueue.length > 0 && rateLimitState.requestCount < rateLimitState.maxRequests) {
		const request = requestQueue.shift();
		if (request) {
			rateLimitState.requestCount++;
			request.resolve();
		}
	}
}

/**
 * Checks if we can make a request immediately
 *
 * @returns True if request can be made immediately
 */
function canMakeRequest(): boolean {
	resetIfNewWindow();
	return rateLimitState.requestCount < rateLimitState.maxRequests;
}

/**
 * Calculates wait time until next available slot
 *
 * @returns Wait time in milliseconds
 */
function getWaitTime(): number {
	resetIfNewWindow();

	if (rateLimitState.requestCount < rateLimitState.maxRequests) {
		return 0;
	}

	return rateLimitState.resetTime - Date.now();
}

/**
 * Implements rate limiting for API requests
 *
 * This function ensures that we don't exceed the rate limit by tracking
 * requests per time window and queuing requests when necessary.
 *
 * @param skipRateLimit - Whether to skip rate limiting for this request
 * @returns Promise that resolves when it's safe to make the request
 */
export async function checkRateLimit(skipRateLimit: boolean = false): Promise<void> {
	// Skip rate limiting if requested (for internal/testing purposes)
	if (skipRateLimit) {
		return Promise.resolve();
	}

	// If we can make the request immediately, do it
	if (canMakeRequest()) {
		rateLimitState.requestCount++;
		return Promise.resolve();
	}

	// Otherwise, queue the request
	return new Promise<void>((resolve) => {
		const request: PendingRequest = {
			resolve,
			timestamp: Date.now()
		};

		requestQueue.push(request);

		// Set up a timer to process the queue when the window resets
		const waitTime = getWaitTime();
		setTimeout(() => {
			resetIfNewWindow();
			processQueue();
		}, waitTime);
	});
}

/**
 * Gets current rate limit status
 *
 * @returns Rate limit information
 */
export function getRateLimitStatus(): {
	requestCount: number;
	maxRequests: number;
	resetTime: number;
	timeUntilReset: number;
	queueLength: number;
} {
	resetIfNewWindow();

	return {
		requestCount: rateLimitState.requestCount,
		maxRequests: rateLimitState.maxRequests,
		resetTime: rateLimitState.resetTime,
		timeUntilReset: Math.max(0, rateLimitState.resetTime - Date.now()),
		queueLength: requestQueue.length
	};
}

/**
 * Resets the rate limit state (useful for testing)
 */
export function resetRateLimit(): void {
	rateLimitState = createRateLimitConfig();
	requestQueue.length = 0; // Clear queue
}

/**
 * Updates rate limit configuration
 *
 * @param config - New rate limit configuration
 */
export function updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
	rateLimitState = { ...rateLimitState, ...config };

	// If the reset time is in the past, reset it
	if (rateLimitState.resetTime <= Date.now()) {
		rateLimitState.resetTime = Date.now() + rateLimitState.windowMs;
		rateLimitState.requestCount = 0;
	}
}

/**
 * Checks if rate limit is currently active (requests being queued)
 *
 * @returns True if rate limited
 */
export function isRateLimited(): boolean {
	resetIfNewWindow();
	return rateLimitState.requestCount >= rateLimitState.maxRequests;
}

/**
 * Estimates when the next request can be made
 *
 * @returns Estimated timestamp when next request can be made
 */
export function getNextAvailableTime(): number {
	if (canMakeRequest()) {
		return Date.now();
	}

	return rateLimitState.resetTime;
}

/**
 * Clean up expired requests from queue (requests older than 5 minutes)
 */
export function cleanupExpiredRequests(): void {
	const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

	for (let i = requestQueue.length - 1; i >= 0; i--) {
		if (requestQueue[i].timestamp < fiveMinutesAgo) {
			// Resolve expired requests to prevent hanging
			requestQueue[i].resolve();
			requestQueue.splice(i, 1);
		}
	}
}

// Periodic cleanup of expired requests
setInterval(cleanupExpiredRequests, 60000); // Every minute

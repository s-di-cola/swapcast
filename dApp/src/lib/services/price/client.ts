/**
 * CoinGecko HTTP Client
 *
 * HTTP client with error handling, retries, and timeout support
 */

import { REQUEST_CONFIG, COINGECKO_CONFIG } from './config';
import { checkRateLimit } from './rateLimit';
import type { ApiRequestOptions } from './types';

/**
 * HTTP error class for CoinGecko API errors
 */
export class CoinGeckoApiError extends Error {
	constructor(
		public status: number,
		public statusText: string,
		message?: string
	) {
		super(message || `CoinGecko API error: ${status} ${statusText}`);
		this.name = 'CoinGeckoApiError';
	}
}

/**
 * Network error class for connection issues
 */
export class NetworkError extends Error {
	constructor(
		message: string,
		public originalError?: Error
	) {
		super(message);
		this.name = 'NetworkError';
	}
}

/**
 * Timeout error class for request timeouts
 */
export class TimeoutError extends Error {
	constructor(timeout: number) {
		super(`Request timed out after ${timeout}ms`);
		this.name = 'TimeoutError';
	}
}

/**
 * Creates a fetch request with timeout support
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves to Response or rejects on timeout
 */
function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new TimeoutError(timeout));
		}, timeout);

		fetch(url, options)
			.then((response) => {
				clearTimeout(timeoutId);
				resolve(response);
			})
			.catch((error) => {
				clearTimeout(timeoutId);
				reject(error);
			});
	});
}

/**
 * Determines if an error is retryable
 *
 * @param error - Error to check
 * @returns True if the error might be transient
 */
function isRetryableError(error: any): boolean {
	// Network errors are usually retryable
	if (error instanceof NetworkError || error.name === 'NetworkError') {
		return true;
	}

	// Timeout errors are retryable
	if (error instanceof TimeoutError) {
		return true;
	}

	// HTTP 5xx errors are retryable
	if (error instanceof CoinGeckoApiError && error.status >= 500) {
		return true;
	}

	// Rate limit errors (429) are retryable
	if (error instanceof CoinGeckoApiError && error.status === 429) {
		return true;
	}

	return false;
}

/**
 * Calculates retry delay with exponential backoff
 *
 * @param attempt - Current attempt number (0-based)
 * @returns Delay in milliseconds
 */
function getRetryDelay(attempt: number): number {
	return REQUEST_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
}

/**
 * Makes an HTTP request to the CoinGecko API with rate limiting, retries, and error handling
 *
 * @param endpoint - API endpoint path
 * @param options - Request options
 * @returns Promise resolving to parsed JSON response
 */
export async function makeApiRequest<T>(
	endpoint: string,
	options: ApiRequestOptions = {}
): Promise<T> {
	const { skipRateLimit = false, timeout = REQUEST_CONFIG.TIMEOUT, headers = {} } = options;

	// Check rate limit unless skipped
	if (!skipRateLimit) {
		await checkRateLimit();
	}

	const url = `${COINGECKO_CONFIG.baseUrl}${endpoint}`;
	const requestHeaders = {
		...REQUEST_CONFIG.DEFAULT_HEADERS,
		...headers
	};

	let lastError: Error = new Error('Unknown error');

	// Retry loop
	for (let attempt = 0; attempt <= REQUEST_CONFIG.MAX_RETRIES; attempt++) {
		try {
			const response = await fetchWithTimeout(
				url,
				{
					method: 'GET',
					headers: requestHeaders
				},
				timeout
			);

			// Handle HTTP errors
			if (!response.ok) {
				throw new CoinGeckoApiError(
					response.status,
					response.statusText,
					`Request to ${endpoint} failed`
				);
			}

			// Parse and return JSON
			const data = await response.json();
			return data as T;
		} catch (error: any) {
			lastError = error;

			// Don't retry on the last attempt
			if (attempt === REQUEST_CONFIG.MAX_RETRIES) {
				break;
			}

			// Don't retry if error is not retryable
			if (!isRetryableError(error)) {
				break;
			}

			// Wait before retrying
			const delay = getRetryDelay(attempt);
			console.warn(
				`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${REQUEST_CONFIG.MAX_RETRIES + 1}):`,
				error.message
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	// Transform error types for better error handling
	if (lastError instanceof TypeError || lastError.name === 'TypeError') {
		throw new NetworkError('Network connection failed', lastError);
	}

	throw lastError;
}

/**
 * Builds query string from parameters
 *
 * @param params - Query parameters
 * @returns URL query string
 */
export function buildQueryString(params: Record<string, string | number>): string {
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		searchParams.append(key, value.toString());
	}

	return searchParams.toString();
}

/**
 * Builds endpoint URL with path parameters
 *
 * @param template - URL template with placeholders (e.g., '/coins/{id}/market_chart')
 * @param params - Path parameters
 * @returns URL with parameters substituted
 */
export function buildEndpoint(template: string, params: Record<string, string>): string {
	let endpoint = template;

	for (const [key, value] of Object.entries(params)) {
		endpoint = endpoint.replace(`{${key}}`, encodeURIComponent(value));
	}

	return endpoint;
}

/**
 * Health check for the CoinGecko API
 *
 * @returns Promise resolving to true if API is healthy
 */
export async function checkApiHealth(): Promise<boolean> {
	try {
		await makeApiRequest('/ping', {
			skipRateLimit: true,
			timeout: 5000
		});
		return true;
	} catch (error) {
		console.error('CoinGecko API health check failed:', error);
		return false;
	}
}

/**
 * Gets API status information
 *
 * @returns Promise resolving to API status details
 */
export async function getApiStatus(): Promise<{
	healthy: boolean;
	responseTime: number;
	error?: string;
}> {
	const startTime = Date.now();

	try {
		await makeApiRequest('/ping', {
			skipRateLimit: true,
			timeout: 5000
		});

		return {
			healthy: true,
			responseTime: Date.now() - startTime
		};
	} catch (error: any) {
		return {
			healthy: false,
			responseTime: Date.now() - startTime,
			error: error.message
		};
	}
}

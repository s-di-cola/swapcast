/**
 * Subgraph Utilities
 * 
 * Helper functions for formatting and processing subgraph data
 */

import type { 
	PredictionOutcome, 
	OutcomeLabel, 
	SubgraphPaginationOptions,
	SubgraphMarketStats,
	SubgraphPrediction
} from './types';

/**
 * Default pagination settings
 */
export const DEFAULT_PAGINATION = {
	limit: 10,
	page: 1,
	skip: 0
} as const;

/**
 * Maximum allowed limit for subgraph queries (to prevent overload)
 */
export const MAX_QUERY_LIMIT = 1000;

/**
 * Outcome label mappings
 */
export const OUTCOME_LABELS: Record<PredictionOutcome, OutcomeLabel> = {
	0: 'Bearish',
	1: 'Bullish'
} as const;

/**
 * Date formatting options for timestamps
 */
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
} as const;

/**
 * Formats a prediction outcome as a human-readable string
 * 
 * @param outcome - Numeric outcome (0 = Bearish, 1 = Bullish)
 * @returns String representation of the outcome
 * 
 * @example
 * ```typescript
 * formatPredictionOutcome(0); // "Bearish"
 * formatPredictionOutcome(1); // "Bullish"
 * ```
 */
export function formatPredictionOutcome(outcome: number): OutcomeLabel {
	return OUTCOME_LABELS[outcome as PredictionOutcome] || 'Bullish';
}

/**
 * Formats a timestamp from the subgraph (seconds since epoch) to a readable date string
 * 
 * @param timestamp - Unix timestamp in seconds as a string
 * @returns Formatted date string
 * 
 * @example
 * ```typescript
 * formatTimestamp("1640995200"); // "Dec 31, 14:00"
 * ```
 */
export function formatTimestamp(timestamp: string): string {
	const date = new Date(parseInt(timestamp) * 1000);
	return date.toLocaleString(undefined, DATE_FORMAT_OPTIONS);
}

/**
 * Formats amount from wei to readable format
 * 
 * @param amount - Amount in wei as string
 * @param decimals - Number of decimal places (default: 18)
 * @returns Formatted amount string
 * 
 * @example
 * ```typescript
 * formatAmount("1000000000000000000"); // "1.00"
 * formatAmount("500000000000000000"); // "0.50"
 * ```
 */
export function formatAmount(amount: string, decimals: number = 18): string {
	const value = BigInt(amount);
	const divisor = BigInt(10 ** decimals);
	const whole = value / divisor;
	const fractional = value % divisor;
	
	if (fractional === BigInt(0)) {
		return whole.toString();
	}
	
	const fractionalStr = fractional.toString().padStart(decimals, '0');
	const trimmed = fractionalStr.replace(/0+$/, '');
	
	return `${whole}.${trimmed}`;
}

/**
 * Calculates pagination parameters
 * 
 * @param options - Pagination options
 * @returns Calculated skip value and validated limit
 * 
 * @example
 * ```typescript
 * calculatePagination({ page: 2, limit: 20 }); // { skip: 20, limit: 20 }
 * ```
 */
export function calculatePagination(options: SubgraphPaginationOptions = {}) {
	const limit = Math.min(options.limit || DEFAULT_PAGINATION.limit, MAX_QUERY_LIMIT);
	const page = Math.max(options.page || DEFAULT_PAGINATION.page, 1);
	const skip = options.skip !== undefined ? options.skip : (page - 1) * limit;
	
	return { skip, limit, page };
}

/**
 * Calculates market statistics from prediction data
 * 
 * @param predictions - Array of predictions for a market
 * @returns Calculated statistics
 */
export function calculateMarketStats(predictions: SubgraphPrediction[]): SubgraphMarketStats {
	const uniqueUsers = new Set(predictions.map(p => p.user.address)).size;
	const totalStaked = predictions.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
	const averageStake = predictions.length > 0 ? totalStaked / BigInt(predictions.length) : BigInt(0);
	
	return {
		id: predictions[0]?.market.id || '',
		totalPredictions: predictions.length,
		totalStaked: totalStaked.toString(),
		uniqueUsers,
		averageStake: averageStake.toString()
	};
}

/**
 * Determines if a prediction is winning based on market outcome
 * 
 * @param predictionOutcome - User's predicted outcome
 * @param marketWinningOutcome - Actual winning outcome
 * @returns True if prediction matches winning outcome
 */
export function isPredictionWinning(
	predictionOutcome: number,
	marketWinningOutcome?: number
): boolean {
	return marketWinningOutcome !== undefined && predictionOutcome === marketWinningOutcome;
}

/**
 * Validates subgraph URL format
 * 
 * @param url - Subgraph URL to validate
 * @returns True if URL appears to be a valid subgraph endpoint
 */
export function isValidSubgraphUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		return urlObj.protocol === 'https:' && 
			   (urlObj.hostname.includes('thegraph.com') || 
			    urlObj.hostname.includes('subgraph'));
	} catch {
		return false;
	}
}

/**
 * Creates a safe GraphQL variable name from a string
 * 
 * @param input - Input string
 * @returns Safe variable name for GraphQL
 */
export function sanitizeGraphQLVariable(input: string): string {
	return input.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Converts BigInt values to strings for JSON serialization
 * 
 * @param obj - Object that may contain BigInt values
 * @returns Object with BigInt values converted to strings
 */
export function serializeBigInts<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj, (_, value) => 
		typeof value === 'bigint' ? value.toString() : value
	));
}
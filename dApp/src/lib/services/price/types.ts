/**
 * CoinGecko Service Types
 * 
 * Type definitions for CoinGecko API responses and service operations
 */

/**
 * Historical price data response from CoinGecko API
 */
export interface PriceData {
	/** Array of [timestamp, price] pairs */
	prices: [number, number][];
	/** Array of [timestamp, market_cap] pairs */
	market_caps: [number, number][];
	/** Array of [timestamp, volume] pairs */
	total_volumes: [number, number][];
}

/**
 * Cryptocurrency information from CoinGecko
 */
export interface CoinInfo {
	/** CoinGecko ID (e.g., 'bitcoin', 'ethereum') */
	id: string;
	/** Symbol (e.g., 'BTC', 'ETH') */
	symbol: string;
	/** Full name (e.g., 'Bitcoin', 'Ethereum') */
	name: string;
}

/**
 * Search response from CoinGecko API
 */
export interface SearchResponse {
	coins: CoinInfo[];
	exchanges: any[];
	icos: any[];
	categories: any[];
	nfts: any[];
}

/**
 * Cache entry with timestamp and data
 */
export interface CacheEntry<T = any> {
	timestamp: number;
	data: T;
}

/**
 * Configuration options for API requests
 */
export interface ApiRequestOptions {
	/** Override rate limiting for this request */
	skipRateLimit?: boolean;
	/** Custom timeout in milliseconds */
	timeout?: number;
	/** Custom headers */
	headers?: Record<string, string>;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
	/** Maximum requests per minute */
	maxRequests: number;
	/** Window size in milliseconds */
	windowMs: number;
	/** Current request count */
	requestCount: number;
	/** When the current window resets */
	resetTime: number;
}

/**
 * Chart data format for visualization
 */
export interface ChartData {
	/** Formatted date labels for x-axis */
	labels: string[];
	/** Price data points for y-axis */
	data: number[];
}

/**
 * Supported vs currencies for price queries
 */
export type VsCurrency = 'usd' | 'eur' | 'gbp' | 'jpy' | 'btc' | 'eth';

/**
 * Supported time periods for historical data
 */
export type TimePeriod = 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max';

/**
 * API endpoint paths
 */
export interface ApiEndpoints {
	coinsList: string;
	marketChart: string;
	search: string;
	ping: string;
}

/**
 * Service configuration
 */
export interface CoinGeckoConfig {
	baseUrl: string;
	rateLimit: RateLimitConfig;
	cache: {
		ttl: number;
		maxSize: number;
	};
	endpoints: ApiEndpoints;
}
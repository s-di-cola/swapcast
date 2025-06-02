/**
 * CoinGecko Service Configuration
 *
 * Configuration constants and utilities for the CoinGecko API service
 */

// Try to import from $env, but fall back to process.env if it fails
let PUBLIC_COINGECKO_API_URL: string | undefined;
try {
	// This will work in SvelteKit context
	PUBLIC_COINGECKO_API_URL = (await import('$env/static/public')).PUBLIC_COINGECKO_API_URL;
} catch (e) {
	// Fall back to process.env when running outside SvelteKit context (e.g., fixtures)
	PUBLIC_COINGECKO_API_URL = process.env.PUBLIC_COINGECKO_API_URL;
}
import type { CoinGeckoConfig, RateLimitConfig, ApiEndpoints } from './types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
	baseUrl: 'https://api.coingecko.com/api/v3',
	rateLimit: {
		maxRequests: 30, // Free tier limit
		windowMs: 60000 // 1 minute
	},
	cache: {
		ttl: 5 * 60 * 1000, // 5 minutes
		maxSize: 100 // Maximum cache entries
	},
	request: {
		timeout: 10000, // 10 seconds
		retries: 3
	}
} as const;

/**
 * API endpoint paths
 */
export const API_ENDPOINTS: ApiEndpoints = {
	coinsList: '/coins/list',
	marketChart: '/coins/{id}/market_chart',
	search: '/search',
	ping: '/ping'
} as const;

/**
 * Rate limiting configuration
 */
export const createRateLimitConfig = (): RateLimitConfig => ({
	maxRequests: DEFAULT_CONFIG.rateLimit.maxRequests,
	windowMs: DEFAULT_CONFIG.rateLimit.windowMs,
	requestCount: 0,
	resetTime: Date.now() + DEFAULT_CONFIG.rateLimit.windowMs
});

/**
 * Get the base URL for the CoinGecko API
 * Priority: Environment variable > Default URL
 */
export function getApiBaseUrl(): string {
	return PUBLIC_COINGECKO_API_URL || DEFAULT_CONFIG.baseUrl;
}

/**
 * Complete service configuration
 */
export const COINGECKO_CONFIG: CoinGeckoConfig = {
	baseUrl: getApiBaseUrl(),
	rateLimit: createRateLimitConfig(),
	cache: DEFAULT_CONFIG.cache,
	endpoints: API_ENDPOINTS
};

/**
 * Hardcoded fallback mapping for popular cryptocurrencies
 * Used when the API is unavailable or fails
 */
export const FALLBACK_COIN_MAPPING: Record<string, string> = {
	BTC: 'bitcoin',
	ETH: 'ethereum',
	SOL: 'solana',
	USDT: 'tether',
	USDC: 'usd-coin',
	BNB: 'binancecoin',
	ADA: 'cardano',
	XRP: 'ripple',
	MATIC: 'matic-network',
	DOT: 'polkadot',
	AVAX: 'avalanche-2',
	LINK: 'chainlink',
	UNI: 'uniswap',
	LTC: 'litecoin',
	BCH: 'bitcoin-cash'
} as const;

/**
 * Priority coins for symbol mapping conflicts
 * These take precedence when multiple coins have the same symbol
 */
export const PRIORITY_COINS = [
	'bitcoin',
	'ethereum',
	'tether',
	'usd-coin',
	'binancecoin',
	'ripple',
	'cardano',
	'solana',
	'polkadot',
	'chainlink'
] as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
	TTL: DEFAULT_CONFIG.cache.ttl,
	MAX_SIZE: DEFAULT_CONFIG.cache.maxSize,
	// Different TTL for different data types
	TTL_BY_TYPE: {
		historical: 5 * 60 * 1000, // 5 minutes
		search: 10 * 60 * 1000, // 10 minutes
		coinList: 60 * 60 * 1000, // 1 hour
		current: 2 * 60 * 1000 // 2 minutes
	}
} as const;

/**
 * Request configuration
 */
export const REQUEST_CONFIG = {
	TIMEOUT: DEFAULT_CONFIG.request.timeout,
	MAX_RETRIES: DEFAULT_CONFIG.request.retries,
	RETRY_DELAY: 1000, // Base delay for exponential backoff
	DEFAULT_HEADERS: {
		Accept: 'application/json',
		'User-Agent': 'SwapCast-Frontend/1.0'
	}
} as const;

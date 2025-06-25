 /**
 * Simplified CoinGecko Operations
 * Uses server API for current prices, keeps chart functionality, uses LRU cache
 */

import { LRUCache } from 'lru-cache';
import { makeApiRequest, buildEndpoint, buildQueryString } from './client';
import { getCachedOrFetch, generateCacheKey } from './cache';
import { CACHE_CONFIG } from './config';
import { toastStore } from '$lib/stores/toastStore';
import type {
	PriceData,
	CoinInfo,
	SearchResponse,
	ChartData,
	VsCurrency,
	TimePeriod
} from './types';

// LRU cache for prices - much simpler!
const priceCache = new LRUCache<string, number>({
	max: 500, // max 500 price entries
	ttl: 2 * 60 * 1000, // 2 minutes TTL
});

/**
 * Extract base asset from trading pair (e.g., "ETH/USD" -> "ETH")
 */
function extractBaseAsset(symbol: string): string {
	return symbol.includes('/') ? symbol.split('/')[0].trim() : symbol;
}

/**
 * Get current price using server API (SIMPLIFIED)
 */
export async function getCurrentPrice(symbol: string): Promise<number | null> {
	if (!symbol?.trim()) return null;

	const baseSymbol = extractBaseAsset(symbol).toUpperCase();

	// Check LRU cache first
	const cached = priceCache.get(baseSymbol);
	if (cached !== undefined) {
		return cached;
	}

	try {
		const response = await fetch(`/api/price?symbol=${encodeURIComponent(baseSymbol)}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Price API error for ${baseSymbol}:`, response.status, errorText);

			if (response.status === 429) {
				toastStore.error('Rate limit exceeded. Please wait before trying again.');
			} else if (response.status === 404) {
				toastStore.warning(`Cryptocurrency "${baseSymbol}" not found`);
			} else {
				toastStore.error(`Failed to fetch price for ${baseSymbol}`);
			}
			return null;
		}

		const data = await response.json();

		if (typeof data.price !== 'number' || data.price <= 0) {
			console.warn(`Invalid price data for ${baseSymbol}:`, data);
			toastStore.warning(`Invalid price data for ${baseSymbol}`);
			return null;
		}

		// Cache in LRU
		priceCache.set(baseSymbol, data.price);
		return data.price;

	} catch (error) {
		console.error(`Error fetching price for ${baseSymbol}:`, error);
		toastStore.error(`Network error fetching price for ${baseSymbol}`);
		return null;
	}
}

/**
 * Get current prices for multiple symbols (SIMPLIFIED)
 */
export async function getBatchPrices(symbols: string[]): Promise<Record<string, number | null>> {
	if (!symbols || symbols.length === 0) {
		return {};
	}

	const uniqueSymbols = [...new Set(symbols.filter(s => s && s.trim()))];
	const results: Record<string, number | null> = {};

	// Process all symbols in parallel
	const promises = uniqueSymbols.map(async (symbol) => {
		const price = await getCurrentPrice(symbol);
		return { symbol: symbol.toUpperCase(), price };
	});

	const resolved = await Promise.allSettled(promises);

	resolved.forEach((result) => {
		if (result.status === 'fulfilled') {
			const { symbol, price } = result.value;
			results[symbol] = price;
		}
	});

	return results;
}

/**
 * Fetches historical price data for charts (KEPT ORIGINAL)
 */
export async function getHistoricalPriceData(
	coinId: string,
	vsCurrency: VsCurrency = 'usd',
	days: number = 30
): Promise<PriceData> {
	const endpoint = buildEndpoint('/coins/{id}/market_chart', { id: coinId });
	const queryParams = {
		vs_currency: vsCurrency,
		days: days.toString()
	};
	const url = `${endpoint}?${buildQueryString(queryParams)}`;

	return getCachedOrFetch(
		generateCacheKey('historical', coinId, vsCurrency, days.toString()),
		async () => {
			try {
				return await makeApiRequest<PriceData>(url, {});
			} catch (error) {
				console.error(`Failed to fetch historical price data for ${coinId}:`, error);
				throw new Error(
					`Failed to fetch price data for ${coinId}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		},
		CACHE_CONFIG.TTL_BY_TYPE.historical
	);
}

/**
 * Searches for cryptocurrencies by name or symbol (KEPT ORIGINAL)
 */
export async function searchCoins(query: string): Promise<CoinInfo[]> {
	if (query.length < 2) {
		return performSearch(query);
	}

	const cacheKey = generateCacheKey('search', query);
	return getCachedOrFetch(cacheKey, () => performSearch(query), CACHE_CONFIG.TTL_BY_TYPE.search);
}

async function performSearch(query: string): Promise<CoinInfo[]> {
	try {
		const endpoint = buildEndpoint('/search', {});
		const queryParams = { query };
		const url = `${endpoint}?${buildQueryString(queryParams)}`;
		const response = await makeApiRequest<SearchResponse>(url, {});
		return (response.coins || []) as CoinInfo[];
	} catch (error) {
		console.error('Failed to search coins:', error);
		throw new Error(
			`Failed to search for coins: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Get coin ID from symbol using search (SIMPLIFIED)
 */
export async function getCoinIdFromSymbol(symbol: string): Promise<string | null> {
	try {
		const searchResults = await searchCoins(symbol);
		const exactMatch = searchResults.find(coin =>
			coin.symbol.toLowerCase() === symbol.toLowerCase()
		);
		return exactMatch?.id || null;
	} catch (error) {
		console.error(`Error finding coin ID for ${symbol}:`, error);
		return null;
	}
}

/**
 * Formats raw CoinGecko price data for chart display (KEPT ORIGINAL)
 */
export function formatPriceDataForChart(
	priceData: PriceData,
	timePeriod: TimePeriod = 30
): ChartData {
	if (!priceData || !priceData.prices || priceData.prices.length === 0) {
		return { labels: [], data: [] };
	}

	const labels: string[] = [];
	const data: number[] = [];

	for (const [timestamp, price] of priceData.prices) {
		const date = new Date(timestamp);
		let formattedDate: string;

		if (typeof timePeriod === 'number' && timePeriod <= 1) {
			formattedDate = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} else if (typeof timePeriod === 'number' && timePeriod <= 7) {
			formattedDate = date.toLocaleDateString([], { weekday: 'short' });
		} else {
			formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
		}

		labels.push(formattedDate);
		data.push(price);
	}

	return { labels, data };
}

/**
 * Legacy function for compatibility - no longer needed but kept for existing imports
 */
export async function fetchCoinList(): Promise<void> {
	// This function is no longer needed since we use dynamic search
	console.warn('fetchCoinList() is deprecated - symbols are now resolved dynamically');
	return Promise.resolve();
}

/**
 * Legacy function for compatibility
 */
export async function getCoinIdFromAssetPair(assetPair: string): Promise<string | null> {
	const baseAsset = extractBaseAsset(assetPair);
	return getCoinIdFromSymbol(baseAsset);
}

/**
 * Legacy aliases for backward compatibility
 */
export const getServerPrice = getCurrentPrice;
export const getBatchServerPrices = getBatchPrices;

/**
 * Clear price cache
 */
export function clearPriceCache(): void {
	priceCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats() {
	return {
		size: priceCache.size,
		maxSize: priceCache.max,
		entries: [...priceCache.keys()]
	};
}

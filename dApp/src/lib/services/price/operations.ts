/**
 * CoinGecko API Operations
 *
 * High-level operations for fetching cryptocurrency data from CoinGecko
 */

import { makeApiRequest, buildEndpoint, buildQueryString } from './client';
import { getCachedOrFetch, generateCacheKey } from './cache';
import { FALLBACK_COIN_MAPPING, PRIORITY_COINS, CACHE_CONFIG } from './config';
import type {
	PriceData,
	CoinInfo,
	SearchResponse,
	ChartData,
	VsCurrency,
	TimePeriod
} from './types';

/**
 * In-memory storage for coin symbol to ID mapping
 */
let coinSymbolToIdMap: Record<string, string> = {};

/**
 * Fetches historical price data for a specific cryptocurrency
 *
 * @param coinId - The CoinGecko ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum')
 * @param vsCurrency - The currency to show prices in (e.g., 'usd', 'eur')
 * @param days - Number of days of historical data to retrieve
 * @returns Promise with the price data including prices, market caps, and volumes
 * @throws Error if the API request fails
 */
export async function getHistoricalPriceData(
	coinId: string,
	vsCurrency: VsCurrency = 'usd',
	days: number = 30
): Promise<PriceData> {
	const endpoint = buildEndpoint('/coins/{id}/market_chart', { id: coinId });
	const queryParams = {
		vs_currency: vsCurrency,
		days: days.toString(),
		interval: days > 90 ? 'daily' : 'hourly'
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
 * Searches for cryptocurrencies by name or symbol
 *
 * @param query - The search term to look for in coin names and symbols
 * @returns Promise with an array of matching coin information
 * @throws Error if the API request fails
 */
export async function searchCoins(query: string): Promise<CoinInfo[]> {
	// Don't cache very short queries to avoid cache pollution
	if (query.length < 2) {
		return performSearch(query);
	}

	const cacheKey = generateCacheKey('search', query);
	return getCachedOrFetch(cacheKey, () => performSearch(query), CACHE_CONFIG.TTL_BY_TYPE.search);
}

/**
 * Performs the actual search request to the CoinGecko API
 *
 * @param query - The search term to look for
 * @returns Promise with an array of matching coin information
 * @throws Error if the API request fails
 */
async function performSearch(query: string): Promise<CoinInfo[]> {
	try {
		const endpoint = buildEndpoint('/search', {});
		const queryParams = { query };
		const url = `${endpoint}?${buildQueryString(queryParams)}`;
		const response = await makeApiRequest<SearchResponse>(url, {});

		// Extract just the coins from the response
		return (response.coins || []) as CoinInfo[];
	} catch (error) {
		console.error('Failed to search coins:', error);
		throw new Error(
			`Failed to search for coins: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Fetches the complete list of cryptocurrencies from CoinGecko and builds a mapping
 *
 * This function retrieves all available cryptocurrencies from CoinGecko and creates
 * a mapping from ticker symbols (e.g., "BTC") to CoinGecko IDs (e.g., "bitcoin").
 * The mapping is cached after the first fetch to avoid unnecessary API calls.
 *
 * For symbols with multiple possible coins, it prioritizes popular cryptocurrencies.
 * If the API request fails, it falls back to a minimal hardcoded mapping.
 */
export async function fetchCoinList(): Promise<void> {
	// If we already have the mapping, don't fetch again
	if (Object.keys(coinSymbolToIdMap).length > 0) {
		return;
	}

	const cacheKey = generateCacheKey('coinList');
	try {
		const coinList = await getCachedOrFetch<CoinInfo[]>(
			cacheKey,
			async () => {
				const endpoint = buildEndpoint('/coins/list');
				return makeApiRequest<CoinInfo[]>(endpoint, {});
			},
			CACHE_CONFIG.TTL_BY_TYPE.coinList
		);

		// Build the mapping from symbol to ID
		const tempMap: Record<string, string[]> = {};

		// First pass: collect all coins for each symbol
		for (const coin of coinList) {
			const symbol = coin.symbol.toLowerCase();
			if (!tempMap[symbol]) {
				tempMap[symbol] = [];
			}
			tempMap[symbol].push(coin.id);
		}

		// Second pass: resolve conflicts by prioritizing popular coins
		for (const [symbol, ids] of Object.entries(tempMap)) {
			if (ids.length === 1) {
				// No conflict, just use the only ID
				coinSymbolToIdMap[symbol] = ids[0];
			} else {
				// Try to find a priority coin
				const priorityCoin = ids.find((id) => PRIORITY_COINS.includes(id as any));
				if (priorityCoin) {
					coinSymbolToIdMap[symbol] = priorityCoin;
				} else {
					// No priority coin found, use the first one
					coinSymbolToIdMap[symbol] = ids[0];
				}
			}
		}

		console.log(
			`Built mapping for ${Object.keys(coinSymbolToIdMap).length} cryptocurrency symbols`
		);
	} catch (error) {
		console.error('Failed to fetch coin list, using fallback mapping:', error);
		// Use the fallback mapping if the API request fails
		Object.entries(FALLBACK_COIN_MAPPING).forEach(([symbol, id]) => {
			coinSymbolToIdMap[symbol.toLowerCase()] = id;
		});
	}
}

/**
 * Converts a trading pair to a CoinGecko ID
 *
 * This function takes a trading pair (e.g., "ETH/USD") and extracts the base asset ("ETH"),
 * then looks up its corresponding CoinGecko ID ("ethereum"). It uses the dynamically
 * built mapping from fetchCoinList().
 *
 * @param assetPair - The trading pair string (e.g., "ETH/USD", "BTC/USDT")
 * @returns Promise resolving to the CoinGecko ID for the base asset, or null if not found
 */
export async function getCoinIdFromAssetPair(assetPair: string): Promise<string | null> {
	// Ensure we have the coin mapping
	if (Object.keys(coinSymbolToIdMap).length === 0) {
		await fetchCoinList();
	}

	// Extract the base asset from the pair (e.g., "ETH" from "ETH/USD")
	const baseAsset = assetPair.split('/')[0].toLowerCase();

	// Look up the CoinGecko ID for this symbol
	return coinSymbolToIdMap[baseAsset] || null;
}

/**
 * Formats raw CoinGecko price data for chart display
 *
 * This function transforms the raw price data from CoinGecko's API into a format
 * suitable for rendering in charts. It extracts timestamps and prices, and formats
 * the dates for display.
 *
 * @param priceData - The raw price data from CoinGecko API
 * @param timePeriod - Optional time period for formatting date labels
 * @returns Object containing arrays of formatted date labels and price values
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

	// Extract timestamps and prices
	for (const [timestamp, price] of priceData.prices) {
		const date = new Date(timestamp);

		// Format the date based on the time period
		let formattedDate: string;

		// Handle different time periods with appropriate date formatting
		if (typeof timePeriod === 'number' && timePeriod <= 1) {
			// 24h format
			formattedDate = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} else if (typeof timePeriod === 'number' && timePeriod <= 7) {
			// Week format
			formattedDate = date.toLocaleDateString([], { weekday: 'short' });
		} else {
			// Default format for longer periods
			formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
		}

		labels.push(formattedDate);
		data.push(price);
	}

	return { labels, data };
}

/**
 * CoinGecko API Operations
 *
 * High-level operations for fetching cryptocurrency data from CoinGecko
 */

import { makeApiRequest, buildEndpoint, buildQueryString } from './client';
import { getCachedOrFetch, generateCacheKey } from './cache';
import { FALLBACK_COIN_MAPPING, PRIORITY_COINS, CACHE_CONFIG } from './config';
import { toastStore } from '$lib/stores/toastStore';
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
 * In-memory price cache for frequently accessed prices
 * This is separate from the main cache system to provide faster access
 * and reduce redundant API calls for the same symbols
 */
const inMemoryPriceCache: Record<string, { price: number; timestamp: number }> = {};

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
		days: days.toString()
		// Note: interval parameter removed as it's only available for Enterprise plan
		// CoinGecko will automatically use hourly data for 1-90 days
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
				const endpoint = buildEndpoint('/coins/list',{});
				return makeApiRequest<CoinInfo[]>(endpoint, { skipRateLimit: false });
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
 * Gets the current price for a cryptocurrency
 *
 * @param coinId - The CoinGecko ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum')
 * @param vsCurrency - The currency to show prices in (e.g., 'usd', 'eur')
 * @returns Promise with the current price or null if not found
 * @throws Error if the API request fails
 */
export async function getCurrentPrice(
	coinId: string,
	vsCurrency: VsCurrency = 'usd'
): Promise<number | null> {
	// Check in-memory cache first for faster access
	const memoryCacheKey = `${coinId}_${vsCurrency}`;
	const cachedPrice = inMemoryPriceCache[memoryCacheKey];
	const cacheExpiry = CACHE_CONFIG.TTL_BY_TYPE.current || 120000; // 2 minutes default
	
	if (cachedPrice && (Date.now() - cachedPrice.timestamp) < cacheExpiry) {
		return cachedPrice.price;
	}

	const endpoint = buildEndpoint('/simple/price', {});
	const queryParams = {
		ids: coinId,
		vs_currencies: vsCurrency
	};
	const url = `${endpoint}?${buildQueryString(queryParams)}`;

	const cacheKey = generateCacheKey('current_price', coinId, vsCurrency);
	try {
		const response = await getCachedOrFetch<Record<string, Record<string, number>>>(
			cacheKey,
			async () => makeApiRequest<Record<string, Record<string, number>>>(url, {}),
			CACHE_CONFIG.TTL_BY_TYPE.current || 120000 // 2 minutes cache if not configured
		);

		// Check if the response contains the requested coin and currency
		if (response && response[coinId] && response[coinId][vsCurrency]) {
			const price = response[coinId][vsCurrency];
			// Update in-memory cache
			inMemoryPriceCache[memoryCacheKey] = { 
				price, 
				timestamp: Date.now() 
			};
			return price;
		}
		return null;
	} catch (error) {
		console.error(`Failed to fetch current price for ${coinId}:`, error);
		return null;
	}
}

/**
 * Gets the current price for a cryptocurrency using its symbol
 *
 * @param symbol - The symbol of the cryptocurrency (e.g., 'BTC', 'ETH')
 * @param vsCurrency - The currency to show prices in (e.g., 'usd', 'eur')
 * @returns Promise with the current price or null if not found
 */
export async function getCurrentPriceBySymbol(
	symbol: string,
	vsCurrency: VsCurrency = 'usd'
): Promise<number | null> {
	// Ensure we have the coin mapping
	if (Object.keys(coinSymbolToIdMap).length === 0) {
		await fetchCoinList();
	}

	// Look up the CoinGecko ID for this symbol
	const coinId = coinSymbolToIdMap[symbol.toLowerCase()];
	if (!coinId) {
		console.warn(`Could not find CoinGecko ID for symbol ${symbol}`);
		return null;
	}

	return getCurrentPrice(coinId, vsCurrency);
}

/**
 * Gets current prices for multiple cryptocurrencies in a single API call
 * 
 * @param symbols - Array of cryptocurrency symbols (e.g., ['BTC', 'ETH'])
 * @param vsCurrency - The currency to show prices in (e.g., 'usd', 'eur')
 * @returns Promise with a record of symbol to price mappings
 */
export async function getBatchPrices(
	symbols: string[],
	vsCurrency: VsCurrency = 'usd'
): Promise<Record<string, number | null>> {
	// Ensure we have the coin mapping
	if (Object.keys(coinSymbolToIdMap).length === 0) {
		await fetchCoinList();
	}

	// Filter out duplicates
	const uniqueSymbols = [...new Set(symbols)];
	
	// Check which symbols we need to fetch (not in memory cache)
	const symbolsToFetch: string[] = [];
	const result: Record<string, number | null> = {};
	const cacheExpiry = CACHE_CONFIG.TTL_BY_TYPE.current || 120000;
	
	// First check in-memory cache
	for (const symbol of uniqueSymbols) {
		const coinId = coinSymbolToIdMap[symbol.toLowerCase()];
		if (!coinId) {
			result[symbol] = null;
			continue;
		}
		
		const memoryCacheKey = `${coinId}_${vsCurrency}`;
		const cachedPrice = inMemoryPriceCache[memoryCacheKey];
		
		if (cachedPrice && (Date.now() - cachedPrice.timestamp) < cacheExpiry) {
			result[symbol] = cachedPrice.price;
		} else {
			symbolsToFetch.push(symbol.toLowerCase());
		}
	}
	
	// If all prices were in memory cache, return early
	if (symbolsToFetch.length === 0) {
		return result;
	}
	
	// Convert symbols to CoinGecko IDs
	const coinIds = symbolsToFetch
		.map(symbol => coinSymbolToIdMap[symbol])
		.filter(Boolean);
	
	if (coinIds.length === 0) {
		return result;
	}
	
	// Make a single API call for all needed coins
	const endpoint = buildEndpoint('/simple/price', {});
	const queryParams = {
		ids: coinIds.join(','),
		vs_currencies: vsCurrency
	};
	const url = `${endpoint}?${buildQueryString(queryParams)}`;
	
	const cacheKey = generateCacheKey('batch_prices', coinIds.join('_'), vsCurrency);
	
	try {
		const response = await getCachedOrFetch<Record<string, Record<string, number>>>(
			cacheKey,
			async () => makeApiRequest<Record<string, Record<string, number>>>(url, {}),
			CACHE_CONFIG.TTL_BY_TYPE.current || 120000
		);
		
		// Process response and update both result and in-memory cache
		for (const symbol of symbolsToFetch) {
			const coinId = coinSymbolToIdMap[symbol];
			if (coinId && response[coinId] && response[coinId][vsCurrency]) {
				const price = response[coinId][vsCurrency];
				result[symbol.toUpperCase()] = price;
				
				// Update in-memory cache
				inMemoryPriceCache[`${coinId}_${vsCurrency}`] = {
					price,
					timestamp: Date.now()
				};
			} else {
				result[symbol.toUpperCase()] = null;
			}
		}
		
		return result;
	} catch (error) {
		console.error(`Failed to fetch batch prices:`, error);
		// Fall back to individual fetches for symbols that weren't in cache
		const promises = symbolsToFetch.map(async (symbol) => {
			const price = await getCurrentPriceBySymbol(symbol, vsCurrency);
			return { symbol: symbol.toUpperCase(), price };
		});
		
		const results = await Promise.all(promises);
		results.forEach(({ symbol, price }) => {
			result[symbol] = price;
		});
		
		return result;
	}
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
/**
 * Gets the current price for a cryptocurrency using the server API
 *
 * @param symbol - Symbol of the asset (e.g., 'BTC', 'ETH')
 * @returns Promise resolving to the current price in USD or null if not found
 */
export async function getServerPrice(symbol: string): Promise<number | null> {
    if (!symbol) return null;
    
    // Use the cache from the main service
    const cacheKey = `server_price_${symbol.toUpperCase()}`;
    
    return getCachedOrFetch<number | null>(
        cacheKey,
        async () => {
            try {
                // Call our server-side API endpoint
                const response = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    const errorMessage = `API error (${response.status}): ${errorText}`;
                    
                    // Show toast notification for API errors
                    toastStore.error(`Failed to fetch price for ${symbol}: ${response.status === 429 ? 'Rate limit exceeded' : 'API error'}`);
                    
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                
                if (typeof data.price !== 'number') {
                    console.warn(`Invalid price data for ${symbol}:`, data);
                    toastStore.warning(`Invalid price data received for ${symbol}`);
                    return null;
                }
                
                return data.price;
            } catch (error) {
                console.error(`Error fetching price for ${symbol}:`, error);
                
                // Only show toast if we haven't already shown one for this error
                // This prevents duplicate toasts for the same error
                if (!(error instanceof Error && error.message.includes('API error'))) {
                    toastStore.error(`Failed to fetch price for ${symbol}`);
                }
                
                return null;
            }
        },
        CACHE_CONFIG.TTL_BY_TYPE.current
    );
}

/**
 * Gets current prices for multiple cryptocurrencies in a single batch
 *
 * @param symbols - Array of cryptocurrency symbols (e.g., ['BTC', 'ETH'])
 * @returns Promise with a record of symbol to price mappings
 */
export async function getBatchServerPrices(
    symbols: string[]
): Promise<Record<string, number | null>> {
    if (!symbols || symbols.length === 0) {
        return {};
    }

    let hasErrors = false;
    
    // Process in parallel for better performance
    const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
            try {
                const price = await getServerPrice(symbol);
                return { symbol, price, success: true };
            } catch (error) {
                hasErrors = true;
                console.error(`Error in batch price fetch for ${symbol}:`, error);
                return { symbol, price: null, success: false };
            }
        })
    );
    
    // Show a single toast for batch errors instead of multiple individual ones
    if (hasErrors) {
        toastStore.warning('Some price data could not be fetched');
    }

    // Convert to record format, handling both fulfilled and rejected promises
    return results.reduce(
        (acc, result) => {
            if (result.status === 'fulfilled') {
                const { symbol, price } = result.value;
                acc[symbol.toUpperCase()] = price;
            } else {
                // For rejected promises, we don't have symbol info
                // This shouldn't happen with our try/catch above, but just in case
                console.error('Unexpected promise rejection in batch price fetch:', result.reason);
            }
            return acc;
        },
        {} as Record<string, number | null>
    );
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

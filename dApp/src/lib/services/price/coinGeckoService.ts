/**
 * CoinGecko API Service
 * 
 * This service provides functions to fetch cryptocurrency price data from the CoinGecko API.
 * It implements caching and rate limiting to ensure reliable operation within the free tier limits.
 * 
 * The service can be configured via environment variables:
 * - PUBLIC_COINGECKO_API_URL: The base URL for the CoinGecko API
 */

import { PUBLIC_COINGECKO_API_URL } from '$env/static/public';

// Types for the API responses
export interface PriceData {
    prices: [number, number][]; // [timestamp, price]
    market_caps: [number, number][];
    total_volumes: [number, number][];
}


export interface CoinInfo {
    id: string;
    symbol: string;
    name: string;
}

/**
 * Base URL for the CoinGecko API, configurable via environment variables
 */
const API_BASE_URL = PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

/**
 * Rate limiting configuration for the free tier
 */
const RATE_LIMIT = 30; // Maximum requests per minute
let requestsThisMinute = 0;
let rateLimitReset = Date.now() + 60000;

/**
 * Implements rate limiting for the CoinGecko API to stay within free tier limits
 * 
 * This function tracks the number of requests made per minute and automatically
 * delays subsequent requests if the rate limit is reached. It will wait until
 * the rate limit resets before allowing more requests.
 * 
 * @returns Promise that resolves when it's safe to make the next request
 */
async function checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if we're in a new minute
    if (now > rateLimitReset) {
        requestsThisMinute = 0;
        rateLimitReset = now + 60000;
    }
    
    // If we've hit the rate limit, wait until reset
    if (requestsThisMinute >= RATE_LIMIT) {
        const waitTime = rateLimitReset - now;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return checkRateLimit(); // Recursive check after waiting
    }
    
    // Increment the counter
    requestsThisMinute++;
}

/**
 * Interface for cache entries with timestamp and data
 */
interface CacheEntry {
    timestamp: number;
    data: any;
}

/**
 * In-memory cache storage
 */
const cache: Record<string, CacheEntry> = {};

/**
 * Cache time-to-live: 5 minutes
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Gets data from cache if available and valid, otherwise fetches fresh data
 * 
 * This function implements a simple in-memory caching mechanism to reduce API calls.
 * It will return cached data if available and not expired, otherwise it will call
 * the provided fetch function and cache the result.
 * 
 * @param cacheKey - Unique identifier for the cached data
 * @param fetchFn - Function to call when cache miss or expired
 * @returns Promise resolving to either cached or freshly fetched data
 */
async function getCachedOrFetch<T>(cacheKey: string, fetchFn: () => Promise<T>): Promise<T> {
    // Check if we have a valid cache entry
    const entry = cache[cacheKey];
    const now = Date.now();
    
    if (entry && (now - entry.timestamp) < CACHE_TTL) {
        return entry.data as T;
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Update cache
    cache[cacheKey] = {
        timestamp: now,
        data
    };
    
    return data;
}

/**
 * Fetches historical price data for a specific cryptocurrency
 * 
 * This function retrieves historical price data for a given cryptocurrency over
 * a specified time period. Results are cached to minimize API calls.
 * 
 * @param coinId - The CoinGecko ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum')
 * @param vsCurrency - The currency to show prices in (e.g., 'usd', 'eur')
 * @param days - Number of days of historical data to retrieve
 * @returns Promise with the price data including prices, market caps, and volumes
 * @throws Error if the API request fails
 */
export async function getHistoricalPriceData(
    coinId: string,
    vsCurrency: string = 'usd',
    days: number = 30
): Promise<PriceData> {
    const cacheKey = `historical_${coinId}_${vsCurrency}_${days}`;
    
    return getCachedOrFetch<PriceData>(cacheKey, async () => {
        try {
            // Check rate limit before making request
            await checkRateLimit();
            
            // Build the URL with query parameters
            const url = `${API_BASE_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
            
            // Make the API request
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
            }
            
            const data: PriceData = await response.json();
            return data;
        } catch (error) {
            throw error;
        }
    });
}

/**
 * Searches for cryptocurrencies by name or symbol
 * 
 * This function searches the CoinGecko database for cryptocurrencies matching
 * the provided query. Results are cached to minimize API calls, except for very
 * short queries to avoid cache pollution.
 * 
 * @param query - The search term to look for in coin names and symbols
 * @returns Promise with an array of matching coin information
 * @throws Error if the API request fails
 */
export async function searchCoins(query: string): Promise<CoinInfo[]> {
    // Don't cache searches with very short queries to avoid cache pollution
    if (query.length < 3) {
        return performSearch(query);
    }
    
    const cacheKey = `search_${query.toLowerCase()}`;
    return getCachedOrFetch<CoinInfo[]>(cacheKey, () => performSearch(query));
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
        // Check rate limit before making request
        await checkRateLimit();
        
        const url = `${API_BASE_URL}/search?query=${encodeURIComponent(query)}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.coins || [];
    } catch (error) {
        throw error;
    }
}

/**
 * Storage for the mapping from cryptocurrency symbols to CoinGecko IDs
 */
let coinSymbolToIdMap: Record<string, string> = {};

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
    if (Object.keys(coinSymbolToIdMap).length > 0) return;
    
    try {
        // Check rate limit before making request
        await checkRateLimit();
        
        const url = `${API_BASE_URL}/coins/list`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        }
        
        const coins: CoinInfo[] = await response.json();
        
        // Build the mapping from symbol to ID
        // Some symbols might have multiple coins, we'll prioritize the more popular ones
        const priorityCoins = ['bitcoin', 'ethereum', 'tether', 'usd-coin', 'binancecoin', 'ripple', 'cardano', 'solana'];
        
        // First pass: add all coins to the map
        for (const coin of coins) {
            const symbol = coin.symbol.toUpperCase();
            coinSymbolToIdMap[symbol] = coin.id;
        }
        
        // Second pass: prioritize popular coins
        for (const coin of coins) {
            if (priorityCoins.includes(coin.id)) {
                const symbol = coin.symbol.toUpperCase();
                coinSymbolToIdMap[symbol] = coin.id;
            }
        }
    } catch (error) {
        // Fallback to a minimal hardcoded mapping for the most common coins
        coinSymbolToIdMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'USDT': 'tether',
            'USDC': 'usd-coin',
            'BNB': 'binancecoin',
        };
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
    // Make sure we have the coin mapping
    await fetchCoinList();
    
    // Split the asset pair (e.g., "ETH/USD" -> ["ETH", "USD"])
    const parts = assetPair.split('/');
    if (parts.length !== 2) return null;
    
    const baseAsset = parts[0].toUpperCase();
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
 * @returns Object containing arrays of formatted date labels and price values
 */
export function formatPriceDataForChart(priceData: PriceData): { labels: string[], data: number[] } {
    const labels: string[] = [];
    const data: number[] = [];
    
    // CoinGecko returns data as [timestamp, price] pairs
    priceData.prices.forEach((item: [number, number]) => {
        const [timestamp, price] = item;
        const date = new Date(timestamp);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        data.push(price);
    });
    
    return { labels, data };
}

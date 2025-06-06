/**
 * Server-side price API endpoint
 * 
 * This endpoint proxies requests to CoinGecko API with authentication
 * to avoid exposing the API key to the client.
 */

import { json, error } from '@sveltejs/kit';
//@ts-ignore present in .env
import { PRIVATE_COINGECKO_API_KEY } from '$env/static/private';
import { PUBLIC_COINGECKO_API_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

// Static mapping for common cryptocurrencies to avoid API calls
const COMMON_COIN_IDS: Record<string, string> = {
	'BTC': 'bitcoin',
	'ETH': 'ethereum',
	'USDC': 'usd-coin',
	'USDT': 'tether',
	'DAI': 'dai',
	'SOL': 'solana',
	'MATIC': 'matic-network',
	'AVAX': 'avalanche-2',
	'BNB': 'binancecoin',
	'XRP': 'ripple',
	'ADA': 'cardano',
	'DOT': 'polkadot',
	'DOGE': 'dogecoin',
	'SHIB': 'shiba-inu',
	'UNI': 'uniswap',
	'LINK': 'chainlink'
};

// Cache for coin list to avoid repeated API calls
let coinListCache: { id: string; symbol: string; name: string }[] | null = null;
let coinListTimestamp = 0;
const COIN_LIST_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache for price data
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const PRICE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms between requests (max 5 req/sec)

/**
 * Fetches the coin list from CoinGecko API and finds the ID for a given symbol
 *
 * @param symbol - The symbol to look up (e.g., 'BTC', 'ETH')
 * @returns Promise resolving to the coin ID or the lowercase symbol as fallback
 */
async function getCoinIdFromSymbol(symbol: string): Promise<string> {
	const upperSymbol = symbol.toUpperCase();
	
	// Check common coins mapping first to avoid API calls
	if (COMMON_COIN_IDS[upperSymbol]) {
		return COMMON_COIN_IDS[upperSymbol];
	}
	
	const now = Date.now();
	
	// Fetch or use cached coin list
	if (!coinListCache || now - coinListTimestamp > COIN_LIST_TTL) {
		try {
			const apiUrl = `${PUBLIC_COINGECKO_API_URL}/coins/list`;
			const response = await fetch(apiUrl, {
				headers: {
					'X-CG-Pro-API-Key': PRIVATE_COINGECKO_API_KEY
				}
			});
			
			if (!response.ok) {
				throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
			}
			
			const data = await response.json();
			coinListCache = Array.isArray(data) ? data : [];
			coinListTimestamp = now;
			console.log(`Fetched ${coinListCache.length} coins from CoinGecko`);
		} catch (err) {
			console.error('Error fetching coin list:', err);
			// If we can't fetch the list, return the symbol as fallback
			return symbol.toLowerCase();
		}
	}
	
	// Find the coin by symbol
	if (coinListCache && coinListCache.length > 0) {
		// First try exact match
		const exactMatch = coinListCache.find(coin => 
			coin.symbol.toUpperCase() === upperSymbol
		);
		
		if (exactMatch) return exactMatch.id;
		
		// If multiple coins have the same symbol, prioritize by market cap or popularity
		// For now, we'll just take the first match as a simple approach
		const matches = coinListCache.filter(coin => 
			coin.symbol.toUpperCase() === upperSymbol
		);
		
		if (matches.length > 0) return matches[0].id;
	}
	
	// Fallback to using the symbol itself
	return symbol.toLowerCase();
}

// Already defined above
// const priceCache: Record<string, { price: number; timestamp: number }> = {};
// Using PRICE_CACHE_TTL instead of CACHE_TTL

/**
 * GET handler for price data
 */
export const GET: RequestHandler = async ({ url }) => {
	// Get symbol from query params
	const symbol = url.searchParams.get('symbol');
	if (!symbol) {
		throw error(400, 'Symbol parameter is required');
	}

	// Check cache first
	const now = Date.now();
	const cacheKey = symbol.toUpperCase();
	if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < PRICE_CACHE_TTL) {
		return json({ price: priceCache[cacheKey].price });
	}

	try {
		// Apply rate limiting
		const currentTime = Date.now();
		if (lastRequestTime > 0) {
			const timeSinceLastRequest = currentTime - lastRequestTime;
			if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
				// Wait to respect rate limit
				const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
		
		// Get coin ID from symbol using the CoinGecko API
		const coinId = await getCoinIdFromSymbol(symbol);

		// Build URL with API key
		const apiUrl = `${PUBLIC_COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=usd`;
		
		// Make authenticated request
		const response = await fetch(apiUrl, {
			headers: {
				'X-CG-Pro-API-Key': PRIVATE_COINGECKO_API_KEY
			}
		});
		
		// Update last request time for rate limiting
		lastRequestTime = Date.now();

		if (!response.ok) {
			// Provide more detailed error information for the client
			const errorMessage = response.status === 429 
				? 'CoinGecko rate limit exceeded. Please try again later.'
				: `CoinGecko API error: ${response.statusText}`;
			
			console.error(`CoinGecko API error for ${symbol}: ${response.status} ${response.statusText}`);
			throw error(response.status, errorMessage);
		}

		const data = await response.json();
		
		if (!data[coinId] || typeof data[coinId].usd !== 'number') {
			throw error(404, `Price not found for ${symbol}`);
		}

		const price = data[coinId].usd;
		
		// Cache the result
		priceCache[cacheKey] = { price, timestamp: now };
		
		return json({ price });
	} catch (err) {
		console.error('Error fetching price data:', err);
		throw error(500, 'Unknown error fetching price data');
	}
};

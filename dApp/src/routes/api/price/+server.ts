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

// Cache for coin list to avoid repeated API calls
let coinListCache: { id: string; symbol: string; name: string }[] | null = null;
let coinListTimestamp = 0;
const COIN_LIST_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches the coin list from CoinGecko API and finds the ID for a given symbol
 *
 * @param symbol - The symbol to look up (e.g., 'BTC', 'ETH')
 * @returns Promise resolving to the coin ID or the lowercase symbol as fallback
 */
async function getCoinIdFromSymbol(symbol: string): Promise<string> {
	const upperSymbol = symbol.toUpperCase();
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

// Cache for price data to reduce API calls
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 minute

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
	if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_TTL) {
		return json({ price: priceCache[cacheKey].price });
	}

	try {
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

		if (!response.ok) {
			throw error(response.status, `CoinGecko API error: ${response.statusText}`);
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
		throw error(500, 'Unknown error fetching price data');
	}
};

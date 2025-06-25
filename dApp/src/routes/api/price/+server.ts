// +server.ts
/**
 * Simplified Server API for Price Data
 * Uses LRU cache and CoinGecko search API
 */

import { json, error } from '@sveltejs/kit';
import { LRUCache } from 'lru-cache';
//@ts-ignore
import { PRIVATE_COINGECKO_API_KEY } from '$env/static/private';
import { PUBLIC_COINGECKO_API_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

// LRU caches - much cleaner!
const symbolCache = new LRUCache<string, string>({
    max: 1000, // max 1000 symbol->ID mappings
    ttl: 24 * 60 * 60 * 1000, // 24 hours
});

const priceCache = new LRUCache<string, number>({
    max: 500, // max 500 price entries
    ttl: 2 * 60 * 1000, // 2 minutes
});

// Simple rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms

function getApiUrl(): string {
    return PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
}

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SwapCast-Frontend/1.0'
    };

    if (PRIVATE_COINGECKO_API_KEY?.trim()) {
        headers['x_cg_demo_api_key'] = PRIVATE_COINGECKO_API_KEY;  // This line is key!
    }

    return headers;
}

async function rateLimit(): Promise<void> {
    const now = Date.now();
    if (lastRequestTime > 0) {
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve =>
                setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
            );
        }
    }
    lastRequestTime = Date.now();
}

/**
 * Find coin ID using search API only
 */
async function findCoinId(symbol: string, fetchFn: typeof fetch): Promise<string | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check LRU cache first
    const cached = symbolCache.get(upperSymbol);
    if (cached) {
        console.log(`[SERVER] Found ${symbol} in cache: ${cached}`);
        return cached;
    }

    try {
        await rateLimit();

        const searchUrl = `${getApiUrl()}/search?query=${encodeURIComponent(symbol)}`;
        console.log(`[SERVER] Making search request to: ${searchUrl}`);
        console.log(`[SERVER] Using headers:`, getHeaders());

        const response = await fetchFn(searchUrl, { headers: getHeaders() });

        console.log(`[SERVER] Search API response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SERVER] Search API error for ${symbol}:`, response.status, errorText);
            return null;
        }

        const searchData = await response.json();
        console.log(`[SERVER] Search results for ${symbol}:`, {
            totalCoins: searchData.coins?.length || 0,
            firstFew: searchData.coins?.slice(0, 5)?.map((c: any) => ({ id: c.id, symbol: c.symbol, name: c.name }))
        });

        // Rest of the function stays the same...
        if (!searchData.coins || !Array.isArray(searchData.coins)) {
            console.warn(`[SERVER] Invalid search response for ${symbol}:`, searchData);
            return null;
        }

        const exactMatch = searchData.coins.find((coin: any) =>
            coin.symbol?.toUpperCase() === upperSymbol
        );

        if (exactMatch) {
            const coinId = exactMatch.id;
            console.log(`[SERVER] Found exact match for ${symbol}: ${coinId}`);
            symbolCache.set(upperSymbol, coinId);
            return coinId;
        }

        console.warn(`[SERVER] No match found for symbol: ${symbol}`);
        return null;

    } catch (err) {
        console.error(`[SERVER] Error searching for coin ${symbol}:`, err);
        return null;
    }
}
/**
 * Get price with LRU cache
 */
async function getPrice(coinId: string, fetchFn: typeof fetch): Promise<number | null> {
    // Check LRU cache first
    const cached = priceCache.get(coinId);
    if (cached !== undefined) {
        return cached;
    }

    try {
        await rateLimit();

        const priceUrl = `${getApiUrl()}/simple/price?ids=${coinId}&vs_currencies=usd`;
        const response = await fetchFn(priceUrl, { headers: getHeaders() });

        if (!response.ok) {
            console.error(`Price API error for ${coinId}:`, response.status);
            return null;
        }

        const priceData = await response.json();

        if (priceData[coinId]?.usd) {
            const price = priceData[coinId].usd;
            priceCache.set(coinId, price); // Cache in LRU
            return price;
        }

        return null;

    } catch (err) {
        console.error(`Error fetching price for ${coinId}:`, err);
        return null;
    }
}

export const GET: RequestHandler = async ({ url, fetch }) => {
    const symbol = url.searchParams.get('symbol');
    console.log(`[SERVER] Received request for symbol: ${symbol}`);

    if (!symbol?.trim()) {
        throw error(400, 'Symbol parameter is required');
    }

    const cleanSymbol = symbol.trim();

    try {
        // Step 1: Find coin ID
        console.log(`[SERVER] Looking for coin ID for: ${cleanSymbol}`);
        const coinId = await findCoinId(cleanSymbol, fetch);
        console.log(`[SERVER] Found coin ID: ${coinId} for symbol: ${cleanSymbol}`);

        if (!coinId) {
            console.log(`[SERVER] No coin ID found for: ${cleanSymbol}`);
            throw error(404, `Cryptocurrency "${cleanSymbol}" not found`);
        }

        // Step 2: Get price
        console.log(`[SERVER] Getting price for coin ID: ${coinId}`);
        const price = await getPrice(coinId, fetch);
        console.log(`[SERVER] Got price: ${price} for coin ID: ${coinId}`);

        if (price === null) {
            console.log(`[SERVER] No price available for coin ID: ${coinId}`);
            throw error(404, `Price not available for ${cleanSymbol}`);
        }

        return json({ price });

    } catch (err: any) {
        console.error(`[SERVER] Error for ${cleanSymbol}:`, err);
        if (err.status) {
            throw err;
        }
        throw error(500, 'Internal server error');
    }
};

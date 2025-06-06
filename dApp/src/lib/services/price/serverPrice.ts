/**
 * Server-backed Price Service
 * 
 * This module provides functions to fetch cryptocurrency prices using
 * the server-side API endpoint that uses the CoinGecko Pro API key.
 */

// Cache for current prices to avoid repeated API calls
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Gets the current price for a cryptocurrency using the server API
 *
 * @param symbol - Symbol of the asset (e.g., 'BTC', 'ETH')
 * @returns Promise resolving to the current price in USD or null if not found
 */
export async function getServerPrice(symbol: string): Promise<number | null> {
    if (!symbol) return null;
    
    // Check cache first
    const now = Date.now();
    const cacheKey = symbol.toUpperCase();

    if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_TTL) {
        return priceCache[cacheKey].price;
    }

    try {
        // Call our server-side API endpoint
        const response = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        if (typeof data.price !== 'number') {
            console.warn(`Invalid price data for ${symbol}:`, data);
            return null;
        }

        // Cache the result
        priceCache[cacheKey] = { price: data.price, timestamp: now };
        
        return data.price;
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return null;
    }
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

    // Process in parallel for better performance
    const results = await Promise.all(
        symbols.map(async (symbol) => {
            const price = await getServerPrice(symbol);
            return { symbol, price };
        })
    );

    // Convert to record format
    return results.reduce(
        (acc, { symbol, price }) => {
            acc[symbol.toUpperCase()] = price;
            return acc;
        },
        {} as Record<string, number | null>
    );
}

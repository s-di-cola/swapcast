import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

interface CachedPrice {
	price: number;
	timestamp: number;
}

const priceCache: Record<string, CachedPrice> = {};
const CACHE_TTL = 60 * 1000;

const SYMBOL_TO_ID: Record<string, string> = {
	'BTC': 'bitcoin',
	'ETH': 'ethereum',
	'WETH': 'ethereum',
	'WBTC': 'bitcoin',
	'USDC': 'usd-coin',
	'USDT': 'tether',
	'DAI': 'dai',
	'SOL': 'solana',
	'MATIC': 'matic-network',
	'LINK': 'chainlink',
	'UNI': 'uniswap',
	'AAVE': 'aave',
	'MKR': 'maker',
	'COMP': 'compound-governance-token'
};

const FALLBACK_PRICES: Record<string, number> = {
	'BTC': 45000,
	'WBTC': 45000,
	'ETH': 2500,
	'WETH': 2500,
	'USDC': 1.0,
	'USDT': 1.0,
	'DAI': 1.0
};

/**
 * Extracts base asset from trading pair
 * @param assetPair - Asset pair string (e.g., "BTC/USDT", "ETH")
 * @returns Base asset symbol
 */
function extractBaseAsset(assetPair: string): string {
	return assetPair.includes('/') ? assetPair.split('/')[0].trim() : assetPair;
}

/**
 * Checks if cached price is still valid
 * @param symbol - Asset symbol
 * @returns Cached price if valid, null otherwise
 */
function getCachedPrice(symbol: string): number | null {
	const cached = priceCache[symbol.toUpperCase()];
	if (!cached) return null;
	
	const now = Date.now();
	const isValid = (now - cached.timestamp) < CACHE_TTL;
	
	return isValid ? cached.price : null;
}

/**
 * Stores price in cache
 * @param symbol - Asset symbol
 * @param price - Price to cache
 */
function setCachedPrice(symbol: string, price: number): void {
	priceCache[symbol.toUpperCase()] = {
		price,
		timestamp: Date.now()
	};
}

/**
 * Creates HTTP headers for CoinGecko API request
 * @returns Headers object
 */
function createAPIHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		'Accept': 'application/json',
		'User-Agent': 'SwapCast-Fixtures/1.0'
	};
	
	const apiKey = process.env.PRIVATE_COINGECKO_API_KEY;
	if (apiKey) {
		headers['X-CG-Pro-API-Key'] = apiKey;
	}
	
	return headers;
}

/**
 * Builds CoinGecko API URL for price request
 * @param coinId - CoinGecko coin ID
 * @returns API URL
 */
function buildAPIUrl(coinId: string): string {
	const baseUrl = process.env.PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
	return `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;
}

/**
 * Fetches price from CoinGecko API
 * @param symbol - Asset symbol
 * @param coinId - CoinGecko coin ID
 * @returns Price in USD or null if failed
 */
async function fetchPriceFromAPI(symbol: string, coinId: string): Promise<number | null> {
	try {
		const url = buildAPIUrl(coinId);
		const headers = createAPIHeaders();
		
		console.log(`Fetching price for ${symbol} (${coinId}) from CoinGecko...`);
		
		const response = await fetch(url, { headers });
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const data = await response.json();
		
		if (!data[coinId] || typeof data[coinId].usd !== 'number') {
			console.warn(`Price not found for ${symbol} (${coinId})`);
			return null;
		}
		
		const price = data[coinId].usd;
		console.log(`Fetched price for ${symbol}: $${price}`);
		
		return price;
	} catch (error) {
		console.error(`Error fetching price for ${symbol}:`, error);
		return null;
	}
}

/**
 * Gets fallback price for common assets
 * @param symbol - Asset symbol (uppercase)
 * @returns Fallback price or null
 */
function getFallbackPrice(symbol: string): number | null {
	const fallbackPrice = FALLBACK_PRICES[symbol];
	if (fallbackPrice) {
		console.log(`Using fallback price for ${symbol}: $${fallbackPrice}`);
		return fallbackPrice;
	}
	return null;
}

/**
 * Gets current price for a cryptocurrency from CoinGecko
 * @param symbol - Symbol of the asset (e.g., 'BTC', 'ETH') or asset pair (e.g., 'BTC/USDT')
 * @returns Promise resolving to current price in USD or null if not found
 */
export async function getCurrentPriceBySymbol(symbol: string): Promise<number | null> {
	if (!symbol) return null;
	
	const baseAsset = extractBaseAsset(symbol);
	const upperSymbol = baseAsset.toUpperCase();
	
	const cachedPrice = getCachedPrice(symbol);
	if (cachedPrice !== null) {
		console.log(`Using cached price for ${symbol}: $${cachedPrice}`);
		return cachedPrice;
	}
	
	const coinId = SYMBOL_TO_ID[upperSymbol];
	if (!coinId) {
		console.warn(`Unknown symbol: ${baseAsset}`);
		return null;
	}
	
	const price = await fetchPriceFromAPI(symbol, coinId);
	if (price !== null) {
		setCachedPrice(symbol, price);
		return price;
	}
	
	const fallbackPrice = getFallbackPrice(upperSymbol);
	if (fallbackPrice !== null) {
		setCachedPrice(symbol, fallbackPrice);
		return fallbackPrice;
	}
	
	return null;
}

/**
 * Gets multiple prices in parallel with rate limiting
 * @param symbols - Array of symbols to fetch
 * @returns Promise resolving to symbol-price mapping
 */
export async function getBatchPrices(symbols: string[]): Promise<Record<string, number | null>> {
	const results: Record<string, number | null> = {};
	
	const promises = symbols.map(async (symbol, index) => {
		if (index > 0) {
			await new Promise(resolve => setTimeout(resolve, 100 * index));
		}
		
		const price = await getCurrentPriceBySymbol(symbol);
		return { symbol: symbol.toUpperCase(), price };
	});
	
	const settled = await Promise.allSettled(promises);
	
	settled.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			results[result.value.symbol] = result.value.price;
		} else {
			console.error(`Failed to fetch price for ${symbols[index]}:`, result.reason);
			results[symbols[index].toUpperCase()] = null;
		}
	});
	
	return results;
}

/**
 * Clears the price cache
 */
export function clearPriceCache(): void {
	Object.keys(priceCache).forEach(key => delete priceCache[key]);
}

/**
 * Gets cache statistics
 * @returns Cache size and entry list
 */
export function getCacheStats(): { size: number; entries: string[] } {
	return {
		size: Object.keys(priceCache).length,
		entries: Object.keys(priceCache)
	};
}
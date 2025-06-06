/**
 * Simplified Price Service for Fixtures
 * 
 * Standalone price service that directly calls CoinGecko API
 * without SvelteKit dependencies for use in fixture generation
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env') });

// Simple cache to avoid hitting API too frequently
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 minute

// Symbol to CoinGecko ID mapping for common cryptocurrencies
const SYMBOL_TO_ID: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum', 
  'WETH': 'ethereum', // Wrapped ETH has same price as ETH
  'WBTC': 'bitcoin',  // Wrapped BTC has same price as BTC
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

/**
 * Extracts the base asset from an asset pair string
 * 
 * @param assetPair - The asset pair string (e.g., "BTC/USDT", "ETH/USDC")
 * @returns The base asset symbol (e.g., "BTC", "ETH")
 */
function extractBaseAsset(assetPair: string): string {
  // If the symbol contains a slash, it's a trading pair
  if (assetPair.includes('/')) {
    // Extract the base asset (first part before the slash)
    return assetPair.split('/')[0].trim();
  }
  
  // Otherwise, return the symbol as is
  return assetPair;
}

/**
 * Gets current price for a cryptocurrency from CoinGecko
 * 
 * @param symbol - Symbol of the asset (e.g., 'BTC', 'ETH') or asset pair (e.g., 'BTC/USDT')
 * @returns Promise resolving to the current price in USD or null if not found
 */
export async function getCurrentPriceBySymbol(symbol: string): Promise<number | null> {
  if (!symbol) return null;
  
  // Extract the base asset if it's a trading pair
  const baseAsset = extractBaseAsset(symbol);
  const upperSymbol = baseAsset.toUpperCase();
  
  // Check cache first
  const now = Date.now();
  const cached = priceCache[symbol.toUpperCase()]; // Keep original symbol for cache key
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Using cached price for ${symbol}: $${cached.price}`);
    return cached.price;
  }
  
  // Get CoinGecko ID for the symbol
  const coinId = SYMBOL_TO_ID[upperSymbol];
  if (!coinId) {
    console.warn(`Unknown symbol: ${baseAsset}`);
    return null;
  }
  
  try {
    // Get API URL from environment or use default
    const baseUrl = process.env.PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
    const url = `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'SwapCast-Fixtures/1.0'
    };
    
    // Add API key if available
    const apiKey = process.env.PRIVATE_COINGECKO_API_KEY;
    if (apiKey) {
      headers['X-CG-Pro-API-Key'] = apiKey;
    }
    
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
    
    // Cache the result using the original symbol as the key
    priceCache[symbol.toUpperCase()] = { price, timestamp: now };
    
    console.log(`Fetched price for ${symbol}: $${price}`);
    return price;
    
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    
    // Return fallback prices for common assets to keep fixtures working
    const fallbackPrices: Record<string, number> = {
      'BTC': 45000,
      'WBTC': 45000,
      'ETH': 2500,
      'WETH': 2500,
      'USDC': 1.0,
      'USDT': 1.0,
      'DAI': 1.0
    };
    
    const fallbackPrice = fallbackPrices[upperSymbol];
    if (fallbackPrice) {
      console.log(`Using fallback price for ${symbol}: $${fallbackPrice}`);
      priceCache[upperSymbol] = { price: fallbackPrice, timestamp: now };
      return fallbackPrice;
    }
    
    return null;
  }
}

/**
 * Gets multiple prices in a single batch (with individual requests for simplicity)
 * 
 * @param symbols - Array of symbols to fetch
 * @returns Promise resolving to a record of symbol to price mappings
 */
export async function getBatchPrices(symbols: string[]): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {};
  
  // Process in parallel but with a small delay to avoid rate limits
  const promises = symbols.map(async (symbol, index) => {
    // Add a small delay to avoid hitting rate limits
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
 * Clears the price cache (useful for testing)
 */
export function clearPriceCache(): void {
  Object.keys(priceCache).forEach(key => delete priceCache[key]);
}

/**
 * Gets cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: Object.keys(priceCache).length,
    entries: Object.keys(priceCache)
  };
}
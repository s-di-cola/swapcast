// lib/services/balance/operations.ts
import { formatUnits } from 'viem';

/**
 * Type definition for cached balance results
 */
type CachedBalance = {
  balance: number;
  timestamp: number;
};

// In-memory cache for balance results to reduce API calls
const balanceCache: Record<string, CachedBalance> = {};
const CACHE_TTL = 30000; // 30 seconds cache lifetime

/**
 * Clears the balance cache for a specific address or all addresses
 * Also attempts to clear server-side cache
 * @param address Optional address to clear cache for. If not provided, clears all cache
 */
export async function clearBalanceCache(address?: string): Promise<void> {
  if (address) {
    console.log(`Clearing balance cache for address: ${address}`);
    // Clear only for the specific address
    Object.keys(balanceCache).forEach(key => {
      if (key.startsWith(`${address}-`)) {
        delete balanceCache[key];
      }
    });
  } else {
    console.log('Clearing all balance cache');
    // Clear all cache
    Object.keys(balanceCache).forEach(key => {
      delete balanceCache[key];
    });
  }
  
  // Also try to clear server-side cache
  try {
    await fetch('/api/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });
  } catch (error) {
    console.error('Failed to clear server-side cache:', error);
  }
}

/**
 * Fetches the token balance for a given address and token symbol
 * Uses server endpoint to query mainnet balances
 * @param address The wallet address to check balance for
 * @param symbol The token symbol (e.g., 'ETH', 'USDC')
 * @returns The token balance as a number
 */
export async function getTokenBalance(address: string, symbol: string): Promise<number> {
  if (!address || !symbol) {
    console.error('Missing required parameters for getTokenBalance');
    return 0;
  }

  // Normalize the symbol to uppercase for consistency
  const normalizedSymbol = symbol.toUpperCase();
  
  // Log the request for debugging
  console.log(`Fetching balance for ${normalizedSymbol} at address ${address}`);

  // Check cache first
  const cacheKey = `${address}-${normalizedSymbol}`;
  if (balanceCache[cacheKey] && Date.now() - balanceCache[cacheKey].timestamp < CACHE_TTL) {
    console.log(`Using cached balance for ${normalizedSymbol}: ${balanceCache[cacheKey].balance}`);
    return balanceCache[cacheKey].balance;
  }

  try {
    // Make API request to get balance
    const url = `/api/balance?address=${address}&symbol=${normalizedSymbol}`;
    console.log(`Making API request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API returned error: ${data.error}`);
    }
    
    // Cache the result
    balanceCache[cacheKey] = {
      balance: data.balance || 0,
      timestamp: Date.now()
    };
    
    console.log(`Successfully fetched ${normalizedSymbol} balance: ${data.balance}`);
    return data.balance || 0;
  } catch (error) {
    console.error(`Error fetching balance for ${normalizedSymbol}:`, error);
    return 0;
  }
}



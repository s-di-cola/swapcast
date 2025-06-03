import { json } from '@sveltejs/kit';
import { Alchemy, Network } from 'alchemy-sdk';
import { formatUnits } from 'viem';
// @ts-ignore
import { PRIVATE_ALCHEMY_API_KEY } from '$env/static/private';
import { PUBLIC_RPC_URL } from '$env/static/public';


// Cache of token addresses we've discovered
const TOKEN_ADDRESSES: Record<string, string> = {};

// Simple in-memory cache for balance results
type CachedBalance = {
  balance: number;
  timestamp: number;
};

const balanceCache: Record<string, CachedBalance> = {};
const CACHE_TTL = 30000; // 30 seconds


/**
 * Creates an Alchemy instance configured to use the RPC URL from environment variables
 * @returns Alchemy instance pointing to the configured RPC URL
 */
function getAlchemyInstance() {
  return new Alchemy({
    // Use the private API key from environment variables
    apiKey: PRIVATE_ALCHEMY_API_KEY,
    // Use the RPC URL from environment variables
    url: PUBLIC_RPC_URL
  });
}

/**
 * GET handler for token balance endpoint
 * @param request The incoming request
 * @returns JSON response with token balance
 */
export async function GET({ url }) {
  const address = url.searchParams.get('address');
  const symbol = url.searchParams.get('symbol');
  
  if (!address || !symbol) {
    return json({ error: 'Missing required parameters' }, { status: 400 });
  }
  
  const now = Date.now();
  const cacheKey = `${address}-${symbol}`;
  if (balanceCache[cacheKey] && now - balanceCache[cacheKey].timestamp < CACHE_TTL) {
    return json({ balance: balanceCache[cacheKey].balance });
  }
  
  try {
    let balance = 0;
    const alchemyClient = getAlchemyInstance();
    
    // Use the symbol as provided
    const tokenSymbol = symbol;
    
    if (tokenSymbol === 'ETH') {
      // Get ETH balance directly from Anvil
      const rawBalance = await alchemyClient.core.getBalance(address);
      balance = parseFloat(formatUnits(BigInt(rawBalance.toString()), 18));
      return json({ balance });
    }
    
    // For tokens, first check our cache of known addresses
    if (TOKEN_ADDRESSES[tokenSymbol]) {
      const tokenBalance = await alchemyClient.core.getTokenBalances(address, [TOKEN_ADDRESSES[tokenSymbol]]);
      
      if (tokenBalance.tokenBalances.length > 0 && tokenBalance.tokenBalances[0].tokenBalance !== '0x0') {
        const meta = await alchemyClient.core.getTokenMetadata(TOKEN_ADDRESSES[tokenSymbol]);
        balance = parseFloat(formatUnits(BigInt(tokenBalance.tokenBalances[0].tokenBalance!), meta.decimals || 18));
        return json({ balance });
      }
    }
    
    // If we don't have the token address cached or the balance was zero, search for it
    const tokens = await alchemyClient.core.getTokenBalances(address);
    
    for (const token of tokens.tokenBalances) {
      if (token.tokenBalance === '0x0') continue;
      
      const meta = await alchemyClient.core.getTokenMetadata(token.contractAddress);
      
      if (meta.symbol === tokenSymbol) {
        balance = parseFloat(formatUnits(BigInt(token.tokenBalance!), meta.decimals || 18));
        
        // Cache the token address for future use
        TOKEN_ADDRESSES[tokenSymbol] = token.contractAddress;
        
        return json({ balance });
      }
    }
    
    // If we get here, we couldn't find the token
    // Cache a zero balance to avoid repeated lookups
    balanceCache[cacheKey] = {
      balance: 0,
      timestamp: now
    };
    
    return json({ balance: 0 });
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return json({ error: 'Failed to fetch token balance' }, { status: 500 });
  }
}

/**
 * POST handler to clear the balance cache
 * @param request The incoming request
 * @returns JSON response indicating success
 */
export async function POST({ request }) {
  try {
    const data = await request.json();
    const address = data.address;
    
    if (address) {
      // Clear cache for specific address
      Object.keys(balanceCache).forEach(key => {
        if (key.startsWith(`${address}-`)) {
          delete balanceCache[key];
        }
      });
      return json({ success: true, message: `Cache cleared for address ${address}` });
    }
    
    // Clear all cache
    Object.keys(balanceCache).forEach(key => {
      delete balanceCache[key];
    });
    // Also clear the token address cache
    Object.keys(TOKEN_ADDRESSES).forEach(key => {
      delete TOKEN_ADDRESSES[key];
    });
    
    return json({ success: true, message: 'All caches cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}

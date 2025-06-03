import { json } from '@sveltejs/kit';
import { formatUnits, createPublicClient, http } from 'viem';
import { getTokenList } from '$lib/services/token';
import { getCurrentNetworkConfig } from '$lib/utils/network';

/**
 * Resolves a token symbol to its token object from the token list.
 * @param symbol Token symbol (e.g., 'USDC')
 * @returns Token object or undefined if not found
 */
async function getTokenBySymbol(symbol: string) {
  const tokens = await getTokenList();
  return tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
}
/**
 * In-memory cache for balance results (per address-symbol combination)
 */
type CachedBalance = {
  balance: number;
  timestamp: number;
};
const balanceCache: Record<string, CachedBalance> = {};
const CACHE_TTL = 30000; // 30 seconds

/**
 * GET handler for token/ETH balance endpoint
 * Accepts:
 *   address: wallet address (required)
 *   symbol: token symbol (e.g. ETH, USDC) (required)
 * Returns: { balance: number }
 */
export async function GET({ url }) {
  const address = url.searchParams.get('address');
  const symbol = url.searchParams.get('symbol');

  if (!address || !symbol) {
    return json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const tokenSymbol = symbol.toUpperCase();
  const cacheKey = `${address}-${tokenSymbol}`;
  const now = Date.now();

  // Early return if cached
  if (balanceCache[cacheKey] && now - balanceCache[cacheKey].timestamp < CACHE_TTL) {
    return json({ balance: balanceCache[cacheKey].balance });
  }

  try {
    let balance = 0;

    // Use viem's createPublicClient for all blockchain calls
    const { rpcUrl, chain } = getCurrentNetworkConfig();
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

    if (tokenSymbol === 'ETH') {
      // Fetch ETH balance using viem
      const rawBalance = await publicClient.getBalance({ address: address as `0x${string}` });
      balance = parseFloat(formatUnits(rawBalance, 18));
    } else {
      // ERC-20: resolve address and decimals from token list
      const tokens = await getTokenList();
      const token = tokens.find(t => t.symbol.toLowerCase() === tokenSymbol.toLowerCase());
      if (!token) {
        return json({ error: `Token symbol not found: ${tokenSymbol}` }, { status: 404 });
      }
      // Minimal ERC-20 ABI for balanceOf
      const erc20Abi = [{
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
      }];
      const rawBalance = await publicClient.readContract({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`]
      });
      balance = parseFloat(formatUnits(rawBalance as bigint, token.decimals!));
    }

    // Cache the result
    balanceCache[cacheKey] = {
      balance,
      timestamp: now
    };

    return json({ balance });
  } catch (error: any) {
    console.error('Error fetching token balance:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return json({ error: 'Failed to fetch token balance', details: error?.message || String(error) }, { status: 500 });
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

    return json({ success: true, message: 'All caches cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}


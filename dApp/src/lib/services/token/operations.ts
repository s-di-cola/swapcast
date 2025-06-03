import type { Token } from '$lib/types';

// Default URL in case the environment variable is not set
const DEFAULT_TOKEN_LIST_URL = 'https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/mainnet.json';

// In-memory cache for token list
let tokenListCache: Token[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Loads the token list from the specified URL or uses the default Uniswap token list
 * Implements caching to avoid excessive network requests
 * @param forceRefresh Force a refresh of the token list even if cached
 * @returns Promise resolving to an array of tokens
 */
export async function getTokenList(forceRefresh = false): Promise<Token[]> {
  const now = Date.now();
  
  // Return cached token list if available and not expired
  if (tokenListCache && !forceRefresh && now - lastFetchTime < CACHE_TTL) {
    return tokenListCache;
  }
  
  try {
    // Use the environment variable if available, otherwise fall back to default
    // TODO: Replace with PUBLIC_TOKEN_LIST_URL from $env/static/public once added to .env
    const tokenListUrl = DEFAULT_TOKEN_LIST_URL;
    
    const response = await fetch(tokenListUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token list: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for Ethereum mainnet tokens (chainId 1)
    const filteredTokens = data.filter((token: Token) => token.chainId === 1);
    tokenListCache = filteredTokens;
    lastFetchTime = now;
    
    return filteredTokens;
  } catch (err: any) {
    console.error('Error fetching token list:', err);
    
    // Return cached list if available, even if expired
    if (tokenListCache) {
      return tokenListCache;
    }
    
    throw err;
  }
}

/**
 * Gets token details by symbol
 * @param symbol Token symbol to look up
 * @returns Token details or undefined if not found
 */
export async function getTokenBySymbol(symbol: string): Promise<Token | undefined> {
  if (!symbol) return undefined;
  
  try {
    const tokenList = await getTokenList();
    return tokenList.find(token => token.symbol === symbol);
  } catch (err) {
    console.error(`Error getting token details for ${symbol}:`, err);
    return undefined;
  }
}

// Common token logo mapping for immediate access without async calls
const COMMON_TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  WETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  USDC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  USDT: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  DAI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  LINK: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',
  UNI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  BTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png'
};

/**
 * Gets token logo URL by symbol
 * @param symbol Token symbol
 * @param useFallback Whether to use the fallback common token logos if token not found
 * @returns Logo URL or undefined if not found
 */
export function getTokenLogoUrl(symbol: string, useFallback = false): string | undefined {
  if (!symbol) return undefined;
  
  // Use common token mapping for immediate access if available
  if (useFallback && COMMON_TOKEN_LOGOS[symbol]) {
    return COMMON_TOKEN_LOGOS[symbol];
  }
  
  // If we have a cached token list, try to find the token there
  if (tokenListCache) {
    const token = tokenListCache.find(t => t.symbol === symbol);
    if (token?.logoURI) return token.logoURI;
  }
  
  // Fall back to common logos if requested
  return useFallback ? COMMON_TOKEN_LOGOS[symbol] : undefined;
}

/**
 * Gets token logo URL by symbol (async version that fetches from token list if needed)
 * @param symbol Token symbol
 * @returns Promise with logo URL or undefined if not found
 */
export async function getTokenLogoUrlAsync(symbol: string): Promise<string | undefined> {
  if (!symbol) return undefined;
  
  try {
    // First check if we can get it synchronously
    const syncLogo = getTokenLogoUrl(symbol, true);
    if (syncLogo) return syncLogo;
    
    // If not, fetch from token list
    const token = await getTokenBySymbol(symbol);
    return token?.logoURI;
  } catch (err) {
    console.error(`Error getting logo URL for ${symbol}:`, err);
    return undefined;
  }
}

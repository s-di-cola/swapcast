/**
 * Token utility functions for handling token addresses, decimals, and other token-related operations
 */
import { createPublicClient, http, type Address, erc20Abi } from 'viem';
import { getCurrentNetworkConfig } from '$lib/utils/network';

const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Cache for token info to avoid repeated network calls
 */
const tokenInfoCache = new Map<string, { decimals: number; symbol: string; name?: string }>();

/**
 * Reverse lookup cache: symbol -> address
 */
const symbolToAddressCache = new Map<string, Address>();

/**
 * Get token decimals using ERC20 ABI call
 *
 * @param address - The token contract address
 * @returns Promise with the token decimals (defaults to 18 for ETH or if call fails)
 */
export async function getTokenDecimals(address: Address): Promise<number> {
    if (address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
        return 18;
    }

    const cacheKey = address.toLowerCase();
    if (tokenInfoCache.has(cacheKey)) {
        return tokenInfoCache.get(cacheKey)!.decimals;
    }

    try {
        const { rpcUrl, chain } = getCurrentNetworkConfig();
        const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl)
        });

        const decimals = await publicClient.readContract({
            address,
            abi: erc20Abi,
            functionName: 'decimals'
        });

        // Update cache with decimals (we might add symbol later)
        const existing = tokenInfoCache.get(cacheKey) || { decimals: 18, symbol: '' };
        tokenInfoCache.set(cacheKey, { ...existing, decimals });

        return decimals;
    } catch (error) {
        console.error(`Failed to fetch decimals for ${address}:`, error);
        return 18;
    }
}

/**
 * Get token symbol from address using ERC20 ABI call
 *
 * @param address - The token contract address
 * @returns Promise with the token symbol
 */
export async function getTokenSymbol(address: Address): Promise<string> {
    if (address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
        return 'ETH';
    }

    const cacheKey = address.toLowerCase();
    if (tokenInfoCache.has(cacheKey) && tokenInfoCache.get(cacheKey)!.symbol) {
        return tokenInfoCache.get(cacheKey)!.symbol;
    }

    try {
        const { rpcUrl, chain } = getCurrentNetworkConfig();
        const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl)
        });

        const symbol = await publicClient.readContract({
            address,
            abi: erc20Abi,
            functionName: 'symbol'
        });

        // Update cache
        const existing = tokenInfoCache.get(cacheKey) || { decimals: 18, symbol: '' };
        tokenInfoCache.set(cacheKey, { ...existing, symbol });

        // Also cache the reverse lookup
        symbolToAddressCache.set(symbol.toUpperCase(), address);

        return symbol;
    } catch (error) {
        console.error(`Failed to fetch symbol for ${address}:`, error);
        return `${address.slice(0, 6)}...`;
    }
}

/**
 * Get complete token info (symbol + decimals) from address
 *
 * @param address - The token contract address
 * @returns Promise with token info
 */
export async function getTokenInfo(address: Address): Promise<{ symbol: string; decimals: number }> {
    if (address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
        return { symbol: 'ETH', decimals: 18 };
    }

    const cacheKey = address.toLowerCase();
    const cached = tokenInfoCache.get(cacheKey);

    if (cached && cached.symbol && cached.decimals) {
        return { symbol: cached.symbol, decimals: cached.decimals };
    }

    try {
        const { rpcUrl, chain } = getCurrentNetworkConfig();
        const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl)
        });

        const [symbol, decimals] = await Promise.all([
            publicClient.readContract({
                address,
                abi: erc20Abi,
                functionName: 'symbol'
            }),
            publicClient.readContract({
                address,
                abi: erc20Abi,
                functionName: 'decimals'
            })
        ]);

        const result = { symbol, decimals };
        tokenInfoCache.set(cacheKey, result);
        symbolToAddressCache.set(symbol.toUpperCase(), address);

        return result;
    } catch (error) {
        console.error(`Failed to fetch token info for ${address}:`, error);
        return {
            symbol: `${address.slice(0, 6)}...`,
            decimals: 18
        };
    }
}

/**
 * Get token address from symbol - DYNAMIC VERSION
 * First checks cache, then you'll need to provide a way to discover tokens
 *
 * @param symbol - The token symbol (e.g., 'ETH', 'USDC')
 * @returns The token contract address
 * @throws Error if the symbol is unknown and not in cache
 */
export function getTokenAddress(symbol: string): Address {
    if (symbol.toUpperCase() === 'ETH') {
        return NATIVE_ETH_ADDRESS as Address;
    }

    // Check if we have this symbol cached from previous contract calls
    const cached = symbolToAddressCache.get(symbol.toUpperCase());
    if (cached) {
        return cached;
    }

    // If not cached, we need a different approach
    // Option 1: You could maintain a minimal list of your deployed test tokens
    // Option 2: You could have a token registry contract
    // Option 3: You could pass the address directly instead of symbol

    console.error(`Unknown token symbol: ${symbol}. This symbol was not discovered from any pool interactions.`);
    console.error('Available cached symbols:', Array.from(symbolToAddressCache.keys()));
    throw new Error(`Unknown token symbol: ${symbol}. Use token address directly or interact with a pool containing this token first.`);
}

/**
 * Check if we know about this token symbol (it's been cached from contract calls)
 *
 * @param symbol - The token symbol to check
 * @returns Whether this symbol is known
 */
export function isKnownTokenSymbol(symbol: string): boolean {
    return symbol.toUpperCase() === 'ETH' || symbolToAddressCache.has(symbol.toUpperCase());
}

/**
 * Get all known token symbols (from cache)
 *
 * @returns Array of known token symbols
 */
export function getKnownTokenSymbols(): string[] {
    return ['ETH', ...Array.from(symbolToAddressCache.keys())];
}

/**
 * Add a token to the cache manually (useful for test setup)
 *
 * @param symbol - Token symbol
 * @param address - Token address
 * @param decimals - Token decimals (optional, will be fetched if not provided)
 */
export async function addTokenToCache(symbol: string, address: Address, decimals?: number): Promise<void> {
    symbolToAddressCache.set(symbol.toUpperCase(), address);

    if (decimals !== undefined) {
        const existing = tokenInfoCache.get(address.toLowerCase()) || { symbol, decimals: 18 };
        tokenInfoCache.set(address.toLowerCase(), { ...existing, symbol, decimals });
    } else {
        // Fetch decimals from contract
        await getTokenInfo(address);
    }
}

/**
 * Clear all token caches (useful for testing or network changes)
 */
export function clearTokenCaches(): void {
    tokenInfoCache.clear();
    symbolToAddressCache.clear();
}

/**
 * Extracts the base asset from an asset pair string
 *
 * @param assetPair - The asset pair string (e.g., "BTC/USDT", "ETH/USDC")
 * @returns The base asset symbol (e.g., "BTC", "ETH")
 */
export function extractBaseAsset(assetPair: string): string {
    if (!assetPair) return '';
    return assetPair.split('/')[0].trim();
}

/**
 * Check if address is native ETH
 */
export function isNativeETH(address: Address): boolean {
    return address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
}

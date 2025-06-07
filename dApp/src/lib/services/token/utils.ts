/**
 * Token utility functions for handling token addresses, decimals, and other token-related operations
 */
import { createPublicClient, http, type Address, erc20Abi } from 'viem';
import { getCurrentNetworkConfig } from '$lib/utils/network';

const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Cache for token decimals to avoid repeated network calls
 */
const decimalsCache = new Map<string, number>();

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
    if (decimalsCache.has(cacheKey)) {
        return decimalsCache.get(cacheKey)!;
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
        
        decimalsCache.set(cacheKey, decimals);
        return decimals;
    } catch (error) {
        console.error(`Failed to fetch decimals for ${address}:`, error);
        return 18;
    }
}

/**
 * Get token address from symbol with native ETH support
 * 
 * @param symbol - The token symbol (e.g., 'ETH', 'USDC')
 * @returns The token contract address
 * @throws Error if the symbol is unknown
 */
export function getTokenAddress(symbol: string): Address {
    const addressMap: Record<string, string> = {
        'ETH': NATIVE_ETH_ADDRESS,
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'BTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
    };

    const address = addressMap[symbol.toUpperCase()];
    if (!address) {
        console.error(`Unknown token symbol: ${symbol}`);
        throw new Error(`Unknown token symbol: ${symbol}`);
    }

    return address as Address;
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

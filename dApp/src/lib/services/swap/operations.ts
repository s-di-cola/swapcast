/**
 * Operations for the swap service
 * @module services/swap/operations
 */

import { http, type Address, keccak256, encodeAbiParameters } from 'viem';
import { getPoolKey } from '$lib/services/market/operations';
import { getStateView } from '$generated/types/StateView';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import { PUBLIC_UNIV4_STATEVIEW_ADDRESS } from '$env/static/public';
import type { PriceFetchResult, SwapQuoteResult } from './types';
import type { PoolKey } from '$lib/services/market/types';

// Constants for price calculations
const Q96 = 2n ** 96n;

/**
 * Calculates a pool ID from a pool key
 * @param poolKey - The pool key object with Uniswap v4 pool parameters
 * @returns The pool ID as a bytes32 string
 */
function calculatePoolId(poolKey: PoolKey): `0x${string}` {
  // Encode the pool key components according to Uniswap v4 spec
  const encodedData = encodeAbiParameters(
    [
      { type: 'address' },  // currency0
      { type: 'address' },  // currency1
      { type: 'uint24' },   // fee
      { type: 'int24' },    // tickSpacing
      { type: 'address' }   // hooks
    ],
    [
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks
    ]
  );
  
  // Hash the encoded data to get the pool ID
  return keccak256(encodedData);
}

/**
 * Creates a StateView contract instance
 * @returns The StateView contract instance
 */
function getStateViewContract() {
  const { rpcUrl, chain } = getCurrentNetworkConfig();
  
  return getStateView({
    address: PUBLIC_UNIV4_STATEVIEW_ADDRESS as Address,
    chain,
    transport: http(rpcUrl)
  });
}

/**
 * Converts sqrtPriceX96 to human-readable price
 * @param sqrtPriceX96 - The sqrt price in X96 format
 * @returns The price as a decimal number
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  // Calculate price = (sqrtPriceX96 / 2^96)^2
  const price = (sqrtPriceX96 * sqrtPriceX96 * 10n**18n) / (Q96 * Q96);
  return Number(price) / 10**18;
}

/**
 * Fetches current prices from a Uniswap v4 pool for a given market
 * @param marketId - The market ID to fetch prices for
 * @returns Promise resolving to PriceFetchResult
 */
export async function fetchPoolPrices(marketId: string | bigint): Promise<PriceFetchResult> {
  try {
    // Get the pool key for the market
    const poolKey = await getPoolKey(marketId);
    if (!poolKey) {
      return { 
        success: false, 
        error: `Failed to get pool key for market ID ${marketId}` 
      };
    }

    // Get the StateView contract
    const stateView = getStateViewContract();

    // Calculate the pool ID from the pool key
    const poolId = calculatePoolId(poolKey);
    
    // Get the slot0 data from the pool
    const slot0Data = await stateView.read.getSlot0([poolId]);
    
    // Destructure the slot0 data
    const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0Data;
    
    // Calculate token prices
    const token0Price = sqrtPriceX96ToPrice(sqrtPriceX96);
    const token1Price = 1 / token0Price;
    
    return {
      success: true,
      prices: {
        sqrtPriceX96,
        tick,
        token0Price,
        token1Price,
        protocolFee: Number(protocolFee),
        lpFee: Number(lpFee)
      }
    };
  } catch (error) {
    console.error('Error fetching pool prices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching pool prices'
    };
  }
}

/**
 * Calculates a swap quote based on current pool prices
 * @param marketId - The market ID
 * @param tokenIn - The input token address
 * @param amountIn - The input amount
 * @returns Promise resolving to SwapQuoteResult
 */
export async function getSwapQuote(
  marketId: string | bigint,
  tokenIn: Address,
  amountIn: bigint
): Promise<SwapQuoteResult> {
  try {
    // Get current pool prices first
    const priceResult = await fetchPoolPrices(marketId);
    if (!priceResult.success) {
      return {
        success: false,
        error: priceResult.error || 'Failed to fetch pool prices'
      };
    }
    
    // Get the pool key for the market
    const poolKey = await getPoolKey(marketId);
    if (!poolKey) {
      return { 
        success: false, 
        error: `Failed to get pool key for market ID ${marketId}` 
      };
    }
    
    // Determine if tokenIn is token0 or token1
    const isToken0 = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
    const isToken1 = tokenIn.toLowerCase() === poolKey.currency1.toLowerCase();
    
    if (!isToken0 && !isToken1) {
      return {
        success: false,
        error: 'Token is not part of this pool'
      };
    }
    
    // Get the price from the pool data
    const { token0Price, token1Price, sqrtPriceX96 } = priceResult.prices!;
    
    // Check if the pool has no liquidity (sqrtPriceX96 is 0)
    if (sqrtPriceX96 === 0n) {
      return {
        success: false,
        error: 'ZERO_LIQUIDITY_POOL',
        details: 'This pool has no liquidity. Swap quotes cannot be calculated.'
      };
    }
    
    // Calculate the output amount based on which token is being swapped
    const price = isToken0 ? token0Price : token1Price;
    
    // Apply a 0.3% fee (standard Uniswap fee) - this is simplified and doesn't account for slippage
    const feeMultiplier = 0.997; // 1 - 0.003 (0.3% fee)
    
    // Determine decimals for the tokens (using 18 as default for ETH-like tokens)
    const decimals = 18;
    
    // Calculate output amount: amountIn * price * feeMultiplier
    // Convert amountIn to a decimal number first, maintaining precision
    const amountInDecimal = Number(amountIn) / 10**18; // Convert from wei to ether
    const amountOutDecimal = amountInDecimal * price * feeMultiplier;
    
    // Convert back to wei (bigint)
    const amountOut = BigInt(Math.floor(amountOutDecimal * 10**18));
    
    // Determine the output token address
    const tokenOut = isToken0 ? poolKey.currency1 : poolKey.currency0;
    
    return {
      success: true,
      quote: {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        price,
        priceImpact: 0.003, // Simplified price impact calculation (0.3%)
        fee: BigInt(Math.floor(amountInDecimal * 0.003 * 10**18)) // 0.3% fee
      }
    };
  } catch (error) {
    console.error('Error calculating swap quote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calculating swap quote'
    };
  }
}

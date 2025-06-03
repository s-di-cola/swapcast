/**
 * Types for the swap service
 * @module services/swap/types
 */

import type { Address } from 'viem';

/**
 * Pool price information
 */
export interface PoolPrices {
  /** Current sqrt price X96 from the pool */
  sqrtPriceX96: bigint;
  
  /** Current tick from the pool */
  tick: number;
  
  /** Price of token0 in terms of token1 */
  token0Price: number;
  
  /** Price of token1 in terms of token0 */
  token1Price: number;
  
  /** Protocol fee percentage */
  protocolFee: number;
  
  /** LP fee percentage */
  lpFee: number;
}

/**
 * Result of a price fetch operation
 */
export interface PriceFetchResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Pool prices if successful */
  prices?: PoolPrices;
  
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Swap quote information
 */
export interface SwapQuote {
  /** Input token address */
  tokenIn: Address;
  
  /** Output token address */
  tokenOut: Address;
  
  /** Input amount */
  amountIn: bigint;
  
  /** Expected output amount */
  amountOut: bigint;
  
  /** Exchange rate */
  price: number;
  
  /** Price impact percentage */
  priceImpact: number;
  
  /** Fee amount in input token */
  fee: bigint;
}

/**
 * Result of a swap quote operation
 */
export interface SwapQuoteResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Swap quote if successful */
  quote?: SwapQuote;
  
  /** Error message if unsuccessful */
  error?: string;
}

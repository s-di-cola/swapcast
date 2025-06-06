/**
 * Swap service for interacting with Uniswap v4 pools
 * @module services/swap
 */

// Import and re-export types
export type { PriceFetchResult, SwapQuoteResult, PoolPrices, SwapQuote } from './types.js';

// Import and re-export operations
export { 
  fetchPoolPrices, 
  getSwapQuote, 
  executeSwapWithPrediction,
  encodePredictionHookData,
  PredictionTypes
} from './operations.js';
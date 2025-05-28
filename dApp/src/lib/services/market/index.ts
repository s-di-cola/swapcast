/**
 * Market Service - Main Entry Point
 * 
 * This is the main entry point for market-related operations.
 * It re-exports all functionality from the sub-modules for easy importing.
 * 
 * @example
 * ```typescript
 * import { getAllMarkets, createMarket, getMarketDetails } from '$lib/services/market/marketService';
 * ```
 */

// Re-export all types
export type {
	MarketStatus,
	MarketSortField,
	SortDirection,
	PredictionSide,
	MarketPaginationOptions,
	PaginatedMarkets,
	Market,
	MarketCreationResult,
	PoolOperationResult,
	PoolKey,
	MarketDetailsResult
} from './types';

// Re-export contract functions
export { 
	getMarketCount,
    getMarketDetails
} from './contracts';

// Re-export operations
export {
	getActiveMarketsCount,
	getAllMarkets,
	createMarket,
	getOrCreateMarketPool
} from './operations';

// Re-export utilities if needed externally
export {
	getMarketStatus,
	sortMarkets,
	applyDefaultSort
} from './utils';
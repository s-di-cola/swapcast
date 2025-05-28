/**
 * Subgraph Service - Main Entry Point
 * 
 * This is the main entry point for subgraph-related operations.
 * It re-exports all functionality from the sub-modules for easy importing.
 * 
 * @example
 * ```typescript
 * import { 
 *   getMarketPredictions, 
 *   formatPredictionOutcome, 
 *   formatTimestamp 
 * } from '$lib/services/subgraph/subgraphService';
 * ```
 */

// Re-export all types
export type {
	SubgraphPaginationOptions,
	SubgraphPaginatedResponse,
	SubgraphUser,
	SubgraphMarketRef,
	SubgraphMarket,
	SubgraphPrediction,
	SubgraphUserPrediction,
	SubgraphMarketStats,
	PredictionOutcome,
	OutcomeLabel,
	QueryVariables,
	GraphQLResponse
} from './types';

// Re-export main operations
export {
	getMarketPredictions,
	getMarketFromSubgraph,
	getUserPredictions,
	getRecentPredictions,
	getAllMarketsFromSubgraph,
	searchMarkets,
	getMarketStatistics,
	batchGetMarkets
} from './operations';

// Re-export utility functions
export {
	formatPredictionOutcome,
	formatTimestamp,
	formatAmount,
	calculatePagination,
	calculateMarketStats,
	isPredictionWinning,
	isValidSubgraphUrl,
	sanitizeGraphQLVariable,
	serializeBigInts
} from './utils';

// Re-export client utilities
export {
	graphQLClient,
	executeQuery,
	checkSubgraphHealth,
	getSubgraphMeta
} from './client';

// Re-export query constants (for advanced usage)
export {
	GET_MARKET_PREDICTIONS,
	GET_MARKET_DETAILS,
	GET_USER_PREDICTIONS,
	GET_MARKET_STATS,
	GET_RECENT_PREDICTIONS,
	GET_ALL_MARKETS,
	SEARCH_MARKETS
} from './queries';
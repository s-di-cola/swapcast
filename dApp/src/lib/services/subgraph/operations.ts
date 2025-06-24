/**
 * Subgraph Operations
 *
 * High-level operations for fetching and processing subgraph data
 */

import { executeQuery } from './client';
import { calculatePagination, calculateMarketStats, isPredictionWinning } from './utils';
import {
	GET_MARKET_PREDICTIONS,
	GET_MARKET_DETAILS,
	GET_USER_PREDICTIONS,
	GET_MARKET_STATS,
	GET_RECENT_PREDICTIONS,
	GET_ALL_MARKETS,
	SEARCH_MARKETS
} from './queries';
import type {
	SubgraphPrediction,
	SubgraphMarket,
	SubgraphUserPrediction,
	SubgraphMarketStats,
	SubgraphPaginationOptions,
	SubgraphPaginatedResponse
} from './types';

/**
 * Fetches predictions (transactions) for a specific market with pagination support
 *
 * @param marketId - ID of the market to fetch predictions for
 * @param limit - Maximum number of predictions to fetch (default: 10)
 * @param page - Page number for pagination (default: 1)
 * @returns Promise resolving to an array of predictions
 *
 * @example
 * ```typescript
 * const predictions = await getMarketPredictions('123', 20, 1);
 * // Process the returned predictions array
 * ```
 */
export async function getMarketPredictions(
	marketId: string,
	limit: number = 10,
	page: number = 1
): Promise<SubgraphPrediction[]> {
	const { skip, limit: validatedLimit } = calculatePagination({ limit, page });

	const variables = {
		marketId,
		limit: validatedLimit,
		skip
	};

	try {
		const result = await executeQuery<{ predictions: SubgraphPrediction[] }>(
			GET_MARKET_PREDICTIONS,
			variables
		);

		return result?.predictions || [];
	} catch (error) {
		console.error(`Error fetching predictions for market ${marketId}:`, error);
		return [];
	}
}

/**
 * Fetches a specific market's details from the subgraph
 *
 * @param marketId - ID of the market to fetch
 * @returns Promise resolving to the market details or null if not found
 *
 * @example
 * ```typescript
 * const market = await getMarketFromSubgraph('123');
 * if (market) {
 *   // Access market properties like description
 * }
 * ```
 */
export async function getMarketFromSubgraph(marketId: string): Promise<SubgraphMarket | null> {
	try {
		const result = await executeQuery<{ market: SubgraphMarket | null }>(GET_MARKET_DETAILS, {
			marketId
		});

		return result?.market || null;
	} catch (error) {
		console.error(`Error fetching market ${marketId}:`, error);
		return null;
	}
}

/**
 * Fetches a user's prediction history with pagination
 *
 * @param userAddress - Ethereum address of the user
 * @param options - Pagination options
 * @returns Promise resolving to user's predictions
 *
 * @example
 * ```typescript
 * const predictions = await getUserPredictions('0x123...', { limit: 50, page: 1 });
 * // Process the returned user predictions array
 * ```
 */
export async function getUserPredictions(
	userAddress: string,
	options: SubgraphPaginationOptions = {}
): Promise<SubgraphUserPrediction[]> {
	const { skip, limit } = calculatePagination(options);

	const variables = {
		userAddress: userAddress.toLowerCase(),
		limit,
		skip
	};

	try {
		const result = await executeQuery<{ predictions: SubgraphPrediction[] }>(
			GET_USER_PREDICTIONS,
			variables
		);

		if (!result?.predictions) {
			return [];
		}

		// Transform to user prediction format with winning status and market resolution info
		return result.predictions.map((prediction) => {
			const market = prediction.market as SubgraphMarket;
			const winningOutcome = market.winningOutcome;
			const isResolved = market.isResolved;

			return {
				id: prediction.id, // This is now the tokenId
				tokenId: prediction.tokenId || prediction.id, // Ensure tokenId is always present
				marketId: market.id,
				marketDescription: market.description || market.name || 'Unknown Market',
				outcome: prediction.outcome,
				amount: prediction.amount,
				timestamp: prediction.timestamp,
				claimed: prediction.claimed,
				reward: prediction.reward,
				isWinning: isResolved ? isPredictionWinning(prediction.outcome, winningOutcome) : undefined,
				marketIsResolved: isResolved,
				marketWinningOutcome: winningOutcome
			};
		});
	} catch (error) {
		console.error(`Error fetching predictions for user ${userAddress}:`, error);
		return [];
	}
}

/**
 * Fetches recent predictions across all markets
 *
 * @param options - Pagination options
 * @returns Promise resolving to recent predictions
 *
 * @example
 * ```typescript
 * const recent = await getRecentPredictions({ limit: 100 });
 * // Process the returned recent predictions array
 * ```
 */
export async function getRecentPredictions(
	options: SubgraphPaginationOptions = {}
): Promise<SubgraphPrediction[]> {
	const { skip, limit } = calculatePagination(options);

	const variables = { limit, skip };

	try {
		const result = await executeQuery<{ predictions: SubgraphPrediction[] }>(
			GET_RECENT_PREDICTIONS,
			variables
		);

		return result?.predictions || [];
	} catch (error) {
		console.error('Error fetching recent predictions:', error);
		return [];
	}
}

/**
 * Fetches all markets with pagination
 *
 * @param options - Pagination options
 * @returns Promise resolving to paginated markets
 *
 * @example
 * ```typescript
 * const markets = await getAllMarketsFromSubgraph({ limit: 20, page: 1 });
 * // Process the returned paginated markets
 * ```
 */
export async function getAllMarketsFromSubgraph(
	options: SubgraphPaginationOptions = {}
): Promise<SubgraphPaginatedResponse<SubgraphMarket>> {
	const { skip, limit } = calculatePagination(options);

	const variables = { limit, skip };

	try {
		const result = await executeQuery<{ markets: SubgraphMarket[] }>(GET_ALL_MARKETS, variables);

		const markets = result?.markets || [];

		return {
			data: markets,
			hasMore: markets.length === limit
		};
	} catch (error) {
		console.error('Error fetching all markets:', error);
		return { data: [], hasMore: false };
	}
}

/**
 * Searches markets by name/description
 *
 * @param searchTerm - Search term to match against market names/descriptions
 * @param limit - Maximum number of results (default: 20)
 * @returns Promise resolving to matching markets
 *
 * @example
 * ```typescript
 * const markets = await searchMarkets('ethereum', 10);
 * // Process the returned matching markets array
 * ```
 */
export async function searchMarkets(
	searchTerm: string,
	limit: number = 20
): Promise<SubgraphMarket[]> {
	if (!searchTerm.trim()) {
		return [];
	}

	const variables = {
		searchTerm: searchTerm.trim(),
		limit
	};

	try {
		const result = await executeQuery<{ markets: SubgraphMarket[] }>(SEARCH_MARKETS, variables);

		return result?.markets || [];
	} catch (error) {
		console.error(`Error searching markets with term "${searchTerm}":`, error);
		return [];
	}
}

/**
 * Fetches comprehensive market statistics
 *
 * @param marketId - ID of the market
 * @returns Promise resolving to market statistics
 *
 * @example
 * ```typescript
 * const stats = await getMarketStatistics('123');
 * // Access stats properties like totalPredictions
 * ```
 */
export async function getMarketStatistics(marketId: string): Promise<SubgraphMarketStats | null> {
	try {
		const result = await executeQuery<{
			market: {
				id: string;
				totalStakedOutcome0: string;
				totalStakedOutcome1: string;
				predictions: SubgraphPrediction[];
			};
		}>(GET_MARKET_STATS, { marketId });

		if (!result?.market) {
			return null;
		}

		return calculateMarketStats(result.market.predictions);
	} catch (error) {
		console.error(`Error fetching statistics for market ${marketId}:`, error);
		return null;
	}
}

/**
 * Batch fetch multiple markets by IDs
 *
 * @param marketIds - Array of market IDs to fetch
 * @returns Promise resolving to array of markets
 *
 * @example
 * ```typescript
 * const markets = await batchGetMarkets(['123', '456', '789']);
 * // Process the returned markets array
 * ```
 */
export async function batchGetMarkets(marketIds: string[]): Promise<SubgraphMarket[]> {
	if (!marketIds.length) {
		return [];
	}

	// Execute requests in parallel but limit concurrency
	const BATCH_SIZE = 10;
	const results: SubgraphMarket[] = [];

	for (let i = 0; i < marketIds.length; i += BATCH_SIZE) {
		const batch = marketIds.slice(i, i + BATCH_SIZE);
		const batchPromises = batch.map((id) => getMarketFromSubgraph(id));
		const batchResults = await Promise.all(batchPromises);

		// Filter out null results
		results.push(...batchResults.filter((market): market is SubgraphMarket => market !== null));
	}

	return results;
}

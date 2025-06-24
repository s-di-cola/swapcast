/**
 * Subgraph Service Types
 *
 * Type definitions for The Graph subgraph data structures
 */

/**
 * Pagination parameters for subgraph queries
 */
export interface SubgraphPaginationOptions {
	limit?: number;
	page?: number;
	skip?: number;
}

/**
 * Base response structure for paginated subgraph queries
 */
export interface SubgraphPaginatedResponse<T> {
	data: T[];
	totalCount?: number;
	hasMore?: boolean;
}

/**
 * User entity from subgraph
 */
export interface SubgraphUser {
	id: string;
	address: string;
}

/**
 * Market entity reference from subgraph (used in predictions)
 */
export interface SubgraphMarketRef {
	id: string;
	name: string;
	description?: string; // Alias for name
	isResolved: boolean;
	winningOutcome?: number;
}

/**
 * Complete market data from subgraph
 */
export interface SubgraphMarket {
	id: string;
	marketId: string;
	name: string;
	assetSymbol: string;
	description?: string; // Alias for name for backward compatibility
	creationTimestamp: string;
	expirationTimestamp: string;
	priceAggregator: string;
	priceThreshold: string;
	isResolved: boolean;
	winningOutcome?: number;
	finalPrice?: string;
	totalStakedOutcome0: string;
	totalStakedOutcome1: string;
}

/**
 * Prediction/transaction data from subgraph
 * Note: id is now the tokenId (unique NFT token ID)
 */
export interface SubgraphPrediction {
	id: string; // This is now the tokenId
	tokenId: string; // Same as id, but explicit for clarity
	market: SubgraphMarketRef;
	user: SubgraphUser;
	outcome: number;
	amount: string;
	timestamp: string;
	claimed: boolean;
	reward: string | null;
}

/**
 * User's prediction history
 * Note: id and tokenId are now the same value since we use tokenId as primary key
 */
export interface SubgraphUserPrediction {
	id: string; // This is now the tokenId
	tokenId: string; // Same as id
	marketId: string;
	marketDescription: string;
	outcome: number;
	amount: string;
	timestamp: string;
	claimed: boolean;
	reward: string | null;
	isWinning?: boolean;
	marketIsResolved: boolean;
	marketWinningOutcome?: number;
}

/**
 * Market statistics from subgraph
 */
export interface SubgraphMarketStats {
	id: string;
	totalPredictions: number;
	totalStaked: string;
	uniqueUsers: number;
	averageStake: string;
}

/**
 * Global statistics from subgraph
 */
export interface SubgraphGlobalStats {
	id: string;
	totalMarkets: string;
	totalPredictions: string;
	totalStaked: string;
	totalUsers: string;
	totalClaimed: string;
	totalProtocolFees: string;
}

/**
 * Market resolution entity from subgraph
 */
export interface SubgraphMarketResolution {
	id: string; // Market ID
	market: SubgraphMarketRef;
	winningOutcome: number;
	finalPrice: string;
	resolutionTimestamp: string;
}

/**
 * Outcome labels mapping
 */
export type PredictionOutcome = 0 | 1;
export type OutcomeLabel = 'Bearish' | 'Bullish';

/**
 * Query variables for GraphQL requests
 */
export interface QueryVariables {
	[key: string]: any;
}

/**
 * GraphQL query response wrapper
 */
export interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{
		message: string;
		locations?: Array<{ line: number; column: number }>;
		path?: string[];
	}>;
}

/**
 * Type guard to check if a prediction has a valid tokenId
 */
export function hasValidTokenId(prediction: any): prediction is SubgraphPrediction & { tokenId: string } {
	return prediction && typeof prediction.tokenId === 'string' && prediction.tokenId.length > 0;
}

/**
 * Type guard to check if a market is resolved
 */
export function isMarketResolved(market: SubgraphMarket | SubgraphMarketRef): market is (SubgraphMarket | SubgraphMarketRef) & { winningOutcome: number } {
	return market.isResolved && typeof market.winningOutcome === 'number';
}

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
 * Market entity from subgraph
 */
export interface SubgraphMarketRef {
	id: string;
	description: string;
}

/**
 * Complete market data from subgraph
 */
export interface SubgraphMarket {
	id: string;
	marketId: string;
	description: string;
	creationTimestamp: string;
	expirationTimestamp: string;
	isResolved: boolean;
	winningOutcome?: number;
	finalPrice?: string;
	totalStakedOutcome0: string;
	totalStakedOutcome1: string;
	baseToken: string;
	quoteToken: string;
	priceThreshold: string;
}

/**
 * Prediction/transaction data from subgraph
 */
export interface SubgraphPrediction {
	id: string;
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
 */
export interface SubgraphUserPrediction {
	id: string;
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

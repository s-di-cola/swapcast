/**
 * Market Service Types
 * 
 * Type definitions for the market service module
 */

import type { Address, Hash } from 'viem';

/**
 * Possible states of a prediction market
 */
export type MarketStatus = 'Open' | 'Expired' | 'Resolved';

/**
 * Fields available for sorting markets
 */
export type MarketSortField = 'id' | 'name' | 'assetPair' | 'status' | 'expirationTime' | 'priceThreshold' | 'totalStake';

/**
 * Sort direction options
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Prediction outcome options
 */
export type PredictionSide = 'above_target' | 'below_target' | undefined;

/**
 * Configuration options for paginating market results
 */
export interface MarketPaginationOptions {
	page: number;
	pageSize: number;
	sortField?: MarketSortField;
	sortDirection?: SortDirection;
}

/**
 * Paginated market results with metadata
 */
export interface PaginatedMarkets {
	markets: Market[];
	totalCount: number;
	totalPages: number;
	currentPage: number;
}

/**
 * Complete market information structure
 */
export interface Market {
	/** Unique identifier for the market */
	id: string;
	/** Human-readable market name/description */
	name: string;
	/** Symbol of the primary asset */
	assetSymbol: string;
	/** Trading pair (e.g., "ETH/USDC") */
	assetPair: string;
	/** Whether the market exists on-chain */
	exists: boolean;
	/** Whether the market has been resolved */
	resolved: boolean;
	/** Winning outcome (0 or 1) if resolved */
	winningOutcome: number;
	/** Total stake for bearish predictions */
	totalStake0: bigint;
	/** Total stake for bullish predictions */
	totalStake1: bigint;
	/** Unix timestamp when market expires */
	expirationTime: number;
	/** Address of the price oracle */
	priceAggregator: Address;
	/** Price threshold for the prediction */
	priceThreshold: number;
	/** Current market status */
	status: MarketStatus;
	/** Human-readable expiration display */
	expirationDisplay: string;
	/** Total stake across both sides (formatted) */
	totalStake: string;
}

/**
 * Result of market creation operation
 */
export interface MarketCreationResult {
	success: boolean;
	message: string;
	hash?: Hash;
	marketId?: string;
}

/**
 * Result of pool creation/verification operation
 */
export interface PoolOperationResult {
	poolExists: boolean;
	poolCreated: boolean;
	hash?: Hash;
	error?: string;
	info?: string;
}

/**
 * Pool key structure for Uniswap v4
 */
export interface PoolKey {
	currency0: Address;
	currency1: Address;
	fee: number;
	tickSpacing: number;
	hooks: Address;
}

/**
 * Raw market details from smart contract
 */
export interface MarketDetailsResult {
	marketId: bigint;
	description: string;
	assetPair: string;
	exists: boolean;
	resolved: boolean;
	winningOutcome: number;
	totalConvictionBearish: bigint;
	totalConvictionBullish: bigint;
	expirationTimestamp: bigint;
	priceOracle: Address;
	priceThreshold: bigint;
}
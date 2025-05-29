/**
 * Market Utilities
 *
 * Helper functions for market operations
 */

import type { Address } from 'viem';
import type {
	Market,
	MarketStatus,
	MarketSortField,
	SortDirection,
	MarketDetailsResult
} from './types';

/**
 * Time constants for calculations
 */
export const TIME_CONSTANTS = {
	SECONDS_PER_MINUTE: 60,
	SECONDS_PER_HOUR: 3600,
	SECONDS_PER_DAY: 86400
} as const;

/**
 * Status priority for default sorting (Open > Expired > Resolved)
 */
export const STATUS_PRIORITY: Record<MarketStatus, number> = {
	Open: 1,
	Expired: 2,
	Resolved: 3
} as const;

/**
 * Default Chainlink ETH/USD price feed address on mainnet
 */
export const DEFAULT_ETH_USD_PRICE_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as Address;

/**
 * Determines market status and expiration display based on resolution and time
 *
 * @param resolved - Whether the market has been resolved
 * @param timeRemaining - Seconds until expiration (negative if expired)
 * @returns Object with status and human-readable expiration display
 */
export function getMarketStatus(
	resolved: boolean,
	timeRemaining: number
): { status: MarketStatus; expirationDisplay: string } {
	if (resolved) {
		return { status: 'Resolved', expirationDisplay: 'Resolved' };
	}

	if (timeRemaining <= 0) {
		return { status: 'Expired', expirationDisplay: 'Expired' };
	}

	const days = Math.floor(timeRemaining / TIME_CONSTANTS.SECONDS_PER_DAY);
	const hours = Math.floor(
		(timeRemaining % TIME_CONSTANTS.SECONDS_PER_DAY) / TIME_CONSTANTS.SECONDS_PER_HOUR
	);
	const minutes = Math.floor(
		(timeRemaining % TIME_CONSTANTS.SECONDS_PER_HOUR) / TIME_CONSTANTS.SECONDS_PER_MINUTE
	);

	let expirationDisplay = `${minutes}m`;
	if (days > 0) {
		expirationDisplay = `${days}d ${hours}h`;
	} else if (hours > 0) {
		expirationDisplay = `${hours}h ${minutes}m`;
	}

	return { status: 'Open', expirationDisplay };
}

/**
 * Creates a default market object for error cases or non-existent markets
 *
 * @param id - Market ID
 * @returns Default market with safe values
 */
export function createDefaultMarket(id: bigint): Market {
	const { status, expirationDisplay } = getMarketStatus(false, -1);

	return {
		id: id.toString(),
		name: `Market ${id}`,
		assetSymbol: 'Unknown',
		assetPair: 'Unknown',
		exists: false,
		resolved: false,
		winningOutcome: 0,
		totalStake0: BigInt(0),
		totalStake1: BigInt(0),
		expirationTime: 0,
		priceAggregator: '0x0000000000000000000000000000000000000000' as Address,
		priceThreshold: 0,
		status,
		expirationDisplay,
		totalStake: '0'
	};
}

/**
 * Transforms raw contract data into Market interface
 *
 * @param details - Raw market details from contract
 * @returns Properly formatted Market object
 */
export function transformMarketDetails(details: MarketDetailsResult): Market {
	const now = Math.floor(Date.now() / 1000);
	const timeRemaining = Number(details.expirationTimestamp) - now;
	const { status, expirationDisplay } = getMarketStatus(details.resolved, timeRemaining);
	
	// Convert bigint values to proper number format for display
	// Using formatEther would be better but we'll use simple division for now
	const bearishStake = Number(details.totalConvictionBearish) / 1e18;
	const bullishStake = Number(details.totalConvictionBullish) / 1e18;
	const totalStakeValue = bearishStake + bullishStake;
	
	return {
		id: details.marketId.toString(),
		name: details.description || `Market ${details.marketId}`,
		assetSymbol: details.assetPair,
		assetPair: details.assetPair,
		exists: details.exists,
		resolved: details.resolved,
		winningOutcome: details.winningOutcome,
		totalStake0: details.totalConvictionBearish,
		totalStake1: details.totalConvictionBullish,
		expirationTime: Number(details.expirationTimestamp),
		priceAggregator: details.priceOracle,
		// Ensure price threshold is properly formatted
		priceThreshold: Number(details.priceThreshold) / 1e18, // Convert from wei
		status,
		expirationDisplay,
		// Format totalStake as a string with proper decimal representation
		totalStake: totalStakeValue.toString()
	};
}

/**
 * Sorts markets based on specified field and direction
 *
 * @param markets - Array of markets to sort
 * @param sortField - Field to sort by
 * @param sortDirection - Direction to sort (asc/desc)
 * @returns New sorted array of markets
 */
export function sortMarkets(
	markets: Market[],
	sortField: MarketSortField,
	sortDirection: SortDirection
): Market[] {
	return [...markets].sort((a, b) => {
		let comparison = 0;

		switch (sortField) {
			case 'id':
				comparison = Number(a.id) - Number(b.id);
				break;
			case 'name':
				comparison = a.name.localeCompare(b.name);
				break;
			case 'assetPair':
				comparison = a.assetPair.localeCompare(b.assetPair);
				break;
			case 'status':
				comparison = a.status.localeCompare(b.status);
				break;
			case 'expirationTime':
				comparison = a.expirationTime - b.expirationTime;
				break;
			case 'priceThreshold':
				comparison = a.priceThreshold - b.priceThreshold;
				break;
			case 'totalStake':
				comparison = parseFloat(a.totalStake) - parseFloat(b.totalStake);
				break;
			default:
				comparison = 0;
		}

		return sortDirection === 'asc' ? comparison : -comparison;
	});
}

/**
 * Applies default sorting logic to markets (Open > Expired > Resolved, newest first within each status)
 *
 * @param markets - Array of markets to sort
 * @returns Sorted array with default logic applied
 */
export function applyDefaultSort(markets: Market[]): Market[] {
	return markets.sort((a, b) => {
		// First sort by status priority
		const statusComparison = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
		if (statusComparison !== 0) return statusComparison;

		// Within same status, sort by ID descending (newest first)
		return Number(b.id) - Number(a.id);
	});
}

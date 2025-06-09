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
 * Extracts asset symbol from asset pair string with better fallbacks
 *
 * @param assetPair - The asset pair string (e.g., "BTC/USDT", "ETH/USDC")
 * @param description - Market description as fallback
 * @returns The base asset symbol (e.g., "BTC", "ETH") or fallback
 */
function extractAssetSymbol(assetPair: string | undefined | null, description?: string): string {
	// Try to extract from assetPair first
	if (assetPair && typeof assetPair === 'string' && assetPair.trim() !== '') {
		// If the symbol contains a slash, it's a trading pair
		if (assetPair.includes('/')) {
			// Extract the base asset (first part before the slash)
			const baseAsset = assetPair.split('/')[0].trim();
			if (baseAsset) return baseAsset;
		} else {
			// Otherwise, return the symbol as is (if it's not empty)
			const trimmed = assetPair.trim();
			if (trimmed) return trimmed;
		}
	}

	// Try to extract from description as fallback
	if (description && typeof description === 'string') {
		// Look for common patterns like "ETH/USD", "BTC price", etc.
		const patterns = [
			/([A-Z]{2,5})\/[A-Z]{2,5}/i, // ETH/USD pattern
			/([A-Z]{2,5})\s+price/i,     // "ETH price" pattern
			/price.*?([A-Z]{2,5})/i,     // "price of ETH" pattern
			/([A-Z]{2,5})\s+prediction/i // "ETH prediction" pattern
		];

		for (const pattern of patterns) {
			const match = description.match(pattern);
			if (match && match[1]) {
				return match[1].toUpperCase();
			}
		}
	}

	// Final fallback
	return 'ETH'; // Default to ETH instead of 'Unknown'
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
		assetSymbol: 'ETH',
		assetPair: 'ETH/USD',
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
 * Transforms raw contract data into Market interface with better price handling
 *
 * @param details - Raw market details from contract
 * @returns Properly formatted Market object
 */
export function transformMarketDetails(details: MarketDetailsResult): Market {
	const now = Math.floor(Date.now() / 1000);
	const timeRemaining = Number(details.expirationTimestamp) - now;
	const { status, expirationDisplay } = getMarketStatus(details.resolved, timeRemaining);

	// Convert bigint values to proper number format for display
	const bearishStake = Number(details.totalConvictionBearish) / 1e18;
	const bullishStake = Number(details.totalConvictionBullish) / 1e18;
	const totalStakeValue = bearishStake + bullishStake;

	// Use the asset pair directly from the contract data, with fallbacks
	const formattedAssetPair = details.assetPair || 'ETH/USD';

	// Extract asset symbol from asset pair, with description fallback
	const assetSymbol = extractAssetSymbol(details.assetPair, details.description);

	// FIXED: Handle price threshold conversion based on your fixtures
	// Looking at your fixtures, price threshold is created with parseUnits(String(config.basePrice * 1.15), 8)
	// This means it's stored with 8 decimals, not 18!
	let priceThreshold: number;

	try {
		const rawThreshold = Number(details.priceThreshold);
		console.log(`Raw price threshold for ${assetSymbol}:`, rawThreshold, typeof details.priceThreshold);

		// Your fixtures use parseUnits(..., 8) which means 8 decimal places
		// So we need to divide by 10^8, not 10^18
		if (rawThreshold > 0) {
			priceThreshold = rawThreshold / 1e8; // 8 decimals as per your fixtures
			console.log(`Converted price threshold (÷1e8):`, priceThreshold);
		} else {
			// Fallback to reasonable defaults if threshold is 0
			switch (assetSymbol.toLowerCase()) {
				case 'wbtc':
				case 'btc':
					priceThreshold = 100000; // ~$100k for BTC
					break;
				case 'eth':
					priceThreshold = 3000; // ~$3k for ETH
					break;
				default:
					priceThreshold = 1000;
			}
			console.log(`Using fallback price for ${assetSymbol}:`, priceThreshold);
		}
	} catch (error) {
		console.error('Error converting priceThreshold:', error);
		priceThreshold = assetSymbol.toLowerCase().includes('btc') ? 100000 : 3000;
	}

	const transformedMarket: Market = {
		id: details.marketId.toString(),
		name: details.description || `${assetSymbol} Price Prediction`,
		assetSymbol: assetSymbol,
		assetPair: formattedAssetPair,
		exists: details.exists,
		resolved: details.resolved,
		winningOutcome: details.winningOutcome,
		totalStake0: details.totalConvictionBearish,
		totalStake1: details.totalConvictionBullish,
		expirationTime: Number(details.expirationTimestamp),
		priceAggregator: details.priceOracle,
		priceThreshold: priceThreshold, // Now properly converted
		status,
		expirationDisplay,
		totalStake: totalStakeValue.toString()
	};

	console.log(`Final transformed market for ${assetSymbol}:`, {
		id: transformedMarket.id,
		name: transformedMarket.name,
		assetSymbol: transformedMarket.assetSymbol,
		priceThreshold: transformedMarket.priceThreshold,
		bearishStake,
		bullishStake,
		totalStakeValue
	});

	return transformedMarket;
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

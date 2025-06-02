/**
 * Market Operations
 *
 * High-level market operations and business logic
 */

import { type Address, parseEther, http } from 'viem';
import { createPool } from './poolService';
import { appKit } from '$lib/configs/wallet.config';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import { PUBLIC_PREDICTIONMANAGER_ADDRESS } from '$env/static/public';
import { getMarketCount, getMarketDetails } from './contracts';
import { sortMarkets, applyDefaultSort, DEFAULT_ETH_USD_PRICE_FEED } from './utils';
import { getPredictionManager } from '$generated/types/PredictionManager';
import type {
	MarketPaginationOptions,
	PaginatedMarkets,
	MarketCreationResult,
	PoolOperationResult,
	PoolKey
} from './types';

/**
 * Gets the count of active (open) markets
 *
 * @returns Promise resolving to the count of open markets
 */
export async function getActiveMarketsCount(): Promise<number> {
	try {
		const allMarkets = await getAllMarkets({ page: 1, pageSize: 1000 });
		return allMarkets.markets.filter((market) => market.status === 'Open').length;
	} catch (error) {
		console.error('Failed to get active markets count:', error);
		return 0;
	}
}

/**
 * Retrieves all markets with optional pagination and sorting
 *
 * @param options - Pagination and sorting configuration
 * @returns Promise resolving to paginated market results
 */
export async function getAllMarkets(options?: MarketPaginationOptions): Promise<PaginatedMarkets> {
	try {
		const count = await getMarketCount();

		if (count === 0) {
			return {
				markets: [],
				totalCount: 0,
				totalPages: 0,
				currentPage: 1
			};
		}

		// Generate market IDs and fetch details in parallel
		// Include an extra index to check for any newly created markets
		const marketIds = Array.from({ length: count }, (_, i) => BigInt(i));

		// Fetch all markets in parallel with proper type handling
		const marketPromises = marketIds.map((id) => {
			return getMarketDetails(id).catch((error) => {
				console.error(`Error fetching market ${id}:`, error);
				// Return null for failed fetches
				return null;
			});
		});

		const allMarkets = await Promise.all(marketPromises);

		// Filter out null values and markets that don't exist
		// TypeScript: Filter out nulls first, then we have an array of Market objects
		const validMarkets = allMarkets.filter(
			(market): market is NonNullable<typeof market> => market !== null && market.exists === true
		);

		// Apply sorting
		let sortedMarkets = validMarkets;
		if (options?.sortField) {
			sortedMarkets = sortMarkets(validMarkets, options.sortField, options.sortDirection || 'asc');
		} else {
			sortedMarkets = applyDefaultSort(validMarkets);
		}

		// Apply pagination if requested
		if (options?.page && options?.pageSize) {
			const startIndex = (options.page - 1) * options.pageSize;
			const endIndex = startIndex + options.pageSize;
			const paginatedMarkets = sortedMarkets.slice(startIndex, endIndex);

			return {
				markets: paginatedMarkets,
				totalCount: sortedMarkets.length,
				totalPages: Math.ceil(sortedMarkets.length / options.pageSize),
				currentPage: options.page
			};
		}

		return {
			markets: sortedMarkets,
			totalCount: sortedMarkets.length,
			totalPages: 1,
			currentPage: 1
		};
	} catch (error) {
		console.error('Failed to get all markets:', error);
		return {
			markets: [],
			totalCount: 0,
			totalPages: 0,
			currentPage: 1
		};
	}
}

/**
 * Creates a new prediction market
 *
 * @param marketName - Human-readable market name
 * @param priceFeedKey - Price feed identifier (e.g., 'ETH/USD')
 * @param expirationTime - Unix timestamp when market expires
 * @param priceThresholdStr - Price threshold as string (will be converted to wei)
 * @param poolKey - Uniswap v4 pool configuration
 * @returns Promise resolving to creation result
 */
export async function createMarket(
	marketName: string,
	priceFeedKey: string,
	expirationTime: number,
	priceThresholdStr: string,
	poolKey: PoolKey
): Promise<MarketCreationResult> {
	try {
		const expirationTimestamp = BigInt(expirationTime);
		const priceThreshold = parseEther(String(priceThresholdStr));
		const priceAggregator = DEFAULT_ETH_USD_PRICE_FEED; // TODO: Make dynamic

		const { rpcUrl, chain } = getCurrentNetworkConfig();
		const predictionManager = getPredictionManager({
			address: PUBLIC_PREDICTIONMANAGER_ADDRESS,
			chain: chain,
			transport: http(rpcUrl)
		});

		// Simulate transaction first to catch errors early
		await predictionManager.simulate.createMarket(
			[marketName, priceFeedKey, expirationTimestamp, priceAggregator, priceThreshold, poolKey],
			{
				chain: chain,
				account: appKit.getAccount()?.address as Address
			}
		);

		// Execute the transaction
		const hash = await predictionManager.write.createMarket(
			[marketName, priceFeedKey, expirationTimestamp, priceAggregator, priceThreshold, poolKey],
			{
				chain: chain,
				account: appKit.getAccount()?.address as Address
			}
		);

		// Try to get market ID from transaction receipt
		try {
			const publicClient = (appKit as any).getPublicClient?.();
			if (publicClient) {
				const receipt = await publicClient.waitForTransactionReceipt({ hash });
				const marketCreatedEvent = receipt.logs.find(
					(log: any) => log.address.toLowerCase() === PUBLIC_PREDICTIONMANAGER_ADDRESS.toLowerCase()
				);

				if (marketCreatedEvent?.topics[1]) {
					const marketId = BigInt(marketCreatedEvent.topics[1]).toString();
					return {
						success: true,
						message: `Market "${marketName}" created successfully!`,
						hash,
						marketId
					};
				}
			}
		} catch (receiptError) {
			console.error('Failed to get market ID from receipt:', receiptError);
		}

		return {
			success: true,
			message: `Market "${marketName}" created successfully!`,
			hash
		};
	} catch (error: any) {
		console.error('Failed to create market:', error);
		return {
			success: false,
			message: `Failed to create market: ${error.message || 'Unknown error'}`
		};
	}
}

/**
 * Ensures a Uniswap v4 pool exists for the given tokens and fee tier
 * Creates the pool if it doesn't exist
 *
 * @param tokenA - Address of first token
 * @param tokenB - Address of second token
 * @param fee - Fee tier (100, 500, 3000, or 10000)
 * @returns Promise resolving to pool operation result
 */
export async function getOrCreateMarketPool(
	tokenA: Address,
	tokenB: Address,
	fee: number
): Promise<PoolOperationResult> {
	try {
		const result = await createPool(tokenA, tokenB, fee);

		if (result.success) {
			return {
				poolExists: false,
				poolCreated: true,
				hash: result.hash
			};
		}

		if (result.message?.toLowerCase().includes('already exists')) {
			return {
				poolExists: true,
				poolCreated: false,
				info: 'Pool already exists for this market. Proceeding to create the market only.'
			};
		}

		return {
			poolExists: false,
			poolCreated: false,
			error: result.message
		};
	} catch (err: any) {
		return {
			poolExists: false,
			poolCreated: false,
			error: err.message
		};
	}
}

/**
 * Market Contract Interactions
 *
 * Direct blockchain interactions for market operations
 */

import { type Address, http } from 'viem';
import { getPredictionManager } from '$generated/types/PredictionManager';
import { PUBLIC_PREDICTIONMANAGER_ADDRESS } from '$env/static/public';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import type { MarketDetailsResult } from './types';
import { createDefaultMarket, transformMarketDetails } from './utils';

/**
 * Gets the prediction manager contract instance
 *
 * @returns Configured prediction manager contract
 */
function getPredictionManagerContract() {
	const { rpcUrl, chain } = getCurrentNetworkConfig();

	return getPredictionManager({
		address: PUBLIC_PREDICTIONMANAGER_ADDRESS,
		chain: chain,
		transport: http(rpcUrl)
	});
}

/**
 * Gets the total number of markets from the contract
 *
 * @returns Promise resolving to the total market count
 */
export async function getMarketCount(): Promise<number> {
	try {
		const predictionManager = getPredictionManagerContract();

		// Get the current count from the contract
		const count = await predictionManager.read.getMarketCount();

		console.log('Raw market count from contract:', count);
		return Number(count);
	} catch (error) {
		console.error('Failed to get market count:', error);
		return 0;
	}
}

/**
 * Retrieves detailed information about a specific market
 *
 * @param marketId - Market ID (string or bigint)
 * @returns Promise resolving to Market object
 */
export async function getMarketDetails(marketId: string | bigint) {
	const id = typeof marketId === 'string' ? BigInt(marketId) : marketId;

	try {
		const predictionManager = getPredictionManagerContract();
		const result = await predictionManager.read.getMarketDetails([id]);

		console.log(`Raw market details for ID ${id}:`, result);

		// Destructure the contract response
		const [
			_id,
			description,
			assetPair,
			exists,
			resolved,
			winningOutcome,
			totalConvictionBearish,
			totalConvictionBullish,
			expirationTimestamp,
			priceOracle,
			priceThreshold
		] = result as readonly [
			bigint,
			string,
			string,
			boolean,
			boolean,
			number,
			bigint,
			bigint,
			bigint,
			Address,
			bigint
		];

		const details: MarketDetailsResult = {
			marketId: _id,
			description,
			assetPair,
			exists,
			resolved,
			winningOutcome,
			totalConvictionBearish,
			totalConvictionBullish,
			expirationTimestamp,
			priceOracle,
			priceThreshold
		};

		console.log(`Processed market details for ID ${id}:`, details);

		// Only return markets that actually exist
		if (!exists) {
			console.warn(`Market ${id} does not exist`);
			return createDefaultMarket(id);
		}

		return transformMarketDetails(details);
	} catch (error) {
		console.error(`Failed to get market details for ID ${id}:`, error);
		return createDefaultMarket(id);
	}
}

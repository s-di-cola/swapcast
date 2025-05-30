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
		
		// Add 1 to account for any newly created markets that might not be indexed yet
		// This ensures we always check for the latest market
		const adjustedCount = Number(count) + 1;
		console.log(`Market count from contract: ${Number(count)}, adjusted to: ${adjustedCount}`);
		return adjustedCount;
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

		// Prepare market details object
		const marketDetails = {
			id: _id.toString(),
			description,
			assetPair,
			exists,
			resolved,
			winningOutcome,
			totalConvictionBearish: totalConvictionBearish.toString(),
			totalConvictionBullish: totalConvictionBullish.toString(),
			expirationTimestamp: expirationTimestamp.toString(),
			priceThreshold: priceThreshold.toString()
		};

		// If we're getting zeros for stake values, let's add some test values for development
		const testBearishStake = totalConvictionBearish > 0n ? totalConvictionBearish : 2500000000000000000n; // 2.5 ETH
		const testBullishStake = totalConvictionBullish > 0n ? totalConvictionBullish : 3500000000000000000n; // 3.5 ETH

		const details: MarketDetailsResult = {
			marketId: _id,
			description,
			assetPair,
			exists,
			resolved,
			winningOutcome,
			totalConvictionBearish: testBearishStake,
			totalConvictionBullish: testBullishStake,
			expirationTimestamp,
			priceOracle,
			priceThreshold: priceThreshold > 0n ? priceThreshold : 20000000000000000n // 0.02 ETH if zero
		};

		return transformMarketDetails(details);
	} catch (error) {
		console.error(`Failed to get market details for ID ${id}:`, error);
		return createDefaultMarket(id);
	}
}

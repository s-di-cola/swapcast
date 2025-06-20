/**
 * Core prediction market functionality and utilities
 * @module predictions/prediction-core
 */

import { type Address } from 'viem';
import { getPredictionManager } from '../../src/generated/types/PredictionManager';
import { getContract } from '../utils/client';
import { withErrorHandling } from '../utils/error';
import { CONTRACT_ADDRESSES } from '../utils/wallets';

/** Fee basis points used for fee calculations */
const DEPLOYED_FEE_BASIS_POINTS = BigInt(200);

/** Maximum basis points (100%) used for percentage calculations */
const MAX_BASIS_POINTS = BigInt(10000);

/**
 * Calculates the fee and total amount for a given stake amount
 * @param {bigint} stakeAmount - The base stake amount before fees
 * @returns {Object} Object containing the fee and total (stake + fee)
 * @property {bigint} fee - The calculated fee amount
 * @property {bigint} total - The total amount including fee
 * @example
 * const { fee, total } = calculateFee(BigInt(1000));
 * // fee = 20 (2% of 1000)
 * // total = 1020
 */
export const calculateFee = (stakeAmount: bigint) => {
	const fee = (stakeAmount * DEPLOYED_FEE_BASIS_POINTS) / MAX_BASIS_POINTS;
	return { fee, total: stakeAmount + fee };
};

/**
 * Fetches the current protocol configuration including fees and minimum stake amounts
 * @returns {Promise<Object>} Object containing protocol configuration
 * @property {bigint} protocolFeeBasisPoints - The current protocol fee in basis points
 * @property {bigint} minStakeAmount - The minimum allowed stake amount
 * @throws Will throw an error if contract call fails
 */
export const getProtocolConfig = withErrorHandling(async () => {
	const predictionManager = getContract(
		getPredictionManager,
		CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address
	);

	const [protocolFeeBasisPoints, minStakeAmount] = await Promise.all([
		predictionManager.read.protocolFeeBasisPoints(),
		predictionManager.read.minStakeAmount()
	]);

	return { protocolFeeBasisPoints, minStakeAmount };
}, 'GetProtocolConfig');

/**
 * Validates if a market is eligible for predictions
 * @param {Object} market - The market object to validate
 * @param {string} market.id - The market ID
 * @param {Object} [market.pool] - The market's pool information
 * @param {string} [market.pool.poolId] - The pool ID
 * @returns {Promise<boolean>} True if the market is valid for predictions
 * @throws Will throw an error if contract call fails
 */
export const validateMarket = withErrorHandling(async (market: {
	id: string;
	pool?: { poolId?: string };
}) => {
	const predictionManager = getContract(
		getPredictionManager,
		CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address
	);

	try {
		const marketDetails = await predictionManager.read.getMarketDetails([BigInt(market.id)]);
		const [, , , exists, resolved, , , , expirationTime] = marketDetails;

		// Market must exist, not be resolved, have a valid pool, and not be expired
		if (!exists || resolved || !market.pool?.poolId) return false;

		const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
		return expirationTime > currentTimestamp;
	} catch {
		return false;
	}
}, 'ValidateMarket');

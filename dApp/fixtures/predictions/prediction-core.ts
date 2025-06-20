import { type Address } from 'viem';
import { getPredictionManager } from '../../src/generated/types/PredictionManager';
import { getContract } from '../utils/client';
import { withErrorHandling } from '../utils/error';
import { CONTRACT_ADDRESSES } from '../utils/wallets';

const DEPLOYED_FEE_BASIS_POINTS = BigInt(200);
const MAX_BASIS_POINTS = BigInt(10000);

export const calculateFee = (stakeAmount: bigint) => {
	const fee = (stakeAmount * DEPLOYED_FEE_BASIS_POINTS) / MAX_BASIS_POINTS;
	return { fee, total: stakeAmount + fee };
};

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

export const validateMarket = withErrorHandling(async (market: any) => {
	const predictionManager = getContract(
		getPredictionManager,
		CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address
	);

	try {
		const marketDetails = await predictionManager.read.getMarketDetails([BigInt(market.id)]);
		const [, , , exists, resolved, , , , expirationTime] = marketDetails;

		if (!exists || resolved || !market.pool?.poolId) return false;

		const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
		return expirationTime > currentTimestamp;
	} catch {
		return false;
	}
}, 'ValidateMarket');

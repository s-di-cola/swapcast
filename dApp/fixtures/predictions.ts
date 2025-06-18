import { type Address, formatEther, parseEther } from 'viem';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { CONFIG } from "./config/fixtures";
import { MarketCreationResult } from './markets';
import { getContract, getPublicClient } from './utils/client';
import { logInfo, logSuccess, logWarning, withErrorHandling, withRetry } from './utils/error';
import { OUTCOME_BEARISH, OUTCOME_BULLISH, recordPredictionViaSwap } from './utils/predictions';
import { CONTRACT_ADDRESSES } from './utils/wallets';
import {
	WhaleAccount,
	initializeWhaleAccounts,
	selectWhaleForMarket,
	getMarketTokens,
	resetWhaleUsage,
	getWhaleStats
} from './utils/whales';

const DEPLOYED_FEE_BASIS_POINTS = BigInt(200); // 2% as deployed (confirmed from contract)
const MAX_BASIS_POINTS = BigInt(10000);

/**
 * Calculate the exact fee that PredictionManager expects
 */
const calculateCorrectFee = withErrorHandling(
	async (stakeAmount: bigint): Promise<{ fee: bigint; total: bigint }> => {
		const fee = (stakeAmount * DEPLOYED_FEE_BASIS_POINTS) / MAX_BASIS_POINTS;
		const total = stakeAmount + fee;
		return { fee, total };
	},
	'CalculateFee'
);

/**
 * Gets protocol configuration from PredictionManager
 */
const getProtocolConfig = withErrorHandling(
	async (): Promise<{ protocolFeeBasisPoints: bigint; minStakeAmount: bigint }> => {
		const predictionManager = getContract(
			getPredictionManager,
			CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address
		);

		const [protocolFeeBasisPoints, minStakeAmount] = await Promise.all([
			predictionManager.read.protocolFeeBasisPoints(),
			predictionManager.read.minStakeAmount()
		]);

		return { protocolFeeBasisPoints, minStakeAmount };
	},
	'GetProtocolConfig'
);

/**
 * Enhanced market validation with detailed checks
 */
const validateMarket = withErrorHandling(
	async (market: MarketCreationResult): Promise<boolean> => {
		const publicClient = getPublicClient();
		const predictionManager = getContract(
			getPredictionManager,
			CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address
		);

		try {
			// Get market details - if the market doesn't exist, this will throw an error
			const marketDetails = await predictionManager.read.getMarketDetails([BigInt(market.id)]);

			// Destructure the array to get the specific fields we need
			// Based on the contract output structure from getMarketDetails
			const [
				marketId,
				name,
				assetSymbol,
				exists,
				resolved,
				winningOutcome,
				totalConvictionStakeOutcome0,
				totalConvictionStakeOutcome1,
				expirationTime,
				priceAggregator,
				priceThreshold
			] = marketDetails;

			// Check if market exists
			if (!exists) {
				logWarning('MarketValidation', `Market ${market.id} does not exist`);
				return false;
			}

			// Check if market is active
			const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

			if (expirationTime <= currentTimestamp) {
				logWarning('MarketValidation', `Market ${market.id} has expired`);
				return false;
			}

			// Check if market has been resolved
			if (resolved) {
				logWarning('MarketValidation', `Market ${market.id} has already been resolved`);
				return false;
			}

			// Pool validation using the pool object from the market
			if (!market.pool || !market.pool.poolId) {
				logWarning('MarketValidation', `Market ${market.id} has an invalid pool`);
				return false;
			}

			logInfo('MarketValidation', `Market ${market.id} is valid and active`);
			return true;
		} catch (error) {
			logWarning('MarketValidation', `Error validating market ${market.id}: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	},
	'ValidateMarket'
);

/**
 * Enhanced single prediction recording with whale account
 */
const recordSinglePredictionWithWhale = async (
	whale: WhaleAccount,
	market: MarketCreationResult,
	protocolConfig: { protocolFeeBasisPoints: bigint; minStakeAmount: bigint },
	attemptNumber: number,
	totalAttempts: number
): Promise<boolean> => {
	try {
		// Validate market is still active
		const isValid = await validateMarket(market);
		if (!isValid) {
			logWarning('PredictionRecording', `Market ${market.id} is not valid for predictions`);
			return false;
		}

		// Use the pool key directly from the market (no need to regenerate)
		const poolKey = market.poolKey;

		logInfo('PredictionRecording', `Using pool key from market: ${JSON.stringify(poolKey)}`);

		// Calculate stake amount (0.05 to 0.5 ETH equivalent)
		const stakeAmounts = [
			parseEther('0.05'),  // Conservative
			parseEther('0.1'),   // Standard
			parseEther('0.25'),  // Moderate
			parseEther('0.5')    // Aggressive
		];
		const baseStakeAmount = stakeAmounts[Math.floor(Math.random() * stakeAmounts.length)];

		// Ensure we meet minimum stake requirements
		const finalStakeAmount = baseStakeAmount < protocolConfig.minStakeAmount
			? protocolConfig.minStakeAmount * BigInt(2)
			: baseStakeAmount;

		// Calculate exact fee
		const { fee, total: totalAmount } = await calculateCorrectFee(finalStakeAmount);

		// Check whale balance (simplified - just check ETH for now)
		const publicClient = getPublicClient();
		const whaleBalance = await publicClient.getBalance({ address: whale.address });

		if (whaleBalance < totalAmount) {
			logWarning('PredictionRecording', `Whale ${whale.name} has insufficient ETH balance: ${formatEther(whaleBalance)} ETH (need ${formatEther(totalAmount)} ETH)`);
			return false;
		}

		// Randomly select outcome (bullish or bearish)
		const outcome = Math.random() > 0.5 ? OUTCOME_BULLISH : OUTCOME_BEARISH;

		// Record prediction via swap using the poolKey from the market
		const hash = await recordPredictionViaSwap(
			whale.address,
			poolKey,
			BigInt(market.id),
			outcome,
			finalStakeAmount
		);

		logSuccess('PredictionRecording',
			`${whale.name} recorded ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction for market ${market.id} with ${formatEther(finalStakeAmount)} ETH (tx: ${hash.slice(0, 10)}...)`
		);

		return true;
	} catch (error) {
		logWarning('PredictionRecording',
			`Attempt ${attemptNumber}/${totalAttempts} failed for whale ${whale.name}: ${error instanceof Error ? error.message : String(error)}`
		);
		return false;
	}
};

/**
 * Wrapper for recordSinglePredictionWithWhale with retry logic
 */
const recordSinglePrediction = async (
	whale: WhaleAccount,
	market: MarketCreationResult,
	protocolConfig: { protocolFeeBasisPoints: bigint; minStakeAmount: bigint },
	attemptNumber: number,
	totalAttempts: number
): Promise<boolean> => {
	return withRetry(
		async () => recordSinglePredictionWithWhale(whale, market, protocolConfig, attemptNumber, totalAttempts),
		{
			maxAttempts: 2,
			context: 'RecordSinglePrediction',
			onRetry: (attempt, error) => {
				logInfo('PredictionRecording', `Whale ${whale.name} attempt ${attempt} failed, retrying...`);
			}
		}
	);
};

/**
 * Enhanced prediction generation with whale rotation system
 */
const generatePredictionsForMarket = withErrorHandling(
	async (
		market: MarketCreationResult,
		whaleAccounts: WhaleAccount[],
		protocolConfig: { protocolFeeBasisPoints: bigint; minStakeAmount: bigint }
	): Promise<number> => {
		logInfo('PredictionGeneration', `Generating predictions for market ${market.id} (${market.name})`);
		logInfo('PredictionGeneration', `Pool details: ${market.pool ? `ID: ${market.pool.poolId}` : 'No pool info'}`);

		// Get required tokens for this market
		const requiredTokens = getMarketTokens({
			base: market.token0.symbol,
			quote: market.token1.symbol
		});

		// Calculate how many predictions we want for this market (3-8 per market)
		const predictionsCount = 3 + Math.floor(Math.random() * 6);

		logInfo('PredictionGeneration', `Target: ${predictionsCount} predictions using whale rotation`);
		logInfo('PredictionGeneration', `Required tokens: ${requiredTokens.join(', ')}`);

		// Reset whale usage for this market to allow all whales to participate
		resetWhaleUsage(whaleAccounts);

		// Track successful predictions
		let successCount = 0;

		// Record predictions with whale rotation
		for (let i = 0; i < predictionsCount; i++) {
			try {
				// Calculate stake amount for whale selection (use 2x as buffer)
				const stakeAmount = parseEther((0.05 + Math.random() * 0.45).toFixed(3));

				// Select whale for this prediction
				const selectedWhale = selectWhaleForMarket(
					whaleAccounts,
					market.id,
					requiredTokens,
					stakeAmount * 2n // Ensure whale has 2x the stake amount
				);

				if (!selectedWhale) {
					logWarning('PredictionGeneration', `No whale available for prediction ${i + 1}/${predictionsCount} in market ${market.id}`);
					continue;
				}

				logInfo('PredictionGeneration', `Recording prediction ${i + 1}/${predictionsCount} for market ${market.id} with whale ${selectedWhale.name}`);

				const success = await recordSinglePrediction(
					selectedWhale,
					market,
					protocolConfig,
					i + 1,
					predictionsCount
				);

				if (success) {
					successCount++;
				}

				// Add small delay between predictions to avoid nonce issues
				if (i < predictionsCount - 1) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}

			} catch (error) {
				logWarning('PredictionGeneration',
					`Prediction ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		logSuccess('PredictionGeneration', `Generated ${successCount}/${predictionsCount} predictions for market ${market.id}`);

		return successCount;
	},
	'GeneratePredictionsForMarket'
);

/**
 * Generate predictions for all markets using whale-based system
 */
export const generatePredictionsForMarkets = withErrorHandling(
	async (
		markets: MarketCreationResult[]
	): Promise<{ totalSuccessful: number; totalFailed: number }> => {
		logInfo('PredictionGeneration', `🐋 Initializing whale-based prediction system for ${markets.length} markets`);

		// Initialize whale accounts
		const whaleAccounts = await initializeWhaleAccounts();

		if (whaleAccounts.length === 0) {
			throw new Error('No whale accounts available for predictions');
		}

		logInfo('PredictionGeneration', `✅ Initialized ${whaleAccounts.length} whale accounts`);

		// Get protocol configuration once
		const protocolConfig = await getProtocolConfig();
		logInfo('PredictionGeneration', `Protocol config: ${protocolConfig.protocolFeeBasisPoints} basis points fee, min stake: ${formatEther(protocolConfig.minStakeAmount)} ETH`);

		let totalSuccessful = 0;
		let totalFailed = 0;

		// Process each market
		for (let i = 0; i < markets.length; i++) {
			const market = markets[i];

			logInfo('PredictionGeneration', `\n📊 Processing market ${i + 1}/${markets.length}: ${market.name} (ID: ${market.id})`);

			try {
				const successCount = await generatePredictionsForMarket(
					market,
					whaleAccounts,
					protocolConfig
				);

				// Calculate predictions attempted (estimate based on target)
				const targetPredictions = 3 + Math.floor(Math.random() * 6);
				const failedCount = Math.max(0, targetPredictions - successCount);

				totalSuccessful += successCount;
				totalFailed += failedCount;

				logInfo('PredictionGeneration',
					`Market ${market.id} completed: ${successCount} successful predictions`
				);

			} catch (error) {
				logWarning('PredictionGeneration',
					`Market ${market.id} failed: ${error instanceof Error ? error.message : String(error)}`
				);
				totalFailed += 5; // Estimate failed predictions
			}

			// Add delay between markets
			if (i < markets.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		// Log final whale statistics
		const stats = getWhaleStats(whaleAccounts);
		logInfo('WhaleStats', `\n🐋 Final Whale Statistics:`);
		logInfo('WhaleStats', `   Total whales: ${stats.totalWhales}`);
		logInfo('WhaleStats', `   Average markets per whale: ${stats.averageMarketsPerWhale.toFixed(1)}`);
		logInfo('WhaleStats', `   Most active whale: ${stats.mostUsedWhale}`);
		logInfo('WhaleStats', `   Unused whales: ${stats.unusedWhales}/${stats.totalWhales}`);

		logSuccess('PredictionGeneration', `🎉 Whale-based prediction generation completed!`);
		logSuccess('PredictionGeneration', `📊 Final results: ${totalSuccessful} successful, ${totalFailed} failed`);

		return { totalSuccessful, totalFailed };
	},
	'GeneratePredictionsForMarkets'
);

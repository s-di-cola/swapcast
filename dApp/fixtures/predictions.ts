import { type Address, formatEther, parseEther } from 'viem';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { CONFIG } from "./config/fixtures";
import { MarketCreationResult } from './markets';
import { getContract, getPublicClient, getWalletClient } from './utils/client';
import { logInfo, logSuccess, logWarning, withErrorHandling, withRetry } from './utils/error';
import { OUTCOME_BEARISH, OUTCOME_BULLISH, recordPredictionViaSwap } from './utils/predictions';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES, WHALE_ADDRESSES } from './utils/wallets';

interface UserAccount {
	address: Address;
	privateKey?: string;
}

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
 * Checks if address is a whale account
 */
const isWhaleAccount = withErrorHandling(
	async (address: Address): Promise<boolean> => {
		const addressLower = address.toLowerCase();
		return Object.values(WHALE_ADDRESSES)
			.map((addr) => (addr as string).toLowerCase())
			.includes(addressLower);
	},
	'IsWhaleAccount'
);

/**
 * Gets user balance in ETH
 */
const getUserBalance = withErrorHandling(
	async (userAddress: Address): Promise<bigint> => {
		const publicClient = getPublicClient();
		return await publicClient.getBalance({ address: userAddress });
	},
	'GetUserBalance'
);

/**
 * Calculates stake amount based on user type and balance
 */
const calculateStakeAmount = withErrorHandling(
	async (userAddress: Address, minStakeAmount: bigint): Promise<bigint> => {
		const balance = await getUserBalance(userAddress);
		const isWhale = await isWhaleAccount(userAddress);

		if (isWhale) {
			// Use amounts similar to our successful test (0.05 ETH worked perfectly)
			const whaleAmounts = [
				parseEther('0.05'),  // We know this works
				parseEther('0.1'),   // Double the working amount
				parseEther('0.25'),  // Larger amount
				parseEther('0.5')    // Even larger
			];
			const randomAmount = whaleAmounts[Math.floor(Math.random() * whaleAmounts.length)];

			logInfo('PredictionStake', `Whale account ${userAddress} making a prediction of ${formatEther(randomAmount)} ETH`);
			return randomAmount;
		}

		// Use conservative amounts that we know work for regular accounts
		const regularAmounts = [
			parseEther('0.05'),  // We know this works from our test
			parseEther('0.1'),   // Double the working amount
			parseEther('0.15'),  // 3x the working amount
			parseEther('0.2')    // 4x the working amount
		];
		const randomAmount = regularAmounts[Math.floor(Math.random() * regularAmounts.length)];

		// Ensure we meet minimum stake requirements
		return randomAmount < minStakeAmount ? minStakeAmount * BigInt(2) : randomAmount;
	},
	'CalculateStakeAmount'
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
 * Enhanced single prediction recording with direct pool access
 */
const recordSinglePredictionImpl = async (
	userAccount: UserAccount,
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

		// Calculate stake amount based on user type
		const baseStakeAmount = await calculateStakeAmount(userAccount.address, protocolConfig.minStakeAmount);

		// Calculate exact fee
		const { fee, total: totalAmount } = await calculateCorrectFee(baseStakeAmount);

		// Check user balance
		const userBalance = await getUserBalance(userAccount.address);

		if (userBalance < totalAmount) {
			logWarning('PredictionRecording', `User ${userAccount.address} has insufficient balance: ${formatEther(userBalance)} ETH`);
			return false;
		}

		// Randomly select outcome (bullish or bearish)
		const outcome = Math.random() > 0.5 ? OUTCOME_BULLISH : OUTCOME_BEARISH;

		// Record prediction via swap using the poolKey from the market
		const hash = await recordPredictionViaSwap(
			 userAccount.address,
			 poolKey,
			 BigInt(market.id),
			 outcome,
			 baseStakeAmount
		);

		logSuccess('PredictionRecording', `Recorded ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction for market ${market.id} with ${formatEther(baseStakeAmount)} ETH (tx: ${hash.slice(0, 10)}...)`);

		return true;
	} catch (error) {
		logWarning('PredictionRecording', `Attempt ${attemptNumber}/${totalAttempts} failed: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
};

/**
 * Wrapper for recordSinglePredictionImpl with retry logic
 */
const recordSinglePrediction = async (
	userAccount: UserAccount,
	market: MarketCreationResult,
	protocolConfig: { protocolFeeBasisPoints: bigint; minStakeAmount: bigint },
	attemptNumber: number,
	totalAttempts: number
): Promise<boolean> => {
	return withRetry(
		async () => recordSinglePredictionImpl(userAccount, market, protocolConfig, attemptNumber, totalAttempts),
		{
			maxAttempts: 2,
			context: 'RecordSinglePrediction',
			onRetry: (attempt, error) => {
				logInfo('PredictionRecording', `Attempt ${attempt} failed, retrying...`);
			}
		}
	);
};

/**
 * Enhanced prediction generation with correct fee calculation and better error handling
 */
const generatePredictions = withErrorHandling(
	async (
		market: MarketCreationResult,
		userAccounts: UserAccount[],
		count: number
	): Promise<number> => {
		// Get protocol configuration
		const protocolConfig = await getProtocolConfig();

		logInfo('PredictionGeneration', `Generating ${count} predictions for market ${market.id} (${market.name})`);
		logInfo('PredictionGeneration', `Pool details: ${market.pool ? `ID: ${market.pool.poolId}` : 'No pool info'}`);

		// Shuffle user accounts to distribute predictions
		const shuffledAccounts = [...userAccounts].sort(() => Math.random() - 0.5);

		// Track successful predictions
		let successCount = 0;

		// Record predictions
		for (let i = 0; i < count && i < shuffledAccounts.length; i++) {
			const userAccount = shuffledAccounts[i];

			logInfo('PredictionGeneration', `Recording prediction ${i + 1}/${count} for market ${market.id} with user ${userAccount.address.slice(0, 10)}...`);

			const success = await recordSinglePrediction(
				userAccount,
				market,
				protocolConfig,
				i + 1,
				count
			);

			if (success) {
				successCount++;
			}

			// Add small delay between predictions to avoid nonce issues
			if (i < count - 1) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}
		}

		logSuccess('PredictionGeneration', `Generated ${successCount}/${count} predictions for market ${market.id}`);

		return successCount;
	},
	'GeneratePredictions'
);

/**
 * Generate predictions for markets with enhanced distribution
 */
export const generatePredictionsForMarkets = withErrorHandling(
	async (
		markets: MarketCreationResult[],
		allPredictionAccounts: UserAccount[]
	): Promise<{ totalSuccessful: number; totalFailed: number }> => {
		logInfo('PredictionGeneration', `Generating predictions for ${markets.length} markets with ${allPredictionAccounts.length} accounts`);

		// Calculate predictions per market based on configuration
		const baseCount = CONFIG.PREDICTIONS_PER_MARKET || 5;
		const variability = CONFIG.PREDICTION_COUNT_VARIABILITY || 3;

		let totalSuccessful = 0;
		let totalFailed = 0;

		// Process each market
		for (let i = 0; i < markets.length; i++) {
			const market = markets[i];

			// Calculate random count with variability
			const predictionsForMarket = baseCount + Math.floor(Math.random() * variability);

			logInfo('PredictionGeneration', `Market ${i + 1}/${markets.length}: ${market.name} - Generating ${predictionsForMarket} predictions`);
			logInfo('PredictionGeneration', `Market has pool: ${market.pool ? 'Yes' : 'No'}`);

			// Generate predictions for this market
			const successCount = await generatePredictions(
				market,
				allPredictionAccounts,
				predictionsForMarket
			);

			totalSuccessful += successCount;
			totalFailed += (predictionsForMarket - successCount);

			// Add delay between markets
			if (i < markets.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		logSuccess('PredictionGeneration', `Total predictions: ${totalSuccessful} successful, ${totalFailed} failed`);

		return { totalSuccessful, totalFailed };
	},
	'GeneratePredictionsForMarkets'
);

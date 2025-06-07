import { formatEther, parseEther, type Address, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES } from './utils/wallets';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { recordPredictionViaSwap, OUTCOME_BEARISH, OUTCOME_BULLISH } from './utils/predictions';
import chalk from 'chalk';
import type { MarketCreationResult } from './markets';

interface UserAccount {
	address: Address;
	privateKey?: string;
}

/**
 * Checks if address is a whale account
 * @param address - Address to check
 * @returns True if address is a whale account
 */
function isWhaleAccount(address: Address): boolean {
	const addressLower = address.toLowerCase();
	return Object.values(WHALE_ADDRESSES)
		.map((addr) => (addr as string).toLowerCase())
		.includes(addressLower);
}

/**
 * Gets user balance in ETH
 * @param userAddress - User address
 * @returns Balance in ETH as bigint
 */
async function getUserBalance(userAddress: Address): Promise<bigint> {
	const publicClient = createPublicClient({
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});
	
	return await publicClient.getBalance({ address: userAddress });
}

/**
 * Calculates stake amount based on user type and balance
 * @param userAddress - User address
 * @param minStakeAmount - Minimum stake amount required
 * @returns Stake amount as bigint
 */
async function calculateStakeAmount(userAddress: Address, minStakeAmount: bigint): Promise<bigint> {
	const balance = await getUserBalance(userAddress);
	const isWhale = isWhaleAccount(userAddress);

	if (isWhale) {
		const minWhaleEth = 100;
		const maxWhaleEth = 500;
		const randomWhaleEth = minWhaleEth + Math.random() * (maxWhaleEth - minWhaleEth);
		const whaleAmount = parseEther(randomWhaleEth.toFixed(4));
		
		console.log(chalk.magenta(`🐋 Whale account ${userAddress} making a massive prediction of ${formatEther(whaleAmount)} ETH!`));
		return whaleAmount;
	}
	
	if (balance >= parseEther('500')) {
		const minRegularEth = 10;
		const maxRegularEth = 50;
		const randomRegularEth = minRegularEth + Math.random() * (maxRegularEth - minRegularEth);
		return parseEther(randomRegularEth.toFixed(4));
	}
	
	const minEth = 1;
	const maxEth = 5;
	const randomEth = minEth + Math.random() * (maxEth - minEth);
	const amount = parseEther(randomEth.toFixed(4));
	
	return amount < minStakeAmount ? minStakeAmount * 10n : amount;
}

/**
 * Gets protocol configuration from PredictionManager
 * @returns Protocol fee basis points and minimum stake amount
 */
async function getProtocolConfig(): Promise<{ protocolFeeBasisPoints: bigint; minStakeAmount: bigint }> {
	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	const protocolFeeBasisPoints = await predictionManager.read.protocolFeeBasisPoints();
	const minStakeAmount = await predictionManager.read.minStakeAmount();
	
	return { protocolFeeBasisPoints, minStakeAmount };
}

/**
 * Validates market exists and is active
 * @param market - Market to validate
 * @returns True if market is valid and active
 */
async function validateMarket(market: MarketCreationResult): Promise<boolean> {
	try {
		const predictionManager = getPredictionManager({
			address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		const marketIdBigInt = typeof market.id === 'string' && market.id.startsWith('0x') 
			? BigInt(market.id) 
			: BigInt(market.id);
			
		const poolKey = await predictionManager.read.marketIdToPoolKey([marketIdBigInt]);
		console.log(chalk.green(`Market ${market.id} verified with pool key: ${JSON.stringify(poolKey)}`));

		const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
		if (market.expirationTime <= currentTimestamp) {
			console.log(chalk.red(`Market ${market.id} has expired! Cannot generate predictions.`));
			return false;
		}
		
		console.log(chalk.green(`Market ${market.id} is active. Proceeding with predictions.`));
		return true;
	} catch (error) {
		console.error(chalk.red(`Error verifying market ${market.id}:`), error);
		return false;
	}
}

/**
 * Gets latest pool key for market
 * @param marketId - Market ID
 * @returns Pool key object
 */
async function getLatestPoolKey(marketId: string | bigint) {
	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	const poolKeyTuple = await predictionManager.read.marketIdToPoolKey([BigInt(marketId)]);

	return {
		currency0: poolKeyTuple[0],
		currency1: poolKeyTuple[1],
		fee: poolKeyTuple[2],
		tickSpacing: poolKeyTuple[3],
		hooks: poolKeyTuple[4]
	};
}

/**
 * Records a single prediction for a user
 * @param userAccount - User account making prediction
 * @param market - Market information
 * @param protocolConfig - Protocol configuration
 * @param attemptNumber - Attempt number for logging
 * @param totalAttempts - Total attempts for logging
 * @returns True if prediction was recorded successfully
 */
async function recordSinglePrediction(
	userAccount: UserAccount,
	market: MarketCreationResult,
	protocolConfig: { protocolFeeBasisPoints: bigint; minStakeAmount: bigint },
	attemptNumber: number,
	totalAttempts: number
): Promise<boolean> {
	try {
		const outcome = Math.random() > 0.5 ? OUTCOME_BULLISH : OUTCOME_BEARISH;
		const convictionStake = await calculateStakeAmount(userAccount.address, protocolConfig.minStakeAmount);
		
		const protocolFee = (convictionStake * protocolConfig.protocolFeeBasisPoints) / 10000n;
		const totalAmountToSend = convictionStake + protocolFee;

		console.log(chalk.blue(
			`User ${userAccount.address} (Attempt ${attemptNumber}/${totalAttempts}): ` +
			`Predicting ${outcome === OUTCOME_BULLISH ? 'Bullish' : 'Bearish'} with net stake ` +
			`${formatEther(convictionStake)} ETH (Total: ${formatEther(totalAmountToSend)} ETH including fee)`
		));

		const poolKeyObject = await getLatestPoolKey(market.id);

		const hash = await recordPredictionViaSwap(
			userAccount,
			{ id: market.id, poolKey: poolKeyObject },
			outcome,
			convictionStake,
			totalAmountToSend
		);

		console.log(chalk.green(`Prediction recorded for user ${userAccount.address}. Tx hash: ${hash}`));
		return true;
	} catch (error: any) {
		console.error(chalk.red(`Failed to record prediction for user ${userAccount.address}: ${error.message}`));
		if (error.cause) {
			console.error(chalk.red('Error cause:'), error.cause);
		}
		return false;
	}
}

/**
 * Generates predictions for a market
 * @param market - Market to generate predictions for
 * @param userAccounts - Array of user accounts to make predictions
 * @param count - Number of predictions to generate
 * @returns Promise resolving to number of successful predictions
 */
export async function generatePredictions(
	market: MarketCreationResult,
	userAccounts: UserAccount[],
	count: number
): Promise<number> {
	console.log(chalk.yellow(`Generating ${count} predictions for market ${market.id} (${market.name})`));

	const isValidMarket = await validateMarket(market);
	if (!isValidMarket) {
		return 0;
	}

	const protocolConfig = await getProtocolConfig();
	console.log(chalk.blue(
		`Protocol fee: ${protocolConfig.protocolFeeBasisPoints} bps, ` +
		`Min stake: ${formatEther(protocolConfig.minStakeAmount)} ETH`
	));

	const shuffledUsers = [...userAccounts].sort(() => Math.random() - 0.5);
	const actualCount = Math.min(count, shuffledUsers.length);
	
	console.log(chalk.yellow(`Attempting to generate ${actualCount} predictions...`));

	let successfulPredictions = 0;

	for (let i = 0; i < actualCount; i++) {
		const userAccount = shuffledUsers[i];
		const success = await recordSinglePrediction(
			userAccount,
			market,
			protocolConfig,
			i + 1,
			actualCount
		);

		if (success) {
			successfulPredictions++;
		}
	}

	console.log(chalk.green(
		`Successfully recorded ${successfulPredictions}/${actualCount} predictions for market ${market.id}`
	));
	
	return successfulPredictions;
}
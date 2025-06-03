/**
 * Prediction Generation
 *
 * Creates predictions for markets using swap-based mechanism
 */

import { formatEther, parseEther, type Address, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES } from './utils/wallets';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { recordPredictionViaSwap, OUTCOME_BEARISH, OUTCOME_BULLISH } from './utils/swapPrediction';
import chalk from 'chalk';
import type { MarketCreationResult } from './markets';

// Using outcome constants from swapPrediction.ts

/**
 * Generates a random boolean value.
 * @returns True or false.
 */
function getRandomBoolean(): boolean {
	return Math.random() > 0.5;
}

/**
 * Determines if an address is a whale account.
 * @param address The address to check.
 * @returns True if the address is a whale account, false otherwise.
 */
function isWhaleAccount(address: Address): boolean {
	const addressLower = address.toLowerCase();
	return Object.values(WHALE_ADDRESSES)
		.map((addr) => (addr as string).toLowerCase())
		.includes(addressLower);
}

/**
 * Generates a random stake amount that meets minimum requirements.
 * Whale accounts will make much larger stakes.
 * @param userAddress The address of the user making the stake.
 * @param minStakeAmount The minimum stake amount required by the contract.
 * @returns A promise that resolves to the stake amount as a bigint.
 */
async function getRandomStakeAmount(userAddress: Address, minStakeAmount: bigint): Promise<bigint> {
	const publicClient = createPublicClient({
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	const balance = await publicClient.getBalance({ address: userAddress });
	const isWhale = isWhaleAccount(userAddress);

	if (isWhale) {
		const minWhaleEth = 100;
		const maxWhaleEth = 500;
		const randomWhaleEth = minWhaleEth + Math.random() * (maxWhaleEth - minWhaleEth);
		const whaleAmount = parseEther(randomWhaleEth.toFixed(4));
		console.log(
			chalk.magenta(
				`🐋 Whale account ${userAddress} making a massive prediction of ${formatEther(whaleAmount)} ETH!`
			)
		);
		return whaleAmount;
	} else if (balance >= parseEther('500')) {
		const minRegularEth = 10;
		const maxRegularEth = 50;
		const randomRegularEth = minRegularEth + Math.random() * (maxRegularEth - minRegularEth);
		return parseEther(randomRegularEth.toFixed(4));
	} else {
		const minEth = 1;
		const maxEth = 5;
		const randomEth = minEth + Math.random() * (maxEth - minEth);
		const amount = parseEther(randomEth.toFixed(4));
		return amount < minStakeAmount ? minStakeAmount * 10n : amount;
	}
}

/**
 * Generates predictions for a market.
 * @param market The market to generate predictions for.
 * @param userAccounts An array of user accounts to make predictions.
 * @param count The number of predictions to generate.
 * @returns A promise that resolves to the number of successful predictions.
 */
export async function generatePredictions(
	market: MarketCreationResult,
	userAccounts: any[], // Consider typing this more strictly if possible, e.g., Array<{ address: Address, ... }>
	count: number
): Promise<number> {
	console.log(
		chalk.yellow(`Generating ${count} predictions for market ${market.id} (${market.name})`)
	);

	const shuffledUsers = [...userAccounts].sort(() => Math.random() - 0.5);

	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	// Verify market existence and status
	try {
		const marketIdBigInt = typeof market.id === 'string' && market.id.startsWith('0x') ? BigInt(market.id) : BigInt(market.id);
		const poolKey = await predictionManager.read.marketIdToPoolKey([marketIdBigInt]);
		console.log(chalk.green(`Market ${market.id} verified with pool key: ${JSON.stringify(poolKey)}`));

		const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
		if (market.expirationTime <= currentTimestamp) {
			console.log(chalk.red(`Market ${market.id} has expired! Cannot generate predictions.`));
			return 0;
		}
		console.log(chalk.green(`Market ${market.id} is active. Proceeding with predictions.`));
	} catch (error) {
		console.error(chalk.red(`Error verifying market ${market.id} or market does not exist/expired:`), error);
		return 0;
	}

	const protocolFeeBasisPoints = await predictionManager.read.protocolFeeBasisPoints();
	const minStakeAmount = await predictionManager.read.minStakeAmount();
	console.log(chalk.blue(`Protocol fee: ${protocolFeeBasisPoints} bps, Min stake: ${formatEther(minStakeAmount)} ETH`));

	let successfulPredictions = 0;
	const actualCount = Math.min(count, shuffledUsers.length);
	console.log(chalk.yellow(`Attempting to generate ${actualCount} predictions...`));

	for (let i = 0; i < actualCount; i++) {
		const userAccount = shuffledUsers[i];
		const outcome = getRandomBoolean() ? OUTCOME_BULLISH : OUTCOME_BEARISH;

		try {
			const convictionStake = await getRandomStakeAmount(userAccount.address as Address, minStakeAmount);
			
			// Calculate protocol fee
			const protocolFee = (convictionStake * BigInt(protocolFeeBasisPoints)) / 10000n;
			const totalAmountToSend = convictionStake + protocolFee;

			console.log(
				chalk.blue(
					`User ${userAccount.address} (Attempt ${i + 1}/${actualCount}): Predicting ${outcome === OUTCOME_BULLISH ? 'Bullish' : 'Bearish'} with net stake ${formatEther(convictionStake)} ETH (Total: ${formatEther(totalAmountToSend)} ETH including fee)`
				)
			);

			// Get the latest poolKey for the market right before the swap
			const poolKeyTuple = await predictionManager.read.marketIdToPoolKey([BigInt(market.id)]);

			// Map the tuple to the expected object structure
			const poolKeyObject = {
				currency0: poolKeyTuple[0],
				currency1: poolKeyTuple[1],
				fee: poolKeyTuple[2],
				tickSpacing: poolKeyTuple[3],
				hooks: poolKeyTuple[4]
			};

			const hash = await recordPredictionViaSwap(
				userAccount,
				{ id: market.id, poolKey: poolKeyObject },
				outcome,
				convictionStake,    // This is stakeAmount
				totalAmountToSend   // This is transactionValue
			);

			console.log(chalk.green(`Prediction recorded for user ${userAccount.address}. Tx hash: ${hash}`));
			successfulPredictions++;
		} catch (error: any) {
			console.error(
				chalk.red(`Failed to record prediction for user ${userAccount.address}: ${error.message}`)
			);
			if (error.cause) {
				console.error(chalk.red('Error cause:'), error.cause);
			}
			// Optional: Add a small delay if needed, e.g., await new Promise(res => setTimeout(res, 200));
		}
	}

	console.log(
		chalk.green(
			`Successfully recorded ${successfulPredictions}/${actualCount} predictions for market ${market.id}`
		)
	);
	return successfulPredictions;
}

/**
 * Prediction generation utilities for fixture generation
 *
 * Creates predictions for markets using multiple user accounts
 */

import { parseEther, type Address, createWalletClient, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES } from './utils/wallets';
import { getRandomBoolean, shuffleArray, sleep } from './utils/helpers';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import chalk from 'chalk';

// Outcome constants (from memory: uint8 values 0 for Bearish, 1 for Bullish)
export const OUTCOME_BEARISH = 0;
export const OUTCOME_BULLISH = 1;

// We'll use the contract ABI from the generated types

/**
 * Generates a random swap amount (the base amount for the transaction)
 *
 * @returns Random swap amount in wei
 */
function getRandomSwapAmount(): bigint {
	// Generate a random amount between 0.5 and 2.5 ETH for larger transactions
	const ethAmount = 0.5 + Math.random() * 2.0;
	return parseEther(ethAmount.toFixed(6));
}

/**
 * Calculates the conviction stake based on the swap amount
 * According to the SwapCast protocol, conviction stake is 1% of the swap amount
 *
 * @param swapAmount The swap amount in wei
 * @returns Conviction stake amount in wei
 */
function calculateConvictionStake(swapAmount: bigint): bigint {
	// Conviction stake is 1% of the swap amount as per SwapCast protocol design
	return swapAmount / BigInt(100);
}

/**
 * Calculates the protocol fee for a conviction stake
 *
 * @param convictionStake Conviction stake amount in wei
 * @returns Protocol fee in wei
 */
function calculateProtocolFee(convictionStake: bigint): bigint {
	// Protocol fee is 5% of conviction stake
	return (convictionStake * BigInt(5)) / BigInt(100);
}

/**
 * Calculates the total amount to send (conviction stake + protocol fee)
 *
 * @param convictionStake Conviction stake amount in wei
 * @returns Total amount to send in wei
 */
function calculateTotalAmount(convictionStake: bigint): bigint {
	const protocolFee = calculateProtocolFee(convictionStake);
	return convictionStake + protocolFee;
}

// The Anvil check will be done in index.ts

/**
 * Generates predictions for a market using multiple user accounts
 * Includes nonce management and retry logic for reliable transaction processing
 *
 * @param marketId Market ID to generate predictions for
 * @param userAccounts Array of user accounts to use for predictions
 * @param count Number of predictions to generate
 */
export async function generatePredictions(
	marketId: string | number,
	userAccounts: any[],
	count: number = 25
) {
	console.log(chalk.blue(`Generating ${count} predictions for market ${marketId}...`));

	// Shuffle user accounts to use different ones for each prediction
	const shuffledUsers = shuffleArray([...userAccounts]);

	// Track successful predictions
	let successfulPredictions = 0;
	let failedPredictions = 0;

	// Create a public client for transaction receipts and nonce tracking
	const publicClient = createPublicClient({
		chain: anvil,
		transport: http()
	});

	// Get the prediction manager contract instance
	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: anvil,
		transport: http()
	});

	// Track nonces for each account to prevent "replacement transaction underpriced" errors
	const nonceTracker: Record<string, number> = {};

	// Initialize nonces for all accounts we'll use
	for (const user of shuffledUsers) {
		const address = user.address as Address;
		const currentNonce = await publicClient.getTransactionCount({
			address
		});
		nonceTracker[address] = currentNonce;
	}

	// Process predictions in parallel batches
	const BATCH_SIZE = 3; // Reduce batch size to 3 predictions in parallel to avoid overwhelming Anvil
	
	// Define prediction task type
	type PredictionTask = {
		userAccount: any;
		outcome: number;
		convictionStake: bigint;
		totalAmount: bigint;
		index: number;
	};

	// Prepare all prediction tasks
	const predictionTasks: PredictionTask[] = [];
	
	for (let i = 0; i < count; i++) {
		// Get a user account (cycling through the available ones)
		const userAccount = shuffledUsers[i % shuffledUsers.length];
		
		// Generate random outcome (0 for Bearish, 1 for Bullish)
		const outcome = getRandomBoolean() ? OUTCOME_BULLISH : OUTCOME_BEARISH;
		
		// Generate random swap amount (this would be the amount the user is swapping in a real scenario)
		const swapAmount = getRandomSwapAmount();
		
		// Calculate conviction stake (1% of swap amount)
		const convictionStake = calculateConvictionStake(swapAmount);
		
		// Calculate protocol fee (5% of conviction stake)
		const protocolFee = calculateProtocolFee(convictionStake);
		const totalAmount = convictionStake + protocolFee;
		
		// Create prediction task
		predictionTasks.push({
			userAccount,
			outcome,
			convictionStake,
			totalAmount,
			index: i
		});
	}
	
	// Process predictions in batches
	const predictionBatches: PredictionTask[][] = [];
	for (let i = 0; i < predictionTasks.length; i += BATCH_SIZE) {
		predictionBatches.push(predictionTasks.slice(i, i + BATCH_SIZE));
	}
	
	// Process each batch
	for (let batchIndex = 0; batchIndex < predictionBatches.length; batchIndex++) {
		const batch = predictionBatches[batchIndex];
		console.log(chalk.blue(`Processing batch ${batchIndex + 1}/${predictionBatches.length} for market ${marketId}...`));
		
		await Promise.all(
			batch.map(async ({ userAccount, outcome, convictionStake, totalAmount, index }) => {
				const address = userAccount.address as Address;
				let retries = 0;
				const MAX_RETRIES = 3;
				let success = false;
				let lastError: any = null;
				
				// Retry logic with exponential backoff
				while (retries <= MAX_RETRIES && !success) {
					try {
						// Get the current nonce for this account
						const nonce = nonceTracker[address];
						
						console.log(
							chalk.cyan(
								`User ${address.slice(0, 8)}... predicting ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} on market ${marketId} with stake ${convictionStake} ETH (total: ${totalAmount} ETH, nonce: ${nonce})`
							)
						);
						
						// Create a wallet client for the user
						const userClient = createWalletClient({
							chain: anvil,
							transport: http(),
							account: userAccount.address
						});
						
						// Execute the transaction with explicit nonce
						const hash = await userClient.writeContract({
							address: predictionManager.address,
							abi: predictionManager.abi,
							functionName: 'recordPrediction',
							args: [userAccount.address, BigInt(marketId), outcome, convictionStake],
							account: address,
							value: totalAmount,
							chain: anvil,
							nonce // Explicitly set the nonce
						});
						
						// Increment the nonce for next transaction from this account
						nonceTracker[address]++;
						
						// Wait for transaction confirmation
						const receipt = await publicClient.waitForTransactionReceipt({ hash });
						
						// Verify that the transaction was actually successful by checking logs
						if (receipt.status === 'success') {
							// Check if the transaction has the expected event logs
							const logs = receipt.logs || [];
							if (logs.length > 0) {
								console.log(chalk.green(`✅ Prediction recorded with hash: ${hash} (status: ${receipt.status}, with ${logs.length} logs)`));
							} else {
								console.log(chalk.yellow(`⚠️ Transaction succeeded but no logs found. This might indicate a silent failure: ${hash}`));
								throw new Error('Transaction succeeded but no logs found');
							}
						} else {
							console.log(chalk.red(`❌ Transaction failed with status: ${receipt.status}`));
							throw new Error(`Transaction failed with status: ${receipt.status}`);
						}
						successfulPredictions++;
						success = true;
					} catch (error: any) {
						lastError = error;
						retries++;
						
						// Check if it's a nonce-related error
						const errorMessage = error.message || '';
						if (errorMessage.includes('nonce') || errorMessage.includes('underpriced')) {
							console.log(chalk.yellow(`⚠️ Nonce issue detected for ${address.slice(0, 8)}... Refreshing nonce.`));
							
							try {
								// Re-fetch the current nonce from the network
								const currentNonce = await publicClient.getTransactionCount({
									address
								});
								nonceTracker[address] = currentNonce;
							} catch (nonceError) {
								console.error(chalk.red(`Failed to refresh nonce: ${nonceError}`));
							}
						}
						
						if (retries <= MAX_RETRIES) {
							// Exponential backoff: 500ms, 1000ms, 2000ms
							const backoffTime = 500 * Math.pow(2, retries - 1);
							console.log(chalk.yellow(`Retrying in ${backoffTime}ms (attempt ${retries}/${MAX_RETRIES})...`));
							await sleep(backoffTime);
						} else {
							console.error(
								chalk.red(`❌ Failed to record prediction after ${MAX_RETRIES} attempts for user ${address.slice(0, 8)}...`),
								error
							);
							failedPredictions++;
						}
					}
				}
			})
		);
		
		// Adaptive delay between batches based on batch index
		// Use a longer base delay (2 seconds) and increase it more aggressively for later batches
		const baseDelay = 2000;
		const adaptiveDelay = baseDelay + (batchIndex * 500);
		console.log(chalk.yellow(`Waiting ${adaptiveDelay}ms before next batch...`));
		await sleep(adaptiveDelay);
	}

	console.log(chalk.green(`✅ Generated ${successfulPredictions} predictions for market ${marketId}`));
	if (failedPredictions > 0) {
		console.log(chalk.yellow(`⚠️ Failed to generate ${failedPredictions} predictions for market ${marketId}`));
	}
}

/**
 * SwapCast Fixture Generator
 *
 * This script generates test fixtures for the SwapCast application:
 * - Creates markets with different expiration dates
 * - Sets up Uniswap v4 pools for each market
 */

import { createPublicClient, http, type Address } from 'viem';
import { anvil } from 'viem/chains';
import { generateMarkets, MarketCreationResult } from './markets';
import { generatePredictions } from './predictions';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES, setupWallets } from './utils/wallets';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { getPoolManager } from '../src/generated/types/PoolManager';
import chalk from 'chalk';

/**
 * Configuration constants for fixtures generation
 * Adjust these values to control the behavior of the script
 */
const CONFIG = {
	MARKETS_COUNT: 20, // Generate 20 markets
	PREDICTIONS_PER_MARKET: 8, // Number of predictions per market
	BATCH_SIZE: 3, // Process 3 markets in parallel
	ADMIN_ACCOUNT_INDEX: 0 // Use the first account as admin
};

/**
 * Check if Anvil is running and contracts are deployed
 * Uses the generated client functions to verify contract deployment
 *
 * @returns True if Anvil is running and contracts are deployed
 */
async function checkAnvilAndContracts() {
	try {
		// Check if we can connect to Anvil
		const publicClient = createPublicClient({
			chain: anvil,
			transport: http()
		});

		const blockNumber = await publicClient.getBlockNumber();
		console.log(chalk.blue(`Connected to Anvil, current block: ${blockNumber}`));

		// Get contract instances using the generated client functions
		const predictionManager = getPredictionManager({
			address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
			chain: anvil,
			transport: http()
		});

		const poolManager = getPoolManager({
			address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
			chain: anvil,
			transport: http()
		});

		// Try to read from the contracts to verify they're deployed
		try {
			// Simple read operations that will fail if contracts aren't properly deployed
			await predictionManager.read.owner();
			await poolManager.read.owner();
			
			console.log(chalk.green('✅ All required contracts are deployed and accessible'));
			return true;
		} catch (contractError) {
			console.error(
				chalk.red('❌ Required contracts are not deployed or not accessible. Please run the deployment script first.')
			);
			console.error(chalk.yellow('Error details:'), contractError);
			return false;
		}
	} catch (error) {
		console.error(chalk.red('❌ Failed to connect to Anvil:'), error);
		return false;
	}
}

async function main() {
	console.log(chalk.blue('🚀 Starting SwapCast fixture generation'));

	try {
		// Check if Anvil is running and contracts are deployed
		console.log(chalk.yellow('⚙️ Checking if Anvil is running and contracts are deployed...'));
		const isReady = await checkAnvilAndContracts();
		if (!isReady) {
			console.error(chalk.red('❌ Anvil is not running or contracts are not deployed'));
			console.error(chalk.yellow('Please run the deployment script first:'));
			console.error(chalk.yellow('npm run env:start'));
			process.exit(1);
		}

		// Setup wallets for testing
		console.log(chalk.yellow('⚙️ Setting up test wallets...'));
		const { publicClient, adminAccount, userAccounts } = await setupWallets();
		console.log(chalk.green(`✅ Admin account: ${adminAccount.address}`));
		console.log(chalk.green(`✅ Set up ${userAccounts.length} user accounts`));
		
		// Setup all accounts for predictions (regular accounts + whale accounts)
		console.log(chalk.yellow('⚙️ Setting up additional whale accounts...'));
		
		// Create prediction accounts array with regular user accounts
		const allPredictionAccounts = [...userAccounts];
		
		// Add whale accounts directly - no need for explicit impersonation with Viem
		// Viem will handle impersonation when we use these addresses in the 'account' parameter
		for (const [key, address] of Object.entries(WHALE_ADDRESSES)) {
			// Fund the whale account with a large amount of ETH to ensure sufficient funds
			// We need enough for both transaction value and gas costs
			const balance = await publicClient.getBalance({ address });
			if (balance < BigInt(100) * BigInt(1e18)) { // Less than 100 ETH
				await publicClient.request({
					method: 'anvil_setBalance' as any,
					params: [address, ('0x' + (BigInt(1000) * BigInt(1e18)).toString(16)) as any] // 1000 ETH
				});
				console.log(chalk.blue(`Funded whale account ${address} with 1000 ETH`));
			}
			
			// Add the whale account to our accounts list using type assertion
			(allPredictionAccounts as any).push({ address });
			console.log(chalk.green(`✅ Added whale account ${key} at address ${address}`));
		}
		
		console.log(chalk.green(`✅ Total accounts available for predictions: ${allPredictionAccounts.length}`));

		// Generate markets and pools
		console.log(chalk.yellow('🏪 Generating markets and pools...'));
		let markets: MarketCreationResult[] = [];
		try {
			markets = await generateMarkets(adminAccount, CONFIG.MARKETS_COUNT);
			console.log(chalk.green(`✅ Created ${markets.length} markets with pools`));
		} catch (error) {
			console.error(chalk.red('❌ Error generating markets:'));
			console.error(error);
			process.exit(1);
		}

		// Generate predictions for each market in parallel (with a batch size to avoid overwhelming the network)
		console.log(chalk.yellow('🔮 Generating predictions for each market in parallel...'));
		const BATCH_SIZE = 2; // Process this many markets in parallel
		
		// Create batches of markets
		const marketBatches = [];
		for (let i = 0; i < markets.length; i += BATCH_SIZE) {
			//@ts-ignore
			marketBatches.push(markets.slice(i, i + BATCH_SIZE));
		}
		
		// Process each batch with adaptive delays between batches
		let totalPredictionsGenerated = 0;
		let totalPredictionsFailed = 0;
		
		for (let batchIndex = 0; batchIndex < marketBatches.length; batchIndex++) {
			const batch = marketBatches[batchIndex] as MarketCreationResult[];
			console.log(chalk.cyan(`📊 Processing batch ${batchIndex + 1}/${marketBatches.length} (${batch.length} markets)...`));
			
			try {
				const results = await Promise.all(
					batch.map(async (market: MarketCreationResult) => {
							// Use all available accounts to create predictions
							const predictionsCount = CONFIG.PREDICTIONS_PER_MARKET;
							console.log(
								chalk.cyan(
									`📊 Generating ${predictionsCount} predictions for market ${market.id} (${market.name})`
								)
							);
							
							try {
								// Shuffle the accounts for each market to ensure different accounts make predictions
								const shuffledAccounts = [...allPredictionAccounts].sort(() => Math.random() - 0.5);
								
								// Use a subset of accounts for this market (limited by predictionsCount)
								const accountsForThisMarket = shuffledAccounts.slice(0, predictionsCount);
								
								const result = await generatePredictions(market, accountsForThisMarket, predictionsCount);
								return { success: true, market, result };
							} catch (error) {
								console.error(chalk.red(`❌ Error generating predictions for market ${market.id}:`));
								console.error(error);
								return { success: false, market, error };
							}
					})
				);
				
				// Count successful and failed predictions using actual results
				results.forEach(result => {
					if (result.success && result.result !== undefined) {
						// Our simplified implementation returns the number of successful predictions directly
						totalPredictionsGenerated += result.result;
						// Calculate failed predictions as the difference between attempted and successful
						const attempted = 1; // We're only generating 1 prediction per market
						totalPredictionsFailed += (attempted - result.result);
					} else {
						// If the entire market failed, count it as one failed prediction
						totalPredictionsFailed++;
					}
				});
				
			} catch (error) {
				console.error(chalk.red(`❌ Error processing batch ${batchIndex + 1}:`));
				console.error(error);
			}
			
			// Add adaptive delay between batches if not the last batch
			if (batchIndex < marketBatches.length - 1) {
				// Increase delay for later batches to avoid network congestion
				// Use a longer base delay (3 seconds) to give Anvil more time to process transactions
				const baseDelay = 3000;
				const adaptiveDelay = baseDelay + (batchIndex * 1000);
				console.log(chalk.yellow(`⏳ Waiting ${adaptiveDelay}ms before next batch...`));
				await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
			}
		}

		console.log(chalk.green('✅ All fixtures generated successfully!'));
		console.log(chalk.blue('📝 Summary:'));
		console.log(chalk.blue(`- Markets created: ${markets.length}`));
		console.log(chalk.blue(`- Total predictions generated: ~${totalPredictionsGenerated}`));
		if (totalPredictionsFailed > 0) {
			console.log(chalk.yellow(`⚠️ Failed markets: ${totalPredictionsFailed}`));
		}
	} catch (error) {
		console.error(chalk.red('❌ Error generating fixtures:'));
		console.error(error);
		process.exit(1);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(chalk.red('❌ Fatal error:'));
		console.error(error);
		process.exit(1);
	});

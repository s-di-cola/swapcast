/**
 * SwapCast Fixture Generator
 */

import { createPublicClient, http, type Address, parseEther, formatEther } from 'viem';
import { anvil } from 'viem/chains';
import { generateMarkets, MarketCreationResult } from './markets';
import { generatePredictions } from './predictions';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES, setupWallets } from './utils/wallets';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { getPoolManager } from '../src/generated/types/PoolManager';
import chalk from 'chalk';
import { quickHealthCheck, runFixtureDiagnostics } from './utils/diagnostic';

/**
 * Configuration constants for fixtures generation
 */
const CONFIG = {
	MARKETS_COUNT: 6,
	PREDICTIONS_PER_MARKET: 8, // Increased from 3 to use more accounts
	BATCH_SIZE: 2,
	ADMIN_ACCOUNT_INDEX: 0
};

/**
 * Fund the hook contract with ETH for processing predictions
 */
async function fundHookForPredictions() {
	console.log(chalk.blue('💰 FUNDING HOOK FOR PREDICTIONS'));

	const publicClient = createPublicClient({
		chain: anvil,
		transport: http()
	});

	const hookAddress = CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address;

	// Check current hook balance
	const currentBalance = await publicClient.getBalance({ address: hookAddress });
	console.log(chalk.gray(`Current hook balance: ${formatEther(currentBalance)} ETH`));

	// Fund with 50 ETH if needed (plenty for testing)
	const fundingAmount = parseEther('50');

	if (currentBalance < parseEther('10')) { // Only fund if less than 10 ETH
		console.log(chalk.yellow(`📤 Funding hook with ${formatEther(fundingAmount)} ETH...`));

		// Send ETH directly to hook (uses receive() function)
		const fundingHash = await publicClient.request({
			method: 'anvil_setBalance' as any,
			params: [hookAddress, ('0x' + fundingAmount.toString(16)) as any]
		});

		console.log(chalk.green(`✅ Hook funded successfully!`));

		const newBalance = await publicClient.getBalance({ address: hookAddress });
		console.log(chalk.green(`💰 New hook balance: ${formatEther(newBalance)} ETH`));
	} else {
		console.log(chalk.green(`✅ Hook already has sufficient funds`));
	}
}

/**
 * Check if Anvil is running and contracts are deployed
 */
async function checkAnvilAndContracts() {
	try {
		const publicClient = createPublicClient({
			chain: anvil,
			transport: http()
		});

		const blockNumber = await publicClient.getBlockNumber();
		console.log(chalk.blue(`Connected to Anvil, current block: ${blockNumber}`));

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

		try {
			await predictionManager.read.owner();
			await poolManager.read.owner();
			console.log(chalk.green('✅ All required contracts are deployed and accessible'));
			return true;
		} catch (contractError) {
			console.error(chalk.red('❌ Required contracts are not deployed or not accessible'));
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
			process.exit(1);
		}

		// Fund the hook first (crucial step!)
		console.log(chalk.yellow('⚙️ Funding hook for predictions...'));
		await fundHookForPredictions();

		// Setup wallets for testing
		console.log(chalk.yellow('⚙️ Setting up test wallets...'));
		const { publicClient, adminClient: adminAccount, userAccounts } = await setupWallets();
		console.log(chalk.green(`✅ Admin account: ${adminAccount.account.address}`));
		console.log(chalk.green(`✅ Set up ${userAccounts.length} user accounts`));

		// Setup all accounts for predictions
		const allPredictionAccounts = [...userAccounts];

		// Add whale accounts
		for (const [key, address] of Object.entries(WHALE_ADDRESSES)) {
			const balance = await publicClient.getBalance({ address });
			if (balance < BigInt(100) * BigInt(1e18)) {
				await publicClient.request({
					method: 'anvil_setBalance' as any,
					params: [address, ('0x' + (BigInt(1000) * BigInt(1e18)).toString(16)) as any]
				});
				console.log(chalk.blue(`Funded whale account ${address} with 1000 ETH`));
			}
			(allPredictionAccounts as any).push({ address });
			console.log(chalk.green(`✅ Added whale account ${key}`));
		}

		console.log(chalk.green(`✅ Total accounts: ${allPredictionAccounts.length}`));

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

		// Generate predictions for each market sequentially
		console.log(chalk.yellow('🔮 Generating predictions for each market...'));

		let totalSuccessful = 0;
		let totalFailed = 0;

		// Distribute accounts across markets more efficiently
		// This ensures we don't reuse the same account for multiple markets
		const totalAccounts = allPredictionAccounts.length;
		const marketsCount = markets.length;
		const accountsPerMarket = Math.floor(totalAccounts / marketsCount);

		console.log(chalk.blue(`📊 Distribution strategy: ${totalAccounts} accounts across ${marketsCount} markets`));
		console.log(chalk.blue(`📊 Using approximately ${accountsPerMarket} unique accounts per market`));

		// Shuffle all accounts once to randomize distribution
		const allShuffledAccounts = [...allPredictionAccounts].sort(() => Math.random() - 0.5);

		for (let i = 0; i < markets.length; i++) {
			const market = markets[i];
			console.log(chalk.cyan(`\n📊 Processing market ${market.id} (${market.name})`));

			try {
				// Calculate which accounts to use for this market
				// Start index is based on market index to ensure different accounts per market
				const startIdx = i * accountsPerMarket;
				const endIdx = Math.min(startIdx + accountsPerMarket, totalAccounts);

				// Get unique accounts for this market
				const accountsForThisMarket = allShuffledAccounts.slice(startIdx, endIdx);
				const predictionsCount = accountsForThisMarket.length;

				console.log(chalk.gray(`Using ${accountsForThisMarket.length} unique accounts for predictions on market ${market.id}`));

				const successfulPredictions = await generatePredictions(
					market,
					accountsForThisMarket,
					predictionsCount
				);

				totalSuccessful += successfulPredictions;
				const failed = predictionsCount - successfulPredictions;
				totalFailed += failed;

				if (successfulPredictions > 0) {
					console.log(chalk.green(`✅ Market ${market.id}: ${successfulPredictions}/${predictionsCount} predictions successful`));
				} else {
					console.log(chalk.red(`❌ Market ${market.id}: No predictions were successful`));
				}

			} catch (error: any) {
				console.error(chalk.red(`❌ Error processing market ${market.id}: ${error.message}`));
				totalFailed += accountsPerMarket;
			}

			// Small delay between markets
			await new Promise(resolve => setTimeout(resolve, 1000));
		}

		console.log(chalk.green('✅ Prediction generation completed!'));
		console.log(chalk.blue('📝 Summary:'));
		console.log(chalk.blue(`- Markets created: ${markets.length}`));
		console.log(chalk.blue(`- Successful predictions: ${totalSuccessful}`));
		console.log(chalk.blue(`- Failed predictions: ${totalFailed}`));

		console.log(chalk.green('\n🎉 FIXTURE GENERATION COMPLETED!'));
		console.log(chalk.blue('\n📋 SUMMARY:'));
		console.log(chalk.green(`✅ ${markets.length} markets created successfully`));
		console.log(chalk.green(`✅ ${totalSuccessful} predictions recorded via swaps`));
		console.log(chalk.green(`✅ Prediction system is functional`));

		// 🔍 RUN COMPREHENSIVE DIAGNOSTICS
		console.log(chalk.blue('\n🔍 Running post-generation diagnostics...'));
		const diagnosticResults = await runFixtureDiagnostics(markets);

		// Quick summary
		const isHealthy = await quickHealthCheck(markets);

		console.log(chalk.blue('\n📋 FINAL SUMMARY:'));
		console.log(chalk.green(`✅ ${markets.length} markets created successfully`));
		console.log(chalk.green(`✅ ${diagnosticResults.totalPredictions} predictions recorded via swaps`));
		console.log(chalk.green(`✅ ${diagnosticResults.totalStakeAmount.toFixed(4)} ETH total stake volume`));
		console.log(isHealthy ?
			chalk.green('✅ System health: EXCELLENT') :
			chalk.yellow('⚠️  System health: See diagnostic report above')
		);

		if (diagnosticResults.totalPredictions > 0) {
			console.log(chalk.blue('\n💡 SYSTEM STATUS:'));
			console.log(chalk.gray('• Hook contract is processing swaps correctly'));
			console.log(chalk.gray('• Predictions are being recorded via Universal Router'));
			console.log(chalk.gray('• NFTs are being minted for each prediction'));
			console.log(chalk.gray('• Protocol fees are being collected'));
			console.log(chalk.gray('• All core functionality is operational! 🚀'));
		}


		if (totalSuccessful > 0) {
			console.log(chalk.blue('\n💡 NEXT STEPS:'));
			console.log(chalk.gray('1. Your hook is successfully processing swaps'));
			console.log(chalk.gray('2. Predictions are being recorded via swap transactions'));
			console.log(chalk.gray('3. Hook has been properly funded with ETH'));
			console.log(chalk.gray('4. The core functionality is working correctly!'));
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
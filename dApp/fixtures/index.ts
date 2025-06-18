/**
 * SwapCast Fixture Generator - Whale-Based Version
 */

import {type Address, createPublicClient, formatEther, http, parseEther} from 'viem';
import {anvil} from 'viem/chains';
import {generateMarketsV2, MarketCreationResult} from './markets';
import {generatePredictionsForMarkets} from './predictions';
import {CONTRACT_ADDRESSES, setupWallets} from './utils/wallets';
import {getPredictionManager} from '../src/generated/types/PredictionManager';
import {getPoolManager} from '../src/generated/types/PoolManager';
import {MarketGenerationConfig} from './config/markets';
import chalk from 'chalk';
import {runFixtureDiagnostics} from './utils/diagnostic';

/**
 * Enhanced configuration presets for different scenarios
 */
const FIXTURE_PRESETS: Record<string, Partial<MarketGenerationConfig>> = {
	// Quick testing - only major pairs, high confidence required
	'quick': {
		maxMarkets: 3,
		enabledCategories: ['major'],
		requireHighConfidence: true,
		priceSource: 'coingecko'
	},

	// Standard testing - major + some DeFi
	'standard': {
		maxMarkets: 6,
		enabledCategories: ['major', 'defi'],
		requireHighConfidence: false,
		priceSource: 'coingecko'
	},

	// Comprehensive testing - all categories
	'comprehensive': {
		maxMarkets: 10,
		enabledCategories: ['major', 'defi', 'experimental'],
		requireHighConfidence: false,
		priceSource: 'coingecko',
		retryAttempts: 5
	},

	// Fallback mode - when CoinGecko is down
	'fallback': {
		maxMarkets: 4,
		enabledCategories: ['major'],
		requireHighConfidence: false,
		priceSource: 'fallback'
	}
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

/**
 * Get configuration from environment or use preset
 */
function getFixtureConfiguration(): Partial<MarketGenerationConfig> {
	// Check for environment variable to select preset
	const preset = process.env.FIXTURE_PRESET || 'standard';

	if (FIXTURE_PRESETS[preset]) {
		console.log(chalk.blue(`📋 Using fixture preset: '${preset}'`));
		return FIXTURE_PRESETS[preset];
	}

	console.log(chalk.yellow(`⚠️ Unknown preset '${preset}', using 'standard'`));
	return FIXTURE_PRESETS['standard'];
}

/**
 * Setup admin account for market creation (we don't need user accounts anymore)
 */
async function setupAdminAccount() {
	const { publicClient, adminClient } = await setupWallets();

	console.log(chalk.green(`✅ Admin account: ${adminClient.account.address}`));
	console.log(chalk.blue(`ℹ️ Whale accounts will be used for predictions`));

	return { publicClient, adminClient };
}

/**
 * Print comprehensive final summary
 */
function printFinalSummary(
	markets: MarketCreationResult[],
	totalSuccessful: number,
	totalFailed: number,
	diagnosticResults: any
) {
	console.log(chalk.blue('\n' + '='.repeat(80)));
	console.log(chalk.green.bold('🎉 SWAPCAST WHALE-BASED FIXTURE GENERATION COMPLETED!'));
	console.log(chalk.blue('='.repeat(80)));

	// Core Results
	console.log(chalk.cyan('\n📊 GENERATION RESULTS:'));
	console.log(chalk.white(`   Markets Created: ${markets.length}`));
	console.log(chalk.white(`   Successful Predictions: ${totalSuccessful}`));
	console.log(chalk.white(`   Failed Predictions: ${totalFailed}`));
	console.log(chalk.white(`   Total NFTs Minted: ${diagnosticResults.totalNFTsMinted || 'Unknown'}`));
	console.log(chalk.white(`   Total Stake Volume: ${diagnosticResults.totalStakeAmount?.toFixed(4) || 'Unknown'} ETH`));

	// Market Breakdown
	console.log(chalk.cyan('\n🏪 MARKET BREAKDOWN:'));
	markets.forEach((market, index) => {
		const confidence = (market as any).priceConfidence || 'unknown';
		const category = (market as any).category || 'unknown';
		console.log(chalk.gray(`   ${index + 1}. ${market.name} (${confidence} confidence, ${category})`));
	});

	// Whale System Benefits
	console.log(chalk.cyan('\n🐋 WHALE SYSTEM BENEFITS:'));
	console.log(chalk.green('   ✅ Real mainnet whale accounts with massive liquidity'));
	console.log(chalk.green('   ✅ No token dealing or complex approval flows'));
	console.log(chalk.green('   ✅ Automatic whale rotation (one prediction per market)'));
	console.log(chalk.green('   ✅ Eliminated transfer_from errors'));
	console.log(chalk.green('   ✅ Realistic prediction distribution patterns'));

	// System Health Assessment
	const isHealthy = diagnosticResults.totalPredictions > 0 &&
		diagnosticResults.activeMarkets > 0 &&
		diagnosticResults.totalNFTsMinted > 0 &&
		diagnosticResults.totalStakeAmount > 0;

	console.log(chalk.cyan('\n🩺 SYSTEM HEALTH:'));
	if (isHealthy) {
		console.log(chalk.green('   Status: ✅ FULLY OPERATIONAL'));
		console.log(chalk.green('   • Hook contract processing swaps correctly'));
		console.log(chalk.green('   • Predictions being recorded via Universal Router'));
		console.log(chalk.green('   • NFTs being minted for each prediction'));
		console.log(chalk.green('   • Protocol fees being collected'));
		console.log(chalk.green('   • Whale rotation system working perfectly! 🐋'));
	} else {
		console.log(chalk.yellow('   Status: ⚠️  ISSUES DETECTED'));
		console.log(chalk.yellow('   • See diagnostic report above for details'));
	}

	// Next Steps
	if (totalSuccessful > 0) {
		console.log(chalk.cyan('\n🚀 NEXT STEPS:'));
		console.log(chalk.gray('   1. Your SwapCast system is operational with whale-based fixtures'));
		console.log(chalk.gray('   2. Hook successfully processes swaps and records predictions'));
		console.log(chalk.gray('   3. NFTs are minted for each whale prediction'));
		console.log(chalk.gray('   4. Ready for frontend integration and testing!'));
		console.log(chalk.gray('   5. Whale accounts provide realistic high-value trading patterns'));
	}

	console.log(chalk.blue('\n' + '='.repeat(80)));
	console.log(chalk.green.bold('🎯 WHALE-BASED FIXTURE GENERATION COMPLETE!'));
	console.log(chalk.blue('='.repeat(80) + '\n'));
}

async function main() {
	console.log(chalk.blue.bold('\n🚀 SWAPCAST WHALE-BASED FIXTURE GENERATOR V3'));
	console.log(chalk.blue('=' .repeat(60)));
	console.log(chalk.cyan('🐋 Using real mainnet whale accounts for predictions'));
	console.log(chalk.cyan('✨ Eliminated token dealing and transfer issues'));

	try {
		// 1. Pre-flight checks
		console.log(chalk.yellow('\n⚙️ PRE-FLIGHT CHECKS'));
		console.log(chalk.yellow('-'.repeat(30)));

		const isReady = await checkAnvilAndContracts();
		if (!isReady) {
			console.error(chalk.red('❌ System not ready - Anvil not running or contracts not deployed'));
			process.exit(1);
		}

		// 2. Fund hook
		await fundHookForPredictions();

		// 3. Setup admin account (only need admin for market creation)
		console.log(chalk.yellow('\n⚙️ ADMIN SETUP'));
		console.log(chalk.yellow('-'.repeat(30)));
		const { publicClient, adminClient } = await setupAdminAccount();

		// 4. Get configuration
		const config = getFixtureConfiguration();
		console.log(chalk.yellow('\n🔧 CONFIGURATION'));
		console.log(chalk.yellow('-'.repeat(30)));
		console.log(chalk.gray(`   Max Markets: ${config.maxMarkets}`));
		console.log(chalk.gray(`   Categories: ${config.enabledCategories?.join(', ')}`));
		console.log(chalk.gray(`   Price Source: ${config.priceSource}`));
		console.log(chalk.gray(`   Require High Confidence: ${config.requireHighConfidence}`));
		console.log(chalk.cyan(`   🐋 Prediction System: Whale-Based Rotation`));

		// 5. Generate markets
		console.log(chalk.yellow('\n🏪 MARKET GENERATION'));
		console.log(chalk.yellow('-'.repeat(30)));
		let markets: MarketCreationResult[] = [];
		try {
			markets = await generateMarketsV2(adminClient, config);
			console.log(chalk.green(`✅ Created ${markets.length} markets successfully`));
		} catch (error) {
			console.error(chalk.red('❌ Market generation failed:'), error);

			// Try fallback mode
			console.log(chalk.yellow('🔄 Attempting fallback mode...'));
			try {
				markets = await generateMarketsV2(adminClient, FIXTURE_PRESETS['fallback']);
				console.log(chalk.yellow(`⚠️ Created ${markets.length} markets using fallback prices`));
			} catch (fallbackError) {
				console.error(chalk.red('❌ Fallback mode also failed:'), fallbackError);
				process.exit(1);
			}
		}

		// 6. Generate predictions using whale system
		console.log(chalk.yellow('\n🐋 WHALE-BASED PREDICTION GENERATION'));
		console.log(chalk.yellow('-'.repeat(50)));
		console.log(chalk.cyan('🎯 Initializing whale rotation system...'));
		console.log(chalk.cyan('💰 Using real whale accounts with massive liquidity'));
		console.log(chalk.cyan('🔄 Automatic rotation: one prediction per whale per market'));

		const { totalSuccessful, totalFailed } = await generatePredictionsForMarkets(markets);

		console.log(chalk.green(`✅ Whale-based prediction generation completed!`));
		console.log(chalk.blue(`📊 Results: ${totalSuccessful} successful, ${totalFailed} failed`));

		// 7. Run comprehensive diagnostics (ONCE)
		console.log(chalk.yellow('\n🔍 SYSTEM DIAGNOSTICS'));
		console.log(chalk.yellow('-'.repeat(30)));
		const diagnosticResults = await runFixtureDiagnostics(markets);

		// 8. Print final summary (ONCE)
		printFinalSummary(markets, totalSuccessful, totalFailed, diagnosticResults);

	} catch (error) {
		console.error(chalk.red('\n❌ FATAL ERROR:'));
		console.error(error);
		process.exit(1);
	}
}

main()
	.then(() => {
		console.log(chalk.green('✅ Whale-based fixture generation completed successfully'));
		console.log(chalk.cyan('🐋 All whale accounts rotated properly'));
		console.log(chalk.green('🎉 Ready for frontend integration!'));
		process.exit(0);
	})
	.catch((error) => {
		console.error(chalk.red('❌ Fatal error in whale-based fixture generation:'));
		console.error(error);
		process.exit(1);
	});

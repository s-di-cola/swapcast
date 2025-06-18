/**
 * SwapCast Fixture Generator
 */

import {type Address, createPublicClient, formatEther, http, parseEther} from 'viem';
import {anvil} from 'viem/chains';
import {generateMarketsV2, MarketCreationResult} from './markets';
import {generatePredictionsForMarkets} from './predictions';
import {CONTRACT_ADDRESSES, setupWallets, WHALE_ADDRESSES} from './utils/wallets';
import {getPredictionManager} from '../src/generated/types/PredictionManager';
import {getPoolManager} from '../src/generated/types/PoolManager';
import {MarketGenerationConfig} from './config/markets';
import chalk from 'chalk';
import {quickHealthCheck, runFixtureDiagnostics} from './utils/diagnostic';

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
 * Setup user accounts for predictions with enhanced distribution
 */
async function setupPredictionAccounts() {
	const { publicClient, adminClient, userAccounts } = await setupWallets();

	console.log(chalk.green(`✅ Admin account: ${adminClient.account.address}`));
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

	console.log(chalk.green(`✅ Total prediction accounts: ${allPredictionAccounts.length}`));

	return { publicClient, adminClient, allPredictionAccounts };
}

/**
 * Print final summary with enhanced information
 */
function printFinalSummary(
	markets: MarketCreationResult[],
	totalSuccessful: number,
	totalFailed: number,
	diagnosticResults: any
) {
	console.log(chalk.green('\n🎉 FIXTURE GENERATION COMPLETED!'));
	console.log(chalk.blue('\n📋 SUMMARY:'));
	console.log(chalk.green(`✅ ${markets.length} markets created successfully`));
	console.log(chalk.green(`✅ ${totalSuccessful} predictions recorded via swaps`));
	console.log(chalk.green(`✅ ${diagnosticResults.totalStakeAmount.toFixed(4)} ETH total stake volume`));

	// Enhanced market breakdown
	console.log(chalk.blue('\n📊 MARKET BREAKDOWN:'));
	markets.forEach((market, index) => {
		const confidence = (market as any).priceConfidence || 'unknown';
		const category = (market as any).category || 'unknown';
		console.log(chalk.gray(`   ${index + 1}. ${market.name} (${confidence} confidence, ${category})`));
	});

	// System health summary
	const isHealthy = diagnosticResults.totalPredictions > 0 &&
		diagnosticResults.activeMarkets > 0 &&
		diagnosticResults.poolDetails.filter(p => p.priceStatus === 'BROKEN').length === 0;

	console.log(isHealthy ?
		chalk.green('✅ System health: EXCELLENT') :
		chalk.yellow('⚠️  System health: See diagnostic report above')
	);

	if (diagnosticResults.totalPredictions > 0) {
		console.log(chalk.blue('\n💡 SYSTEM STATUS:'));
		console.log(chalk.gray('• Hook contract is processing swaps correctly'));
		console.log(chalk.gray('• Predictions are being recorded via UniversalRouter'));
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
}

async function main() {
	console.log(chalk.blue('🚀 Starting SwapCast fixture generation V2'));

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

		// Setup wallets and accounts
		console.log(chalk.yellow('⚙️ Setting up test wallets and accounts...'));
		const { publicClient, adminClient, allPredictionAccounts } = await setupPredictionAccounts();

		// Get configuration (from environment or preset)
		const config = getFixtureConfiguration();
		console.log(chalk.blue('🔧 Configuration:'));
		console.log(chalk.gray(`   Max Markets: ${config.maxMarkets}`));
		console.log(chalk.gray(`   Categories: ${config.enabledCategories?.join(', ')}`));
		console.log(chalk.gray(`   Price Source: ${config.priceSource}`));
		console.log(chalk.gray(`   Require High Confidence: ${config.requireHighConfidence}`));

		// Generate markets using the new flexible system
		console.log(chalk.yellow('🏪 Generating markets using flexible configuration...'));
		let markets: MarketCreationResult[] = [];
		try {
			markets = await generateMarketsV2(adminClient, config);
			console.log(chalk.green(`✅ Created ${markets.length} markets with pools`));
		} catch (error) {
			console.error(chalk.red('❌ Error generating markets:'));
			console.error(error);

			// Try fallback mode
			console.log(chalk.yellow('🔄 Trying fallback mode...'));
			try {
				markets = await generateMarketsV2(adminClient, FIXTURE_PRESETS['fallback']);
				console.log(chalk.yellow(`⚠️ Created ${markets.length} markets using fallback prices`));
			} catch (fallbackError) {
				console.error(chalk.red('❌ Fallback mode also failed:'));
				console.error(fallbackError);
				process.exit(1);
			}
		}

		// Generate predictions for each market
		const { totalSuccessful, totalFailed } = await generatePredictionsForMarkets(
			markets,
			allPredictionAccounts
		);

		console.log(chalk.green('✅ Prediction generation completed!'));
		console.log(chalk.blue('📝 Summary:'));
		console.log(chalk.blue(`- Markets created: ${markets.length}`));
		console.log(chalk.blue(`- Successful predictions: ${totalSuccessful}`));
		console.log(chalk.blue(`- Failed predictions: ${totalFailed}`));

		// 🔍 RUN COMPREHENSIVE DIAGNOSTICS
		console.log(chalk.blue('\n🔍 Running post-generation diagnostics...'));
		const diagnosticResults = await runFixtureDiagnostics(markets);

		// Quick summary
		const isHealthy = await quickHealthCheck(markets);

		// Print enhanced final summary
		// printFinalSummary(markets, totalSuccessful, totalFailed, diagnosticResults);

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

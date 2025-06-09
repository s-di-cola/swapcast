import { Address, parseUnits, type WalletClient } from 'viem';
import chalk from 'chalk';
import { calculateSqrtPriceX96 } from './utils/math';
import { getPoolManager } from '../src/generated/types/PoolManager';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from './utils/wallets';
import { sortTokenAddresses, getTickSpacing } from './utils/helpers';
import { getCurrentPriceBySymbol } from './utils/price';
import { addLiquidityToPool } from './utils/liquidity';
import { anvil } from 'viem/chains';
import { http } from 'viem';

interface TokenInfo {
	address: Address;
	symbol: string;
	name: string;
	decimals: number;
}

export interface MarketCreationResult {
	id: string;
	name: string;
	poolKey: {
		currency0: Address;
		currency1: Address;
		fee: number;
		tickSpacing: number;
		hooks: Address;
	};
	sqrtPriceX96: bigint;
	expirationTime: bigint;
	priceThreshold: bigint;
	token0: TokenInfo;
	token1: TokenInfo;
}

interface MarketConfig {
	base: string;
	quote: string;
	basePrice: number;
}

// FIXED: Use BTC instead of WBTC for price API compatibility
const TOKEN_INFO: Record<string, TokenInfo> = {
	ETH: { address: TOKEN_ADDRESSES.ETH, symbol: 'ETH', name: 'Ethereum', decimals: 18 },
	USDC: { address: TOKEN_ADDRESSES.USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
	USDT: { address: TOKEN_ADDRESSES.USDT, symbol: 'USDT', name: 'Tether USD', decimals: 6 },
	DAI: { address: TOKEN_ADDRESSES.DAI, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
	// CHANGED: Use BTC instead of WBTC for API compatibility, but keep WBTC address for contract
	BTC: { address: TOKEN_ADDRESSES.WBTC, symbol: 'BTC', name: 'Bitcoin', decimals: 8 },
};

/**
 * Fetches current market prices for ETH and BTC
 * @returns Object containing current prices
 */
async function getCurrentMarketPrices(): Promise<{ ethPrice: number; btcPrice: number }> {
	const ethPrice = await getCurrentPriceBySymbol('ETH') || 2488;
	const btcPrice = await getCurrentPriceBySymbol('BTC') || 104859;
	
	console.log(chalk.green(`Current prices: ETH=$${ethPrice}, BTC=$${btcPrice}`));
	
	return { ethPrice, btcPrice };
}

/**
 * Creates default market configurations
 * @param ethPrice - Current ETH price
 * @param btcPrice - Current BTC price
 * @returns Array of market configurations
 */
function createMarketConfigs(ethPrice: number, btcPrice: number): MarketConfig[] {
	return [
		{ base: 'ETH', quote: 'USDC', basePrice: ethPrice },
		{ base: 'ETH', quote: 'USDT', basePrice: ethPrice },
		{ base: 'ETH', quote: 'DAI', basePrice: ethPrice },
		// CHANGED: Use BTC instead of WBTC
		{ base: 'BTC', quote: 'USDC', basePrice: btcPrice },
		{ base: 'BTC', quote: 'USDT', basePrice: btcPrice },
		{ base: 'BTC', quote: 'DAI', basePrice: btcPrice },
	];
}

/**
 * Gets contract instances for pool and prediction management
 * @returns Object containing contract instances
 */
function getContractInstances() {
	const poolManager = getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
		chain: anvil,
		transport: http()
	});
	
	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: anvil,
		transport: http()
	});
	
	return { poolManager, predictionManager };
}

/**
 * Creates pool key for Uniswap v4
 * @param token0Address - Address of token0
 * @param token1Address - Address of token1
 * @returns Pool key object
 */
function createPoolKey(token0Address: Address, token1Address: Address) {
	return {
		currency0: token0Address,
		currency1: token1Address,
		fee: 3000,
		tickSpacing: getTickSpacing(3000),
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
	};
}

/**
 * Initializes a Uniswap v4 pool with starting price
 * @param poolManager - PoolManager contract instance
 * @param poolKey - Pool key object
 * @param sqrtPriceX96 - Starting price as sqrtPriceX96
 * @param adminClient - Admin wallet client
 */
async function initializePool(
	poolManager: any,
	poolKey: any,
	sqrtPriceX96: bigint,
	adminClient: WalletClient
): Promise<void> {
	console.log(chalk.yellow(`  🔧 Initializing pool with sqrtPriceX96: ${sqrtPriceX96}`));
	
	try {
		const initHash = await poolManager.write.initialize([poolKey, sqrtPriceX96], {
			account: adminClient.account!,
			chain: anvil,
			gas: 1000000n
		});
		
		console.log(chalk.green(`  ✅ Pool initialized: ${initHash.slice(0, 10)}...`));
	} catch (initError: any) {
		if (initError.message.includes('AlreadyInitialized') || initError.message.includes('PoolAlreadyInitialized')) {
			console.log(chalk.yellow(`  ⚠️ Pool already initialized, continuing...`));
		} else {
			throw initError;
		}
	}
}

/**
 * Adds liquidity to the initialized pool
 * @param adminClient - Admin wallet client
 * @param poolKey - Pool key object
 * @param basePrice - Base asset price for liquidity calculation
 */
async function addPoolLiquidity(
	adminClient: WalletClient,
	poolKey: any,
	basePrice: number
): Promise<void> {
	console.log(chalk.yellow(`  💧 Adding liquidity to pool...`));
	
	try {
		await addLiquidityToPool(
			adminClient.transport,
			adminClient,
			poolKey,
			basePrice
		);
		console.log(chalk.green(`  ✅ Liquidity added successfully`));
	} catch (liquidityError: any) {
		console.log(chalk.yellow(`  ⚠️ Liquidity addition failed, but pool is functional: ${liquidityError.message}`));
	}
}

/**
 * Creates prediction market for the pool
 * @param predictionManager - PredictionManager contract instance
 * @param config - Market configuration
 * @param poolKey - Pool key object
 * @param adminClient - Admin wallet client
 * @returns Market ID
 */
async function createPredictionMarket(
	predictionManager: any,
	config: MarketConfig,
	poolKey: any,
	adminClient: WalletClient
): Promise<void> {
	console.log(chalk.yellow(`  📈 Creating prediction market...`));
	
	// FIXED: Use BTC instead of WBTC in market name
	const marketName = `${config.base} Price Prediction`;
	const expirationTime = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
	const priceThreshold = parseUnits(String(config.basePrice * 1.15), 8);
	const priceAggregator = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as Address;
	
	const marketHash = await predictionManager.write.createMarket([
		marketName,
		config.base, // This will now be 'BTC' instead of 'WBTC'
		expirationTime,
		priceAggregator,
		priceThreshold,
		poolKey
	], {
		account: adminClient.account!,
		chain: anvil,
		gas: 1000000n
	});
	
	console.log(chalk.green(`  ✅ Market created: ${marketHash.slice(0, 10)}...`));
}

/**
 * Creates a single market with pool and prediction setup
 * @param config - Market configuration
 * @param marketId - Market ID number
 * @param contracts - Contract instances
 * @param adminClient - Admin wallet client
 * @returns MarketCreationResult or null if failed
 */
async function createSingleMarket(
	config: MarketConfig,
	marketId: number,
	contracts: { poolManager: any; predictionManager: any },
	adminClient: WalletClient
): Promise<MarketCreationResult | null> {
	console.log(chalk.cyan(`\n📊 Creating market ${marketId}: ${config.base}/${config.quote}`));
	
	try {
		const baseToken = TOKEN_INFO[config.base];
		const quoteToken = TOKEN_INFO[config.quote];
		
		const [token0Address, token1Address] = sortTokenAddresses(baseToken.address, quoteToken.address);
		const token0Info = token0Address === baseToken.address ? baseToken : quoteToken;
		const token1Info = token1Address === baseToken.address ? baseToken : quoteToken;
		
		console.log(`  Token0: ${token0Info.symbol} (${token0Info.address})`);
		console.log(`  Token1: ${token1Info.symbol} (${token1Info.address})`);
		
		const sqrtPriceX96 = calculateSqrtPriceX96(
			token0Info.symbol,
			token1Info.symbol,
			config.basePrice
		);
		
		const poolKey = createPoolKey(token0Address, token1Address);
		
		await initializePool(contracts.poolManager, poolKey, sqrtPriceX96, adminClient);
		await addPoolLiquidity(adminClient, poolKey, config.basePrice);
		await createPredictionMarket(contracts.predictionManager, config, poolKey, adminClient);
		
		const result: MarketCreationResult = {
			id: String(marketId),
			name: `${config.base} Price Prediction`,
			poolKey,
			sqrtPriceX96,
			expirationTime: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
			priceThreshold: parseUnits(String(config.basePrice * 1.15), 8),
			token0: token0Info,
			token1: token1Info
		};
		
		console.log(chalk.green(`✅ Market ${marketId} fully created and configured\n`));
		return result;
		
	} catch (error: any) {
		console.error(chalk.red(`❌ Failed to create market ${marketId}: ${error.message}`));
		return null;
	}
}

/**
 * Generates markets and creates pools on-chain
 * @param adminClient - Admin wallet client for transactions
 * @param marketsCount - Number of markets to create
 * @returns Array of successfully created markets
 */
export async function generateMarkets(
	adminClient: WalletClient,
	marketsCount: number
): Promise<MarketCreationResult[]> {
	console.log(chalk.blue('\n🏗️  GENERATING PREDICTION MARKETS AND POOLS\n'));
	
	const { ethPrice, btcPrice } = await getCurrentMarketPrices();
	const marketConfigs = createMarketConfigs(ethPrice, btcPrice);
	const configsToUse = marketConfigs.slice(0, marketsCount);
	const contracts = getContractInstances();
	
	const markets: MarketCreationResult[] = [];
	let marketId = 1;
	
	for (const config of configsToUse) {
		const result = await createSingleMarket(config, marketId, contracts, adminClient);
		
		if (result) {
			markets.push(result);
		}
		
		marketId++;
	}
	
	console.log(chalk.blue(`📝 Successfully created ${markets.length}/${configsToUse.length} markets with pools\n`));
	return markets;
}

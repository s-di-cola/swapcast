/**
 * Market Generation - Simplified and Atomic
 */

import { type Address, createPublicClient, http, erc20Abi } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from './utils/wallets';
import { getTickSpacing, sortTokenAddresses } from './utils/helpers';
import { getCurrentPriceBySymbol } from './utils/price';
import { addLiquidityToPool } from './utils/liquidity';
import { getPoolManager } from '../src/generated/types/PoolManager';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import chalk from 'chalk';

// Types
export type MarketCreationResult = {
	id: string | bigint;
	name: string;
	assetSymbol: string;
	expirationTime: bigint;
	priceThreshold: bigint;
	poolKey: {
		currency0: Address;
		currency1: Address;
		fee: number;
		tickSpacing: number;
		hooks: Address;
	};
};

// Constants
const Q96 = 2n ** 96n;
const STABLECOINS = [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.USDT, TOKEN_ADDRESSES.DAI];

const ASSET_PAIRS = [
	{
		name: 'ETH/USDC',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.ETH,
		token1: TOKEN_ADDRESSES.USDC,
		fee: 3000
	},
	{
		name: 'ETH/USDT', 
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.ETH,
		token1: TOKEN_ADDRESSES.USDT,
		fee: 3000
	},
	{
		name: 'ETH/DAI',
		symbol: 'ETH', 
		token0: TOKEN_ADDRESSES.ETH,
		token1: TOKEN_ADDRESSES.DAI,
		fee: 3000
	},
	{
		name: 'BTC/USDC',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,
		token1: TOKEN_ADDRESSES.USDC,
		fee: 3000
	},
	{
		name: 'BTC/USDT',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,
		token1: TOKEN_ADDRESSES.USDT,
		fee: 3000
	},
	{
		name: 'BTC/DAI',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,
		token1: TOKEN_ADDRESSES.DAI,
		fee: 3000
	}
];

// Helper Functions

/**
 * Calculates a realistic price threshold based on current price and volatility
 *
 * @param currentPrice - Current price of the asset
 * @param volatilityPercent - Volatility percentage (default: 2-5%)
 * @returns Price value to use as threshold
 */
function calculatePriceThreshold(currentPrice: number, volatilityPercent?: number): number {
	const volatility = volatilityPercent || 2 + Math.random() * 3;
	
	if (currentPrice >= 0.95 && currentPrice <= 1.05) {
		return 1.002;
	}
	
	return currentPrice * (1 + volatility / 100);
}

/**
 * Checks if a token is a stablecoin
 *
 * @param token - Token address to check
 * @returns True if token is a stablecoin
 */
function isStablecoin(token: Address): boolean {
	return STABLECOINS.includes(token);
}

/**
 * Checks if a token is ETH
 *
 * @param token - Token address to check
 * @returns True if token is ETH
 */
function isETH(token: Address): boolean {
	return token === TOKEN_ADDRESSES.ETH;
}

/**
 * Checks if a token is WBTC
 *
 * @param token - Token address to check
 * @returns True if token is WBTC
 */
function isBTC(token: Address): boolean {
	return token === TOKEN_ADDRESSES.WBTC;
}

/**
 * Gets token symbol, handling ETH specially
 *
 * @param token - Token address
 * @param publicClient - Viem public client
 * @returns Token symbol
 */
async function getTokenSymbol(token: Address, publicClient: any): Promise<string> {
	if (isETH(token)) {
		return 'ETH';
	}
	
	try {
		return await publicClient.readContract({
			address: token as `0x${string}`,
			abi: erc20Abi,
			functionName: 'symbol'
		});
	} catch (error) {
		console.warn(chalk.yellow(`Failed to read token symbol for ${token}: ${error.message}`));
		return 'UNKNOWN';
	}
}

/**
 * Fetches real-time price for an asset
 *
 * @param assetSymbol - Asset symbol (ETH, BTC, etc.)
 * @returns Current price in USD, or null if failed
 */
async function fetchAssetPrice(assetSymbol: string): Promise<number | null> {
	try {
		const price = await getCurrentPriceBySymbol(assetSymbol);
		if (price) {
			console.log(chalk.blue(`Fetched real-time price for ${assetSymbol}: $${price}`));
			return price;
		}
		return null;
	} catch (error) {
		console.error(chalk.red(`Failed to fetch price for ${assetSymbol}: ${error.message}`));
		return null;
	}
}

/**
 * Calculates price ratio for token pair
 *
 * @param token0 - First token address
 * @param token1 - Second token address
 * @param token0Symbol - First token symbol
 * @param token1Symbol - Second token symbol
 * @returns Price ratio for sqrtPriceX96 calculation
 */
async function calculatePriceRatio(
	token0: Address, 
	token1: Address, 
	token0Symbol: string, 
	token1Symbol: string
): Promise<number> {
	const isToken0Stable = isStablecoin(token0);
	const isToken1Stable = isStablecoin(token1);
	const isToken0ETH = isETH(token0);
	const isToken1ETH = isETH(token1);
	const isToken0BTC = isBTC(token0);
	const isToken1BTC = isBTC(token1);
	
	if (isToken0ETH && isToken1Stable) {
		const ethPrice = await fetchAssetPrice('ETH');
		if (!ethPrice) throw new Error('Failed to fetch ETH price');
		const ratio = 1.0 / ethPrice;
		console.log(chalk.blue(`ETH/Stable pair: ${token0Symbol}/${token1Symbol}, ETH price: $${ethPrice}, ratio: ${ratio}`));
		return ratio;
	}
	
	if (isToken0Stable && isToken1ETH) {
		const ethPrice = await fetchAssetPrice('ETH');
		if (!ethPrice) throw new Error('Failed to fetch ETH price');
		console.log(chalk.blue(`Stable/ETH pair: ${token0Symbol}/${token1Symbol}, ETH price: $${ethPrice}, ratio: ${ethPrice}`));
		return ethPrice;
	}
	
	if (isToken0BTC && isToken1Stable) {
		const btcPrice = await fetchAssetPrice('BTC');
		if (!btcPrice) throw new Error('Failed to fetch BTC price');
		const ratio = 1.0 / btcPrice;
		console.log(chalk.blue(`BTC/Stable pair: ${token0Symbol}/${token1Symbol}, BTC price: $${btcPrice}, ratio: ${ratio}`));
		return ratio;
	}
	
	if (isToken0Stable && isToken1BTC) {
		const btcPrice = await fetchAssetPrice('BTC');
		if (!btcPrice) throw new Error('Failed to fetch BTC price');
		console.log(chalk.blue(`Stable/BTC pair: ${token0Symbol}/${token1Symbol}, BTC price: $${btcPrice}, ratio: ${btcPrice}`));
		return btcPrice;
	}
	
	if (isToken0Stable && isToken1Stable) {
		console.log(chalk.blue(`Stable/Stable pair: ${token0Symbol}/${token1Symbol}, ratio: 1.0`));
		return 1.0;
	}
	
	console.log(chalk.yellow(`Unknown pair: ${token0Symbol}/${token1Symbol}, using 1:1 ratio`));
	return 1.0;
}

/**
 * Converts price ratio to sqrtPriceX96
 *
 * @param priceRatio - Price ratio between tokens
 * @returns sqrtPriceX96 value for Uniswap v4
 */
function priceRatioToSqrtPriceX96(priceRatio: number): bigint {
	const sqrtRatio = Math.sqrt(priceRatio);
	const sqrtPriceX96 = BigInt(Math.floor(sqrtRatio * Number(Q96)));
	
	console.log(chalk.green(`Price calculation: ratio=${priceRatio}, sqrtRatio=${sqrtRatio}, sqrtPriceX96=${sqrtPriceX96}`));
	return sqrtPriceX96;
}

/**
 * Creates pool manager contract instance
 *
 * @param adminAccount - Admin account with chain info
 * @returns Pool manager contract instance
 */
function createPoolManagerContract(adminAccount: any) {
	return getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Creates prediction manager contract instance
 *
 * @param adminAccount - Admin account with chain info
 * @returns Prediction manager contract instance
 */
function createPredictionManagerContract(adminAccount: any) {
	return getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Creates public client instance
 *
 * @param adminAccount - Admin account with chain info
 * @returns Public client instance
 */
function createPublicClientInstance(adminAccount: any) {
	return createPublicClient({
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Builds pool key object
 *
 * @param token0 - First token address (sorted)
 * @param token1 - Second token address (sorted)
 * @param fee - Pool fee
 * @returns Pool key object
 */
function buildPoolKey(token0: Address, token1: Address, fee: number) {
	return {
		currency0: token0,
		currency1: token1,
		fee: fee,
		tickSpacing: getTickSpacing(fee),
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
	};
}

/**
 * Initializes a Uniswap v4 pool
 *
 * @param poolManager - Pool manager contract
 * @param poolKey - Pool key object
 * @param sqrtPriceX96 - Initial price
 * @param adminAccount - Admin account
 * @returns Transaction hash
 */
async function initializePool(poolManager: any, poolKey: any, sqrtPriceX96: bigint, adminAccount: any): Promise<string> {
	return await poolManager.write.initialize(
		[poolKey, sqrtPriceX96],
		{
			account: adminAccount.account,
			chain: adminAccount.chain
		}
	);
}

/**
 * Handles pool creation errors
 *
 * @param error - Error object
 * @param poolKey - Pool key for fallback
 * @returns Pool key if pool exists, throws otherwise
 */
function handlePoolCreationError(error: any, poolKey: any) {
	if (error.message.includes('already') || error.message.includes('exists') || error.signature === '0x61487524') {
		console.log(chalk.yellow(`Pool already exists, returning pool key...`));
		return poolKey;
	}
	
	console.error(chalk.red(`Failed to initialize pool: ${error.message}`));
	throw error;
}

// Main Export Functions

/**
 * Creates a Uniswap v4 pool with real-time pricing
 *
 * @param adminAccount - Admin account for transactions
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @param fee - Pool fee (3000 = 0.3%)
 * @returns Pool key object
 */
export async function createPool(
	adminAccount: any,
	tokenA: Address,
	tokenB: Address,
	fee: number
): Promise<any> {
	console.log(chalk.yellow(`Creating pool for ${tokenA}/${tokenB} with fee ${fee}...`));

	const [token0, token1] = sortTokenAddresses(tokenA, tokenB);
	console.log(chalk.blue(`Sorted tokens: token0=${token0}, token1=${token1}`));

	const poolManager = createPoolManagerContract(adminAccount);
	const poolKey = buildPoolKey(token0, token1, fee);

	try {
		const publicClient = createPublicClientInstance(adminAccount);

		const token0Symbol = await getTokenSymbol(token0, publicClient);
		const token1Symbol = await getTokenSymbol(token1, publicClient);

		console.log(chalk.blue(`Creating pool: ${token0Symbol}/${token1Symbol}`));

		const priceRatio = await calculatePriceRatio(token0, token1, token0Symbol, token1Symbol);
		const sqrtPriceX96 = priceRatioToSqrtPriceX96(priceRatio);

		console.log(chalk.green(`Initializing pool with sqrtPriceX96: ${sqrtPriceX96}`));

		const hash = await initializePool(poolManager, poolKey, sqrtPriceX96, adminAccount);

		console.log(chalk.green(`Pool ${token0Symbol}/${token1Symbol} initialized successfully with hash: ${hash}`));
		return poolKey;
	} catch (error: any) {
		return handlePoolCreationError(error, poolKey);
	}
}

/**
 * Creates a prediction market
 *
 * @param adminAccount - Admin account for transactions
 * @param name - Market name
 * @param assetSymbol - Asset symbol (e.g., "ETH/USDC")
 * @param expirationTime - Market expiration timestamp
 * @param priceAggregator - Oracle aggregator address
 * @param priceThreshold - Price threshold for predictions
 * @param poolKey - Associated pool key
 * @returns Market creation result
 */
export async function createMarket(
	adminAccount: any,
	name: string,
	assetSymbol: string,
	expirationTime: bigint,
	priceAggregator: Address,
	priceThreshold: bigint,
	poolKey: any
): Promise<MarketCreationResult> {
	const predictionManager = createPredictionManagerContract(adminAccount);

	try {
		console.log(chalk.yellow(`Creating market "${name}" with expiration ${expirationTime}...`));

		const txHash = await predictionManager.write.createMarket([
			name,
			assetSymbol,
			expirationTime,
			priceAggregator,
			priceThreshold,
			poolKey
		], { account: adminAccount.account, chain: adminAccount.chain });

		const publicClient = createPublicClientInstance(adminAccount);
		await publicClient.waitForTransactionReceipt({ hash: txHash });

		const marketCount = await predictionManager.read.getMarketCount();
		const marketId = marketCount - 1n;

		console.log(chalk.green(`Market created successfully with ID: ${marketId}, hash: ${txHash}`));

		return {
			id: marketId,
			name,
			assetSymbol,
			expirationTime,
			priceThreshold,
			poolKey
		};
	} catch (error: any) {
		console.error(chalk.red(`Failed to create market: ${error.message}`));
		throw error;
	}
}

/**
 * Adds liquidity to a pool safely
 *
 * @param adminAccount - Admin account
 * @param poolKey - Pool key object
 * @param currentPrice - Current asset price
 * @returns True if successful, false otherwise
 */
async function addLiquidityToPoolSafely(adminAccount: any, poolKey: any, currentPrice: number): Promise<boolean> {
	try {
		const publicClient = createPublicClientInstance(adminAccount);
		await addLiquidityToPool(publicClient, adminAccount, poolKey, currentPrice);
		return true;
	} catch (liquidityError: any) {
		console.error(chalk.red(`Failed to add liquidity: ${liquidityError.message}`));
		return false;
	}
}

/**
 * Generates markets and pools with real-time pricing
 *
 * @param adminAccount - Admin account for transactions
 * @param count - Number of markets to create (default: 5)
 * @returns Array of created markets
 */
export async function generateMarkets(
	adminAccount: any,
	count: number = 5
): Promise<MarketCreationResult[]> {
	console.log(chalk.yellow(`Generating ${count} markets with real-time pricing...`));

	const markets: MarketCreationResult[] = [];
	const createdPools = new Set<string>();

	for (let i = 0; i < count; i++) {
		const assetPairIndex = i % ASSET_PAIRS.length;
		const assetPair = ASSET_PAIRS[assetPairIndex];

		const marketSuffix = i >= ASSET_PAIRS.length ? ` #${Math.floor(i / ASSET_PAIRS.length) + 1}` : '';
		const marketName = `${assetPair.name}${marketSuffix}`;

		console.log(chalk.yellow(`Processing market ${i + 1}/${count}: ${marketName}`));

		try {
			const [token0, token1] = sortTokenAddresses(assetPair.token0, assetPair.token1);
			const poolId = `${token0}-${token1}-${assetPair.fee}`;

			let poolKey;
			if (createdPools.has(poolId)) {
				console.log(chalk.blue(`Pool ${poolId} already created, reusing...`));
				poolKey = buildPoolKey(token0, token1, assetPair.fee);
			} else {
				poolKey = await createPool(adminAccount, assetPair.token0, assetPair.token1, assetPair.fee);
				createdPools.add(poolId);
			}

			const currentPrice = await fetchAssetPrice(assetPair.symbol);
			if (!currentPrice) {
				console.error(chalk.red(`Failed to get real-time price for ${assetPair.symbol}, skipping market`));
				continue;
			}

			console.log(chalk.blue(`Using real-time price for ${assetPair.symbol}: $${currentPrice}`));

			const liquidityAdded = await addLiquidityToPoolSafely(adminAccount, poolKey, currentPrice);
			if (liquidityAdded) {
				console.log(chalk.green(`Successfully added liquidity to pool for ${marketName}`));
			} else {
				console.log(chalk.yellow(`Continuing without liquidity for ${marketName}...`));
			}

			const priceThreshold = calculatePriceThreshold(currentPrice);
			const daysToExpiration = 7 + Math.floor(Math.random() * 53);
			const expirationTime = BigInt(Math.floor(Date.now() / 1000) + daysToExpiration * 24 * 60 * 60);

			console.log(chalk.blue(`Creating market with real-time data: ${assetPair.name}, current price: $${currentPrice}, threshold: $${priceThreshold}`));

			const market = await createMarket(
				adminAccount,
				`${marketName} Market`,
				assetPair.name,
				expirationTime,
				CONTRACT_ADDRESSES.ORACLE_RESOLVER as Address,
				BigInt(Math.floor(priceThreshold * 1e18)),
				poolKey
			);

			console.log(chalk.green(`Successfully created market for ${marketName} with real-time pricing`));
			markets.push(market);

		} catch (error: any) {
			console.error(chalk.red(`Failed to create market for ${marketName}:`), error);
		}
	}

	console.log(chalk.green(`Successfully created ${markets.length}/${count} markets with real-time pricing`));
	return markets;
}
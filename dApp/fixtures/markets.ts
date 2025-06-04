/**
 * Market Generation
 *
 * Creates markets and associated Uniswap v4 pools for testing
 */

import { type Address, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from './utils/wallets';
import { getTickSpacing, sortTokenAddresses } from './utils/helpers';
import { getCurrentPrice, calculateRealisticPriceThreshold } from './utils/currentPrice';
import { addLiquidityToPool } from './utils/liquidity';
import { getPoolManager } from '../src/generated/types/PoolManager';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import chalk from 'chalk';

// Asset pairs for markets - token1 is always a stablecoin (DAI, USDT, or USDC)
const ASSET_PAIRS = [
	{
		name: 'ETH/USDC',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.WETH,
		token1: TOKEN_ADDRESSES.USDC,
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
		name: 'ETH/DAI',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.WETH,
		token1: TOKEN_ADDRESSES.DAI,
		fee: 3000
	},
	{
		name: 'BTC/DAI',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,
		token1: TOKEN_ADDRESSES.DAI,
		fee: 3000
	},
	{
		name: 'ETH/USDT',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.WETH,
		token1: TOKEN_ADDRESSES.USDT,
		fee: 3000
	},
	{
		name: 'BTC/USDT',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,
		token1: TOKEN_ADDRESSES.USDT,
		fee: 3000
	}
];

// Market creation result type
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

/**
 * Creates a Uniswap v4 pool for a market with proper token sorting
 */
export async function createPool(
	adminAccount: any,
	tokenA: Address,
	tokenB: Address,
	fee: number
): Promise<any> {
	console.log(chalk.yellow(`Creating pool for ${tokenA}/${tokenB} with fee ${fee}...`));

	// CRITICAL: Sort tokens to ensure correct order for Uniswap v4
	const [token0, token1] = sortTokenAddresses(tokenA, tokenB);
	console.log(chalk.blue(`Sorted tokens: token0=${token0}, token1=${token1}`));

	// Get the PoolManager contract
	const poolManager = getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	// Calculate tick spacing based on fee
	const tickSpacing = getTickSpacing(fee);

	// Create the pool key with sorted tokens
	const poolKey = {
		currency0: token0,
		currency1: token1,
		fee: fee,
		tickSpacing: tickSpacing,
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
	};

	try {
		// Check if pool already exists first
		console.log(chalk.yellow(`Checking if pool already exists...`));
		try {
			// Try to get pool slot0 to see if it exists
			const publicClient = createPublicClient({
				chain: anvil,
				transport: http(anvil.rpcUrls.default.http[0])
			});

			// If we can read pool data, it already exists
			const poolExists = await publicClient.readContract({
				address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
				abi: poolManager.abi,
				functionName: 'extsload',
				args: ['0x' + '00'.repeat(32)] // Try to read some pool storage
			});

			console.log(chalk.green(`Pool might already exist, proceeding...`));
		} catch (e) {
			// Pool doesn't exist, which is fine
			console.log(chalk.blue(`Pool doesn't exist yet, will create...`));
		}

		// Initialize the pool with proper sqrtPriceX96
		// For new pools, we typically start at 1:1 ratio or use current market price
		// Using a neutral price of sqrt(1) * 2^96 for initialization
		const neutralSqrtPriceX96 = BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96

		console.log(chalk.yellow(`Attempting to initialize pool...`));
		const hash = await poolManager.write.initialize(
			[poolKey, neutralSqrtPriceX96], 
			{ 
				account: adminAccount.account, 
				chain: adminAccount.chain 
			}
		);

		console.log(chalk.green(`Pool initialized successfully with hash: ${hash}`));
		return poolKey;
	} catch (error: any) {
		console.error(chalk.red(`Failed to initialize pool: ${error.message}`));
		
		// Check if it's a "pool already exists" type error
		if (error.message.includes('already') || error.message.includes('exists') || 
			error.signature === '0x61487524') {
			console.log(chalk.yellow(`Pool might already exist, returning pool key anyway...`));
			return poolKey;
		}
		
		throw error;
	}
}

/**
 * Creates a market with the PredictionManager contract
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
	// Get the PredictionManager contract
	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	try {
		// Create the market
		console.log(chalk.yellow(`Creating market "${name}" with expiration ${expirationTime}...`));

		// Send the transaction
		const txHash = await predictionManager.write.createMarket([
			name,
			assetSymbol,
			expirationTime,
			priceAggregator,
			priceThreshold,
			poolKey
		], { account: adminAccount.account, chain: adminAccount.chain });

		// Wait for transaction confirmation
		const publicClient = createPublicClient({
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

		// Get the market ID (latest market)
		const marketCount = await predictionManager.read.getMarketCount();
		const marketId = marketCount - 1n;

		console.log(chalk.green(`Market created successfully with hash: ${txHash}`));

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
 * Generates markets and pools for testing with better error handling
 */
export async function generateMarkets(
	adminAccount: any,
	count: number = 5
): Promise<MarketCreationResult[]> {
	console.log(chalk.yellow(`Generating ${count} markets...`));

	const markets: MarketCreationResult[] = [];
	const createdPools = new Set<string>(); // Track created pools to avoid duplicates

	for (let i = 0; i < count; i++) {
		const assetPairIndex = i % ASSET_PAIRS.length;
		const assetPair = ASSET_PAIRS[assetPairIndex];

		const marketSuffix = i >= ASSET_PAIRS.length ? ` #${Math.floor(i / ASSET_PAIRS.length) + 1}` : '';
		const marketName = `${assetPair.name}${marketSuffix}`;

		console.log(chalk.yellow(`Processing market ${i + 1}/${count}: ${marketName}`));

		try {
			// Create unique pool identifier
			const [token0, token1] = sortTokenAddresses(assetPair.token0, assetPair.token1);
			const poolId = `${token0}-${token1}-${assetPair.fee}`;

			let poolKey;

			// Check if we already created this pool
			if (createdPools.has(poolId)) {
				console.log(chalk.blue(`Pool ${poolId} already created, reusing...`));
				poolKey = {
					currency0: token0,
					currency1: token1,
					fee: assetPair.fee,
					tickSpacing: getTickSpacing(assetPair.fee),
					hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
				};
			} else {
				// Create new pool
				poolKey = await createPool(
					adminAccount,
					assetPair.token0,
					assetPair.token1,
					assetPair.fee
				);
				createdPools.add(poolId);
			}

			if (!poolKey) {
				throw new Error(`Failed to create pool for ${marketName}`);
			}

			// Fetch current price for the asset
			console.log(chalk.yellow(`Fetching current price for ${assetPair.symbol}...`));
			const currentPrice = await getCurrentPrice(assetPair.symbol);
			console.log(chalk.blue(`Current price for ${assetPair.symbol}: $${currentPrice}`));

			// Add liquidity to the pool
			console.log(chalk.yellow(`Adding liquidity to pool for ${marketName}...`));
			try {
				const publicClient = createPublicClient({
					chain: anvil,
					transport: http(anvil.rpcUrls.default.http[0])
				});
				
				await addLiquidityToPool(publicClient, adminAccount, poolKey, currentPrice);
				console.log(chalk.green(`Successfully added liquidity to pool for ${marketName}`));
			} catch (liquidityError: any) {
				console.error(chalk.red(`Failed to add liquidity to pool: ${liquidityError.message}`));
				console.log(chalk.yellow(`Continuing without liquidity for ${marketName}...`));
			}

			// Calculate a realistic price threshold
			const priceThreshold = calculateRealisticPriceThreshold(currentPrice);
			console.log(chalk.blue(`Using price threshold of $${priceThreshold.toFixed(2)} for ${assetPair.symbol}`));

			// Create the market
			console.log(chalk.yellow(`Creating market for ${marketName}...`));

			const daysToExpiration = 7 + Math.floor(Math.random() * 53);
			const expirationTime = BigInt(Math.floor(Date.now() / 1000) + daysToExpiration * 24 * 60 * 60);

			const market = await createMarket(
				adminAccount,
				`${marketName} Market`,
				assetPair.symbol,
				expirationTime,
				CONTRACT_ADDRESSES.ORACLE_RESOLVER as Address,
				BigInt(Math.floor(priceThreshold * 1e18)),
				poolKey
			);

			console.log(chalk.green(`Successfully created market for ${marketName}`));
			markets.push(market);

		} catch (error: any) {
			console.error(chalk.red(`Failed to create market for ${marketName}:`), error);
			console.log(chalk.yellow(`Continuing with next market...`));
		}
	}

	console.log(chalk.green(`Successfully created ${markets.length}/${count} markets`));
	return markets;
}
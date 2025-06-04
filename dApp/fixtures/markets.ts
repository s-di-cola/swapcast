/**
 * Market Generation 
 * For mainnet fork with real whale balances
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
 * Creates a Uniswap v4 pool with proper token sorting
 */
export async function createPool(
	adminAccount: any,
	tokenA: Address,
	tokenB: Address,
	fee: number
): Promise<any> {
	console.log(chalk.yellow(`Creating pool for ${tokenA}/${tokenB} with fee ${fee}...`));

	// Sort tokens for Uniswap v4 requirements
	const [token0, token1] = sortTokenAddresses(tokenA, tokenB);
	console.log(chalk.blue(`Sorted tokens: token0=${token0}, token1=${token1}`));

	const poolManager = getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	const poolKey = {
		currency0: token0,
		currency1: token1,
		fee: fee,
		tickSpacing: getTickSpacing(fee),
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
	};

	try {
		// Initialize with neutral price
		const neutralSqrtPriceX96 = BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96

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
		// Pool might already exist
		if (error.message.includes('already') || error.message.includes('exists') || 
			error.signature === '0x61487524') {
			console.log(chalk.yellow(`Pool already exists, returning pool key...`));
			return poolKey;
		}
		
		console.error(chalk.red(`Failed to initialize pool: ${error.message}`));
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
	const predictionManager = getPredictionManager({
		address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
		chain: adminAccount.chain,
		transport: http(anvil.rpcUrls.default.http[0])
	});

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

		const publicClient = createPublicClient({
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		await publicClient.waitForTransactionReceipt({ hash: txHash });

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
 * Generates markets and pools for testing
 */
export async function generateMarkets(
	adminAccount: any,
	count: number = 5
): Promise<MarketCreationResult[]> {
	console.log(chalk.yellow(`Generating ${count} markets...`));

	const markets: MarketCreationResult[] = [];
	const createdPools = new Set<string>();

	for (let i = 0; i < count; i++) {
		const assetPairIndex = i % ASSET_PAIRS.length;
		const assetPair = ASSET_PAIRS[assetPairIndex];

		const marketSuffix = i >= ASSET_PAIRS.length ? ` #${Math.floor(i / ASSET_PAIRS.length) + 1}` : '';
		const marketName = `${assetPair.name}${marketSuffix}`;

		console.log(chalk.yellow(`Processing market ${i + 1}/${count}: ${marketName}`));

		try {
			// Check if pool already created
			const [token0, token1] = sortTokenAddresses(assetPair.token0, assetPair.token1);
			const poolId = `${token0}-${token1}-${assetPair.fee}`;

			let poolKey;
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
				poolKey = await createPool(adminAccount, assetPair.token0, assetPair.token1, assetPair.fee);
				createdPools.add(poolId);
			}

			// Get current price
			const currentPrice = await getCurrentPrice(assetPair.symbol);
			console.log(chalk.blue(`Current price for ${assetPair.symbol}: $${currentPrice}`));

			// Add liquidity
			try {
				const publicClient = createPublicClient({
					chain: anvil,
					transport: http(anvil.rpcUrls.default.http[0])
				});
				
				await addLiquidityToPool(publicClient, adminAccount, poolKey, currentPrice);
				console.log(chalk.green(`Successfully added liquidity to pool for ${marketName}`));
			} catch (liquidityError: any) {
				console.error(chalk.red(`Failed to add liquidity: ${liquidityError.message}`));
				console.log(chalk.yellow(`Continuing without liquidity for ${marketName}...`));
			}

			// Create market
			const priceThreshold = calculateRealisticPriceThreshold(currentPrice);
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
		}
	}

	console.log(chalk.green(`Successfully created ${markets.length}/${count} markets`));
	return markets;
}
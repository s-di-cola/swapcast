/**
 * Market Generation 
 * For mainnet fork with real whale balances
 */

import { type Address, createPublicClient, http, erc20Abi } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from './utils/wallets';
import { getTickSpacing, sortTokenAddresses } from './utils/helpers';
import { getCurrentPriceBySymbol } from './utils/price'; // Use simplified price service
import { addLiquidityToPool } from './utils/liquidity';
import { getPoolManager } from '../src/generated/types/PoolManager';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import chalk from 'chalk';

/**
 * Calculates a realistic price threshold based on current price and volatility
 *
 * @param currentPrice - Current price of the asset
 * @param volatilityPercent - Volatility percentage (default: 2-5%)
 * @returns Price value to use as threshold
 */
function calculatePriceThreshold(
	currentPrice: number,
	volatilityPercent?: number
): number {
	// If volatility is not provided, use a random value between 2-5%
	const volatility = volatilityPercent || 2 + Math.random() * 3;

	// For stablecoins (price around $1), use a smaller threshold
	if (currentPrice >= 0.95 && currentPrice <= 1.05) {
		// For stablecoins, use a very small absolute difference
		return 1.002;
	}

	// For other assets, calculate a realistic price near the current price
	// Slightly above current price (by the volatility percentage)
	return currentPrice * (1 + volatility / 100);
}

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
 * Creates a Uniswap v4 pool with proper token sorting and realistic price ratio
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
		// Read token symbols directly from the contracts
		const publicClient = createPublicClient({
			chain: adminAccount.chain,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		// Read token symbols
		let token0Symbol, token1Symbol;
		try {
			// Use erc20Abi from viem to read the symbols
			[token0Symbol, token1Symbol] = await Promise.all([
				publicClient.readContract({
					address: token0 as `0x${string}`,
					abi: erc20Abi,
					functionName: 'symbol'
				}),
				publicClient.readContract({
					address: token1 as `0x${string}`,
					abi: erc20Abi,
					functionName: 'symbol'
				})
			]);

			console.log(chalk.blue(`Token symbols: ${token0Symbol}/${token1Symbol}`));
		} catch (error) {
			console.warn(chalk.yellow(`Failed to read token symbols: ${error.message}`));
			// Use fallback symbols based on address patterns if contract read fails
			token0Symbol = token0.toLowerCase().includes('eth') ? 'WETH' : 
				token0.toLowerCase().includes('btc') ? 'WBTC' : 
				token0.toLowerCase().includes('usdc') ? 'USDC' :
				token0.toLowerCase().includes('usdt') ? 'USDT' :
				token0.toLowerCase().includes('dai') ? 'DAI' : 'UNKNOWN';
			token1Symbol = token1.toLowerCase().includes('eth') ? 'WETH' : 
				token1.toLowerCase().includes('btc') ? 'WBTC' : 
				token1.toLowerCase().includes('usdc') ? 'USDC' :
				token1.toLowerCase().includes('usdt') ? 'USDT' :
				token1.toLowerCase().includes('dai') ? 'DAI' : 'UNKNOWN';
			console.log(chalk.yellow(`Using fallback symbols: ${token0Symbol}/${token1Symbol}`));
		}

		// Determine which token is the base asset and which is the quote asset
		let baseTokenSymbol: string;
		let baseTokenIsToken0: boolean;
		
		// Check if token0 is a base asset (ETH, BTC) or token1 is a stablecoin
		const isToken0BaseAsset = ['WETH', 'ETH', 'WBTC', 'BTC'].includes(token0Symbol.toUpperCase());
		const isToken1Stablecoin = ['USDC', 'USDT', 'DAI'].includes(token1Symbol.toUpperCase());
		
		if (isToken0BaseAsset && isToken1Stablecoin) {
			// token0 is base, token1 is quote (e.g., WETH/USDC)
			baseTokenSymbol = token0Symbol;
			baseTokenIsToken0 = true;
		} else if (['USDC', 'USDT', 'DAI'].includes(token0Symbol.toUpperCase()) && 
		           ['WETH', 'ETH', 'WBTC', 'BTC'].includes(token1Symbol.toUpperCase())) {
			// token1 is base, token0 is quote (e.g., USDC/WETH)
			baseTokenSymbol = token1Symbol;
			baseTokenIsToken0 = false;
		} else {
			// Default to token0 as base
			baseTokenSymbol = token0Symbol;
			baseTokenIsToken0 = true;
		}

		// Fetch realistic price ratio using the simplified price service
		let priceRatio = 1.0;
		try {
			// Get price of the base asset
			const basePrice = await getCurrentPriceBySymbol(baseTokenSymbol);
			if (basePrice && basePrice > 0) {
				console.log(chalk.blue(`Fetched price for ${baseTokenSymbol}: $${basePrice}`));
				
				// Calculate price ratio based on which token is which
				if (baseTokenIsToken0) {
					// token0 is expensive asset, token1 is stablecoin ($1)
					// Price ratio = token1_price / token0_price = 1 / basePrice
					priceRatio = 1.0 / basePrice;
				} else {
					// token1 is expensive asset, token0 is stablecoin ($1)  
					// Price ratio = token1_price / token0_price = basePrice / 1
					priceRatio = basePrice;
				}
				
				console.log(chalk.blue(`Calculated price ratio (token1/token0): ${priceRatio}`));
			} else {
				console.warn(chalk.yellow(`Could not get price for ${baseTokenSymbol}, using 1:1 ratio`));
			}
		} catch (priceError) {
			console.warn(chalk.yellow(`Price fetch failed for ${baseTokenSymbol}, using 1:1 ratio: ${priceError.message}`));
		}
		
		// Encode the sqrt price with the realistic ratio
		// For Uniswap v4, we need sqrt(price) * 2^96
		const Q96 = 2n ** 96n;
		
		// Calculate sqrtPriceX96 = sqrt(priceRatio) * 2^96
		// Using Math.sqrt for the JavaScript number and then converting to BigInt
		const sqrtRatio = Math.sqrt(priceRatio);
		const sqrtPriceX96 = BigInt(Math.floor(sqrtRatio * Number(Q96)));
		console.log(chalk.blue(`Encoded sqrtPriceX96: ${sqrtPriceX96}`));

		const hash = await poolManager.write.initialize(
			[poolKey, sqrtPriceX96], 
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

			// Get current price for the market
			const currentPrice = await getCurrentPriceBySymbol(assetPair.symbol);
			const finalPrice = currentPrice || 100; // Fallback price
			console.log(chalk.blue(`Using price for ${assetPair.symbol}: $${finalPrice}`));

			// Add liquidity with much larger amounts for realistic trading
			try {
				const publicClient = createPublicClient({
					chain: anvil,
					transport: http(anvil.rpcUrls.default.http[0])
				});
				
				await addLiquidityToPool(publicClient, adminAccount, poolKey, finalPrice);
				console.log(chalk.green(`Successfully added liquidity to pool for ${marketName}`));
			} catch (liquidityError: any) {
				console.error(chalk.red(`Failed to add liquidity: ${liquidityError.message}`));
				console.log(chalk.yellow(`Continuing without liquidity for ${marketName}...`));
			}

			// Create market
			// Calculate a realistic price threshold based on current price and volatility
			const priceThreshold = calculatePriceThreshold(finalPrice);
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
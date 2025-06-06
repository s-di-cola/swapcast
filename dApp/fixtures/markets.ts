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

// FIXED: Use native ETH (address(0)) for true ETH pools
const ASSET_PAIRS = [
	{
		name: 'ETH/USDC',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.ETH,  // Native ETH
		token1: TOKEN_ADDRESSES.USDC,
		fee: 3000
	},
	{
		name: 'ETH/USDT',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.ETH,  // Native ETH
		token1: TOKEN_ADDRESSES.USDT,
		fee: 3000
	},
	{
		name: 'ETH/DAI',
		symbol: 'ETH',
		token0: TOKEN_ADDRESSES.ETH,  // Native ETH
		token1: TOKEN_ADDRESSES.DAI,
		fee: 3000
	},
	{
		name: 'BTC/USDC',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,  // Still use WBTC (no native BTC)
		token1: TOKEN_ADDRESSES.USDC,
		fee: 3000
	},
	{
		name: 'BTC/USDT',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,  // Still use WBTC
		token1: TOKEN_ADDRESSES.USDT,
		fee: 3000
	},
	{
		name: 'BTC/DAI',
		symbol: 'BTC',
		token0: TOKEN_ADDRESSES.WBTC,  // Still use WBTC
		token1: TOKEN_ADDRESSES.DAI,
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

	// VALIDATION: Ensure we have the expected tokens
	const expectedTokens = Object.values(TOKEN_ADDRESSES);
	if (!expectedTokens.includes(token0) || !expectedTokens.includes(token1)) {
		throw new Error(`Invalid token addresses: ${token0}, ${token1}`);
	}

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
		// Read token symbols directly from the contracts for verification
		const publicClient = createPublicClient({
			chain: adminAccount.chain,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		let token0Symbol, token1Symbol;
		try {
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

			console.log(chalk.blue(`Creating pool: ${token0Symbol}/${token1Symbol}`));
		} catch (error) {
			console.warn(chalk.yellow(`Failed to read token symbols: ${error.message}`));
			// Use fallback names
			token0Symbol = 'TOKEN0';
			token1Symbol = 'TOKEN1';
		}

		// Determine price ratio based on known token types
		let priceRatio = 1.0;

		// Check if we have a stablecoin/ETH pair
		const isToken0Stable = [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.USDT, TOKEN_ADDRESSES.DAI].includes(token0);
		const isToken1Stable = [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.USDT, TOKEN_ADDRESSES.DAI].includes(token1);
		const isToken0ETH = token0 === TOKEN_ADDRESSES.ETH;  // Native ETH
		const isToken1ETH = token1 === TOKEN_ADDRESSES.ETH;  // Native ETH
		const isToken0BTC = token0 === TOKEN_ADDRESSES.WBTC;
		const isToken1BTC = token1 === TOKEN_ADDRESSES.WBTC;

		if (isToken0Stable && (isToken1ETH || isToken1BTC)) {
			// Stablecoin/ETH or Stablecoin/BTC pair
			const assetPrice = isToken1ETH ? 2500 : 45000; // ETH ~$2500, BTC ~$45000
			priceRatio = assetPrice; // 1 stablecoin = 1/assetPrice ETH/BTC
		} else if ((isToken0ETH || isToken0BTC) && isToken1Stable) {
			// ETH/Stablecoin or BTC/Stablecoin pair
			const assetPrice = isToken0ETH ? 2500 : 45000;
			priceRatio = 1.0 / assetPrice; // 1 ETH/BTC = assetPrice stablecoins
		}

		// Encode the sqrt price with the realistic ratio
		const Q96 = 2n ** 96n;
		const sqrtRatio = Math.sqrt(priceRatio);
		const sqrtPriceX96 = BigInt(Math.floor(sqrtRatio * Number(Q96)));

		console.log(chalk.blue(`Price ratio: ${priceRatio}, sqrtPriceX96: ${sqrtPriceX96}`));

		const hash = await poolManager.write.initialize(
			[poolKey, sqrtPriceX96],
			{
				account: adminAccount.account,
				chain: adminAccount.chain
			}
		);

		console.log(chalk.green(`Pool ${token0Symbol}/${token1Symbol} initialized successfully with hash: ${hash}`));
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

		// VALIDATION: Log what we're actually creating
		console.log('Market Creation Details:', {
			name,
			assetSymbol,
			poolKey: {
				currency0: poolKey.currency0,
				currency1: poolKey.currency1,
				fee: poolKey.fee
			}
		});

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
 * Generates markets and pools for testing - FIXED for proper asset pairs
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
				// FORCE the correct token order
				poolKey = await createPool(adminAccount, assetPair.token0, assetPair.token1, assetPair.fee);
				createdPools.add(poolId);

				// VALIDATION: Ensure the pool was created with expected tokens
				console.log(chalk.green(`Pool created for ${assetPair.name}:`), {
					expected: `${assetPair.token0}/${assetPair.token1}`,
					actual: `${poolKey.currency0}/${poolKey.currency1}`
				});
			}

			// Get current price for the market
			const currentPrice = await getCurrentPriceBySymbol(assetPair.symbol);
			const finalPrice = currentPrice || (assetPair.symbol === 'ETH' ? 2500 : 45000); // Fallback prices
			console.log(chalk.blue(`Using price for ${assetPair.symbol}: $${finalPrice}`));

			// Add liquidity with realistic amounts
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

			// Create market with correct asset symbol
			const priceThreshold = calculatePriceThreshold(finalPrice);
			const daysToExpiration = 7 + Math.floor(Math.random() * 53);
			const expirationTime = BigInt(Math.floor(Date.now() / 1000) + daysToExpiration * 24 * 60 * 60);

			// FIXED: Use the actual asset pair name, not just the symbol
			console.log(chalk.blue(`Creating market with asset pair: ${assetPair.name}`));

			const market = await createMarket(
				adminAccount,
				`${marketName} Market`,
				assetPair.name, // ✅ FIXED: Use "ETH/USDT" instead of just "ETH"
				expirationTime,
				CONTRACT_ADDRESSES.ORACLE_RESOLVER as Address,
				BigInt(Math.floor(priceThreshold * 1e18)),
				poolKey
			);

			console.log(chalk.green(`Successfully created market for ${marketName} with asset pair: ${assetPair.name}`));
			markets.push(market);

		} catch (error: any) {
			console.error(chalk.red(`Failed to create market for ${marketName}:`), error);
		}
	}

	console.log(chalk.green(`Successfully created ${markets.length}/${count} markets`));
	return markets;
}
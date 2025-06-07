import { createPublicClient as getPublicClient, http, type Address, formatUnits, erc20Abi, keccak256, encodeAbiParameters, createPublicClient } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from '../utils/wallets';
import { sortTokenAddresses, getTickSpacing } from '../utils/helpers';
import { getStateView } from '../../src/generated/types/StateView';
import { getCurrentPriceBySymbol } from '../utils/price';
import { calculateSqrtPriceX96 } from '../utils/math';
import chalk from 'chalk';

const NATIVE_ETH = '0x0000000000000000000000000000000000000000';
const Q96 = 2n ** 96n;

interface PoolDiagnostics {
	name: string;
	exists: boolean;
	hasLiquidity: boolean;
	pricesValid: boolean;
	poolData: {
		sqrtPriceX96: string;
		tick: string;
		actualPrice: number;
		expectedSqrtPriceX96: string;
		priceLabel: string;
	};
	expectedPrices: {
		range: string;
		currentMarketPrice?: number;
	};
	balances: {
		token0: { name: string; balance: string; raw: bigint };
		token1: { name: string; balance: string; raw: bigint };
	};
	errors: string[];
	warnings: string[];
}

interface ValidationResult {
	isValid: boolean;
	expectedRange: string;
	errors: string[];
	expectedSqrtPriceX96: bigint;
	actualPrice: number;
}

/**
 * Maps token address to symbol
 * @param address - Token address
 * @returns Token symbol
 */
function getTokenName(address: Address): string {
	const tokenMap: Record<string, string> = {
		[NATIVE_ETH]: 'ETH',
		[TOKEN_ADDRESSES.USDC]: 'USDC',
		[TOKEN_ADDRESSES.USDT]: 'USDT',
		[TOKEN_ADDRESSES.DAI]: 'DAI',
		[TOKEN_ADDRESSES.WBTC]: 'WBTC'
	};
	
	return tokenMap[address] || 'UNKNOWN';
}

/**
 * Maps token address to decimals
 * @param address - Token address
 * @returns Number of decimals
 */
function getTokenDecimals(address: Address): number {
	const decimalMap: Record<string, number> = {
		[NATIVE_ETH]: 18,
		[TOKEN_ADDRESSES.USDC]: 6,
		[TOKEN_ADDRESSES.USDT]: 6,
		[TOKEN_ADDRESSES.DAI]: 18,
		[TOKEN_ADDRESSES.WBTC]: 8
	};
	
	return decimalMap[address] || 18;
}

/**
 * Gets token balance for ETH or ERC20
 * @param publicClient - Public client instance
 * @param tokenAddress - Token contract address
 * @param holderAddress - Address holding the tokens
 * @returns Token balance as bigint
 */
async function getTokenBalance(
	publicClient: any,
	tokenAddress: Address,
	holderAddress: Address
): Promise<bigint> {
	if (tokenAddress === NATIVE_ETH) {
		return await publicClient.getBalance({ address: holderAddress });
	}
	
	return await publicClient.readContract({
		address: tokenAddress,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: [holderAddress]
	});
}

/**
 * Calculates pool ID from pool key
 * @param poolKey - Pool key object
 * @returns Pool ID as hex string
 */
function calculatePoolId(poolKey: any): `0x${string}` {
	const encodedData = encodeAbiParameters(
		[
			{ type: 'address' },
			{ type: 'address' },
			{ type: 'uint24' },
			{ type: 'int24' },
			{ type: 'address' }
		],
		[
			poolKey.currency0,
			poolKey.currency1,
			poolKey.fee,
			poolKey.tickSpacing,
			poolKey.hooks
		]
	);
	return keccak256(encodedData);
}

/**
 * Converts sqrtPriceX96 back to human readable price
 * @param sqrtPriceX96 - Square root price in X96 format
 * @returns Price as number
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
	if (sqrtPriceX96 === 0n) return 0;
	
	const sqrtPriceFloat = Number(sqrtPriceX96) / Number(Q96);
	return sqrtPriceFloat * sqrtPriceFloat;
}

/**
 * Validates pool prices against expected values
 * @param token0Name - Token0 symbol
 * @param token1Name - Token1 symbol
 * @param actualSqrtPriceX96 - Actual sqrtPriceX96 from pool
 * @param marketPrice - Current market price
 * @returns Validation result
 */
async function validatePoolPrices(
	token0Name: string,
	token1Name: string,
	actualSqrtPriceX96: bigint,
	marketPrice: number
): Promise<ValidationResult> {
	const errors: string[] = [];
	let expectedRange = 'Unknown pair';

	try {
		const expectedSqrtPriceX96 = calculateSqrtPriceX96(
			token0Name,
			token1Name,
			marketPrice,
			false
		);
		
		const actualPrice = sqrtPriceX96ToPrice(actualSqrtPriceX96);
		
		const sqrtDiff = actualSqrtPriceX96 > expectedSqrtPriceX96 
			? Number(actualSqrtPriceX96 - expectedSqrtPriceX96) / Number(expectedSqrtPriceX96)
			: Number(expectedSqrtPriceX96 - actualSqrtPriceX96) / Number(expectedSqrtPriceX96);
		
		const tolerance = 0.05;
		const isValid = sqrtDiff < tolerance;
		
		if (!isValid) {
			errors.push(
				`sqrtPriceX96 mismatch: actual=${actualSqrtPriceX96}, ` +
				`expected=${expectedSqrtPriceX96}, diff=${(sqrtDiff * 100).toFixed(2)}%`
			);
		}
		
		expectedRange = `Expected sqrtPriceX96: ${expectedSqrtPriceX96} (market: $${marketPrice})`;
		
		return { 
			isValid, 
			expectedRange, 
			errors, 
			expectedSqrtPriceX96,
			actualPrice
		};
		
	} catch (error: any) {
		errors.push(`Price validation failed: ${error.message}`);
		expectedRange = 'Validation error';
		
		return { 
			isValid: false, 
			expectedRange, 
			errors, 
			expectedSqrtPriceX96: 0n,
			actualPrice: 0
		};
	}
}

/**
 * Gets current market price for token pair
 * @param token0Name - Token0 symbol
 * @param token1Name - Token1 symbol
 * @returns Market price or null
 */
async function getMarketPrice(token0Name: string, token1Name: string): Promise<number | null> {
	if (token0Name === 'ETH' || token1Name === 'ETH') {
		return await getCurrentPriceBySymbol('ETH');
	}
	
	if (token0Name === 'WBTC' || token1Name === 'WBTC') {
		return await getCurrentPriceBySymbol('BTC');
	}
	
	return 1.0;
}

/**
 * Creates public client for blockchain interaction
 * @returns Public client instance
 */
function getPublicClient() {
	return createPublicClient({
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Creates pool key for diagnostics
 * @param token0 - Token0 address
 * @param token1 - Token1 address
 * @returns Pool key object
 */
function createPoolKey(token0: Address, token1: Address) {
	return {
		currency0: token0,
		currency1: token1,
		fee: 3000,
		tickSpacing: getTickSpacing(3000),
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
	};
}

/**
 * Initializes empty diagnostics object
 * @param poolName - Pool name for display
 * @param token0Name - Token0 symbol
 * @param token1Name - Token1 symbol
 * @returns Empty diagnostics object
 */
function createEmptyDiagnostics(poolName: string, token0Name: string, token1Name: string): PoolDiagnostics {
	return {
		name: poolName,
		exists: false,
		hasLiquidity: false,
		pricesValid: false,
		poolData: {
			sqrtPriceX96: '0',
			tick: '0',
			actualPrice: 0,
			expectedSqrtPriceX96: '0',
			priceLabel: `${token0Name}/${token1Name}`
		},
		expectedPrices: {
			range: 'Unknown'
		},
		balances: {
			token0: { name: token0Name, balance: '0', raw: 0n },
			token1: { name: token1Name, balance: '0', raw: 0n }
		},
		errors: [],
		warnings: []
	};
}

/**
 * Checks pool existence and gets price data
 * @param diagnostics - Diagnostics object to update
 * @param poolKey - Pool key object
 * @param token0Name - Token0 symbol
 * @param token1Name - Token1 symbol
 */
async function checkPoolPricing(
	diagnostics: PoolDiagnostics,
	poolKey: any,
	token0Name: string,
	token1Name: string
): Promise<void> {
	try {
		const stateView = getStateView({
			address: CONTRACT_ADDRESSES.UNIV4_STATEVIEW_ADDRESS as Address,
			chain: anvil,
			transport: http('http://localhost:8545')
		});

		const poolId = calculatePoolId(poolKey);
		const slot0Data = await stateView.read.getSlot0([poolId]);
		const [sqrtPriceX96, tick] = slot0Data;

		diagnostics.exists = true;
		diagnostics.poolData.sqrtPriceX96 = sqrtPriceX96.toString();
		diagnostics.poolData.tick = tick.toString();

		if (sqrtPriceX96 > 0n) {
			const marketPrice = await getMarketPrice(token0Name, token1Name);

			if (marketPrice) {
				const validation = await validatePoolPrices(
					token0Name,
					token1Name,
					sqrtPriceX96,
					marketPrice
				);
				
				diagnostics.pricesValid = validation.isValid;
				diagnostics.expectedPrices.range = validation.expectedRange;
				diagnostics.expectedPrices.currentMarketPrice = marketPrice;
				diagnostics.poolData.expectedSqrtPriceX96 = validation.expectedSqrtPriceX96.toString();
				diagnostics.poolData.actualPrice = validation.actualPrice;
				
				if (!validation.isValid) {
					diagnostics.errors.push(...validation.errors);
				}
			} else {
				diagnostics.warnings.push('Could not fetch market price for validation');
			}
		} else {
			diagnostics.warnings.push('Pool not initialized (zero price)');
		}
	} catch (error: any) {
		diagnostics.errors.push(`Failed to read pool: ${error.message}`);
	}
}

/**
 * Checks pool liquidity balances
 * @param diagnostics - Diagnostics object to update
 * @param publicClient - Public client instance
 * @param token0 - Token0 address
 * @param token1 - Token1 address
 */
async function checkPoolLiquidity(
	diagnostics: PoolDiagnostics,
	publicClient: any,
	token0: Address,
	token1: Address
): Promise<void> {
	try {
		const token0Balance = await getTokenBalance(publicClient, token0, CONTRACT_ADDRESSES.POOL_MANAGER as Address);
		const token1Balance = await getTokenBalance(publicClient, token1, CONTRACT_ADDRESSES.POOL_MANAGER as Address);

		diagnostics.balances.token0.raw = token0Balance;
		diagnostics.balances.token0.balance = formatUnits(token0Balance, getTokenDecimals(token0));
		diagnostics.balances.token1.raw = token1Balance;
		diagnostics.balances.token1.balance = formatUnits(token1Balance, getTokenDecimals(token1));

		diagnostics.hasLiquidity = token0Balance > 0n || token1Balance > 0n;
	} catch (error: any) {
		diagnostics.errors.push(`Failed to check liquidity: ${error.message}`);
	}
}

/**
 * Runs comprehensive diagnostics on a single pool
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @param poolName - Pool name for display
 * @returns Pool diagnostics result
 */
async function diagnosePool(tokenA: Address, tokenB: Address, poolName: string): Promise<PoolDiagnostics> {
	const publicClient = getPublicClient();
	const [token0, token1] = sortTokenAddresses(tokenA, tokenB);
	const token0Name = getTokenName(token0);
	const token1Name = getTokenName(token1);
	const poolKey = createPoolKey(token0, token1);
	
	const diagnostics = createEmptyDiagnostics(poolName, token0Name, token1Name);
	
	await checkPoolPricing(diagnostics, poolKey, token0Name, token1Name);
	await checkPoolLiquidity(diagnostics, publicClient, token0, token1);

	return diagnostics;
}

/**
 * Prints diagnostics for a single pool
 * @param diagnostics - Pool diagnostics to print
 */
function printPoolDiagnostics(diagnostics: PoolDiagnostics): void {
	console.log(chalk.blue(`\n🔍 ${diagnostics.name}`));
	console.log(chalk.gray(`   ${diagnostics.balances.token0.name}/${diagnostics.balances.token1.name}`));

	if (diagnostics.exists) {
		console.log(chalk.green(`   ✅ Pool exists`));
		
		console.log(chalk.cyan(`   💰 PRICES:`));
		console.log(chalk.gray(`      Actual sqrtPriceX96: ${diagnostics.poolData.sqrtPriceX96}`));
		console.log(chalk.gray(`      Expected sqrtPriceX96: ${diagnostics.poolData.expectedSqrtPriceX96}`));
		console.log(chalk.gray(`      Actual price ratio: ${diagnostics.poolData.actualPrice.toFixed(8)}`));
		console.log(chalk.gray(`      ${diagnostics.expectedPrices.range}`));
		
		console.log(diagnostics.pricesValid 
			? chalk.green(`      ✅ Prices valid`) 
			: chalk.red(`      ❌ Prices invalid`)
		);
		
		console.log(chalk.cyan(`   💧 LIQUIDITY:`));
		console.log(chalk.gray(`      ${diagnostics.balances.token0.name}: ${diagnostics.balances.token0.balance}`));
		console.log(chalk.gray(`      ${diagnostics.balances.token1.name}: ${diagnostics.balances.token1.balance}`));
		
		console.log(diagnostics.hasLiquidity 
			? chalk.green(`      ✅ Has liquidity`) 
			: chalk.yellow(`      ⚠️ No liquidity`)
		);
	} else {
		console.log(chalk.red(`   ❌ Pool does not exist`));
	}

	if (diagnostics.errors.length > 0) {
		console.log(chalk.red(`   🚨 ERRORS:`));
		diagnostics.errors.forEach(error => console.log(chalk.red(`      • ${error}`)));
	}

	if (diagnostics.warnings.length > 0) {
		console.log(chalk.yellow(`   ⚠️ WARNINGS:`));
		diagnostics.warnings.forEach(warning => console.log(chalk.yellow(`      • ${warning}`)));
	}
}

/**
 * Prints summary of all pool diagnostics
 * @param results - Array of pool diagnostics
 * @returns True if all pools are healthy
 */
function printDiagnosticsSummary(results: PoolDiagnostics[]): boolean {
	const existingPools = results.filter(r => r.exists).length;
	const poolsWithLiquidity = results.filter(r => r.hasLiquidity).length;
	const poolsWithValidPrices = results.filter(r => r.pricesValid).length;
	const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
	const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

	console.log(chalk.blue('\n📊 SUMMARY'));
	console.log(chalk.cyan(`   Pools existing: ${existingPools}/${results.length}`));
	console.log(chalk.cyan(`   Pools with liquidity: ${poolsWithLiquidity}/${existingPools}`));
	console.log(chalk.cyan(`   Pools with valid prices: ${poolsWithValidPrices}/${existingPools}`));
	console.log(chalk.cyan(`   Total errors: ${totalErrors}`));
	console.log(chalk.cyan(`   Total warnings: ${totalWarnings}`));

	const allGood = existingPools === results.length && 
					poolsWithLiquidity === existingPools && 
					poolsWithValidPrices === existingPools && 
					totalErrors === 0;

	if (allGood) {
		console.log(chalk.green('\n🎉 ALL POOLS READY!'));
	} else {
		console.log(chalk.red('\n⚠️ ISSUES DETECTED!'));
		
		if (existingPools < results.length) {
			console.log(chalk.yellow('   → Some pools need to be created'));
		}
		if (poolsWithLiquidity < existingPools) {
			console.log(chalk.yellow('   → Some pools need liquidity'));
		}
		if (poolsWithValidPrices < existingPools) {
			console.log(chalk.red('   → Some pools have invalid pricing (CRITICAL!)'));
		}
	}
	
	return allGood;
}

/**
 * Runs comprehensive diagnostics on all pools
 * @returns True if all pools are healthy
 */
export async function comprehensivePoolDiagnostics(): Promise<boolean> {
	console.log(chalk.blue('\n🔍 COMPREHENSIVE POOL DIAGNOSTICS'));
	console.log(chalk.gray('Checking existence, pricing, and liquidity...\n'));

	const pools = [
		{ name: 'ETH/USDC', tokenA: TOKEN_ADDRESSES.ETH, tokenB: TOKEN_ADDRESSES.USDC },
		{ name: 'ETH/USDT', tokenA: TOKEN_ADDRESSES.ETH, tokenB: TOKEN_ADDRESSES.USDT },
		{ name: 'ETH/DAI', tokenA: TOKEN_ADDRESSES.ETH, tokenB: TOKEN_ADDRESSES.DAI },
		{ name: 'BTC/USDC', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.USDC },
		{ name: 'BTC/USDT', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.USDT },
		{ name: 'BTC/DAI', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.DAI }
	];

	const results: PoolDiagnostics[] = [];
	
	for (const pool of pools) {
		const diagnostics = await diagnosePool(pool.tokenA, pool.tokenB, pool.name);
		results.push(diagnostics);
		printPoolDiagnostics(diagnostics);
	}

	return printDiagnosticsSummary(results);
}

/**
 * Quick validation entry point
 */
export async function validatePools(): Promise<void> {
	console.log(chalk.blue('\n🧪 POOL VALIDATION'));
	const allGood = await comprehensivePoolDiagnostics();
	
	if (!allGood) {
		console.log(chalk.red('\n❌ Pool validation failed!'));
		process.exit(1);
	}
	
	console.log(chalk.green('✅ Pool validation completed!\n'));
}
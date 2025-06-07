import { Address } from 'viem';
import chalk from 'chalk';

/**
 * Calculates sqrt(1.0001^tick) * 2^96 using Uniswap's TickMath formula
 * @param tick - The tick value to convert
 * @returns sqrtPriceX96 as bigint
 * @throws Error if tick is out of bounds
 */
function getSqrtRatioAtTick(tick: number): bigint {
	const MIN_TICK = -887272;
	const MAX_TICK = 887272;
	
	if (tick < MIN_TICK || tick > MAX_TICK) {
		throw new Error(`Tick ${tick} out of bounds [${MIN_TICK}, ${MAX_TICK}]`);
	}
	
	const base = 1.0001;
	const tickPower = Math.pow(base, tick);
	const sqrtPrice = Math.sqrt(tickPower);
	const Q96 = 2n ** 96n;
	
	return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Determines the price ratio (token1/token0) for a given token pair and market price
 * @param token0Symbol - Symbol of token0
 * @param token1Symbol - Symbol of token1
 * @param marketPrice - Market price of the base asset in USD
 * @returns Price ratio as number
 */
function calculatePriceRatio(token0Symbol: string, token1Symbol: string, marketPrice: number): number {
	if (token0Symbol === 'ETH' && ['USDC', 'USDT', 'DAI'].includes(token1Symbol)) {
		return marketPrice;
	}
	
	if (['USDC', 'USDT', 'DAI'].includes(token0Symbol) && token1Symbol === 'ETH') {
		return 1 / marketPrice;
	}
	
	if (token0Symbol === 'WBTC' && ['USDC', 'USDT', 'DAI'].includes(token1Symbol)) {
		return marketPrice;
	}
	
	if (['USDC', 'USDT', 'DAI'].includes(token0Symbol) && token1Symbol === 'WBTC') {
		return 1 / marketPrice;
	}
	
	return 1.0;
}

/**
 * Converts price to tick using Uniswap's formula: tick = log(price) / log(1.0001)
 * @param price - Price ratio to convert
 * @returns Tick value as integer
 */
function priceToTick(price: number): number {
	return Math.floor(Math.log(price) / Math.log(1.0001));
}

/**
 * Validates calculated sqrtPriceX96 by converting back to price
 * @param sqrtPriceX96 - The calculated sqrtPriceX96 value
 * @param expectedPrice - The expected price ratio
 * @returns Validation result with percentage difference
 */
function validateSqrtPriceX96(sqrtPriceX96: bigint, expectedPrice: number): { isValid: boolean; difference: number } {
	const Q96 = 2n ** 96n;
	const backToPrice = Math.pow(Number(sqrtPriceX96) / Number(Q96), 2);
	const difference = Math.abs(backToPrice - expectedPrice) / expectedPrice;
	
	return {
		isValid: difference <= 0.01,
		difference: difference * 100
	};
}

/**
 * Logs calculation steps if verbose mode is enabled
 * @param verbose - Whether to log debug information
 * @param token0Symbol - Symbol of token0
 * @param token1Symbol - Symbol of token1
 * @param marketPrice - Market price used
 * @param price - Calculated price ratio
 * @param tick - Calculated tick
 * @param sqrtPriceX96 - Final sqrtPriceX96 value
 */
function logCalculationSteps(
	verbose: boolean,
	token0Symbol: string,
	token1Symbol: string,
	marketPrice: number,
	price: number,
	tick: number,
	sqrtPriceX96: bigint
): void {
	if (!verbose) return;
	
	console.log(chalk.blue(`Calculating sqrtPriceX96 for ${token0Symbol}/${token1Symbol}`));
	console.log(`  Market price: ${marketPrice}`);
	console.log(`  Price ratio (token1/token0): ${price}`);
	console.log(`  Calculated tick: ${tick}`);
	console.log(chalk.green(`  Final sqrtPriceX96: ${sqrtPriceX96}`));
	
	const validation = validateSqrtPriceX96(sqrtPriceX96, price);
	console.log(chalk.green(`  Validation: ${validation.isValid ? 'PASS' : 'FAIL'} (${validation.difference.toFixed(2)}% diff)`));
	
	if (!validation.isValid) {
		console.warn(chalk.yellow(`  Warning: Price validation failed by ${validation.difference.toFixed(2)}%`));
	}
}

/**
 * Calculates sqrtPriceX96 for any token pair using market price
 * @param token0Symbol - Symbol of token0 (sorted token)
 * @param token1Symbol - Symbol of token1 (sorted token)
 * @param marketPrice - Market price of the base asset in USD
 * @param verbose - Whether to log debug information (default: true)
 * @returns sqrtPriceX96 as bigint
 */
export function calculateSqrtPriceX96(
	token0Symbol: string,
	token1Symbol: string,
	marketPrice: number,
	verbose: boolean = true
): bigint {
	const price = calculatePriceRatio(token0Symbol, token1Symbol, marketPrice);
	const tick = priceToTick(price);
	const sqrtPriceX96 = getSqrtRatioAtTick(tick);
	
	logCalculationSteps(verbose, token0Symbol, token1Symbol, marketPrice, price, tick, sqrtPriceX96);
	
	return sqrtPriceX96;
}

/**
 * Maps token address to symbol
 * @param address - Token contract address
 * @returns Token symbol or 'UNKNOWN'
 */
export function getTokenSymbolFromAddress(address: Address): string {
	const tokenMap: Record<string, string> = {
		'0x0000000000000000000000000000000000000000': 'ETH',
		'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
		'0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
		'0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI',
		'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC',
	};
	
	return tokenMap[address.toLowerCase()] || 'UNKNOWN';
}

/**
 * Calculates sqrtPriceX96 from token addresses
 * @param token0 - Address of token0
 * @param token1 - Address of token1
 * @param marketPrice - Market price of the base asset in USD
 * @param verbose - Whether to log debug information (default: true)
 * @returns sqrtPriceX96 as bigint
 */
export function calculateSqrtPriceX96FromAddresses(
	token0: Address,
	token1: Address,
	marketPrice: number,
	verbose: boolean = true
): bigint {
	const token0Symbol = getTokenSymbolFromAddress(token0);
	const token1Symbol = getTokenSymbolFromAddress(token1);
	
	return calculateSqrtPriceX96(token0Symbol, token1Symbol, marketPrice, verbose);
}

export { getSqrtRatioAtTick };
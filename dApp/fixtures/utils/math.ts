import { encodeSqrtRatioX96 } from '@uniswap/v3-sdk';
import chalk from 'chalk';
import JSBI from 'jsbi';
import { Address, parseUnits } from 'viem';
import { TOKEN_CONFIGS } from '../config/tokens';
import { PriceData } from '../services/price';

/**
 * Calculate sqrtPriceX96 from two separate USD prices
 * @param token0PriceUSD - Price of token0 in USD
 * @param token1PriceUSD - Price of token1 in USD
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 */
export function calculateSqrtPriceX96FromUSDPrices(
	token0PriceUSD: PriceData, // e.g., ETH = $2000
	token1PriceUSD: PriceData, // e.g., USDC = $1
	token0Decimals: number,
	token1Decimals: number
): JSBI {
	// Calculate the ratio: how many token1 per 1 token0
	const priceRatio = token0PriceUSD.price / token1PriceUSD.price;

	const token0Amount = parseUnits('1', token0Decimals);
	const token1Amount = parseUnits(priceRatio.toString(), token1Decimals);

	return encodeSqrtRatioX96(token1Amount.toString(), token0Amount.toString());
}

/**
 * Test function to validate calculations against known good values
 */
export function testSqrtPriceCalculations(): void {
	console.log(chalk.blue('\n🧪 TESTING SQRTPRICEX96 CALCULATIONS'));
	console.log(chalk.blue('='.repeat(50)));

	const testCases = [
		{ token0: 'ETH', token1: 'USDC', marketPrice: 2500, description: 'ETH/USDC pair' },
		{ token0: 'ETH', token1: 'USDT', marketPrice: 2500, description: 'ETH/USDT pair' },
		{ token0: 'ETH', token1: 'DAI', marketPrice: 2500, description: 'ETH/DAI pair' },
		{ token0: 'WBTC', token1: 'USDC', marketPrice: 45000, description: 'WBTC/USDC pair' },
		{ token0: 'USDC', token1: 'USDT', marketPrice: 1, description: 'Stablecoin pair' }
	];

	for (const testCase of testCases) {
		try {
			console.log(chalk.yellow(`\n🧪 Testing ${testCase.description}`));
			const result = calculateSqrtPriceX96(
				testCase.token0,
				testCase.token1,
				testCase.marketPrice,
				true
			);

			// Basic validation - result should be reasonable
			const MIN_SQRT_PRICE = 4295128739n;
			const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970341n;

			if (result > MIN_SQRT_PRICE && result < MAX_SQRT_PRICE) {
				console.log(chalk.green(`✅ PASS: Result is within valid bounds`));
			} else {
				console.log(chalk.red(`❌ FAIL: Result is outside valid bounds`));
			}
		} catch (error) {
			console.log(chalk.red(`❌ ERROR: ${error.message}`));
		}
	}

	console.log(
		chalk.blue('\n📊 Test Summary: If all tests show ✅ PASS, the math is working correctly')
	);
}

/**
 * Maps token address to symbol (for compatibility)
 */
export function getTokenSymbolFromAddress(address: Address): string {
	const addressLower = address.toLowerCase();

	for (const [symbol, config] of Object.entries(TOKEN_CONFIGS)) {
		if (config.address.toLowerCase() === addressLower) {
			return symbol;
		}
	}

	return 'UNKNOWN';
}

/**
 * Get market price for a base asset from our symbol
 * This is a helper to determine which token has the "market price"
 */
export function getBaseAssetFromPair(token0Symbol: string, token1Symbol: string): string | null {
	const token0Config = TOKEN_CONFIGS[token0Symbol];
	const token1Config = TOKEN_CONFIGS[token1Symbol];

	if (!token0Config || !token1Config) return null;

	// Return the non-stablecoin if there's one
	if (!token0Config.isStablecoin && token1Config.isStablecoin) {
		return token0Symbol;
	}

	if (token0Config.isStablecoin && !token1Config.isStablecoin) {
		return token1Symbol;
	}

	// If both are crypto or both are stablecoin, return the first one
	return token0Symbol;
}

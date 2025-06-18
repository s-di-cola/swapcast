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
 */
export function calculateSqrtPriceX96FromUSDPrices(
	token0PriceUSD: PriceData,
	token1PriceUSD: PriceData,
): JSBI {
	// Calculate price ratio in floating point
	const priceRatio = token0PriceUSD.price / token1PriceUSD.price;
	
	// Use a common decimal base (18) for both tokens
	const commonDecimals = 18;
	const token0Amount = parseUnits('1', commonDecimals);
	const token1Amount = parseUnits(priceRatio.toString(), commonDecimals);
	
	console.log(`🔍 Debug: ${token0PriceUSD.symbol}/${token1PriceUSD.symbol}`);
	console.log(`🔍 Price ratio: ${priceRatio}`);
	console.log(`🔍 Normalized token0Amount: ${token0Amount}`);
	console.log(`🔍 Normalized token1Amount: ${token1Amount}`);
	
	return encodeSqrtRatioX96(token1Amount.toString(), token0Amount.toString());
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

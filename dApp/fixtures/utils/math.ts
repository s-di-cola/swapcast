/**
 * @file Mathematical utilities for price calculations
 * @description Provides functions for price calculations and token conversions
 * @module utils/math
 */

import { encodeSqrtRatioX96 } from '@uniswap/v3-sdk';
import chalk from 'chalk';
import JSBI from 'jsbi';
import { Address, parseUnits } from 'viem';
import { TOKEN_CONFIGS } from '../config/tokens';
import { PriceData } from '../services/price';

/**
 * Calculates the sqrtPriceX96 value from two USD-denominated token prices
 * @param token0PriceUSD - Price data for the first token
 * @param token1PriceUSD - Price data for the second token
 * @returns {JSBI} The calculated sqrtPriceX96 value
 * @example
 * const sqrtPrice = calculateSqrtPriceX96FromUSDPrices(ethPrice, usdcPrice);
 */
export function calculateSqrtPriceX96FromUSDPrices(
	token0PriceUSD: PriceData,
	token1PriceUSD: PriceData,
): JSBI {
	const priceRatio = token0PriceUSD.price / token1PriceUSD.price;
	const commonDecimals = 18;
	const token0Amount = parseUnits('1', commonDecimals);
	const token1Amount = parseUnits(priceRatio.toString(), commonDecimals);
	
	// Debug logging removed in production
	if (process.env.NODE_ENV === 'development') {
		console.log(`🔍 Debug: ${token0PriceUSD.symbol}/${token1PriceUSD.symbol}`);
		console.log(`🔍 Price ratio: ${priceRatio}`);
		console.log(`🔍 Normalized token0Amount: ${token0Amount}`);
		console.log(`🔍 Normalized token1Amount: ${token1Amount}`);
	}
	
	return encodeSqrtRatioX96(token1Amount.toString(), token0Amount.toString());
}

/**
 * Retrieves the token symbol from its address
 * @param address - The token contract address
 * @returns The token symbol or 'UNKNOWN' if not found
 * @example
 * const symbol = getTokenSymbolFromAddress('0x...');
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
 * Determines if a token symbol represents a base asset with a market price
 * @param token0Symbol - The symbol of the first token in the pair
 * @param token1Symbol - The symbol of the second token in the pair
 * @returns The base asset symbol if found, otherwise null
 * @example
 * const baseAsset = getBaseAssetFromPair('WETH', 'USDC'); // Returns 'WETH'
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

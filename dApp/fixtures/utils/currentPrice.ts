/**
 * Current Price Service for Fixtures
 *
 * This module provides functionality to fetch current cryptocurrency prices
 * from CoinGecko for use in fixture generation.
 */

import {
	makeApiRequest,
	buildEndpoint,
	buildQueryString
} from '../../src/lib/services/price/client';
import { FALLBACK_COIN_MAPPING } from '../../src/lib/services/price/config';
import { getCoinIdFromAssetPair } from '../../src/lib/services/price/operations';
import chalk from 'chalk';

// Cache for current prices to avoid repeated API calls
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Gets the current price for a cryptocurrency
 *
 * @param assetSymbol - Symbol of the asset (e.g., 'BTC', 'ETH')
 * @returns Promise resolving to the current price in USD
 */
export async function getCurrentPrice(assetSymbol: string): Promise<number> {
	// Check cache first
	const now = Date.now();
	const cacheKey = assetSymbol.toUpperCase();

	if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_TTL) {
		return priceCache[cacheKey].price;
	}

	try {
		// Get coin ID from symbol
		const coinId = await getCoinIdForSymbol(assetSymbol);
		if (!coinId) {
			throw new Error(`Could not find coin ID for symbol: ${assetSymbol}`);
		}

		// Fetch current price
		const endpoint = buildEndpoint('/simple/price', {});
		const queryParams = {
			ids: coinId,
			vs_currencies: 'usd',
			include_24hr_change: 'false'
		};
		const url = `${endpoint}?${buildQueryString(queryParams)}`;

		console.log(chalk.blue(`Fetching current price for ${assetSymbol} (${coinId})...`));
		const response = await makeApiRequest<Record<string, { usd: number }>>(url, {});

		if (!response[coinId] || typeof response[coinId].usd !== 'number') {
			throw new Error(`Invalid price response for ${assetSymbol}`);
		}

		const price = response[coinId].usd;
		console.log(chalk.green(`Current price for ${assetSymbol}: $${price.toFixed(2)}`));

		// Cache the result
		priceCache[cacheKey] = { price, timestamp: now };

		return price;
	} catch (error) {
		console.error(
			chalk.yellow(`Error fetching price for ${assetSymbol}, using fallback price:`),
			error
		);

		// Use fallback prices for common cryptocurrencies
		const fallbackPrices: Record<string, number> = {
			BTC: 65000,
			ETH: 3500,
			SOL: 150,
			USDC: 1,
			USDT: 1,
			DAI: 1
		};

		const fallbackPrice = fallbackPrices[cacheKey] || 100; // Default fallback
		console.log(chalk.yellow(`Using fallback price for ${assetSymbol}: $${fallbackPrice}`));

		// Cache the fallback result with shorter TTL
		priceCache[cacheKey] = { price: fallbackPrice, timestamp: now - CACHE_TTL / 2 };

		return fallbackPrice;
	}
}

/**
 * Gets the CoinGecko coin ID for a symbol
 *
 * @param symbol - Asset symbol (e.g., 'BTC', 'ETH')
 * @returns Promise resolving to the coin ID or null if not found
 */
async function getCoinIdForSymbol(symbol: string): Promise<string | null> {
	const upperSymbol = symbol.toUpperCase();

	// Try to get from the mapping first
	try {
		// For asset pairs like ETH/USD, extract the base asset
		if (symbol.includes('/')) {
			return await getCoinIdFromAssetPair(symbol);
		}

		// Check fallback mapping
		if (FALLBACK_COIN_MAPPING[upperSymbol]) {
			return FALLBACK_COIN_MAPPING[upperSymbol];
		}
	} catch (error) {
		console.error(chalk.yellow(`Error getting coin ID for ${symbol}:`), error);
	}

	// Fallback mapping for common symbols
	const symbolToId: Record<string, string> = {
		BTC: 'bitcoin',
		ETH: 'ethereum',
		SOL: 'solana',
		USDC: 'usd-coin',
		USDT: 'tether',
		DAI: 'dai'
	};

	return symbolToId[upperSymbol] || null;
}

/**
 * Calculates a realistic price threshold based on current price and volatility
 *
 * @param currentPrice - Current price of the asset
 * @param volatilityPercent - Volatility percentage (default: 2-5%)
 * @returns Absolute price value to use as threshold
 */
export function calculateRealisticPriceThreshold(
	currentPrice: number,
	volatilityPercent?: number
): number {
	// If volatility is not provided, use a random value between 2-5%
	const volatility = volatilityPercent || 2 + Math.random() * 3;

	// For stablecoins (price around $1), use a smaller threshold
	if (currentPrice >= 0.95 && currentPrice <= 1.05) {
		// For stablecoins, use a very small absolute difference (e.g., $0.002)
		return 1.002;
	}

	// For high-value assets, calculate a realistic price near the current price
	// Slightly above current price (by the volatility percentage)
	return currentPrice * (1 + volatility / 100);
}

/**
 * @file Market generation service for test fixtures
 * @description Generates market requests based on configuration and price data
 * @module services/marketGenerator
 */

import {MARKET_PAIR_CONFIGS, MarketGenerationConfig, MarketPairConfig} from '../config/markets';
import {TOKEN_CONFIGS} from '../config/tokens';
import {PriceData, PriceService} from './price';
import chalk from 'chalk';

/**
 * Represents a request to create a new prediction market
 * @property base - Base token symbol (e.g., 'ETH')
 * @property quote - Quote token symbol (e.g., 'USDC')
 * @property basePrice - Current price of base token in terms of quote token
 * @property priceConfidence - Confidence level of the price data
 * @property priceThresholdMultiplier - Multiplier to determine price target
 * @property expirationDays - Days until market expiration
 * @property category - Market category (e.g., 'crypto', 'forex')
 */
export interface MarketRequest {
    base: string;
    quote: string;
    basePrice: number;
    priceConfidence: 'high' | 'medium' | 'low';
    priceThresholdMultiplier: number;
    expirationDays: number;
    category: string;
}

/**
 * Service for generating market requests based on configuration
 * Handles filtering, price fetching, and request generation
 */
export class MarketGenerator {
    private priceService = new PriceService();

    /**
     * Generates a random price threshold multiplier that can be positive or negative
     * @param minPct - Minimum absolute percentage (e.g., 5 for 5% or -5%)
     * @param maxPct - Maximum absolute percentage (e.g., 25 for 25% or -25%)
     * @returns A random multiplier that can be above or below 1.0
     */
    private getRandomMultiplier(minPct: number = 5, maxPct: number = 25): number {
        // Randomly decide if the movement is positive or negative
        const isPositive = Math.random() > 0.5;
        const sign = isPositive ? 1 : -1;
        
        // Generate a random percentage within the range
        const randomPct = Math.random() * (maxPct - minPct) + minPct;
        const adjustedPct = sign * randomPct;
        
        // Calculate the multiplier (e.g., 3000 * 1.15 = 3450 or 3000 * 0.85 = 2550)
        const multiplier = 1 + (adjustedPct / 100);
        
        // Round to 2 decimal places for cleaner numbers
        return Math.round(multiplier * 100) / 100;
    }

    /**
     * Generates market requests based on configuration
     * @param config - Market generation configuration
     * @returns Array of market requests ready for processing
     */
    async generateMarketRequests(config: MarketGenerationConfig): Promise<MarketRequest[]> {
        console.log(chalk.blue(`🏗️ Generating market requests:`));
        console.log(chalk.gray(`   Max markets: ${config.maxMarkets}`));
        console.log(chalk.gray(`   Categories: ${config.enabledCategories.join(', ')}`));
        console.log(chalk.gray(`   Price source: ${config.priceSource}`));
        console.log(chalk.gray(`   Require high confidence: ${config.requireHighConfidence}`));

        // Filter and sort market pairs
        const enabledPairs = this.getEnabledPairs(config);
        console.log(chalk.blue(`📋 Found ${enabledPairs.length} enabled market pairs`));

        // Get required symbols for pricing
        const requiredSymbols = this.getRequiredSymbols(enabledPairs);
        console.log(chalk.blue(`💰 Fetching prices for ${requiredSymbols.length} tokens...`));

        // Fetch all prices
        const prices = await this.priceService.getBatchPrices(requiredSymbols);
        this.logPriceResults(prices);

        // Generate market requests
        const marketRequests: MarketRequest[] = [];

        for (const pair of enabledPairs.slice(0, config.maxMarkets)) {
            const basePrice = prices.get(pair.base);

            if (!basePrice) {
                console.warn(chalk.yellow(`⚠️ No price for ${pair.base}, skipping ${pair.base}/${pair.quote}`));
                continue;
            }

            if (config.requireHighConfidence && basePrice.confidence === 'low') {
                console.warn(chalk.yellow(`⚠️ Low confidence price for ${pair.base}, skipping due to requireHighConfidence`));
                continue;
            }

            marketRequests.push({
                base: pair.base,
                quote: pair.quote,
                basePrice: basePrice.price,
                priceConfidence: basePrice.confidence,
                priceThresholdMultiplier: this.getRandomMultiplier(),
                expirationDays: pair.expirationDays || 30,
                category: pair.category
            });

            console.log(chalk.green(
                `✅ ${pair.base}/${pair.quote}: $${basePrice.price} (${basePrice.source}, ${basePrice.confidence})`
            ));
        }

        console.log(chalk.blue(`🎯 Generated ${marketRequests.length} market requests`));
        return marketRequests;
    }

    /**
     * Filters and sorts available market pairs based on configuration
     * @param config - Market generation configuration
     * @returns Array of enabled and valid market pairs
     */
    private getEnabledPairs(config: MarketGenerationConfig): MarketPairConfig[] {
        return MARKET_PAIR_CONFIGS
            .filter(pair => pair.enabled)
            .filter(pair => config.enabledCategories.includes(pair.category))
            .filter(pair => this.isValidPair(pair))
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Validates if a market pair has valid token configurations
     * @param pair - Market pair to validate
     * @returns True if both tokens in the pair exist in token configs
     */
    private isValidPair(pair: MarketPairConfig): boolean {
        const baseToken = TOKEN_CONFIGS[pair.base];
        const quoteToken = TOKEN_CONFIGS[pair.quote];
        return !!(baseToken && quoteToken);
    }

    /**
     * Extracts unique token symbols needed for price fetching
     * @param pairs - Array of market pairs
     * @returns Array of unique token symbols (excluding stablecoins for quote tokens)
     */
    private getRequiredSymbols(pairs: MarketPairConfig[]): string[] {
        const symbols = new Set<string>();
        pairs.forEach(pair => {
            symbols.add(pair.base);
            // Don't fetch prices for stablecoins (we use $1.00)
            if (!TOKEN_CONFIGS[pair.quote]?.isStablecoin) {
                symbols.add(pair.quote);
            }
        });
        return Array.from(symbols);
    }

    /**
     * Logs price fetching results with statistics
     * @param prices - Map of token symbols to their price data
     */
    private logPriceResults(prices: Map<string, PriceData>): void {
        console.log(chalk.blue(`📊 Price fetch results:`));
        const bySource = new Map<string, number>();
        const byConfidence = new Map<string, number>();

        prices.forEach(price => {
            bySource.set(price.source, (bySource.get(price.source) || 0) + 1);
            byConfidence.set(price.confidence, (byConfidence.get(price.confidence) || 0) + 1);
        });

        console.log(chalk.gray(`   Sources: ${Array.from(bySource.entries()).map(([k, v]) => `${k}(${v})`).join(', ')}`));
        console.log(chalk.gray(`   Confidence: ${Array.from(byConfidence.entries()).map(([k, v]) => `${k}(${v})`).join(', ')}`));
    }
}

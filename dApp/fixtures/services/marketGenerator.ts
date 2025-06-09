import { MarketPairConfig, MarketGenerationConfig, MARKET_PAIR_CONFIGS } from '../config/markets';
import { TOKEN_CONFIGS } from '../config/tokens';
import { PriceService, PriceData } from './price';
import chalk from 'chalk';

export interface MarketRequest {
    base: string;
    quote: string;
    basePrice: number;
    priceConfidence: 'high' | 'medium' | 'low';
    priceThresholdMultiplier: number;
    expirationDays: number;
    category: string;
}

export class MarketGenerator {
    private priceService = new PriceService();
    
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
                priceThresholdMultiplier: pair.priceThresholdMultiplier || 1.15,
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
    
    private getEnabledPairs(config: MarketGenerationConfig): MarketPairConfig[] {
        return MARKET_PAIR_CONFIGS
            .filter(pair => pair.enabled)
            .filter(pair => config.enabledCategories.includes(pair.category))
            .filter(pair => this.isValidPair(pair))
            .sort((a, b) => b.priority - a.priority);
    }
    
    private isValidPair(pair: MarketPairConfig): boolean {
        const baseToken = TOKEN_CONFIGS[pair.base];
        const quoteToken = TOKEN_CONFIGS[pair.quote];
        return !!(baseToken && quoteToken);
    }
    
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
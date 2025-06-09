import { TOKEN_CONFIGS } from '../config/tokens';
import chalk from 'chalk';

export interface PriceData {
    symbol: string;
    price: number;
    source: 'coingecko' | 'fallback' | 'cache';
    timestamp: number;
    confidence: 'high' | 'medium' | 'low';
}

export class PriceService {
    private cache = new Map<string, PriceData>();
    private readonly CACHE_TTL = 60 * 1000; // 1 minute
    private readonly RATE_LIMIT_DELAY = 200; // 200ms between requests
    
    async getPrice(symbol: string): Promise<PriceData | null> {
        // Check cache first
        const cached = this.getCachedPrice(symbol);
        if (cached) {
            console.log(chalk.gray(`💾 Using cached price for ${symbol}: $${cached.price}`));
            return cached;
        }
        
        const tokenConfig = TOKEN_CONFIGS[symbol.toUpperCase()];
        if (!tokenConfig) {
            console.warn(chalk.yellow(`⚠️ Unknown token: ${symbol}`));
            return null;
        }
        
        try {
            // Try CoinGecko first
            const price = await this.fetchFromCoinGecko(tokenConfig.coingeckoId);
            if (price !== null) {
                const priceData: PriceData = {
                    symbol,
                    price,
                    source: 'coingecko',
                    timestamp: Date.now(),
                    confidence: 'high'
                };
                this.cache.set(symbol, priceData);
                console.log(chalk.green(`🌐 Fetched ${symbol} from CoinGecko: $${price}`));
                return priceData;
            }
        } catch (error) {
            console.warn(chalk.yellow(`⚠️ CoinGecko failed for ${symbol}: ${error.message}`));
        }
        
        // Fallback for stablecoins
        if (tokenConfig.isStablecoin) {
            const priceData: PriceData = {
                symbol,
                price: 1.0,
                source: 'fallback',
                timestamp: Date.now(),
                confidence: 'high'
            };
            this.cache.set(symbol, priceData);
            console.log(chalk.blue(`💰 Using stablecoin fallback for ${symbol}: $1.00`));
            return priceData;
        }
        
        // Last resort fallback prices (only when CoinGecko fails)
        const fallbackPrices: Record<string, number> = {
            'ETH': 2500,
            'WBTC': 45000,
            'LINK': 15,
            'UNI': 8,
            'AAVE': 100
        };
        
        const fallbackPrice = fallbackPrices[symbol.toUpperCase()];
        if (fallbackPrice) {
            const priceData: PriceData = {
                symbol,
                price: fallbackPrice,
                source: 'fallback',
                timestamp: Date.now(),
                confidence: 'low'
            };
            this.cache.set(symbol, priceData);
            console.log(chalk.yellow(`🔄 Using fallback price for ${symbol}: $${fallbackPrice}`));
            return priceData;
        }
        
        return null;
    }
    
    async getBatchPrices(symbols: string[]): Promise<Map<string, PriceData>> {
        const results = new Map<string, PriceData>();
        
        console.log(chalk.blue(`💰 Fetching prices for ${symbols.length} tokens...`));
        
        for (let i = 0; i < symbols.length; i++) {
            if (i > 0) {
                await this.delay(this.RATE_LIMIT_DELAY);
            }
            
            const priceData = await this.getPrice(symbols[i]);
            if (priceData) {
                results.set(symbols[i], priceData);
            }
        }
        
        return results;
    }
    
    private getCachedPrice(symbol: string): PriceData | null {
        const cached = this.cache.get(symbol);
        if (!cached) return null;
        
        const isValid = (Date.now() - cached.timestamp) < this.CACHE_TTL;
        return isValid ? cached : null;
    }
    
    private async fetchFromCoinGecko(coinId: string): Promise<number | null> {
        const apiKey = process.env.PRIVATE_COINGECKO_API_KEY;
        const baseUrl = process.env.PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
        
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'User-Agent': 'SwapCast-Fixtures/2.0'
        };
        
        if (apiKey) {
            headers['X-CG-Pro-API-Key'] = apiKey;
        }
        
        const url = `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data[coinId]?.usd || null;
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    clearCache(): void {
        this.cache.clear();
    }
    
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}
export interface MarketPairConfig {
    base: string;
    quote: string;
    enabled: boolean;
    priority: number; // Higher = more important
    priceThresholdMultiplier?: number; // Default 1.15 (15% above current price)
    expirationDays?: number; // Default 30 days
    category: 'major' | 'defi' | 'experimental';
}

export interface MarketGenerationConfig {
    maxMarkets: number;
    predictionsPerMarket: number;
    enabledCategories: ('major' | 'defi' | 'experimental')[];
    priceSource: 'coingecko' | 'fallback';
    retryAttempts: number;
    requireHighConfidence: boolean;
}

export const MARKET_PAIR_CONFIGS: MarketPairConfig[] = [
    // Major crypto pairs (highest priority) - ETH PAIRS ONLY FOR WHALE SYSTEM
    { base: 'ETH', quote: 'USDC', enabled: true, priority: 100, category: 'major' },
    { base: 'ETH', quote: 'USDT', enabled: true, priority: 95, category: 'major' },
    { base: 'ETH', quote: 'DAI', enabled: true, priority: 90, category: 'major' },
    
    // DISABLE WBTC pairs for whale system (whales don't have WBTC)
    { base: 'WBTC', quote: 'USDC', enabled: false, priority: 85, category: 'major' },
    { base: 'WBTC', quote: 'USDT', enabled: false, priority: 80, category: 'major' },
    { base: 'WBTC', quote: 'DAI', enabled: false, priority: 75, category: 'major' },
    
    // DeFi tokens (medium priority) - ONLY ETH-based pairs
    { base: 'LINK', quote: 'ETH', enabled: true, priority: 45, category: 'defi' },
    { base: 'UNI', quote: 'ETH', enabled: true, priority: 35, category: 'defi' },
    { base: 'AAVE', quote: 'ETH', enabled: true, priority: 25, category: 'defi' },
    
    // DISABLE non-ETH DeFi pairs
    { base: 'LINK', quote: 'USDC', enabled: false, priority: 50, category: 'defi' },
    { base: 'UNI', quote: 'USDC', enabled: false, priority: 40, category: 'defi' },
    { base: 'AAVE', quote: 'USDC', enabled: false, priority: 30, category: 'defi' },
    
    // Cross-crypto pairs (experimental)
    { base: 'ETH', quote: 'WBTC', enabled: false, priority: 20, category: 'experimental' },
    { base: 'LINK', quote: 'WBTC', enabled: false, priority: 15, category: 'experimental' }
];


export const DEFAULT_MARKET_CONFIG: MarketGenerationConfig = {
    maxMarkets: 6,
    predictionsPerMarket: 8,
    enabledCategories: ['major', 'defi'],
    priceSource: 'coingecko',
    retryAttempts: 3,
    requireHighConfidence: false
};
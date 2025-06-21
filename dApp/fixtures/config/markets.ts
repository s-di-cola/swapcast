/**
 * Configuration for a market trading pair
 */
export interface MarketPairConfig {
    /** The base token symbol (e.g., 'ETH') */
    base: string;
    /** The quote token symbol (e.g., 'USDC') */
    quote: string;
    /** Whether this market is enabled for trading */
    enabled: boolean;
    /** Priority for display/sorting (higher = more important) */
    priority: number;
    /** Multiplier for price threshold (default: 1.15) */
    priceThresholdMultiplier?: number;
    /** Days until market expiration (default: 30) */
    expirationDays?: number;
    /** Market category for grouping and filtering */
    category: 'major' | 'defi' | 'experimental';
}

/**
 * Configuration for market generation and management
 */
export interface MarketGenerationConfig {
    /** Maximum number of markets to generate */
    maxMarkets: number;
    /** Number of predictions per market */
    predictionsPerMarket: number;
    /** Which market categories are enabled */
    enabledCategories: ('major' | 'defi' | 'experimental')[];
    /** Source for price data */
    priceSource: 'coingecko' | 'fallback';
    /** Number of retry attempts for price fetching */
    retryAttempts: number;
    /** Whether to require high confidence in price data */
    requireHighConfidence: boolean;
}

/**
 * Configuration for all available market pairs
 * Organized by priority and category
 */
export const MARKET_PAIR_CONFIGS: MarketPairConfig[] = [
    // Major crypto pairs (highest priority) - ETH based
    { base: 'ETH', quote: 'USDC', enabled: true, priority: 100, category: 'major' },
    { base: 'ETH', quote: 'DAI', enabled: true, priority: 90, category: 'major' },

    // DeFi tokens (ETH-based pairs)
    { base: 'LINK', quote: 'ETH', enabled: true, priority: 50, category: 'defi' },
    { base: 'UNI', quote: 'ETH', enabled: true, priority: 40, category: 'defi' },
    { base: 'AAVE', quote: 'ETH', enabled: true, priority: 30, category: 'defi' },

    // DeFi tokens (USDC pairs)
    { base: 'LINK', quote: 'USDC', enabled: true, priority: 45, category: 'defi' },
    { base: 'UNI', quote: 'USDC', enabled: true, priority: 35, category: 'defi' },
    { base: 'AAVE', quote: 'USDC', enabled: true, priority: 25, category: 'defi' },

    // DeFi tokens (DAI pairs)
    { base: 'LINK', quote: 'DAI', enabled: true, priority: 20, category: 'defi' },
    { base: 'UNI', quote: 'DAI', enabled: true, priority: 15, category: 'defi' },
    { base: 'AAVE', quote: 'DAI', enabled: true, priority: 10, category: 'defi' }
];

/**
 * Default configuration for market generation
 */
export const DEFAULT_MARKET_CONFIG: MarketGenerationConfig = {
    maxMarkets: 6,
    predictionsPerMarket: 8,
    enabledCategories: ['major', 'defi'],
    priceSource: 'coingecko',
    retryAttempts: 3,
    requireHighConfidence: true
};

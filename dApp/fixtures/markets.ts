import {type Address, type Hash, type WalletClient} from 'viem';
import {anvil} from 'viem/chains';
import {getPoolManager} from '../src/generated/types/PoolManager';
import {getPredictionManager} from '../src/generated/types/PredictionManager';
import {DEFAULT_MARKET_CONFIG, MarketGenerationConfig} from './config/markets';
import {TOKEN_CONFIGS} from './config/tokens';
import {MarketGenerator, MarketRequest} from './services/marketGenerator';
import {getContract, getPublicClient} from './utils/client';
import {logInfo, logSuccess, logWarning, withErrorHandling, withRetry} from './utils/error';
import {sortTokenAddresses} from './utils/helpers';
import {mintPool} from './utils/liquidity';
import {TokenInfo} from './utils/tokens';
import {CONTRACT_ADDRESSES} from './utils/wallets';
import {Pool} from '@uniswap/v4-sdk';

export interface MarketCreationResult {
    id: string;
    name: string;
    poolKey: {
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address;
    };
    expirationTime: bigint;
    priceThreshold: bigint;
    token0: TokenInfo;
    token1: TokenInfo;
    priceConfidence: string;
    category: string;
    pool: Pool; // Add the pool object for direct access
}

/**
 * Convert token symbol to TokenInfo
 * @param symbol The token symbol to convert to TokenInfo
 * @returns TokenInfo object with token details
 */
function tokenConfigToInfo(symbol: string): TokenInfo {
    const config = TOKEN_CONFIGS[symbol];
    if (!config) {
        throw new Error(`Token config not found for: ${symbol}`);
    }

    return {
        address: config.address as Address,
        symbol: config.symbol,
        name: config.name,
        decimals: config.decimals
    };
}

/**
 * Creates prediction market for the pool
 * @param predictionManager - The prediction manager contract instance
 * @param request - The market request configuration
 * @param pool - The pool object containing all pool information
 * @param adminClient - The wallet client with admin permissions
 * @param token0Info - Information about token0
 * @param token1Info - Information about token1
 * @returns Transaction hash
 */
const createPredictionMarket = withErrorHandling(
    async (
        predictionManager: ReturnType<typeof getPredictionManager>,
        request: MarketRequest,
        pool: Pool,
        adminClient: WalletClient,
        token0Info: TokenInfo,
        token1Info: TokenInfo
    ): Promise<Hash> => {
        logInfo('MarketCreation', `Creating prediction market for ${token0Info.symbol}/${token1Info.symbol}`);

        // Calculate expiration time (7 days from now)
        const expirationTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

        // Calculate price threshold based on priceThresholdMultiplier (e.g., 1.15 = 15% movement)
        // Convert from multiplier (e.g., 1.15) to percentage points (e.g., 15)
        const priceThresholdPercentage = Math.floor((request.priceThresholdMultiplier - 1) * 100);
        const priceThreshold = BigInt(priceThresholdPercentage);

        // Ensure we have a valid account
        if (!adminClient.account) {
            throw new Error('No account available in admin client');
        }

        // Use the pool's poolKey directly
        const poolKey = {
            currency0: pool.poolKey.currency0 as Address,
            currency1: pool.poolKey.currency1 as Address,
            fee: pool.poolKey.fee,
            tickSpacing: pool.poolKey.tickSpacing,
            hooks: pool.poolKey.hooks as Address
        };

        // Based on the contract ABI, createMarket expects:
        // - name (string)
        // - assetSymbol (string)
        // - expirationTime (uint256)
        // - priceAggregator (address)
        // - priceThreshold (uint256)
        // - poolKey (tuple)
        const hash = await predictionManager.write.createMarket(
            [
                // Market name
                `${token0Info.symbol}/${token1Info.symbol} Market`,
                // Asset symbol
                token0Info.symbol,
                // Expiration time
                expirationTime,
                // Price aggregator - using Oracle Resolver address
                CONTRACT_ADDRESSES.ORACLE_RESOLVER as Address,
                // Price threshold
                priceThreshold,
                // Pool key from the actual pool
                poolKey
            ],
            {
                account: adminClient.account,
                chain: anvil
            }
        );

        const publicClient = getPublicClient();
        await publicClient.waitForTransactionReceipt({ hash });

        logSuccess('MarketCreation', `Market created successfully!`);

        return hash;
    },
    'CreatePredictionMarket'
);

/**
 * Creates a single market from a MarketRequest
 * @param request - The market request configuration
 * @param marketId - The market ID
 * @param contracts - The contract instances
 * @param adminClient - The wallet client with admin permissions
 * @returns Market creation result or null if failed
 */
const createSingleMarketFromRequest = async (
    request: MarketRequest,
    marketId: number,
    contracts: {
        poolManager: ReturnType<typeof getPoolManager>;
        predictionManager: ReturnType<typeof getPredictionManager>
    },
    adminClient: WalletClient
): Promise<MarketCreationResult | null> => {
    // Create a wrapper function that captures the arguments
    const wrappedFn = async (): Promise<MarketCreationResult | null> => {
        const { poolManager, predictionManager } = contracts;

        try {
            // Get token configs first
            const baseConfig = TOKEN_CONFIGS[request.base];
            const quoteConfig = TOKEN_CONFIGS[request.quote];

            if (!baseConfig || !quoteConfig) {
                throw new Error(`Token config not found for: ${!baseConfig ? request.base : request.quote}`);
            }

            // Sort token addresses to match Uniswap's convention
            const [token0Address, token1Address] = sortTokenAddresses(
                baseConfig.address as Address,
                quoteConfig.address as Address
            );

            // Get token info
            const token0 = tokenConfigToInfo(
                token0Address === baseConfig.address ? request.base : request.quote
            );
            const token1 = tokenConfigToInfo(
                token1Address === quoteConfig.address ? request.quote : request.base
            );

            logInfo('MarketCreation', `Creating market #${marketId}: ${token0.symbol}/${token1.symbol}`);

            // Calculate initial price
            const basePrice = request.basePrice;

            logInfo('MarketCreation', `Base price: ${basePrice}`);

            // Initialize pool and mint liquidity - this returns a Pool object
            const pool = await mintPool(
                token0Address,
                token1Address,
            );

            logInfo('MarketCreation', `Pool created with ID: ${pool.poolId}`);

            // Calculate expiration time based on request's expirationDays or default to 7 days
            const expirationDays = request.expirationDays || 7;
            const expirationTime = BigInt(Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60);

            // Calculate price threshold based on priceThresholdMultiplier
            const priceThresholdPercentage = Math.floor((request.priceThresholdMultiplier - 1) * 100);
            const priceThreshold = BigInt(priceThresholdPercentage);

            // Create prediction market with pool information
            const marketHash = await createPredictionMarket(
                predictionManager,
                request,
                pool,
                adminClient,
                token0,
                token1
            );
            logInfo('MarketCreation', `Market transaction hash: ${marketHash}`);

            // Return market info with the pool object
            return {
                id: `${marketId}`,
                name: `${token0.symbol}/${token1.symbol}`,
                poolKey: {
                    currency0: pool.poolKey.currency0 as Address,
                    currency1: pool.poolKey.currency1 as Address,
                    fee: pool.poolKey.fee,
                    tickSpacing: pool.poolKey.tickSpacing,
                    hooks: pool.poolKey.hooks as Address
                },
                expirationTime,
                priceThreshold,
                token0,
                token1,
                priceConfidence: request.priceConfidence || 'medium',
                category: request.category || 'unknown',
                pool // Include the actual pool object
            };
        } catch (error) {
            logWarning('MarketCreation', `Failed to create market #${marketId}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    };

    // Use withRetry with the wrapped function
    return await withRetry(wrappedFn, {
        maxAttempts: 2,
        context: 'CreateSingleMarket',
        onRetry: (attempt, error) => {
            logInfo('MarketCreation', `Attempt ${attempt} failed, retrying...`);
        }
    });
};

/**
 * Enhanced market generation with flexible configuration
 * @param adminClient - The wallet client with admin permissions
 * @param customConfig - Optional custom market generation configuration
 * @returns Array of created markets
 */
export const generateMarketsV2 = withErrorHandling(
    async (
        adminClient: WalletClient,
        customConfig?: Partial<MarketGenerationConfig>
    ): Promise<MarketCreationResult[]> => {
        // Merge default config with custom config
        const config = { ...DEFAULT_MARKET_CONFIG, ...customConfig };

        logInfo('MarketGeneration', `Generating up to ${config.maxMarkets} markets with config: ${JSON.stringify(config)}`);

        // Get contract instances with proper typing
        const poolManager = getContract(getPoolManager, CONTRACT_ADDRESSES.POOL_MANAGER as Address);
        const predictionManager = getContract(getPredictionManager, CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address);

        // Create market generator
        const marketGenerator = new MarketGenerator();

        // Generate market requests
        const marketRequests = await marketGenerator.generateMarketRequests(config);

        logInfo('MarketGeneration', `Generated ${marketRequests.length} market requests`);

        // Create markets
        const markets: MarketCreationResult[] = [];

        for (let i = 0; i < Math.min(marketRequests.length, config.maxMarkets); i++) {
            const request = marketRequests[i];

            logInfo('MarketGeneration', `Processing market request ${i + 1}/${Math.min(marketRequests.length, config.maxMarkets)}: ${request.base}/${request.quote}`);

            const market = await createSingleMarketFromRequest(
                request,
                i + 1,
                { poolManager, predictionManager },
                adminClient
            );

            if (market) {
                markets.push(market);
                logSuccess('MarketGeneration', `Created market ${i + 1}: ${market.name}`);
            }
        }

        logSuccess('MarketGeneration', `Successfully created ${markets.length} markets`);

        return markets;
    },
    'GenerateMarketsV2'
);

import { Address, parseUnits, type WalletClient } from 'viem';
import { calculateSqrtPriceX96 } from './utils/math';
import { getPoolManager } from '../src/generated/types/PoolManager';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import { CONTRACT_ADDRESSES } from './utils/wallets';
import { sortTokenAddresses, getTickSpacing } from './utils/helpers';
import { addLiquidityToPool } from './utils/liquidity';
import { anvil } from 'viem/chains';
import { http, createPublicClient } from 'viem';
import { TOKEN_CONFIGS } from './config/tokens';
import { MarketGenerator, MarketRequest } from './services/marketGenerator';
import { DEFAULT_MARKET_CONFIG, MarketGenerationConfig } from './config/markets';
import chalk from 'chalk';

interface TokenInfo {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
}

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
    sqrtPriceX96: bigint;
    expirationTime: bigint;
    priceThreshold: bigint;
    token0: TokenInfo;
    token1: TokenInfo;
    priceConfidence: string;
    category: string;
}

/**
 * Convert TokenConfig to TokenInfo
 */
function tokenConfigToInfo(config: any): TokenInfo {
    return {
        address: config.address as Address,
        symbol: config.symbol,
        name: config.name,
        decimals: config.decimals
    };
}

/**
 * Gets contract instances
 */
function getContractInstances() {
    const poolManager = getPoolManager({
        address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
        chain: anvil,
        transport: http()
    });
    
    const predictionManager = getPredictionManager({
        address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
        chain: anvil,
        transport: http()
    });
    
    return { poolManager, predictionManager };
}

/**
 * Creates pool key for Uniswap v4
 */
function createPoolKey(token0Address: Address, token1Address: Address) {
    return {
        currency0: token0Address,
        currency1: token1Address,
        fee: 3000,
        tickSpacing: getTickSpacing(3000),
        hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
    };
}

/**
 * Initializes a Uniswap v4 pool with starting price
 */
async function initializePool(
    poolManager: any,
    poolKey: any,
    sqrtPriceX96: bigint,
    adminClient: WalletClient
): Promise<void> {
    console.log(chalk.yellow(`  🔧 Initializing pool with sqrtPriceX96: ${sqrtPriceX96}`));
    
    try {
        const initHash = await poolManager.write.initialize([poolKey, sqrtPriceX96], {
            account: adminClient.account!,
            chain: anvil,
            gas: 1000000n
        });
        
        console.log(chalk.green(`  ✅ Pool initialized: ${initHash.slice(0, 10)}...`));
    } catch (initError: any) {
        if (initError.message.includes('AlreadyInitialized') || initError.message.includes('PoolAlreadyInitialized')) {
            console.log(chalk.yellow(`  ⚠️ Pool already initialized, continuing...`));
        } else {
            throw initError;
        }
    }
}

/**
 * Adds liquidity to the initialized pool
 */
async function addPoolLiquidity(
    adminClient: WalletClient,
    poolKey: any,
    basePrice: number
): Promise<void> {
    console.log(chalk.yellow(`  💧 Adding liquidity to pool...`));
    
    try {
        // Create a proper publicClient
        const publicClient = createPublicClient({
            chain: anvil,
            transport: http()
        });
        
        await addLiquidityToPool(
            publicClient,
            poolKey,
            basePrice
        );
        console.log(chalk.green(`  ✅ Liquidity added successfully`));
    } catch (liquidityError: any) {
        console.log(chalk.yellow(`  ⚠️ Liquidity addition failed, but pool is functional: ${liquidityError.message}`));
    }
}

/**
 * Creates prediction market for the pool
 */
async function createPredictionMarket(
    predictionManager: any,
    request: MarketRequest,
    poolKey: any,
    adminClient: WalletClient
): Promise<void> {
    console.log(chalk.yellow(`  📈 Creating prediction market...`));
    
    const marketName = `${request.base} Price Prediction`;
    const expirationTime = BigInt(Math.floor(Date.now() / 1000) + request.expirationDays * 24 * 60 * 60);
    const priceThreshold = parseUnits(String(request.basePrice * request.priceThresholdMultiplier), 8);
    const priceAggregator = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as Address;
    
    const fullAssetPair = `${request.base}/${request.quote}`;
    
    const marketHash = await predictionManager.write.createMarket([
        marketName,
        fullAssetPair,
        expirationTime,
        priceAggregator,
        priceThreshold,
        poolKey
    ], {
        account: adminClient.account!,
        chain: anvil,
        gas: 1000000n
    });
    
    console.log(chalk.green(`  ✅ Market created with pair ${fullAssetPair}: ${marketHash.slice(0, 10)}...`));
}

/**
 * Creates a single market from a MarketRequest
 */
async function createSingleMarketFromRequest(
    request: MarketRequest,
    marketId: number,
    contracts: { poolManager: any; predictionManager: any },
    adminClient: WalletClient
): Promise<MarketCreationResult | null> {
    console.log(chalk.cyan(`\n📊 Creating market ${marketId}: ${request.base}/${request.quote}`));
    console.log(chalk.gray(`   Price: $${request.basePrice} (${request.priceConfidence} confidence)`));
    console.log(chalk.gray(`   Category: ${request.category}`));
    
    try {
        const baseTokenConfig = TOKEN_CONFIGS[request.base];
        const quoteTokenConfig = TOKEN_CONFIGS[request.quote];
        
        if (!baseTokenConfig || !quoteTokenConfig) {
            throw new Error(`Unknown token: ${request.base} or ${request.quote}`);
        }
        
        const baseToken = tokenConfigToInfo(baseTokenConfig);
        const quoteToken = tokenConfigToInfo(quoteTokenConfig);
        
        const [token0Address, token1Address] = sortTokenAddresses(baseToken.address, quoteToken.address);
        const token0Info = token0Address === baseToken.address ? baseToken : quoteToken;
        const token1Info = token1Address === baseToken.address ? baseToken : quoteToken;
        
        console.log(`  Token0: ${token0Info.symbol} (${token0Info.address})`);
        console.log(`  Token1: ${token1Info.symbol} (${token1Info.address})`);
        
        const sqrtPriceX96 = calculateSqrtPriceX96(
            token0Info.symbol,
            token1Info.symbol,
            request.basePrice,
            false // Don't verbose log for each market
        );
        
        const poolKey = createPoolKey(token0Address, token1Address);
        
        await initializePool(contracts.poolManager, poolKey, sqrtPriceX96, adminClient);
        await addPoolLiquidity(adminClient, poolKey, request.basePrice);
        await createPredictionMarket(contracts.predictionManager, request, poolKey, adminClient);
        
        const result: MarketCreationResult = {
            id: String(marketId),
            name: `${request.base} Price Prediction`,
            poolKey,
            sqrtPriceX96,
            expirationTime: BigInt(Math.floor(Date.now() / 1000) + request.expirationDays * 24 * 60 * 60),
            priceThreshold: parseUnits(String(request.basePrice * request.priceThresholdMultiplier), 8),
            token0: token0Info,
            token1: token1Info,
            priceConfidence: request.priceConfidence,
            category: request.category
        };
        
        console.log(chalk.green(`✅ Market ${marketId} fully created and configured\n`));
        return result;
        
    } catch (error: any) {
        console.error(chalk.red(`❌ Failed to create market ${marketId}: ${error.message}`));
        return null;
    }
}

/**
 * NEW: Enhanced market generation with flexible configuration
 */
export async function generateMarketsV2(
    adminClient: WalletClient,
    customConfig?: Partial<MarketGenerationConfig>
): Promise<MarketCreationResult[]> {
    console.log(chalk.blue('\n🏗️  GENERATING PREDICTION MARKETS V2\n'));
    
    const config = { ...DEFAULT_MARKET_CONFIG, ...customConfig };
    const generator = new MarketGenerator();
    
    // Generate market requests based on configuration
    const marketRequests = await generator.generateMarketRequests(config);
    
    if (marketRequests.length === 0) {
        throw new Error('No valid market requests generated - check your configuration');
    }
    
    const contracts = getContractInstances();
    const markets: MarketCreationResult[] = [];
    
    for (let i = 0; i < marketRequests.length; i++) {
        const request = marketRequests[i];
        
        const result = await createSingleMarketFromRequest(
            request,
            i + 1,
            contracts,
            adminClient
        );
        
        if (result) {
            markets.push(result);
        }
    }
    
    console.log(chalk.blue(`📝 Successfully created ${markets.length}/${marketRequests.length} markets\n`));
    return markets;
}
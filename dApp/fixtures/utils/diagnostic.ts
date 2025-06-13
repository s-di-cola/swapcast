import { formatEther, type Address, createPublicClient, http, encodePacked, keccak256 } from 'viem';
import { getStateView } from '../../src/generated/types/StateView';
import { getPredictionManager } from '../../src/generated/types/PredictionManager';
import chalk from 'chalk';
import {CONTRACT_ADDRESSES} from './wallets.ts';
import {MarketCreationResult} from '../markets.ts';
import { anvil } from 'viem/chains';

interface DiagnosticResults {
    totalMarkets: number;
    activeMarkets: number;
    resolvedMarkets: number;
    totalPredictions: number;
    totalStakeAmount: number;
    hookBalance: number;
    predictionManagerBalance: number;
    marketDetails: MarketDiagnostic[];
    poolDetails: PoolDiagnostic[];
    errors: string[];
}

interface MarketDiagnostic {
    id: number;
    name: string;
    asset: string;
    isActive: boolean;
    isResolved: boolean;
    totalStakeBearish: number;
    totalStakeBullish: number;
    totalStake: number;
    expirationTime: Date;
    timeUntilExpiration: string;
    priceThreshold: number;
    status: string;
}

interface PoolDiagnostic {
    marketId: number;
    poolKey: {
        currency0: string;
        currency1: string;
        fee: number;
        tickSpacing: number;
        hooks: string;
    };
    sqrtPriceX96: string;
    tick: number;
    token0Price: number;
    token1Price: number;
    priceStatus: 'REASONABLE' | 'SUSPICIOUS' | 'BROKEN';
    dataSource: string;
}

/**
 * Convert sqrtPriceX96 to human readable prices
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): { token0Price: number; token1Price: number } {
    if (sqrtPriceX96 === 0n) return { token0Price: 0, token1Price: 0 };
    
    const Q96 = 2n ** 96n;
    
    try {
        const numerator = sqrtPriceX96 * sqrtPriceX96;
        const denominator = Q96 * Q96;
        const priceFloat = Number(numerator) / Number(denominator);
        
        const token0Price = priceFloat;
        const token1Price = priceFloat > 0 ? 1 / priceFloat : 0;
        
        return { token0Price, token1Price };
    } catch (error) {
        console.error('Error converting sqrtPriceX96:', error);
        return { token0Price: 0, token1Price: 0 };
    }
}

/**
 * Analyze if pool prices are reasonable
 */
function analyzePriceSanity(
    token0Price: number, 
    token1Price: number, 
    currency0: string, 
    currency1: string
): { status: 'REASONABLE' | 'SUSPICIOUS' | 'BROKEN'; expectedRange: string } {
    
    const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
    const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
    
    // Check for ETH/USD pairs
    if (currency0.toLowerCase() === ETH_ADDRESS.toLowerCase() && 
        (currency1.toLowerCase() === USDC_ADDRESS.toLowerCase() || 
         currency1.toLowerCase() === USDT_ADDRESS.toLowerCase())) {
        const expectedRange = '2000-4000';
        if (token0Price > 2000 && token0Price < 4000) {
            return { status: 'REASONABLE', expectedRange };
        } else if (token0Price > 100 && token0Price < 10000) {
            return { status: 'SUSPICIOUS', expectedRange };
        } else {
            return { status: 'BROKEN', expectedRange };
        }
    }
    
    // Check for USD/ETH pairs
    if ((currency0.toLowerCase() === USDC_ADDRESS.toLowerCase() || 
         currency0.toLowerCase() === USDT_ADDRESS.toLowerCase()) &&
        currency1.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
        const expectedRange = '0.00025-0.0005';
        if (token0Price > 0.00025 && token0Price < 0.0005) {
            return { status: 'REASONABLE', expectedRange };
        } else if (token0Price > 0.0001 && token0Price < 0.01) {
            return { status: 'SUSPICIOUS', expectedRange };
        } else {
            return { status: 'BROKEN', expectedRange };
        }
    }
    
    // Check for BTC pairs
    if (currency0.toLowerCase() === WBTC_ADDRESS.toLowerCase() || 
        currency1.toLowerCase() === WBTC_ADDRESS.toLowerCase()) {
        return { status: 'REASONABLE', expectedRange: 'BTC pairs' };
    }
    
    // Check for extreme values
    if (token0Price > 1e10 || token0Price < 1e-10 || token1Price > 1e10 || token1Price < 1e-10) {
        return { status: 'BROKEN', expectedRange: 'Non-extreme values' };
    }
    
    return { status: 'REASONABLE', expectedRange: 'Unknown pair' };
}

/**
 * Check pool prices - Use StateView contract to get actual pool state
 */
async function checkPoolPrices(markets: MarketCreationResult[], results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n📊 ANALYZING POOL PRICES'));
    console.log(chalk.yellow('-'.repeat(40)));
    
    // Early return if no markets exist
    if (markets.length === 0) {
        console.log(chalk.red('❌ No markets available to analyze pools'));
        results.errors.push('No markets created - cannot analyze pools');
        return;
    }
    
    console.log(chalk.blue('🔍 Using StateView contract to check actual pool state'));
    console.log('');
    
    const publicClient = createPublicClient({
        chain: anvil,
        transport: http()
    });
    
    // Get StateView contract instance
    const stateView = getStateView({
        address: CONTRACT_ADDRESSES.STATE_VIEW as Address,
        chain: anvil,
        transport: http()
    });

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        console.log(chalk.blue(`🔍 Market ${i + 1}: ${market.name}`));
        console.log(chalk.gray(`   Pool: ${market.poolKey.currency0}/${market.poolKey.currency1}`));
        console.log(chalk.gray(`   Price Confidence: ${(market as any).priceConfidence || 'Unknown'}`));
        console.log(chalk.gray(`   Category: ${(market as any).category || 'Unknown'}`));

        try {
            // Generate poolId from poolKey
            const poolId = keccak256(
                encodePacked(
                    ['address', 'address', 'uint24', 'int24', 'address'],
                    [
                        market.poolKey.currency0 as Address,
                        market.poolKey.currency1 as Address,
                        market.poolKey.fee,
                        market.poolKey.tickSpacing,
                        market.poolKey.hooks as Address
                    ]
                )
            );
            
            // Get pool state from StateView contract
            const poolState = await stateView.read.getSlot0([poolId]);
            const liquidity = await stateView.read.getLiquidity([poolId]);
            
            // Extract values from pool state
            const sqrtPriceX96 = poolState[0];
            const tick = poolState[1];
            const dataSource = 'StateView Contract (Live)';
            
            console.log(chalk.gray(`   Liquidity: ${liquidity}`));
            console.log(chalk.gray(`   Tick: ${tick}`));
            console.log(chalk.gray(`   SqrtPriceX96: ${sqrtPriceX96}`));
            
            // Convert to human readable prices
            const { token0Price, token1Price } = sqrtPriceX96ToPrice(sqrtPriceX96);
            
            // Analyze price sanity
            const { status, expectedRange } = analyzePriceSanity(
                token0Price, 
                token1Price, 
                market.poolKey.currency0, 
                market.poolKey.currency1
            );
            
            const statusColor = status === 'REASONABLE' ? chalk.green : 
                               status === 'SUSPICIOUS' ? chalk.yellow : chalk.red;
            
            console.log(chalk.blue(`📊 Analysis:`));
            console.log(chalk.gray(`   Data Source: ${dataSource}`));
            console.log(chalk.gray(`   sqrtPriceX96: ${sqrtPriceX96}`));
            console.log(chalk.gray(`   token0Price: ${token0Price.toExponential(4)}`));
            console.log(chalk.gray(`   token1Price: ${token1Price.toExponential(4)}`));
            console.log(statusColor(`   Status: ${status} (${expectedRange})`));
            console.log('');
            
            results.poolDetails.push({
                marketId: i + 1,
                poolKey: {
                    currency0: market.poolKey.currency0,
                    currency1: market.poolKey.currency1,
                    fee: market.poolKey.fee,
                    tickSpacing: market.poolKey.tickSpacing,
                    hooks: market.poolKey.hooks
                },
                sqrtPriceX96: sqrtPriceX96.toString(),
                tick,
                token0Price,
                token1Price,
                priceStatus: status,
                dataSource
            });
        } catch (error: any) {
            console.log(chalk.red(`❌ Error checking pool: ${error.message}`));
            results.errors.push(`Pool check failed for market ${i + 1}: ${error.message}`);
            
            // Fallback to market creation values if StateView fails
            console.log(chalk.yellow(`⚠️ Falling back to market creation values`));
            
            const sqrtPriceX96 = market.sqrtPriceX96;
            const tick = 0; 
            const dataSource = 'Market Creation (Fallback)';
            
            // Convert to human readable prices using market creation values
            const { token0Price, token1Price } = sqrtPriceX96ToPrice(sqrtPriceX96);
            
            // Add to results with fallback data
            results.poolDetails.push({
                marketId: i + 1,
                poolKey: {
                    currency0: market.poolKey.currency0,
                    currency1: market.poolKey.currency1,
                    fee: market.poolKey.fee,
                    tickSpacing: market.poolKey.tickSpacing,
                    hooks: market.poolKey.hooks
                },
                sqrtPriceX96: sqrtPriceX96.toString(),
                tick,
                token0Price,
                token1Price,
                priceStatus: 'SUSPICIOUS',
                dataSource
            });
        }
    }
}

/**
 * Check contract balances
 */
async function checkContractBalances(publicClient: any, results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n💰 CHECKING CONTRACT BALANCES'));
    console.log(chalk.yellow('-'.repeat(40)));

    try {
        const hookBalance = await publicClient.getBalance({ 
            address: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address 
        });
        results.hookBalance = Number(formatEther(hookBalance));
        console.log(chalk.green(`🪝 Hook Balance: ${results.hookBalance} ETH`));

        const pmBalance = await publicClient.getBalance({ 
            address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address 
        });
        results.predictionManagerBalance = Number(formatEther(pmBalance));
        console.log(chalk.green(`📊 PredictionManager Balance: ${results.predictionManagerBalance} ETH`));

    } catch (error: any) {
        results.errors.push(`Balance check failed: ${error.message}`);
        console.error(chalk.red(`❌ Balance check error: ${error.message}`));
    }
}

/**
 * Analyze all markets
 */
async function analyzeMarkets(predictionManager: any, markets: MarketCreationResult[], results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n📊 ANALYZING MARKETS'));
    console.log(chalk.yellow('-'.repeat(40)));

    results.totalMarkets = markets.length;
    
    // Early return with error if no markets exist
    if (markets.length === 0) {
        console.log(chalk.red('❌ No markets found - market creation is failing'));
        results.errors.push('No markets created - market creation process is failing');
        return;
    }

    for (const market of markets) {
        try {
            const marketDetails = await predictionManager.read.getMarketDetails([BigInt(market.id)]);
            const [
                marketId,
                name,
                assetSymbol,
                exists,
                resolved,
                winningOutcome,
                totalStakeBearish,
                totalStakeBullish,
                expirationTime,
                priceAggregator,
                priceThreshold
            ] = marketDetails;

            const totalStake = Number(formatEther(totalStakeBearish + totalStakeBullish));
            const expirationDate = new Date(Number(expirationTime) * 1000);
            const now = new Date();
            const timeUntilExpiration = getTimeUntilExpiration(expirationDate, now);
            
            let status = 'Unknown';
            if (resolved) {
                status = `Resolved (${winningOutcome === 0 ? 'Bearish' : 'Bullish'} won)`;
                results.resolvedMarkets++;
            } else if (expirationDate > now) {
                status = 'Active';
                results.activeMarkets++;
            } else {
                status = 'Expired (awaiting resolution)';
            }

            const diagnostic: MarketDiagnostic = {
                id: Number(marketId),
                name,
                asset: assetSymbol,
                isActive: !resolved && expirationDate > now,
                isResolved: resolved,
                totalStakeBearish: Number(formatEther(totalStakeBearish)),
                totalStakeBullish: Number(formatEther(totalStakeBullish)),
                totalStake,
                expirationTime: expirationDate,
                timeUntilExpiration,
                priceThreshold: Number(priceThreshold),
                status
            };

            results.marketDetails.push(diagnostic);
            results.totalStakeAmount += totalStake;

            console.log(chalk.cyan(`📈 Market ${marketId}: ${name}`));
            console.log(chalk.gray(`   Asset: ${assetSymbol} | Status: ${status}`));
            console.log(chalk.gray(`   Stakes: 🐻 ${diagnostic.totalStakeBearish} ETH | 🐂 ${diagnostic.totalStakeBullish} ETH`));

        } catch (error: any) {
            results.errors.push(`Market ${market.id} analysis failed: ${error.message}`);
            console.error(chalk.red(`❌ Market ${market.id} error: ${error.message}`));
        }
    }
}

/**
 * Check NFTs and predictions (simplified)
 */
async function checkNFTsAndPredictions(results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n🎨 CHECKING NFTs AND PREDICTIONS'));
    console.log(chalk.yellow('-'.repeat(40)));

    try {
        results.totalPredictions = results.totalStakeAmount > 0 ? 
            results.marketDetails.reduce((sum, m) => sum + (m.totalStake > 0 ? 1 : 0), 0) : 0;
        
        console.log(chalk.green(`🎯 Estimated Predictions: ${results.totalPredictions}`));

    } catch (error: any) {
        results.errors.push(`NFT analysis failed: ${error.message}`);
        console.error(chalk.red(`❌ NFT check error: ${error.message}`));
    }
}

/**
 * Validate system consistency
 */
async function validateSystemConsistency(results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n🔍 VALIDATING SYSTEM CONSISTENCY'));
    console.log(chalk.yellow('-'.repeat(40)));

    // Check if no markets were created - this is a critical issue
    if (results.totalMarkets === 0) {
        console.log(chalk.red(`❌ CRITICAL ISSUE: No markets have been created!`));
        results.errors.push('No markets have been created - market creation is failing');
        return;
    }

    const brokenPools = results.poolDetails.filter(p => p.priceStatus === 'BROKEN');
    const suspiciousPools = results.poolDetails.filter(p => p.priceStatus === 'SUSPICIOUS');
    
    if (brokenPools.length > 0) {
        console.log(chalk.red(`❌ ${brokenPools.length} pools have broken price calculations`));
        brokenPools.forEach(pool => {
            console.log(chalk.red(`   Market ${pool.marketId}: ${pool.priceStatus}`));
        });
    } else if (suspiciousPools.length > 0) {
        console.log(chalk.yellow(`⚠️ ${suspiciousPools.length} pools have suspicious prices`));
    } else if (results.poolDetails.length > 0) {
        console.log(chalk.green(`✅ All pool price calculations look reasonable`));
    } else {
        console.log(chalk.red(`❌ No pools found for the markets`));
        results.errors.push('Markets exist but no pools were found');
    }
}

/**
 * Print comprehensive diagnostic report
 */
function printDiagnosticReport(results: DiagnosticResults): void {
    console.log(chalk.blue('\n📋 COMPREHENSIVE DIAGNOSTIC REPORT'));
    console.log(chalk.blue('='.repeat(60)));

    console.log(chalk.green(`\n📊 SYSTEM OVERVIEW:`));
    console.log(chalk.white(`   Total Markets: ${results.totalMarkets}`));
    console.log(chalk.white(`   Active Markets: ${results.activeMarkets}`));
    console.log(chalk.white(`   Total Stake Volume: ${results.totalStakeAmount.toFixed(4)} ETH`));

    console.log(chalk.green(`\n🏊 POOL ANALYSIS:`));
    const reasonablePools = results.poolDetails.filter(p => p.priceStatus === 'REASONABLE').length;
    const suspiciousPools = results.poolDetails.filter(p => p.priceStatus === 'SUSPICIOUS').length;
    const brokenPools = results.poolDetails.filter(p => p.priceStatus === 'BROKEN').length;
    
    console.log(chalk.white(`   Reasonable Pools: ${reasonablePools}`));
    console.log(chalk.white(`   Suspicious Pools: ${suspiciousPools}`));
    console.log(chalk.white(`   Broken Pools: ${brokenPools}`));

    if (results.errors.length > 0) {
        console.log(chalk.red(`\n⚠️  CRITICAL ISSUES DETECTED:`));
        results.errors.forEach(error => {
            console.log(chalk.red(`   • ${error}`));
        });
        console.log(chalk.red(`\n❌ SYSTEM HEALTH CHECK FAILED - FIXES REQUIRED!`));
    } else if (results.totalMarkets === 0) {
        console.log(chalk.red(`\n❌ NO MARKETS CREATED - SYSTEM IS NOT OPERATIONAL!`));
    } else {
        console.log(chalk.green(`\n✅ NO ISSUES DETECTED - SYSTEM IS HEALTHY!`));
    }
}

/**
 * Helper function to calculate time until expiration
 */
function getTimeUntilExpiration(expirationDate: Date, now: Date): string {
    const diffMs = expirationDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
        return 'Expired';
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m`;
    } else {
        return `${diffMinutes}m`;
    }
}

/**
 * Main diagnostic function
 */
export async function runFixtureDiagnostics(markets: MarketCreationResult[]): Promise<DiagnosticResults> {
    console.log(chalk.blue('\n🔍 RUNNING COMPREHENSIVE FIXTURE DIAGNOSTICS'));
    console.log(chalk.blue('='.repeat(60)));

    const client = createPublicClient({
        chain: anvil,
        transport: http()
    });

    const predictionManager = getPredictionManager({
        address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as `0x${string}`,
        chain: anvil,
        transport: http()
    });

    const results: DiagnosticResults = {
        totalMarkets: markets.length,
        activeMarkets: 0,
        resolvedMarkets: 0,
        totalPredictions: 0,
        totalStakeAmount: 0,
        hookBalance: 0,
        predictionManagerBalance: 0,
        marketDetails: [],
        poolDetails: [],
        errors: []
    };

    try {
        // 1. Check contract balances
        await checkContractBalances(client, results);

        // 2. Analyze all markets
        await analyzeMarkets(predictionManager, markets, results);

        // 3. Check pool prices using trusted market creation values
        await checkPoolPrices(markets, results);

        // 4. Check NFTs and predictions
        await checkNFTsAndPredictions(results);

        // 5. Validate system consistency
        await validateSystemConsistency(results);

        // 6. Print comprehensive report
        printDiagnosticReport(results);

    } catch (error: any) {
        results.errors.push(`Diagnostic failed: ${error.message}`);
        console.error(chalk.red(`❌ Diagnostic error: ${error.message}`));
    }

    return results;
}

/**
 * Quick health check function
 */
export async function quickHealthCheck(markets: MarketCreationResult[]): Promise<boolean> {
    try {
        const results = await runFixtureDiagnostics(markets);
        
        const hasStakes = results.totalStakeAmount > 0;
        const hasActiveMarkets = results.activeMarkets > 0;
        const noBrokenPools = results.poolDetails.filter(p => p.priceStatus === 'BROKEN').length === 0;
        
        const isHealthy = hasStakes && hasActiveMarkets && noBrokenPools;
        
        if (isHealthy) {
            console.log(chalk.green('✅ SYSTEM HEALTH: EXCELLENT'));
        } else {
            console.log(chalk.yellow('⚠️  SYSTEM HEALTH: ISSUES DETECTED'));
            if (!noBrokenPools) {
                console.log(chalk.red('❌ Broken pool price calculations detected'));
            }
        }
        
        return isHealthy;
    } catch (error) {
        console.error(chalk.red(`❌ Health check failed: ${error}`));
        return false;
    }
}
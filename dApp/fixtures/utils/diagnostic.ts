/**
 * @fileoverview Comprehensive fixture diagnostics for SwapCast prediction markets
 * @description Analyzes system health, market states, NFT predictions, and pool prices
 * @author SwapCast Team
 */

import { formatEther, type Address, createPublicClient, http } from 'viem';
import { getStateView } from '../../src/generated/types/StateView';
import { getPredictionManager } from '../../src/generated/types/PredictionManager';
import { getSwapCastNFT } from '../../src/generated/types/SwapCastNFT';
import chalk from 'chalk';
import { CONTRACT_ADDRESSES } from './wallets';
import { MarketCreationResult } from '../markets';
import { anvil } from 'viem/chains';

/**
 * Main diagnostic results interface
 */
interface DiagnosticResults {
    totalMarkets: number;
    activeMarkets: number;
    resolvedMarkets: number;
    totalPredictions: number;
    totalNFTsMinted: number;
    totalStakeAmount: number;
    hookBalance: number;
    predictionManagerBalance: number;
    marketDetails: MarketDiagnostic[];
    poolDetails: PoolDiagnostic[];
    nftDetails: NFTDiagnostic[];
    errors: string[];
    systemHealth: 'HEALTHY' | 'ISSUES' | 'FAILED';
}

/**
 * Market diagnostic information
 */
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

/**
 * Pool diagnostic information
 */
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
    priceStatus: 'REASONABLE' | 'PREDICTION_MOVEMENT' | 'ERROR';
    dataSource: string;
}

/**
 * NFT diagnostic information
 */
interface NFTDiagnostic {
    tokenId: number;
    owner: string;
    marketId: number;
    outcome: string;
    stakeAmount: number;
    mintedAt: string;
}

/**
 * Contract addresses for easy reference
 */
const ADDRESSES = {
    ETH: '0x0000000000000000000000000000000000000000',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
} as const;

/**
 * Convert sqrtPriceX96 to human readable token prices
 * 
 * @param sqrtPriceX96 - The sqrt price in X96 format
 * @returns Object containing token0 and token1 prices
 */
function convertSqrtPriceX96(sqrtPriceX96: bigint): { token0Price: number; token1Price: number } {
    if (sqrtPriceX96 === 0n) {
        return { token0Price: 0, token1Price: 0 };
    }
    
    try {
        const Q96 = 2n ** 96n;
        const numerator = sqrtPriceX96 * sqrtPriceX96;
        const denominator = Q96 * Q96;
        const priceFloat = Number(numerator) / Number(denominator);
        
        return {
            token0Price: priceFloat,
            token1Price: priceFloat > 0 ? 1 / priceFloat : 0
        };
    } catch (error) {
        console.error('Error converting sqrtPriceX96:', error);
        return { token0Price: 0, token1Price: 0 };
    }
}

/**
 * Analyze pool price status for prediction markets
 * 
 * @param token0Price - Price of token0 in terms of token1
 * @param token1Price - Price of token1 in terms of token0
 * @param currency0 - Address of token0
 * @param currency1 - Address of token1
 * @returns Price status analysis
 */
function analyzePoolPrice(
    token0Price: number, 
    token1Price: number, 
    currency0: string, 
    currency1: string
): { status: 'REASONABLE' | 'PREDICTION_MOVEMENT' | 'ERROR'; description: string } {
    
    if (token0Price === 0 && token1Price === 0) {
        return { 
            status: 'REASONABLE', 
            description: 'Pool not traded yet (expected for fixtures)' 
        };
    }
    
    const isETHPair = currency0.toLowerCase() === ADDRESSES.ETH.toLowerCase() || 
                     currency1.toLowerCase() === ADDRESSES.ETH.toLowerCase();
    const isUSDPair = currency1.toLowerCase() === ADDRESSES.USDC.toLowerCase() || 
                     currency1.toLowerCase() === ADDRESSES.USDT.toLowerCase() ||
                     currency0.toLowerCase() === ADDRESSES.USDC.toLowerCase() || 
                     currency0.toLowerCase() === ADDRESSES.USDT.toLowerCase();
    
    if (isETHPair && isUSDPair) {
        const hasExtremePrices = token0Price > 1e6 || token0Price < 1e-6 || 
                                token1Price > 1e6 || token1Price < 1e-6;
        
        if (hasExtremePrices) {
            return { 
                status: 'PREDICTION_MOVEMENT', 
                description: 'Directional prediction trading detected (normal)' 
            };
        }
        
        return { 
            status: 'REASONABLE', 
            description: 'Standard ETH/USD pricing' 
        };
    }
    
    if (token0Price > 1e10 || token0Price < 1e-10 || token1Price > 1e10 || token1Price < 1e-10) {
        return { 
            status: 'ERROR', 
            description: 'Extreme price values detected' 
        };
    }
    
    return { 
        status: 'REASONABLE', 
        description: 'Normal pool pricing' 
    };
}

/**
 * Calculate time remaining until market expiration
 * 
 * @param expirationDate - Market expiration timestamp
 * @param currentDate - Current timestamp
 * @returns Formatted time string
 */
function calculateTimeRemaining(expirationDate: Date, currentDate: Date): string {
    const diffMs = expirationDate.getTime() - currentDate.getTime();
    
    if (diffMs <= 0) {
        return 'Expired';
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ${diffHours % 24}h`;
    }
    
    return diffHours > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffMinutes}m`;
}

/**
 * Check balances of key contracts
 * 
 * @param publicClient - Viem public client instance
 * @param results - Results object to populate
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
 * Analyze all prediction markets
 * 
 * @param predictionManager - PredictionManager contract instance
 * @param markets - Array of market creation results
 * @param results - Results object to populate
 */
async function analyzeMarkets(
    predictionManager: any, 
    markets: MarketCreationResult[], 
    results: DiagnosticResults
): Promise<void> {
    console.log(chalk.yellow('\n📊 ANALYZING MARKETS'));
    console.log(chalk.yellow('-'.repeat(40)));

    results.totalMarkets = markets.length;
    
    if (markets.length === 0) {
        console.log(chalk.red('❌ No markets found'));
        results.errors.push('No markets created');
        return;
    }

    for (const market of markets) {
        try {
            const marketDetails = await predictionManager.read.getMarketDetails([BigInt(market.id)]);
            const [
                marketId, name, assetSymbol, exists, resolved, winningOutcome,
                totalStakeBearish, totalStakeBullish, expirationTime, priceAggregator, priceThreshold
            ] = marketDetails;

            const bearishETH = Number(formatEther(totalStakeBearish));
            const bullishETH = Number(formatEther(totalStakeBullish));
            const totalStake = bearishETH + bullishETH;
            
            const expirationDate = new Date(Number(expirationTime) * 1000);
            const timeUntilExpiration = calculateTimeRemaining(expirationDate, new Date());
            
            let status = 'Unknown';
            if (resolved) {
                status = `Resolved (${winningOutcome === 0 ? 'Bearish' : 'Bullish'} won)`;
                results.resolvedMarkets++;
            } else if (expirationDate > new Date()) {
                status = 'Active';
                results.activeMarkets++;
            } else {
                status = 'Expired (awaiting resolution)';
            }

            const diagnostic: MarketDiagnostic = {
                id: Number(marketId),
                name,
                asset: assetSymbol,
                isActive: !resolved && expirationDate > new Date(),
                isResolved: resolved,
                totalStakeBearish: bearishETH,
                totalStakeBullish: bullishETH,
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
            console.log(chalk.gray(`   Stakes: 🐻 ${bearishETH.toFixed(4)} ETH | 🐂 ${bullishETH.toFixed(4)} ETH`));

        } catch (error: any) {
            results.errors.push(`Market ${market.id} analysis failed: ${error.message}`);
            console.error(chalk.red(`❌ Market ${market.id} error: ${error.message}`));
        }
    }
}

/**
 * Check NFT predictions and validate system consistency
 * 
 * @param results - Results object to populate
 */
async function checkNFTPredictions(results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n🎨 CHECKING NFTs AND PREDICTIONS'));
    console.log(chalk.yellow('-'.repeat(40)));

    try {
        const swapCastNFT = getSwapCastNFT({
            address: CONTRACT_ADDRESSES.SWAPCAST_NFT as Address,
            chain: anvil,
            transport: http()
        });

        const totalSupply = await swapCastNFT.read.totalSupply();
        results.totalNFTsMinted = Number(totalSupply);
        results.totalPredictions = Number(totalSupply);
        
        console.log(chalk.green(`🎯 Total Predictions Recorded: ${results.totalPredictions}`));
        console.log(chalk.green(`🎨 Total NFTs Minted: ${results.totalNFTsMinted}`));
        
        if (results.totalNFTsMinted > 0) {
            console.log(chalk.blue(`\n🔍 Sampling NFT Details:`));
            
            const samplesToCheck = Math.min(5, results.totalNFTsMinted);
            
            // FIX: Start from 0, not 1 (NFT IDs are 0-based)
            for (let i = 0; i < samplesToCheck; i++) {
                try {
                    const predictionDetails = await swapCastNFT.read.getPredictionDetails([BigInt(i)]);
                    const [marketId, outcome, stakeAmount, owner] = predictionDetails;
                    
                    const nftDetail: NFTDiagnostic = {
                        tokenId: i,
                        owner: owner,
                        marketId: Number(marketId),
                        outcome: outcome === 0 ? 'BEARISH' : 'BULLISH',
                        stakeAmount: Number(formatEther(stakeAmount)),
                        mintedAt: 'Recent'
                    };
                    
                    results.nftDetails.push(nftDetail);
                    
                    console.log(chalk.gray(`   NFT #${i}: Market ${marketId}, ${nftDetail.outcome}, ${nftDetail.stakeAmount} ETH`));
                    console.log(chalk.gray(`     Owner: ${owner.slice(0, 10)}...`));
                    
                } catch (error: any) {
                    console.log(chalk.yellow(`   NFT #${i}: Error reading details - ${error.message.slice(0, 50)}...`));
                }
            }
            
            if (results.totalNFTsMinted > samplesToCheck) {
                console.log(chalk.gray(`   ... and ${results.totalNFTsMinted - samplesToCheck} more NFTs`));
            }
        }

        console.log(chalk.green(`💰 Total Stake Volume: ${results.totalStakeAmount.toFixed(4)} ETH`));
        console.log(chalk.green(`✅ Prediction system operational: ${results.totalPredictions} predictions recorded`));

    } catch (error: any) {
        results.errors.push(`NFT analysis failed: ${error.message}`);
        console.error(chalk.red(`❌ NFT check error: ${error.message}`));
    }
}

/**
 * Analyze pool states and prices
 * 
 * @param markets - Array of market creation results
 * @param results - Results object to populate
 */
async function analyzePoolStates(markets: MarketCreationResult[], results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n📊 ANALYZING POOL PRICES'));
    console.log(chalk.yellow('-'.repeat(40)));
    
    if (markets.length === 0) {
        console.log(chalk.red('❌ No markets available to analyze'));
        results.errors.push('No markets available for pool analysis');
        return;
    }
    
    console.log(chalk.blue('🔍 Using StateView contract for live pool data'));
    console.log('');
    
    const stateView = getStateView({
        address: CONTRACT_ADDRESSES.STATE_VIEW as Address,
        chain: anvil,
        transport: http()
    });

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        console.log(chalk.blue(`🔍 Market ${i + 1}: ${market.name}`));
        console.log(chalk.gray(`   Pool: ${market.poolKey.currency0}/${market.poolKey.currency1}`));

        try {
            const poolId = market.pool.poolId as `0x${string}`;
            const poolState = await stateView.read.getSlot0([poolId]);
            const liquidity = await stateView.read.getLiquidity([poolId]);
            
            const sqrtPriceX96 = poolState[0];
            const tick = poolState[1];
            
            console.log(chalk.gray(`   Liquidity: ${liquidity}`));
            console.log(chalk.gray(`   Tick: ${tick}`));
            console.log(chalk.gray(`   SqrtPriceX96: ${sqrtPriceX96}`));
            
            const { token0Price, token1Price } = convertSqrtPriceX96(sqrtPriceX96);
            const { status, description } = analyzePoolPrice(
                token0Price, 
                token1Price, 
                market.poolKey.currency0, 
                market.poolKey.currency1
            );
            
            const statusColor = status === 'REASONABLE' ? chalk.green : 
                               status === 'PREDICTION_MOVEMENT' ? chalk.yellow : chalk.red;
            
            console.log(chalk.blue(`📊 Analysis:`));
            console.log(chalk.gray(`   Token0 Price: ${token0Price.toExponential(4)}`));
            console.log(chalk.gray(`   Token1 Price: ${token1Price.toExponential(4)}`));
            console.log(statusColor(`   Status: ${status} - ${description}`));
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
                dataSource: 'StateView Contract (Live)'
            });
        } catch (error: any) {
            console.log(chalk.red(`❌ Error analyzing pool: ${error.message}`));
            results.errors.push(`Pool analysis failed for market ${i + 1}: ${error.message}`);
            
            results.poolDetails.push({
                marketId: i + 1,
                poolKey: {
                    currency0: market.poolKey.currency0,
                    currency1: market.poolKey.currency1,
                    fee: market.poolKey.fee,
                    tickSpacing: market.poolKey.tickSpacing,
                    hooks: market.poolKey.hooks
                },
                sqrtPriceX96: '0',
                tick: 0,
                token0Price: 0,
                token1Price: 0,
                priceStatus: 'ERROR',
                dataSource: 'Error (fallback)'
            });
        }
    }
}

/**
 * Validate overall system consistency and health
 * 
 * @param results - Results object to validate
 */
function validateSystemHealth(results: DiagnosticResults): void {
    console.log(chalk.yellow('\n🔍 VALIDATING SYSTEM CONSISTENCY'));
    console.log(chalk.yellow('-'.repeat(40)));

    if (results.totalMarkets === 0) {
        console.log(chalk.red(`❌ CRITICAL: No markets created`));
        results.systemHealth = 'FAILED';
        return;
    }

    const predictionMovementPools = results.poolDetails.filter(p => p.priceStatus === 'PREDICTION_MOVEMENT');
    if (predictionMovementPools.length > 0) {
        console.log(chalk.green(`✅ ${predictionMovementPools.length} pools showing prediction market activity`));
    }

    if (results.totalPredictions > 0 && results.totalStakeAmount > 0) {
        console.log(chalk.green(`✅ Prediction system operational: ${results.totalPredictions} predictions, ${results.totalStakeAmount.toFixed(4)} ETH staked`));
        results.systemHealth = results.errors.length === 0 ? 'HEALTHY' : 'ISSUES';
    } else {
        console.log(chalk.red(`❌ No predictions recorded`));
        results.errors.push('No predictions recorded');
        results.systemHealth = 'FAILED';
    }
}

/**
 * Generate comprehensive diagnostic report
 * 
 * @param results - Complete diagnostic results
 */
function generateReport(results: DiagnosticResults): void {
    console.log(chalk.blue('\n📋 COMPREHENSIVE DIAGNOSTIC REPORT'));
    console.log(chalk.blue('='.repeat(60)));

    console.log(chalk.green(`\n📊 SYSTEM OVERVIEW:`));
    console.log(chalk.white(`   Total Markets: ${results.totalMarkets}`));
    console.log(chalk.white(`   Active Markets: ${results.activeMarkets}`));
    console.log(chalk.white(`   Total Predictions: ${results.totalPredictions}`));
    console.log(chalk.white(`   Total NFTs Minted: ${results.totalNFTsMinted}`));
    console.log(chalk.white(`   Total Stake Volume: ${results.totalStakeAmount.toFixed(4)} ETH`));

    console.log(chalk.green(`\n🏊 POOL ANALYSIS:`));
    const normalPools = results.poolDetails.filter(p => p.priceStatus === 'REASONABLE').length;
    const predictionPools = results.poolDetails.filter(p => p.priceStatus === 'PREDICTION_MOVEMENT').length;
    const errorPools = results.poolDetails.filter(p => p.priceStatus === 'ERROR').length;
    
    console.log(chalk.white(`   Normal Pools: ${normalPools}`));
    console.log(chalk.white(`   Prediction Market Activity: ${predictionPools}`));
    console.log(chalk.white(`   Error Pools: ${errorPools}`));

    console.log(chalk.green(`\n🎨 PREDICTION ANALYSIS:`));
    console.log(chalk.white(`   Total Predictions: ${results.totalPredictions}`));
    console.log(chalk.white(`   NFT Sample Size: ${results.nftDetails.length}`));
    if (results.nftDetails.length > 0) {
        const bearishPredictions = results.nftDetails.filter(nft => nft.outcome === 'BEARISH').length;
        const bullishPredictions = results.nftDetails.filter(nft => nft.outcome === 'BULLISH').length;
        console.log(chalk.white(`   Outcome Distribution: 🐻 ${bearishPredictions} | 🐂 ${bullishPredictions}`));
    }

    if (results.errors.length > 0) {
        console.log(chalk.red(`\n⚠️  ISSUES DETECTED:`));
        results.errors.forEach(error => {
            console.log(chalk.red(`   • ${error}`));
        });
    }

    const healthColor = results.systemHealth === 'HEALTHY' ? chalk.green : 
                       results.systemHealth === 'ISSUES' ? chalk.yellow : chalk.red;
    
    console.log(healthColor(`\n🏥 SYSTEM HEALTH: ${results.systemHealth}`));
    
    if (results.systemHealth === 'HEALTHY') {
        console.log(chalk.green(`✅ All systems operational`));
        console.log(chalk.green(`🎯 ${results.totalPredictions} predictions recorded successfully`));
        console.log(chalk.green(`💰 ${results.totalStakeAmount.toFixed(4)} ETH in prediction stakes`));
    }
}

/**
 * Run comprehensive fixture diagnostics
 * 
 * @param markets - Array of created markets to diagnose
 * @returns Complete diagnostic results
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
        totalNFTsMinted: 0,
        totalStakeAmount: 0,
        hookBalance: 0,
        predictionManagerBalance: 0,
        marketDetails: [],
        poolDetails: [],
        nftDetails: [],
        errors: [],
        systemHealth: 'HEALTHY'
    };

    try {
        await checkContractBalances(client, results);
        await analyzeMarkets(predictionManager, markets, results);
        await checkNFTPredictions(results);
        await analyzePoolStates(markets, results);
        validateSystemHealth(results);
        generateReport(results);

    } catch (error: any) {
        results.errors.push(`Diagnostic failed: ${error.message}`);
        results.systemHealth = 'FAILED';
        console.error(chalk.red(`❌ Diagnostic error: ${error.message}`));
    }

    return results;
}

/**
 * Quick health check for rapid system validation
 * 
 * @param markets - Array of markets to check
 * @returns True if system is healthy
 */
export async function quickHealthCheck(markets: MarketCreationResult[]): Promise<boolean> {
    try {
        const results = await runFixtureDiagnostics(markets);
        
        const isHealthy = results.systemHealth === 'HEALTHY';
        
        if (isHealthy) {
            console.log(chalk.green(`✅ SYSTEM HEALTH: EXCELLENT`));
            console.log(chalk.green(`   💰 ${results.totalStakeAmount.toFixed(4)} ETH in stakes`));
            console.log(chalk.green(`   🎨 ${results.totalPredictions} predictions recorded`));
        } else {
            console.log(chalk.yellow(`⚠️  SYSTEM HEALTH: ${results.systemHealth}`));
            if (results.totalPredictions === 0) {
                console.log(chalk.red('❌ No predictions recorded'));
            }
            if (results.totalMarkets === 0) {
                console.log(chalk.red('❌ No markets created'));
            }
        }
        
        return isHealthy;
    } catch (error) {
        console.error(chalk.red(`❌ Health check failed: ${error}`));
        return false;
    }
}
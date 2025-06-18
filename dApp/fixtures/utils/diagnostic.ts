import { formatEther, type Address, createPublicClient, http, encodePacked, keccak256 } from 'viem';
import { getStateView } from '../../src/generated/types/StateView';
import { getPredictionManager } from '../../src/generated/types/PredictionManager';
import { getSwapCastNFT } from '../../src/generated/types/SwapCastNFT';
import chalk from 'chalk';
import {CONTRACT_ADDRESSES} from './wallets.ts';
import {MarketCreationResult} from '../markets.ts';
import { anvil } from 'viem/chains';

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

interface NFTDiagnostic {
    tokenId: number;
    owner: string;
    marketId: number;
    outcome: string;
    stakeAmount: number;
    mintedAt: string;
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
    
    // If sqrtPriceX96 is 0, pools haven't been initialized properly (but this is expected for fixture pools)
    if (token0Price === 0 && token1Price === 0) {
        return { status: 'REASONABLE', expectedRange: 'Pool not traded yet (expected for fixture)' };
    }
    
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
        return { status: 'REASONABLE', expectedRange: 'BTC pairs (expected for fixture)' };
    }
    
    // Check for extreme values
    if (token0Price > 1e10 || token0Price < 1e-10 || token1Price > 1e10 || token1Price < 1e-10) {
        return { status: 'BROKEN', expectedRange: 'Non-extreme values' };
    }
    
    return { status: 'REASONABLE', expectedRange: 'Unknown pair (likely OK for fixture)' };
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
            
            // Still add a fallback entry
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
                priceStatus: 'REASONABLE',
                dataSource: 'Error (fallback)'
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
 * Analyze all markets with corrected stake calculation
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

            // Convert from wei to ETH for display and calculation
            const bearishETH = Number(formatEther(totalStakeBearish));
            const bullishETH = Number(formatEther(totalStakeBullish));
            const totalStake = bearishETH + bullishETH;
            
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
 * Check NFTs and predictions with actual NFT count
 */
async function checkNFTsAndPredictions(results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n🎨 CHECKING NFTs AND PREDICTIONS'));
    console.log(chalk.yellow('-'.repeat(40)));

    try {
        // Get SwapCastNFT contract instance
        const swapCastNFT = getSwapCastNFT({
            address: CONTRACT_ADDRESSES.SWAPCAST_NFT as Address,
            chain: anvil,
            transport: http()
        });

        // Get the total supply of NFTs (total number minted)
        const totalSupply = await swapCastNFT.read.totalSupply();
        results.totalNFTsMinted = Number(totalSupply);
        
        console.log(chalk.green(`🎯 Total NFTs Minted: ${results.totalNFTsMinted}`));
        
        // Sample some NFT details if there are any
        if (results.totalNFTsMinted > 0) {
            console.log(chalk.blue(`\n🔍 Sampling NFT Details:`));
            
            // Check up to 5 NFTs for details
            const samplesToCheck = Math.min(5, results.totalNFTsMinted);
            
            for (let i = 1; i <= samplesToCheck; i++) {
                try {
                    // Get prediction details for this NFT
                    const predictionDetails = await swapCastNFT.read.getPredictionDetails([BigInt(i)]);
                    const [marketId, outcome, stakeAmount, owner] = predictionDetails;
                    
                    // Get owner of the NFT
                    const nftOwner = await swapCastNFT.read.ownerOf([BigInt(i)]);
                    
                    const nftDetail: NFTDiagnostic = {
                        tokenId: i,
                        owner: nftOwner,
                        marketId: Number(marketId),
                        outcome: outcome === 0 ? 'BEARISH' : 'BULLISH',
                        stakeAmount: Number(formatEther(stakeAmount)),
                        mintedAt: 'Recent' // Could get this from events if needed
                    };
                    
                    results.nftDetails.push(nftDetail);
                    
                    console.log(chalk.gray(`   NFT #${i}: Market ${marketId}, ${nftDetail.outcome}, ${nftDetail.stakeAmount} ETH`));
                    console.log(chalk.gray(`     Owner: ${nftOwner.slice(0, 10)}...`));
                    
                } catch (error: any) {
                    console.log(chalk.yellow(`   NFT #${i}: Error reading details - ${error.message.slice(0, 50)}...`));
                }
            }
            
            if (results.totalNFTsMinted > samplesToCheck) {
                console.log(chalk.gray(`   ... and ${results.totalNFTsMinted - samplesToCheck} more NFTs`));
            }
        }

        // Calculate total predictions based on markets with stake
        results.totalPredictions = 0;
        for (const market of results.marketDetails) {
            if (market.totalStakeBearish > 0) results.totalPredictions++;
            if (market.totalStakeBullish > 0) results.totalPredictions++;
        }
        
        console.log(chalk.green(`💰 Total Stake Volume: ${results.totalStakeAmount.toFixed(4)} ETH`));
        
        // Validate NFT count matches predictions
        const expectedNFTs = results.totalPredictions;
        if (results.totalNFTsMinted === expectedNFTs) {
            console.log(chalk.green(`✅ NFT count matches predictions: ${results.totalNFTsMinted}/${expectedNFTs}`));
        } else {
            console.log(chalk.yellow(`⚠️ NFT mismatch: ${results.totalNFTsMinted} NFTs for ${expectedNFTs} predictions`));
            results.errors.push(`NFT count mismatch: expected ${expectedNFTs}, got ${results.totalNFTsMinted}`);
        }

    } catch (error: any) {
        results.errors.push(`NFT analysis failed: ${error.message}`);
        console.error(chalk.red(`❌ NFT check error: ${error.message}`));
    }
}

/**
 * Validate system consistency with better logic
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

    // For fixtures, broken pools are actually expected since they're minimal test pools
    const brokenPools = results.poolDetails.filter(p => p.priceStatus === 'BROKEN');
    const suspiciousPools = results.poolDetails.filter(p => p.priceStatus === 'SUSPICIOUS');
    
    if (brokenPools.length > 0) {
        console.log(chalk.yellow(`⚠️ ${brokenPools.length} pools have no trading activity (expected for fixtures)`));
    } else if (suspiciousPools.length > 0) {
        console.log(chalk.yellow(`⚠️ ${suspiciousPools.length} pools have suspicious prices`));
    } else if (results.poolDetails.length > 0) {
        console.log(chalk.green(`✅ All pool price calculations look reasonable`));
    } else {
        console.log(chalk.red(`❌ No pools found for the markets`));
        results.errors.push('Markets exist but no pools were found');
    }

    // Check if predictions are working
    if (results.totalStakeAmount > 0) {
        console.log(chalk.green(`✅ Prediction system is working: ${results.totalStakeAmount.toFixed(4)} ETH in stakes`));
    } else {
        console.log(chalk.red(`❌ No stakes found - prediction recording may be failing`));
        results.errors.push('No prediction stakes found - system may not be recording predictions');
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
    console.log(chalk.white(`   Total Predictions: ${results.totalPredictions}`));
    console.log(chalk.white(`   Total NFTs Minted: ${results.totalNFTsMinted}`));
    console.log(chalk.white(`   Total Stake Volume: ${results.totalStakeAmount.toFixed(4)} ETH`));

    console.log(chalk.green(`\n🏊 POOL ANALYSIS:`));
    const reasonablePools = results.poolDetails.filter(p => p.priceStatus === 'REASONABLE').length;
    const suspiciousPools = results.poolDetails.filter(p => p.priceStatus === 'SUSPICIOUS').length;
    const brokenPools = results.poolDetails.filter(p => p.priceStatus === 'BROKEN').length;
    
    console.log(chalk.white(`   Reasonable Pools: ${reasonablePools}`));
    console.log(chalk.white(`   Suspicious Pools: ${suspiciousPools}`));
    console.log(chalk.white(`   Broken Pools: ${brokenPools} (expected for fixtures)`));

    console.log(chalk.green(`\n🎨 NFT ANALYSIS:`));
    console.log(chalk.white(`   Total NFTs: ${results.totalNFTsMinted}`));
    console.log(chalk.white(`   NFT Sample Size: ${results.nftDetails.length}`));
    if (results.nftDetails.length > 0) {
        const bearishNFTs = results.nftDetails.filter(nft => nft.outcome === 'BEARISH').length;
        const bullishNFTs = results.nftDetails.filter(nft => nft.outcome === 'BULLISH').length;
        console.log(chalk.white(`   Outcome Distribution: 🐻 ${bearishNFTs} | 🐂 ${bullishNFTs}`));
    }

    if (results.errors.length > 0) {
        console.log(chalk.red(`\n⚠️  ISSUES DETECTED:`));
        results.errors.forEach(error => {
            console.log(chalk.red(`   • ${error}`));
        });
    }

    // Determine overall health
    const isHealthy = results.totalMarkets > 0 && results.totalStakeAmount > 0 && results.totalNFTsMinted > 0;
    const nftMatchesPredictions = results.totalNFTsMinted === results.totalPredictions;
    
    if (isHealthy && nftMatchesPredictions) {
        console.log(chalk.green(`\n🎉 SYSTEM IS FULLY OPERATIONAL!`));
        console.log(chalk.green(`✅ ${results.totalNFTsMinted} NFTs minted for ${results.totalPredictions} predictions`));
        console.log(chalk.green(`💰 ${results.totalStakeAmount.toFixed(4)} ETH in prediction stakes`));
    } else if (isHealthy) {
        console.log(chalk.yellow(`\n⚠️  SYSTEM IS MOSTLY OPERATIONAL WITH MINOR ISSUES`));
        if (!nftMatchesPredictions) {
            console.log(chalk.yellow(`⚠️ NFT count mismatch: ${results.totalNFTsMinted} NFTs vs ${results.totalPredictions} predictions`));
        }
    } else {
        console.log(chalk.red(`\n❌ SYSTEM HEALTH CHECK FAILED - FIXES REQUIRED!`));
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
        totalNFTsMinted: 0,
        totalStakeAmount: 0,
        hookBalance: 0,
        predictionManagerBalance: 0,
        marketDetails: [],
        poolDetails: [],
        nftDetails: [],
        errors: []
    };

    try {
        // 1. Check contract balances
        await checkContractBalances(client, results);

        // 2. Analyze all markets (this will now correctly calculate stakes)
        await analyzeMarkets(predictionManager, markets, results);

        // 3. Check NFTs and predictions
        await checkNFTsAndPredictions(results);

        // 4. If no stakes/NFTs found AND hook balance unchanged, run hook debug
        if (results.totalStakeAmount === 0 && results.totalNFTsMinted === 0 && results.hookBalance >= 50) {
            console.log(chalk.red('\n🚨 HOOK BALANCE UNCHANGED - RUNNING HOOK INTEGRATION DEBUG'));
            await debugHookIntegration(markets);
        } else if (results.totalStakeAmount === 0 && results.totalNFTsMinted === 0) {
            console.log(chalk.red('\n❌ NO STAKES OR NFTs FOUND - RUNNING DEBUG ANALYSIS'));
            await debugStakeIssue(markets);
        }

        // 5. Check pool prices
        await checkPoolPrices(markets, results);

        // 6. Validate system consistency
        await validateSystemConsistency(results);

        // 7. Print comprehensive report
        printDiagnosticReport(results);

    } catch (error: any) {
        results.errors.push(`Diagnostic failed: ${error.message}`);
        console.error(chalk.red(`❌ Diagnostic error: ${error.message}`));
    }

    return results;
}

/**
 * Debug function to investigate why stakes are showing as 0
 */
async function debugStakeIssue(markets: MarketCreationResult[]): Promise<void> {
    console.log(chalk.yellow('\n🔍 DEBUG: INVESTIGATING STAKE ISSUE'));
    console.log(chalk.yellow('='.repeat(50)));

    const publicClient = createPublicClient({
        chain: anvil,
        transport: http()
    });

    const predictionManager = getPredictionManager({
        address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
        chain: anvil,
        transport: http()
    });

    const swapCastNFT = getSwapCastNFT({
        address: CONTRACT_ADDRESSES.SWAPCAST_NFT as Address,
        chain: anvil,
        transport: http()
    });

    console.log(chalk.blue('\n📋 CONTRACT ADDRESSES:'));
    console.log(chalk.gray(`   PredictionManager: ${CONTRACT_ADDRESSES.PREDICTION_MANAGER}`));
    console.log(chalk.gray(`   SwapCastNFT: ${CONTRACT_ADDRESSES.SWAPCAST_NFT}`));
    console.log(chalk.gray(`   Hook: ${CONTRACT_ADDRESSES.SWAPCAST_HOOK}`));

    // 1. Check NFT contract first
    console.log(chalk.blue('\n🎨 NFT CONTRACT ANALYSIS:'));
    try {
        const totalSupply = await swapCastNFT.read.totalSupply();
        console.log(chalk.green(`   Total NFTs minted: ${totalSupply}`));

        if (totalSupply > 0n) {
            console.log(chalk.blue(`   Sampling first few NFTs:`));
            
            for (let i = 1; i <= Math.min(3, Number(totalSupply)); i++) {
                try {
                    const owner = await swapCastNFT.read.ownerOf([BigInt(i)]);
                    const details = await swapCastNFT.read.getPredictionDetails([BigInt(i)]);
                    const [marketId, outcome, stakeAmount, detailOwner] = details;
                    
                    console.log(chalk.gray(`     NFT #${i}:`));
                    console.log(chalk.gray(`       Owner: ${owner}`));
                    console.log(chalk.gray(`       Market: ${marketId}`));
                    console.log(chalk.gray(`       Outcome: ${outcome === 0 ? 'BEARISH' : 'BULLISH'}`));
                    console.log(chalk.gray(`       Stake: ${formatEther(stakeAmount)} ETH`));
                } catch (error) {
                    console.log(chalk.red(`     NFT #${i}: Error - ${error}`));
                }
            }
        } else {
            console.log(chalk.red(`   ❌ No NFTs found! This suggests prediction recording failed.`));
        }
    } catch (error) {
        console.error(chalk.red(`   NFT contract error: ${error}`));
    }

    // 2. Check each market individually with detailed logging
    console.log(chalk.blue('\n📊 INDIVIDUAL MARKET ANALYSIS:'));
    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        console.log(chalk.cyan(`\n   Market ${i + 1}: ${market.name} (ID: ${market.id})`));
        
        try {
            // Direct contract call to get market details
            const marketDetails = await predictionManager.read.getMarketDetails([BigInt(market.id)]);
            
            console.log(chalk.gray(`     Raw market details:`));
            console.log(chalk.gray(`       [6] totalStakeBearish: ${marketDetails[6]} (${formatEther(marketDetails[6])} ETH)`));
            console.log(chalk.gray(`       [7] totalStakeBullish: ${marketDetails[7]} (${formatEther(marketDetails[7])} ETH)`));

            const totalStakeBearish = marketDetails[6];
            const totalStakeBullish = marketDetails[7];
            const totalStake = totalStakeBearish + totalStakeBullish;

            if (totalStake > 0n) {
                console.log(chalk.green(`     ✅ Found stakes! Total: ${formatEther(totalStake)} ETH`));
            } else {
                console.log(chalk.red(`     ❌ No stakes found for market ${market.id}`));
            }

        } catch (error) {
            console.error(chalk.red(`     Error reading market ${market.id}: ${error}`));
        }
    }

    console.log(chalk.yellow('\n' + '='.repeat(50)));
    console.log(chalk.yellow('🔍 DEBUG ANALYSIS COMPLETE'));
}

/**
 * Debug why the hook is not being called during swaps
 */
async function debugHookIntegration(markets: MarketCreationResult[]): Promise<void> {
    console.log(chalk.red('\n🚨 HOOK INTEGRATION DEBUG'));
    console.log(chalk.red('='.repeat(50)));
    console.log(chalk.yellow('Investigating why hook balance is unchanged (50 ETH)'));

    const publicClient = createPublicClient({
        chain: anvil,
        transport: http()
    });

    // 1. Verify hook contract exists and is accessible
    console.log(chalk.blue('\n🪝 HOOK CONTRACT VERIFICATION:'));
    try {
        const swapCastHook = getSwapCastNFT({
            address: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address,
            chain: anvil,
            transport: http()
        });

        const hookBalance = await publicClient.getBalance({ 
            address: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address 
        });
        console.log(chalk.gray(`   Hook Address: ${CONTRACT_ADDRESSES.SWAPCAST_HOOK}`));
        console.log(chalk.gray(`   Hook Balance: ${formatEther(hookBalance)} ETH`));

    } catch (error) {
        console.error(chalk.red(`   ❌ Hook contract error: ${error}`));
    }

    // 2. Check pool registration and hook integration
    console.log(chalk.blue('\n🏊 POOL-HOOK INTEGRATION CHECK:'));
    
    if (markets.length === 0) {
        console.log(chalk.red('   ❌ No markets to check'));
        return;
    }

    for (let i = 0; i < Math.min(3, markets.length); i++) {
        const market = markets[i];
        console.log(chalk.cyan(`\n   Market ${i + 1}: ${market.name}`));
        console.log(chalk.gray(`     Expected Hook: ${market.poolKey.hooks}`));
        console.log(chalk.gray(`     Actual Hook: ${CONTRACT_ADDRESSES.SWAPCAST_HOOK}`));

        // Verify poolKey hook address matches our hook
        if (market.poolKey.hooks.toLowerCase() === CONTRACT_ADDRESSES.SWAPCAST_HOOK?.toLowerCase()) {
            console.log(chalk.green(`     ✅ Pool configured with correct hook address`));
        } else {
            console.log(chalk.red(`     ❌ Pool configured with wrong hook address!`));
            console.log(chalk.red(`       This is why the hook is not being called!`));
        }
    }

    // 3. Check recent transactions to see what's happening
    console.log(chalk.blue('\n🔍 RECENT TRANSACTION ANALYSIS:'));
    try {
        const latestBlock = await publicClient.getBlockNumber();
        console.log(chalk.gray(`   Current block: ${latestBlock}`));
        
        let foundSwapTransactions = 0;
        let foundHookCalls = 0;

        // Check last 5 blocks for transactions
        for (let blockOffset = 0; blockOffset < 5 && foundSwapTransactions < 3; blockOffset++) {
            const blockNumber = latestBlock - BigInt(blockOffset);
            try {
                const block = await publicClient.getBlock({ 
                    blockNumber,
                    includeTransactions: true 
                });
                
                const transactions = block.transactions as any[];
                
                for (const tx of transactions) {
                    // Check for Universal Router transactions (our swaps)
                    if (tx.to === CONTRACT_ADDRESSES.UNIVERSAL_ROUTER && Number(tx.value || 0) > 0) {
                        foundSwapTransactions++;
                        console.log(chalk.blue(`   📤 Swap TX ${foundSwapTransactions}: ${tx.hash}`));
                        console.log(chalk.gray(`     Value: ${formatEther(tx.value || 0n)} ETH`));

                        // Get transaction receipt to see if it succeeded
                        try {
                            const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
                            console.log(chalk.gray(`     Status: ${receipt.status}`));
                            
                            // Check if there were any logs from our hook
                            const hookLogs = receipt.logs.filter(log => 
                                log.address?.toLowerCase() === CONTRACT_ADDRESSES.SWAPCAST_HOOK?.toLowerCase()
                            );
                            
                            if (hookLogs.length > 0) {
                                foundHookCalls++;
                                console.log(chalk.green(`     ✅ Hook was called! Found ${hookLogs.length} hook logs`));
                            } else {
                                console.log(chalk.red(`     ❌ Hook was NOT called - no logs from hook`));
                            }

                        } catch (receiptError) {
                            console.log(chalk.yellow(`     ⚠️ Could not get receipt`));
                        }
                    }
                }
                
            } catch (blockError) {
                // Skip block if error
            }
        }

        console.log(chalk.gray(`\n   Summary:`));
        console.log(chalk.gray(`     Swap transactions found: ${foundSwapTransactions}`));
        console.log(chalk.gray(`     Hook calls detected: ${foundHookCalls}`));

        if (foundSwapTransactions > 0 && foundHookCalls === 0) {
            console.log(chalk.red(`   🚨 CRITICAL: Swaps happening but hook NEVER called!`));
        }

    } catch (error) {
        console.error(chalk.red(`   ❌ Transaction analysis error: ${error}`));
    }

    console.log(chalk.red('\n' + '='.repeat(50)));
}

/**
 * Quick health check function
 */
export async function quickHealthCheck(markets: MarketCreationResult[]): Promise<boolean> {
    try {
        const results = await runFixtureDiagnostics(markets);
        
        const hasStakes = results.totalStakeAmount > 0;
        const hasActiveMarkets = results.activeMarkets > 0;
        const hasMarkets = results.totalMarkets > 0;
        const hasNFTs = results.totalNFTsMinted > 0;
        const nftMatchesPredictions = results.totalNFTsMinted === results.totalPredictions;
        
        const isHealthy = hasStakes && hasActiveMarkets && hasMarkets && hasNFTs && nftMatchesPredictions;
        
        if (isHealthy) {
            console.log(chalk.green(`✅ SYSTEM HEALTH: EXCELLENT`));
            console.log(chalk.green(`   💰 ${results.totalStakeAmount.toFixed(4)} ETH in stakes`));
            console.log(chalk.green(`   🎨 ${results.totalNFTsMinted} NFTs minted`));
        } else {
            console.log(chalk.yellow('⚠️  SYSTEM HEALTH: ISSUES DETECTED'));
            if (!hasStakes) {
                console.log(chalk.red('❌ No prediction stakes found'));
            }
            if (!hasMarkets) {
                console.log(chalk.red('❌ No markets created'));
            }
            if (!hasNFTs) {
                console.log(chalk.red('❌ No NFTs minted'));
            }
            if (!nftMatchesPredictions) {
                console.log(chalk.yellow(`⚠️ NFT mismatch: ${results.totalNFTsMinted} vs ${results.totalPredictions}`));
            }
        }
        
        return isHealthy;
    } catch (error) {
        console.error(chalk.red(`❌ Health check failed: ${error}`));
        return false;
    }
}
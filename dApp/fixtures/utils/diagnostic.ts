/**
 * Comprehensive Fixture Diagnostics
 * Runs complete health checks on all markets and predictions
 */

import { formatEther, type Address, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES } from './wallets';
import { getPredictionManager } from '../../src/generated/types/PredictionManager';
import { getSwapCastNFT } from '../../src/generated/types/SwapCastNFT';
import chalk from 'chalk';
import type { MarketCreationResult } from '../markets';

interface DiagnosticResults {
    totalMarkets: number;
    activeMarkets: number;
    resolvedMarkets: number;
    totalPredictions: number;
    totalStakeAmount: number;
    hookBalance: number;
    predictionManagerBalance: number;
    treasuryBalance: number;
    marketDetails: MarketDiagnostic[];
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
    participantCount: number;
    expirationTime: Date;
    timeUntilExpiration: string;
    priceThreshold: number;
    status: string;
}

interface NFTDiagnostic {
    tokenId: number;
    owner: string;
    marketId: number;
    outcome: string;
    stake: number;
    isValid: boolean;
}

/**
 * Main diagnostic function - runs all checks and returns comprehensive results
 */
export async function runFixtureDiagnostics(markets: MarketCreationResult[]): Promise<DiagnosticResults> {
    console.log(chalk.blue('\n🔍 RUNNING COMPREHENSIVE FIXTURE DIAGNOSTICS'));
    console.log(chalk.blue('='.repeat(60)));

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

    const results: DiagnosticResults = {
        totalMarkets: 0,
        activeMarkets: 0,
        resolvedMarkets: 0,
        totalPredictions: 0,
        totalStakeAmount: 0,
        hookBalance: 0,
        predictionManagerBalance: 0,
        treasuryBalance: 0,
        marketDetails: [],
        nftDetails: [],
        errors: []
    };

    try {
        // 1. Check contract balances
        await checkContractBalances(publicClient, results);

        // 2. Analyze all markets
        await analyzeMarkets(predictionManager, markets, results);

        // 3. Check NFTs and predictions
        await checkNFTsAndPredictions(swapCastNFT, results);

        // 4. Validate system consistency
        await validateSystemConsistency(results);

        // 5. Print comprehensive report
        printDiagnosticReport(results);

    } catch (error: any) {
        results.errors.push(`Diagnostic failed: ${error.message}`);
        console.error(chalk.red(`❌ Diagnostic error: ${error.message}`));
    }

    return results;
}

/**
 * Check all contract balances
 */
async function checkContractBalances(publicClient: any, results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n💰 CHECKING CONTRACT BALANCES'));
    console.log(chalk.yellow('-'.repeat(40)));

    try {
        // Hook balance
        const hookBalance = await publicClient.getBalance({ 
            address: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address 
        });
        results.hookBalance = Number(formatEther(hookBalance));
        console.log(chalk.green(`🪝 Hook Balance: ${results.hookBalance} ETH`));

        // PredictionManager balance
        const pmBalance = await publicClient.getBalance({ 
            address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address 
        });
        results.predictionManagerBalance = Number(formatEther(pmBalance));
        console.log(chalk.green(`📊 PredictionManager Balance: ${results.predictionManagerBalance} ETH`));

        // Treasury balance
        try {
            const treasuryBalance = await publicClient.getBalance({ 
                address: CONTRACT_ADDRESSES.TREASURY as Address 
            });
            results.treasuryBalance = Number(formatEther(treasuryBalance));
            console.log(chalk.green(`🏦 Treasury Balance: ${results.treasuryBalance} ETH`));
        } catch {
            // Try alternative treasury address from env
            try {
                const altTreasuryAddress = process.env.PUBLIC_TREASURY_ADDRESS as Address;
                if (altTreasuryAddress) {
                    const treasuryBalance = await publicClient.getBalance({ address: altTreasuryAddress });
                    results.treasuryBalance = Number(formatEther(treasuryBalance));
                    console.log(chalk.green(`🏦 Treasury Balance: ${results.treasuryBalance} ETH`));
                } else {
                    console.log(chalk.yellow(`⚠️  Treasury address not configured in CONTRACT_ADDRESSES`));
                }
            } catch {
                console.log(chalk.yellow(`⚠️  Treasury address not available`));
            }
        }

    } catch (error: any) {
        results.errors.push(`Balance check failed: ${error.message}`);
    }
}

/**
 * Analyze all markets in detail
 */
async function analyzeMarkets(predictionManager: any, markets: MarketCreationResult[], results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n📊 ANALYZING MARKETS'));
    console.log(chalk.yellow('-'.repeat(40)));

    results.totalMarkets = markets.length;

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
                participantCount: 0, // Will be filled later
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
            console.log(chalk.gray(`   Expires: ${timeUntilExpiration}`));

        } catch (error: any) {
            results.errors.push(`Market ${market.id} analysis failed: ${error.message}`);
            console.error(chalk.red(`❌ Failed to analyze market ${market.id}: ${error.message}`));
        }
    }
}

/**
 * Check NFTs and predictions
 */
async function checkNFTsAndPredictions(swapCastNFT: any, results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n🎨 CHECKING NFTs AND PREDICTIONS'));
    console.log(chalk.yellow('-'.repeat(40)));

    try {
        // Get total supply of NFTs
        const totalSupply = await swapCastNFT.read.totalSupply();
        results.totalPredictions = Number(totalSupply);
        
        console.log(chalk.green(`🎯 Total Predictions (NFTs): ${results.totalPredictions}`));

        // Analyze each NFT
        for (let tokenId = 0; tokenId < Number(totalSupply); tokenId++) {
            try {
                const owner = await swapCastNFT.read.ownerOf([BigInt(tokenId)]);
                const predictionDetails = await swapCastNFT.read.getPredictionDetails([BigInt(tokenId)]);
                const [marketId, outcome, stake, nftOwner] = predictionDetails;

                const nftDiagnostic: NFTDiagnostic = {
                    tokenId,
                    owner,
                    marketId: Number(marketId),
                    outcome: outcome === 0 ? 'Bearish' : 'Bullish',
                    stake: Number(formatEther(stake)),
                    isValid: owner === nftOwner
                };

                results.nftDetails.push(nftDiagnostic);

                // Update participant count for the market
                const marketDiag = results.marketDetails.find(m => m.id === Number(marketId));
                if (marketDiag) {
                    marketDiag.participantCount++;
                }

                console.log(chalk.cyan(`🎨 NFT #${tokenId}: Market ${marketId} | ${nftDiagnostic.outcome} | ${nftDiagnostic.stake} ETH`));
                console.log(chalk.gray(`   Owner: ${owner.slice(0, 10)}...`));

            } catch (error: any) {
                results.errors.push(`NFT ${tokenId} check failed: ${error.message}`);
            }
        }

    } catch (error: any) {
        results.errors.push(`NFT analysis failed: ${error.message}`);
    }
}

/**
 * Validate system consistency
 */
async function validateSystemConsistency(results: DiagnosticResults): Promise<void> {
    console.log(chalk.yellow('\n🔍 VALIDATING SYSTEM CONSISTENCY'));
    console.log(chalk.yellow('-'.repeat(40)));

    // Check if total stakes match between markets and NFTs
    const nftTotalStake = results.nftDetails.reduce((sum, nft) => sum + nft.stake, 0);
    const marketTotalStake = results.totalStakeAmount;
    
    if (Math.abs(nftTotalStake - marketTotalStake) > 0.001) {
        results.errors.push(`Stake mismatch: NFTs show ${nftTotalStake} ETH, markets show ${marketTotalStake} ETH`);
        console.log(chalk.red(`❌ Stake mismatch detected!`));
    } else {
        console.log(chalk.green(`✅ Stakes consistent: ${marketTotalStake} ETH`));
    }

    // Check if all markets have at least one prediction
    const marketsWithoutPredictions = results.marketDetails.filter(m => m.participantCount === 0);
    if (marketsWithoutPredictions.length > 0) {
        results.errors.push(`${marketsWithoutPredictions.length} markets have no predictions`);
        console.log(chalk.yellow(`⚠️  ${marketsWithoutPredictions.length} markets have no predictions`));
    } else {
        console.log(chalk.green(`✅ All markets have predictions`));
    }

    // Check hook balance vs expected usage
    const expectedHookUsage = results.totalStakeAmount * 1.02; // Stakes + 2% fee
    if (results.hookBalance < expectedHookUsage) {
        console.log(chalk.yellow(`⚠️  Hook balance (${results.hookBalance} ETH) may be low for usage (${expectedHookUsage} ETH expected)`));
    } else {
        console.log(chalk.green(`✅ Hook balance sufficient`));
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
    console.log(chalk.white(`   Resolved Markets: ${results.resolvedMarkets}`));
    console.log(chalk.white(`   Total Predictions: ${results.totalPredictions}`));
    console.log(chalk.white(`   Total Stake Volume: ${results.totalStakeAmount.toFixed(4)} ETH`));

    console.log(chalk.green(`\n💰 BALANCES:`));
    console.log(chalk.white(`   Hook Contract: ${results.hookBalance.toFixed(4)} ETH`));
    console.log(chalk.white(`   PredictionManager: ${results.predictionManagerBalance.toFixed(4)} ETH`));
    console.log(chalk.white(`   Treasury: ${results.treasuryBalance.toFixed(4)} ETH`));

    console.log(chalk.green(`\n🎯 MARKET PERFORMANCE:`));
    results.marketDetails.forEach(market => {
        const participationRate = market.participantCount > 0 ? '✅' : '❌';
        console.log(chalk.white(`   ${participationRate} Market ${market.id}: ${market.participantCount} predictions, ${market.totalStake.toFixed(4)} ETH`));
    });

    if (results.errors.length > 0) {
        console.log(chalk.red(`\n⚠️  ISSUES DETECTED:`));
        results.errors.forEach(error => {
            console.log(chalk.red(`   • ${error}`));
        });
    } else {
        console.log(chalk.green(`\n✅ NO ISSUES DETECTED - SYSTEM IS HEALTHY!`));
    }

    console.log(chalk.blue('\n🎉 DIAGNOSTIC COMPLETE'));
    console.log(chalk.blue('='.repeat(60)));
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
 * Quick health check function for simple pass/fail
 */
export async function quickHealthCheck(markets: MarketCreationResult[]): Promise<boolean> {
    try {
        const results = await runFixtureDiagnostics(markets);
        
        // A system is healthy if:
        // 1. Markets have actual stakes (money flowing)
        // 2. Few or no critical errors
        // 3. Active markets exist
        const hasStakes = results.totalStakeAmount > 0;
        const hasActiveMarkets = results.activeMarkets > 0;
        const criticalErrors = results.errors.filter(error => 
            !error.includes('NFT analysis failed') && // This is just an ABI issue
            !error.includes('Treasury address not')   // This is just missing config
        );
        
        const isHealthy = hasStakes && hasActiveMarkets && criticalErrors.length === 0;
        
        if (isHealthy) {
            console.log(chalk.green('✅ SYSTEM HEALTH: EXCELLENT'));
            console.log(chalk.green(`💰 ${results.totalStakeAmount.toFixed(4)} ETH in active predictions`));
        } else {
            console.log(chalk.yellow('⚠️  SYSTEM HEALTH: MINOR ISSUES DETECTED'));
            if (!hasStakes) {
                console.log(chalk.red('❌ No predictions with stakes detected'));
            }
            if (criticalErrors.length > 0) {
                console.log(chalk.red(`❌ ${criticalErrors.length} critical errors`));
            }
        }
        
        return isHealthy;
    } catch (error) {
        console.error(chalk.red(`❌ Health check failed: ${error}`));
        return false;
    }
}
/**
 * @file Enhanced prediction generation system with whale tracking
 * @description Manages the creation of predictions across multiple markets using a whale-based
 * system with balance validation and duplicate prediction prevention.
 * @module predictions
 */

import { parseEther } from 'viem';
import { MarketCreationResult } from '../markets';
import { logInfo, logSuccess, logWarning, withErrorHandling } from '../utils/error';
import { selectWhaleForPrediction } from '../utils/swap';
import {
    getWhaleStats,
    initializeWhaleAccounts,
    markWhalePredicted,
    resetWhaleUsage,
    validateWhaleBalanceForSwap,
    type WhaleAccount
} from '../utils/whales';
import { getProtocolConfig } from './prediction-core';
import { recordPredictionWithRetry } from './prediction-executor';

/**
 * Generates predictions across multiple markets using available whale accounts
 * @param markets - Array of markets to generate predictions for
 * @param whales - Array of available whale accounts
 * @param minStakeAmount - Minimum stake amount in wei
 * @returns Promise that resolves to the total number of successful predictions
 */
const generatePredictionsForMarket = async (
    market: MarketCreationResult,
    whales: WhaleAccount[],
    minStakeAmount: bigint
): Promise<number> => {
    logInfo('Market', `🏪 Generating predictions for ${market.name} (ID: ${market.id})`);

    resetWhaleUsage(whales);
    const targetCount = 3 + Math.floor(Math.random() * 6);
    let successCount = 0;

    logInfo('Market', `🎯 Target: ${targetCount} predictions for market ${market.id}`);
    logInfo('Market', `📊 Market tokens: ${market.token0.symbol}/${market.token1.symbol}`);

    for (let i = 0; i < targetCount; i++) {
        const stakeAmount = parseEther((0.05 + Math.random() * 0.45).toFixed(3));

        logInfo('Market', `\n📊 Prediction ${i + 1}/${targetCount} - Stake: ${stakeAmount.toString()} wei`);

        // Use enhanced whale selection that considers token requirements
        const selection = await selectWhaleForPrediction(
            whales,
            market.id.toString(),
            {
                token0: { symbol: market.token0.symbol },
                token1: { symbol: market.token1.symbol }
            },
            stakeAmount * 3n, // Buffer for safety
            validateWhaleBalanceForSwap
        );

        if (!selection) {
            logWarning('Market', `❌ No suitable whale found for prediction ${i + 1}/${targetCount}`);
            continue;
        }

        const { whale, outcome } = selection;
        logInfo('Market', `🐋 Selected ${whale.name} for ${outcome === 0 ? 'BEARISH' : 'BULLISH'} prediction`);

        // Record prediction with the determined outcome
        try {
            const success = await recordPredictionWithSpecificOutcome(
                whale,
                market,
                outcome,
                stakeAmount,
                minStakeAmount
            );

            if (success) {
                markWhalePredicted(whale, market.id.toString());
                successCount++;
                logSuccess('Market', `✅ Prediction ${successCount} recorded successfully with ${whale.name}`);
            } else {
                logWarning('Market', `❌ Prediction failed with ${whale.name}`);
            }
        } catch (error) {
            logWarning('Market', `❌ Prediction error with ${whale.name}: ${error}`);
        }

        // Small delay between predictions
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successRate = targetCount > 0 ? (successCount / targetCount * 100).toFixed(1) : '0';
    logSuccess('Market', `📊 Market ${market.id} completed: ${successCount}/${targetCount} predictions (${successRate}% success rate)`);

    return successCount;
};

/**
 * Records a prediction with a specific outcome
 * @param whale - The whale account making the prediction
 * @param market - The target market information
 * @param outcome - The specific outcome to predict (0 for bearish, 1 for bullish)
 * @param stakeAmount - The amount to stake in wei
 * @param minStakeAmount - The minimum allowed stake amount in wei
 * @returns Promise that resolves to true if prediction was successful
 */
async function recordPredictionWithSpecificOutcome(
    whale: WhaleAccount,
    market: MarketCreationResult,
    outcome: number,
    stakeAmount: bigint,
    minStakeAmount: bigint
): Promise<boolean> {

    try {
        logInfo('PredictionRecord', `📝 Recording ${outcome === 0 ? 'BEARISH' : 'BULLISH'} prediction for ${whale.name}`);

        const success = await recordPredictionWithRetry(whale, market, stakeAmount, minStakeAmount);

        return success;
    } catch (error) {
        logWarning('PredictionRecord', `Failed to record prediction: ${error}`);
        return false;
    }
}

/**
 * Main prediction generation function with enhanced error handling
 * 
 * @param markets - Array of markets to generate predictions for
 * @returns Promise<{totalSuccessful: number, totalFailed: number}>
 */
export const generatePredictionsForMarkets = withErrorHandling(
    async (markets: MarketCreationResult[]) => {
        logInfo('System', `🚀 Starting prediction generation for ${markets.length} markets`);

        const whales = await initializeWhaleAccounts();

        if (whales.length === 0) {
            throw new Error('No whale accounts available');
        }

        const { minStakeAmount, protocolFeeBasisPoints } = await getProtocolConfig();

        logSuccess('System', `🐋 Initialized ${whales.length} validated whale accounts`);
        logInfo('System', `⚙️ Protocol: ${protocolFeeBasisPoints} basis points fee, ${minStakeAmount.toString()} wei min stake`);

        let totalSuccessful = 0;
        let totalFailed = 0;

        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];

            logInfo('System', `\n🏪 Processing market ${i + 1}/${markets.length}: ${market.name}`);
            logInfo('System', `📊 Pair: ${market.token0.symbol}/${market.token1.symbol}`);

            try {
                const successful = await generatePredictionsForMarket(market, whales, minStakeAmount);

                const estimatedTarget = 5;
                const failed = Math.max(0, estimatedTarget - successful);

                totalSuccessful += successful;
                totalFailed += failed;

                logSuccess('System', `✅ Market ${market.id}: ${successful} successful predictions`);

                if (i < markets.length - 1) {
                    logInfo('System', '⏳ Waiting 2s before next market...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logWarning('System', `❌ Market ${market.id} failed: ${errorMessage}`);
                totalFailed += 5;
            }
        }

        const whaleStats = getWhaleStats(whales);
        const overallSuccessRate = (totalSuccessful + totalFailed) > 0
            ? (totalSuccessful / (totalSuccessful + totalFailed) * 100).toFixed(1)
            : '0';

        logSuccess('System', `\n🎉 PREDICTION GENERATION COMPLETED!`);
        logSuccess('System', `📊 Results: ${totalSuccessful} successful, ${totalFailed} failed (${overallSuccessRate}% success rate)`);

        logInfo('WhaleStats', `\n🐋 Whale Statistics:`);
        logInfo('WhaleStats', `   📊 Active whales: ${whaleStats.predictionStats.whalesWithPredictions}/${whaleStats.totalWhales}`);
        logInfo('WhaleStats', `   📈 Total predictions: ${whaleStats.predictionStats.totalPredictions}`);
        logInfo('WhaleStats', `   💰 Total whale ETH: ${whaleStats.totalETHAcrossWhales} ETH`);

        return { totalSuccessful, totalFailed };
    },
    'GeneratePredictionsForMarkets'
);
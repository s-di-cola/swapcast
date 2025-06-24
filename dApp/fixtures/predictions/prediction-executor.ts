import { MarketCreationResult } from '../markets';
import { logSuccess, logWarning, withRetry } from '../utils/error';
import { ensureWhaleHasTokens, getMarketTokens, validateWhaleBalanceForSwap, WhaleAccount } from '../utils/whales';
import { calculateFee, validateMarket } from './prediction-core';
import {
    OUTCOME_BEARISH,
    OUTCOME_BULLISH,
    recordPredictionViaSwapWithRealisticAmount
} from './prediction-swap';

/**
 * Records a single prediction for a whale account
 * @param whale - The whale account making the prediction
 * @param market - The market to predict on
 * @param stakeAmount - The amount to stake in the prediction
 * @param minStakeAmount - The minimum allowed stake amount
 * @returns Promise that resolves to true if prediction was successful, false otherwise
 */
const recordSinglePrediction = async (
    whale: WhaleAccount,
    market: MarketCreationResult,
    stakeAmount: bigint,
    minStakeAmount: bigint
): Promise<boolean> => {
    try {
        if (!(await validateMarket(market))) return false;

        const finalStake = stakeAmount < minStakeAmount ? minStakeAmount * 2n : stakeAmount;
        const { total } = calculateFee(finalStake);

        // Validate ETH balance for transaction fees
        const ethCheck = await validateWhaleBalanceForSwap(whale, 'ETH', total);
        if (!ethCheck.valid) {
            logWarning('Prediction', `${whale.name} insufficient ETH`);
            return false;
        }

        // Ensure required tokens are available
        const requiredTokens = getMarketTokens({
            base: market.token0.symbol,
            quote: market.token1.symbol
        });

        if (!(await ensureWhaleHasTokens(whale, requiredTokens, finalStake))) {
            return false;
        }

        // Determine possible prediction outcomes based on token balances
        const token0Check = await validateWhaleBalanceForSwap(whale, market.token0.symbol, finalStake);
        const token1Check = await validateWhaleBalanceForSwap(whale, market.token1.symbol, finalStake);

        const validOutcomes: number[] = [];
        if (token0Check.valid) validOutcomes.push(OUTCOME_BEARISH);  // Can sell token0
        if (token1Check.valid) validOutcomes.push(OUTCOME_BULLISH); // Can buy token0 with token1

        if (validOutcomes.length === 0) {
            logWarning('Prediction', `${whale.name} can't execute any prediction`);
            return false;
        }

        // Pick randomly from valid outcomes
        const outcome = validOutcomes[Math.floor(Math.random() * validOutcomes.length)];
        await recordPredictionViaSwapWithRealisticAmount(
            whale.address,
            market.pool,
            BigInt(market.id),
            outcome,
            finalStake
        );
        logSuccess('Prediction', `✅ ${whale.name} predicted ${outcome} on market ${market.id}`);
        return true;
    } catch (error) {
        logWarning('Prediction', `Failed: ${error}`);
        return false;
    }
};

/**
 * Records a prediction with retry logic
 * @param whale - The whale account making the prediction
 * @param market - The market to predict on
 * @param stakeAmount - The amount to stake in the prediction
 * @param minStakeAmount - The minimum allowed stake amount
 * @returns Promise that resolves to true if prediction was successful after retries
 */
export const recordPredictionWithRetry = async (
    whale: WhaleAccount,
    market: MarketCreationResult,
    stakeAmount: bigint,
    minStakeAmount: bigint
) => withRetry(
    () => recordSinglePrediction(whale, market, stakeAmount, minStakeAmount),
    { maxAttempts: 2, context: 'PredictionRetry' }
);

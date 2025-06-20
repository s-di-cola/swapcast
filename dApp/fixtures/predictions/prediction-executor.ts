import { MarketCreationResult } from '../markets';
import { logSuccess, logWarning, withRetry } from '../utils/error';
import { OUTCOME_BEARISH, OUTCOME_BULLISH, recordPredictionViaSwap } from './prediction-swap';
import { ensureWhaleHasTokens, getMarketTokens, validateWhaleBalanceForSwap, WhaleAccount } from '../utils/whales';
import { calculateFee, validateMarket } from './prediction-core';

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

        // Check ETH balance
        const ethCheck = await validateWhaleBalanceForSwap(whale, 'ETH', total);
        if (!ethCheck.valid) {
            logWarning('Prediction', `${whale.name} insufficient ETH`);
            return false;
        }

        // Ensure tokens
        const requiredTokens = getMarketTokens({
            base: market.token0.symbol,
            quote: market.token1.symbol
        });

        if (!(await ensureWhaleHasTokens(whale, requiredTokens, finalStake))) {
            return false;
        }

        // Execute prediction

        // Check which outcomes are possible
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
        await recordPredictionViaSwap(
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

export const recordPredictionWithRetry = (
    whale: WhaleAccount,
    market: MarketCreationResult,
    stakeAmount: bigint,
    minStakeAmount: bigint
) => withRetry(
    () => recordSinglePrediction(whale, market, stakeAmount, minStakeAmount),
    { maxAttempts: 2, context: 'PredictionRetry' }
);

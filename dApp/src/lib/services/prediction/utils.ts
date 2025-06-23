import {formatEther} from 'viem';
import type {ClaimableReward, UserPrediction} from './types';
import type {SubgraphPrediction} from '$lib/services/subgraph/types';

/**
 * Maps a numeric outcome to a human-readable format
 * @param {number | string} outcome - The numeric outcome from the contract (0, 1, or other)
 * @returns {'above' | 'below' | 'pending'} The human-readable outcome
 * @example
 * mapOutcome(0) // returns 'below'
 * mapOutcome(1) // returns 'above'
 * mapOutcome(2) // returns 'pending'
 */
export function mapOutcome(outcome: number | string): 'above' | 'below' | 'pending' {
  const outcomeNum = typeof outcome === 'string' ? parseInt(outcome, 10) : outcome;

  switch (outcomeNum) {
    case 0: return 'below';
    case 1: return 'above';
    default: return 'pending';
  }
}

/**
 * Transforms raw prediction data from the subgraph to our app's UserPrediction format
 * @param {SubgraphPrediction} prediction - Raw prediction data from the subgraph
 * @param {Object} [marketData={}] - Additional market data (optional)
 * @param {string} [marketData.winningOutcome] - The winning outcome for the market
 * @param {string} [marketData.description] - Description of the market
 * @returns {UserPrediction} Formatted prediction object with all required fields
 * @throws {Error} If the prediction data is invalid
 */
export function transformPrediction(
    prediction: SubgraphPrediction,
    marketData: any = {}
): UserPrediction {
  const isWinning = marketData.winningOutcome !== undefined &&
      prediction.outcome === marketData.winningOutcome;

  // Fixed tokenId extraction with proper handling
  let tokenId: string | undefined;

  if ('tokenId' in prediction && prediction.tokenId !== undefined && prediction.tokenId !== null) {
    tokenId = String(prediction.tokenId);
    console.log('✅ Found direct tokenId:', tokenId);
  } else {
    console.warn('❌ No tokenId found in prediction:', {
      id: prediction.id,
      availableFields: Object.keys(prediction)
    });
    tokenId = undefined;
  }

  const marketId = prediction.market?.id || '';
  const amount = 'amount' in prediction ? String(prediction.amount) : '0';
  const timestamp = 'timestamp' in prediction ? Number(prediction.timestamp) : 0;
  const claimed = 'claimed' in prediction ? Boolean(prediction.claimed) : false;
  const reward = 'reward' in prediction && prediction.reward ? String(prediction.reward) : null;

  // Handle marketWinningOutcome properly - it should never be 'pending'
  let marketWinningOutcome: 'above' | 'below' | undefined;
  if (marketData.winningOutcome !== undefined && marketData.winningOutcome !== null) {
    const mappedOutcome = mapOutcome(marketData.winningOutcome);
    marketWinningOutcome = (mappedOutcome === 'above' || mappedOutcome === 'below') ? mappedOutcome : undefined;
  } else {
    marketWinningOutcome = undefined;
  }

  return {
    id: prediction.id,
    marketId,
    marketDescription: prediction.market?.description || marketData.description || 'Unknown Market',
    outcome: mapOutcome(prediction.outcome),
    amount: formatEther(BigInt(amount)),
    stakedAmount: formatEther(BigInt(amount)), // Using amount for stakedAmount as per original logic
    timestamp,
    claimed,
    reward: reward ? formatEther(BigInt(reward)) : null,
    isWinning,
    marketIsResolved: marketData.isResolved || false,
    marketWinningOutcome,
    tokenId
  };
}

/**
 * Calculates the total claimable rewards from an array of predictions
 * @param {UserPrediction[]} predictions - Array of user predictions
 * @returns {string} Total claimable rewards as a formatted ETH string
 * @example
 * const total = calculateClaimableRewards(userPredictions);
 * console.log(total); // '1.2345'
 * @description This function calculates the total claimable rewards from an array of user predictions.
 */
export function calculateClaimableRewards(predictions: UserPrediction[]): string {
  return predictions
      .filter(p => p.isWinning && !p.claimed && p.reward)
      .reduce((sum, p) => sum + parseFloat(p.reward || '0'), 0)
      .toFixed(6);
}


/**
 * Formats a Unix timestamp to a human-readable date string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date string in locale format
 * @example
 * formatDate(1625097600); // Returns: '6/30/2021, 1:00:00 PM' (timezone dependent)
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Groups claimable rewards by market and outcome
 * @param {UserPrediction[]} predictions - Array of user predictions with claimable rewards
 * @returns {ClaimableReward[]} Array of claimable rewards grouped by market and outcome
 * @example
 * const rewards = groupClaimableRewards(userPredictions);
 * // Returns: [
 * //   { tokenId: '1', amount: '0.5', marketId: '1', outcome: 'above' },
 * //   { tokenId: '2', amount: '1.0', marketId: '1', outcome: 'below' }
 * // ]
 */
export function groupClaimableRewards(predictions: UserPrediction[]): ClaimableReward[] {
  const claimable: Record<string, ClaimableReward> = {};

  predictions.forEach(prediction => {
    if (!prediction.isWinning || prediction.claimed || !prediction.reward || !prediction.tokenId) return;

    const key = `${prediction.marketId}-${prediction.outcome}`;

    if (!claimable[key]) {
      claimable[key] = {
        tokenId: prediction.tokenId,
        amount: '0',
        marketId: prediction.marketId,
        outcome: prediction.outcome as 'above' | 'below'
      };
    }

    // Sum up rewards for the same market/outcome
    claimable[key].amount = (
        parseFloat(claimable[key].amount) +
        parseFloat(prediction.reward || '0')
    ).toString();
  });

  return Object.values(claimable);
}

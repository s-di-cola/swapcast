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

  // Since tokenId is now the prediction ID, they should be the same
  const tokenId = prediction.id; // prediction.id is now the tokenId
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
    id: prediction.id, // This is now the tokenId
    marketId,
    marketDescription: prediction.market?.description || prediction.market?.name || marketData.description || 'Unknown Market',
    outcome: mapOutcome(prediction.outcome),
    amount: formatEther(BigInt(amount)),
    stakedAmount: formatEther(BigInt(amount)), // Using amount for stakedAmount as per original logic
    timestamp,
    claimed,
    reward: reward ? formatEther(BigInt(reward)) : null,
    isWinning,
    marketIsResolved: marketData.isResolved || false,
    marketWinningOutcome,
    tokenId // Same as id since id is now tokenId
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
  const claimable: ClaimableReward[] = [];

  predictions.forEach(prediction => {
    if (!prediction.isWinning || prediction.claimed || !prediction.reward || !prediction.tokenId) return;

    // Since each prediction has a unique tokenId, we don't need to group them
    // Each prediction becomes its own claimable reward
    claimable.push({
      tokenId: prediction.tokenId,
      amount: prediction.reward,
      marketId: prediction.marketId,
      outcome: prediction.outcome as 'above' | 'below'
    });
  });

  return claimable;
}

export function formatAmount(amount: string | number): string {
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? '0.0000' : num.toFixed(4);
  } catch (err) {
    console.error('Amount formatting error:', err);
    return '0.0000';
  }
}

export function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'above': return 'Bullish';
    case 'below': return 'Bearish';
    default: return 'Pending';
  }
}

export function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case 'above': return 'bg-green-100 text-green-800';
    case 'below': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusColor(prediction: any): string {
  if (!prediction.marketIsResolved) return 'bg-yellow-100 text-yellow-800';
  if (prediction.isWinning) return 'bg-green-100 text-green-800';
  return 'bg-red-100 text-red-800';
}

export function getStatusText(prediction: any): string {
  if (!prediction.marketIsResolved) return 'Pending';
  if (prediction.marketWinningOutcome) {
    return prediction.isWinning ? 'Won' : 'Lost';
  }
  return 'Pending';
}

export function estimateUSDValue(ethAmount: string, ethPrice: number = 2000): string {
  try {
    const amount = parseFloat(ethAmount);
    return isNaN(amount) ? '0.00' : (amount * ethPrice).toFixed(2);
  } catch (err) {
    console.error('USD value estimation error:', err);
    return '0.00';
  }
}

export function getMarketDisplayName(prediction: any): string {
  try {
    const desc = prediction.marketDescription;
    if (desc && desc.includes('/')) {
      return desc.split(' ')[0] || desc;
    }
    return desc || `Market #${prediction.marketId}`;
  } catch (err) {
    console.error('Market name formatting error:', err);
    return `Market #${prediction.marketId}`;
  }
}

export function getMarketInitial(prediction: any): string {
  try {
    const name = getMarketDisplayName(prediction);
    return name.charAt(0).toUpperCase();
  } catch (err) {
    console.error('Market initial formatting error:', err);
    return 'M';
  }
}

import { PUBLIC_PREDICTIONMANAGER_ADDRESS } from '$env/static/public';
import { getPredictionManager } from '$generated/types/PredictionManager';
import { appKit } from '$lib/configs/wallet.config';
import { formatEther } from '$lib/helpers/formatters';
import {
  getUserPredictions as getSubgraphPredictions
} from '$lib/services/subgraph/operations';
import { toastStore } from '$lib/stores/toastStore';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import { type Address, getAddress, http } from 'viem';
import type { ClaimableReward, ClaimRewardParams, PredictionStats, UserPrediction } from './types';
import {
  calculateClaimableRewards,
  groupClaimableRewards,
  mapOutcome
} from './utils';

/**
 * Internal function to get the PredictionManager contract instance
 * @returns {ReturnType<typeof getPredictionManager>} The contract instance
 * @private
 */
function getPredictionManagerContract(): ReturnType<typeof getPredictionManager> {
  try {
    const { chain, rpcUrl } = getCurrentNetworkConfig();    
    return getPredictionManager({
      address: getAddress(PUBLIC_PREDICTIONMANAGER_ADDRESS),
      chain,
      transport: http(rpcUrl)
    });
  } catch (error) {
    console.error('Error creating PredictionManager contract:', error);
    throw error;
  }
}

/**
 * Formats a value to ETH using the helper formatter
 * @param {bigint | string | number | null | undefined} value - The value to format
 * @returns {string} The formatted ETH value as a string
 * @private
 */
function formatValueToEther(value: bigint | string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  try {
    return formatEther(value);
  } catch (error) {
    console.warn('Failed to format value to ETH:', value, error);
    return '0';
  }
}

/**
 * Fetches user's prediction history from the subgraph
 * @param {string} userAddress - The user's wallet address
 * @param {number} [limit=1000] - Maximum number of predictions to fetch (default: 1000)
 * @returns {Promise<UserPrediction[]>} Array of user predictions with formatted data
 * @throws {Error} If there's an error fetching predictions
 */
export async function fetchUserPredictions(
  userAddress: string,
  limit: number = 1000
): Promise<UserPrediction[]> {
  try {
    const predictions = await getSubgraphPredictions(userAddress, { limit });

    return predictions.map(prediction => {
      const amount = formatValueToEther(prediction.amount);
      const reward = prediction.reward ? formatValueToEther(prediction.reward) : null;
      const marketIsResolved = Boolean(prediction.marketIsResolved);
      
      // Ensure marketWinningOutcome is either 'above', 'below', or undefined
      let marketWinningOutcome: 'above' | 'below' | undefined;
      if (prediction.marketWinningOutcome !== undefined) {
        const outcome = mapOutcome(prediction.marketWinningOutcome);
        marketWinningOutcome = (outcome === 'above' || outcome === 'below') ? outcome : undefined;
      }

      return {
        id: prediction.id,
        marketId: prediction.marketId || 'unknown',
        marketDescription: prediction.marketDescription || 'Unknown Market',
        outcome: mapOutcome(prediction.outcome),
        amount,
        stakedAmount: amount, // Same as amount for now
        timestamp: Number(prediction.timestamp || 0),
        claimed: Boolean(prediction.claimed),
        reward,
        isWinning: marketIsResolved ? Boolean(prediction.isWinning) : false,
        marketIsResolved,
        marketWinningOutcome,
        tokenId: prediction.id.split('-')[1] || prediction.id
      };
    });
  } catch (error) {
    console.error('Failed to fetch user predictions:', error);
    toastStore.error('Failed to load prediction history');
    return [];
  }
}

/**
 * Claims rewards for a specific prediction
 */
/**
 * Claims a reward for a specific prediction
 * @param {Object} params - The claim parameters
 * @param {string} params.tokenId - The token ID of the prediction to claim
 * @param {() => void} [params.onSuccess] - Callback executed on successful claim
 * @param {(error: Error) => void} [params.onError] - Callback executed if claim fails
 * @returns {Promise<string>} The transaction hash of the claim transaction
 * @throws {Error} If tokenId is not provided or claim fails
 */
export async function claimReward({
  tokenId,
  onSuccess,
  onError
}: ClaimRewardParams): Promise<string> {
  if (!tokenId) {
    const error = new Error('Token ID is required');
    onError?.(error);
    throw error;
  }
  try {
    const predictionManager = getPredictionManagerContract();

    // Call the contract to claim the reward
    const hash = await predictionManager.write.claimReward([BigInt(tokenId)], {
      account: appKit.getAccount()?.address as Address,
      chain: getCurrentNetworkConfig().chain
    });

    // Show success message
    toastStore.success('Reward claimed successfully!');

    // Call success callback if provided
    onSuccess?.();

    return hash;
  } catch (error: any) {
    console.error('Failed to claim reward:', error);

    // Format a user-friendly error message
    let errorMessage = 'Failed to claim reward';
    if (error.message?.includes('Already claimed')) {
      errorMessage = 'This reward has already been claimed';
    } else if (error.message?.includes('Not a winner')) {
      errorMessage = 'This prediction did not win';
    } else if (error.message?.includes('Market not resolved')) {
      errorMessage = 'Market is not yet resolved';
    }

    toastStore.error(errorMessage);

    // Call error callback if provided
    onError?.(error);

    throw error;
  }
}

/**
 * Fetches user's prediction statistics
 * @param userAddress - User's wallet address
 * @returns User's prediction statistics including totals and claimable amounts
 */
/**
 * Fetches statistics about a user's predictions
 * @param {string} userAddress - The user's wallet address
 * @returns {Promise<PredictionStats>} Object containing prediction statistics
 * @throws {Error} If there's an error fetching the statistics
 */
export async function fetchUserPredictionStats(userAddress: string): Promise<PredictionStats> {
  try {
    // Fetch all user predictions
    const predictions = await fetchUserPredictions(userAddress);

    // Calculate stats
    const totalPredictions = predictions.length;
    const totalWon = predictions.filter(p => p.isWinning).length;
    const claimablePredictions = predictions.filter((p): p is UserPrediction & { reward: string } =>
      p.isWinning && !p.claimed && p.reward !== null
    );
    const claimableAmount = claimablePredictions.length > 0
      ? calculateClaimableRewards(claimablePredictions)
      : '0';

    // Calculate total claimed (all rewards from claimed predictions)
    const totalClaimed = predictions
      .filter(p => p.claimed && p.reward)
      .reduce((sum, p) => sum + parseFloat(p.reward || '0'), 0)
      .toFixed(6);

    return {
      totalPredictions,
      totalWon,
      totalClaimed,
      claimableAmount
    };
  } catch (error) {
    console.error('Failed to fetch prediction stats:', error);
    toastStore.error('Failed to load prediction statistics');
    return {
      totalPredictions: 0,
      totalWon: 0,
      totalClaimed: '0',
      claimableAmount: '0'
    };
  }
}

/**
 * Fetches claimable rewards for a user
 * @param {string} userAddress - The user's wallet address
 * @returns {Promise<ClaimableReward[]>} Array of claimable rewards
 * @throws {Error} If there's an error fetching claimable rewards
 */
export async function fetchClaimableRewards(userAddress: string): Promise<ClaimableReward[]> {
  try {
    const predictions = await fetchUserPredictions(userAddress);
    const claimablePredictions = predictions.filter(p => p.isWinning && !p.claimed);

    // Group by market and outcome
    return groupClaimableRewards(claimablePredictions);
  } catch (error) {
    console.error('Failed to fetch claimable rewards:', error);
    toastStore.error('Failed to load claimable rewards');
    return [];
  }
}

/**
 * Claims multiple rewards in a single transaction
 * @param {string[]} tokenIds - Array of token IDs to claim
 * @returns {Promise<void>}
 * @throws {Error} If no token IDs are provided or if the claim fails
 */
export async function batchClaimRewards(tokenIds: string[]): Promise<void> {
  if (!tokenIds.length) {
    toastStore.warning('No rewards to claim');
    return;
  }

  try {
    const predictionManager = getPredictionManagerContract();
    const validTokenIds = tokenIds.filter(id => id && id.trim() !== '');

    if (validTokenIds.length === 0) {
      throw new Error('No valid token IDs provided');
    }

    // In a real implementation, you would batch the claims
    // For now, we'll just claim them one by one
    for (const tokenId of validTokenIds) {
      try {
        await predictionManager.write.claimReward([BigInt(tokenId)],{
          account: appKit.getAccount()?.address as Address,
          chain: getCurrentNetworkConfig().chain,
        });
        toastStore.success(`Claimed reward for token ${tokenId}`);
      } catch (error) {
        console.error(`Failed to claim reward for token ${tokenId}:`, error);
        // Continue with next token even if one fails
      }
    }

    if (validTokenIds.length > 1) {
      toastStore.success(`Successfully processed ${validTokenIds.length} claims`);
    }
  } catch (error) {
    console.error('Failed to batch claim rewards:', error);
    toastStore.error('Failed to process some claims');
    throw error;
  }
}

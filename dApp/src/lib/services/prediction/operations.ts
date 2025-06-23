import { PUBLIC_PREDICTIONMANAGER_ADDRESS, PUBLIC_REWARDDISTRIBUTOR_ADDRESS } from '$env/static/public';
import { getPredictionManager } from '$generated/types/PredictionManager';
import { getRewardDistributor } from '$generated/types/RewardDistributor';
import { appKit } from '$lib/configs/wallet.config';
import { formatEther } from '$lib/helpers/formatters';
import {
  getUserPredictions as getSubgraphPredictions
} from '$lib/services/subgraph/operations';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import { type Address, createPublicClient, getAddress, http } from 'viem';
import type { ClaimableReward, PredictionStats, UserPrediction } from './types';
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
 * Internal function to get the RewardDistributor contract instance
 * @returns {ReturnType<typeof getRewardDistributor>} The contract instance
 * @private
 */
function getRewardDistributorContract(): ReturnType<typeof getRewardDistributor> {
  try {
    const { chain, rpcUrl } = getCurrentNetworkConfig();
    return getRewardDistributor({
      address: getAddress(PUBLIC_REWARDDISTRIBUTOR_ADDRESS),
      chain,
      transport: http(rpcUrl)
    });
  } catch (error) {
    console.error('Error creating RewardDistributor contract:', error);
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
    console.log('🔍 Fetching predictions for:', userAddress);
    const predictions = await getSubgraphPredictions(userAddress, { limit });

    console.log('🔍 Raw subgraph response:', {
      count: predictions.length,
      firstPrediction: predictions[0],
      sampleFields: predictions[0] ? Object.keys(predictions[0]) : []
    });

    return predictions.map((prediction, index) => {
      // Debug each prediction's tokenId
      console.log(`🔍 Processing prediction ${index}:`, {
        id: prediction.id,
        tokenId: prediction.tokenId,
        tokenIdType: typeof prediction.tokenId,
        tokenIdExists: 'tokenId' in prediction,
        allFields: Object.keys(prediction)
      });

      const amount = formatValueToEther(prediction.amount);
      const reward = prediction.reward ? formatValueToEther(prediction.reward) : null;
      const marketIsResolved = Boolean(prediction.marketIsResolved);

      // Ensure marketWinningOutcome is either 'above', 'below', or undefined (never 'pending')
      let marketWinningOutcome: 'above' | 'below' | undefined;
      if (prediction.marketWinningOutcome !== undefined && prediction.marketWinningOutcome !== null) {
        const outcome = mapOutcome(prediction.marketWinningOutcome);
        marketWinningOutcome = (outcome === 'above' || outcome === 'below') ? outcome : undefined;
      } else {
        marketWinningOutcome = undefined;
      }

      // Handle tokenId extraction with detailed logging
      let resolvedTokenId: string | undefined;

      if (prediction.tokenId !== undefined && prediction.tokenId !== null) {
        resolvedTokenId = prediction.tokenId.toString();
        console.log(`✅ Found tokenId for prediction ${index}:`, resolvedTokenId);
      } else {
        console.warn(`❌ No tokenId found for prediction ${index}:`, {
          id: prediction.id,
          availableFields: Object.keys(prediction)
        });
        resolvedTokenId = undefined;
      }

      const result = {
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
        tokenId: resolvedTokenId
      };

      console.log(`🔍 Final processed prediction ${index}:`, {
        id: result.id,
        tokenId: result.tokenId,
        claimed: result.claimed,
        isWinning: result.isWinning,
        marketIsResolved: result.marketIsResolved
      });

      return result;
    });
  } catch (error) {
    console.error('Failed to fetch user predictions:', error);
    throw new Error('Failed to load prediction history');
  }
}

/**
 * Result of a claim operation
 */
export interface ClaimResult {
  success: boolean;
  hash?: string;
  error?: string;
}

/**
 * Claims a reward for a specific prediction
 * @param {string} tokenId - The token ID of the prediction to claim
 * @returns {Promise<ClaimResult>} The result of the claim operation
 */
export async function claimReward(tokenId: string): Promise<ClaimResult> {
  if (!tokenId) {
    return {
      success: false,
      error: 'Token ID is required'
    };
  }

  // Validate tokenId is numeric
  if (!/^\d+$/.test(tokenId)) {
    console.error('❌ Invalid tokenId format:', tokenId);
    return {
      success: false,
      error: 'Token ID must be a number'
    };
  }

  try {
    const rewardDistributor = getRewardDistributorContract();
    const account = appKit.getAccount()?.address;
    const { chain, rpcUrl } = getCurrentNetworkConfig();

    if (!account) {
      return {
        success: false,
        error: 'No wallet connected'
      };
    }

    console.log('Claiming reward for token:', tokenId);
    console.log('Contract address:', PUBLIC_REWARDDISTRIBUTOR_ADDRESS);
    console.log('Account:', account);

    // Convert to BigInt
    const tokenIdBigInt = BigInt(tokenId);
    console.log('TokenId as BigInt:', tokenIdBigInt);

    // Call the contract to claim the reward
    const hash = await rewardDistributor.write.claimReward([tokenIdBigInt], {
      account: account as Address,
      chain
    });

    console.log('Claim transaction hash:', hash);

    const tx = await createPublicClient({ chain, transport: http(rpcUrl) }).waitForTransactionReceipt({ hash });
    console.log('Transaction receipt:', tx);
    return {
      success: tx.status === 'success',
      hash
    };
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
    } else if (error.message?.includes('No wallet connected')) {
      errorMessage = 'Please connect your wallet';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

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
    throw new Error('Failed to load prediction statistics');
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
    throw new Error('Failed to load claimable rewards');
  }
}

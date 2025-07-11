import type { Address } from 'viem';

/**
 * Represents a user's prediction in the application
 */
export interface UserPrediction {
  /** Unique prediction ID (now the tokenId) */
  id: string;
  /** ID of the market this prediction is for */
  marketId: string;
  /** Human-readable market description */
  marketDescription: string;
  /** Prediction direction */
  outcome: 'above' | 'below' | 'pending';
  /** Formatted amount staked (in ETH) */
  amount: string;
  /** Formatted staked amount (same as amount for now) */
  stakedAmount: string;
  /** Prediction timestamp in seconds */
  timestamp: number;
  /** Whether the reward has been claimed */
  claimed: boolean;
  /** Formatted reward amount (in ETH) if any */
  reward: string | null;
  /** Whether this prediction is a winner (only set if market is resolved) */
  isWinning: boolean;
  /** Whether the market for this prediction has been resolved */
  marketIsResolved: boolean;
  /** The winning outcome of the market (only set if market is resolved) */
  marketWinningOutcome?: 'above' | 'below';
  /** Token ID (same as id since we now use tokenId as the primary key) */
  tokenId: string;
}

/**
 * Type guard to check if an object is a UserPrediction
 */
export function isUserPrediction(obj: any): obj is UserPrediction {
  return (
      obj &&
      typeof obj === 'object' &&
      'id' in obj &&
      'marketId' in obj &&
      'outcome' in obj &&
      'tokenId' in obj
  );
}

/**
 * Parameters for claiming a reward
 */
export interface ClaimRewardParams {
  /** The token ID of the prediction NFT */
  tokenId: string;
  /** Callback for successful claim */
  onSuccess?: () => void;
  /** Callback for failed claim */
  onError?: (error: Error) => void;
}

/**
 * User's prediction statistics
 */
export interface PredictionStats {
  /** Total number of predictions made */
  totalPredictions: number;
  /** Number of winning predictions */
  totalWon: number;
  /** Total amount claimed (formatted ETH) */
  totalClaimed: string;
  /** Total amount available to claim (formatted ETH) */
  claimableAmount: string;
}

/**
 * Represents a claimable reward
 */
export interface ClaimableReward {
  /** The token ID of the prediction NFT */
  tokenId: string;
  /** Formatted reward amount (in ETH) */
  amount: string;
  /** Market ID this reward is for */
  marketId: string;
  /** Outcome of the prediction */
  outcome: 'above' | 'below';
}

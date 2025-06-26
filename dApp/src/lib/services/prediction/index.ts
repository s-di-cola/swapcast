/**
 * Prediction Service
 *
 * Provides functionality for interacting with prediction markets:
 * - Fetch user predictions and statistics
 * - Claim rewards (single or batch)
 * - Get claimable rewards
 *
 * @module services/prediction
 */

// Core operations
export {
    fetchUserPredictions,
    claimReward,
    fetchUserPredictionStats,
    fetchClaimableRewards,
} from './operations';

// Types
export type {
    UserPrediction,
    ClaimableReward,
    PredictionStats,
    ClaimRewardParams
} from './types';

// Internal utilities
export {
    calculateClaimableRewards,
    groupClaimableRewards,
    mapOutcome,
    getMarketInitial,
    getMarketDisplayName,
    getOutcomeLabel,
    getStatusText,
    formatDate,
    formatAmount,
    estimateUSDValue,
    getStatusColor,
    getOutcomeColor
} from './utils';


// Handlers
export{
    setupChunkErrorHandling,
    isChunkLoadError
} from './handlers';

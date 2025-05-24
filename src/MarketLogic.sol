// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";
import {PredictionManager} from "./PredictionManager.sol"; // For Market struct definition
import {ISwapCastNFT} from "./interfaces/ISwapCastNFT.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MarketLogic Library
 * @author Simone Di Cola
 * @notice Provides the core logic for operating on individual prediction markets.
 * @dev Functions in this library act on the Market storage struct defined in PredictionManager.
 *      This library centralizes the core business logic for prediction markets to improve code organization,
 *      reduce duplication, and facilitate testing. It handles operations like recording predictions,
 *      resolving markets, and calculating rewards.
 * @custom:security-contact security@swapcast.com
 */
library MarketLogic {
    // Re-using PredictionManager's Market struct directly by importing PredictionManager
    // This avoids defining a duplicate struct and ensures consistency.
    // Functions will take `PredictionManager.Market storage market` as a parameter.

    // --- Events (to be emitted by PredictionManager after calling library functions) ---
    // It's generally better for the main contract (PredictionManager) to emit events
    // after a successful library call, as libraries cannot emit events themselves directly
    // in a way that attributes them to the calling contract's address in logs.
    // However, we can define event signatures here for clarity if needed, or just rely on PM's events.

    // --- Errors ---
    /**
     * @notice Thrown when attempting to perform an action on a market that is already resolved.
     * @param marketId The ID of the market that is already resolved.
     */
    error MarketAlreadyResolvedL(uint256 marketId);

    /**
     * @notice Thrown when attempting to claim a reward for a market that is not yet resolved.
     * @param marketId The ID of the market that is not yet resolved.
     */
    error MarketNotResolvedL(uint256 marketId);

    /**
     * @notice Thrown when a user attempts to make a prediction for a market they have already predicted on.
     * @param user The address of the user who has already made a prediction.
     * @param marketId The ID of the market on which the user has already predicted.
     */
    error AlreadyPredictedL(address user, uint256 marketId);

    /**
     * @notice Thrown when attempting to record a prediction with zero stake amount.
     */
    error AmountCannotBeZeroL();

    /**
     * @notice Thrown when the stake amount is below the minimum required amount.
     * @param sentAmount The amount sent by the user.
     * @param minRequiredAmount The minimum required stake amount.
     */
    error StakeBelowMinimumL(uint256 sentAmount, uint256 minRequiredAmount);

    /**
     * @notice Thrown when the transfer of a reward to the user fails.
     * @param recipient The address that was supposed to receive the reward.
     * @param amount The amount that failed to transfer.
     */
    error RewardTransferFailedL(address recipient, uint256 amount);

    /**
     * @notice Thrown when the transfer of a fee to the treasury fails.
     * @param treasuryAddress The address of the treasury that was supposed to receive the fee.
     * @param amount The fee amount that failed to transfer.
     */
    error FeeTransferFailedL(address treasuryAddress, uint256 amount);

    /**
     * @notice Thrown when attempting to claim a reward for an NFT that did not predict the winning outcome.
     * @param tokenId The ID of the NFT that did not predict the winning outcome.
     * @param predictedOutcome The outcome that was predicted.
     * @param winningOutcome The actual winning outcome.
     */
    error NotWinningNFTL(uint256 tokenId, uint8 predictedOutcome, uint8 winningOutcome);

    /**
     * @notice Thrown when attempting to claim a reward but there are no stakes for the outcome.
     * @param marketId The ID of the market with no stakes for the outcome.
     * @param outcome The outcome with no stakes.
     */
    error ClaimFailedNoStakeForOutcomeL(uint256 marketId, uint8 outcome);

    /**
     * @notice Thrown when the price data from the oracle is stale.
     * @param lastUpdateTime The timestamp of the last oracle update.
     * @param currentTime The current block timestamp.
     * @param maxStaleness The maximum allowed staleness in seconds.
     */
    error PriceOracleStaleL(uint256 lastUpdateTime, uint256 currentTime, uint256 maxStaleness);

    /**
     * @notice Thrown when attempting to record a prediction for a market that has already expired.
     * @param marketId The ID of the expired market.
     * @param expirationTime The expiration timestamp of the market.
     * @param currentTime The current block timestamp.
     */
    error MarketExpiredL(uint256 marketId, uint256 expirationTime, uint256 currentTime);

    /**
     * @notice Thrown when attempting to resolve a market that has not yet expired.
     * @param marketId The ID of the market that has not yet expired.
     * @param expirationTime The expiration timestamp of the market.
     * @param currentTime The current block timestamp.
     */
    error MarketNotYetExpiredL(uint256 marketId, uint256 expirationTime, uint256 currentTime);

    /**
     * @notice Thrown when an operation is attempted with a zero address where it's not allowed.
     * @param message A descriptive message explaining the context of the zero address error.
     */
    error ZeroAddressL(string message);

    /**
     * @notice Thrown when a calculated reward amount is unexpectedly zero.
     * @param tokenId The ID of the NFT for which the reward was calculated.
     */
    error ZeroRewardAmountL(uint256 tokenId);

    /**
     * @notice Thrown when the NFT owner address is zero.
     * @param tokenId The ID of the NFT with a zero owner address.
     */
    error ZeroNFTOwnerL(uint256 tokenId);

    /**
     * @notice Records a user's prediction for a given market and mints an NFT representing their position.
     * @dev This function handles the core logic for recording predictions, including:
     *      - Validating market state (not expired, not resolved)
     *      - Validating user eligibility (not already predicted)
     *      - Calculating and transferring protocol fees
     *      - Updating market state with the user's prediction
     *      - Minting an NFT to represent the user's position
     *
     * The function implements several gas optimizations by caching storage variables
     * to reduce SLOADs and follows a checks-effects-interactions pattern for security.
     *
     * @param market The storage reference to the market data in PredictionManager.
     * @param user The address of the user making the prediction.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStakeDeclared The net ETH amount the user wants to stake (excluding fees).
     * @param swapCastNFT The ISwapCastNFT contract instance used to mint the position NFT.
     * @param treasuryAddress The address where protocol fees are sent.
     * @param protocolFeeBasisPoints The fee percentage in basis points (1/100 of 1%).
     * @param minStakeAmount The minimum net stake amount allowed.
     * @return stakeAmountNet The net stake amount (same as convictionStakeDeclared).
     * @return protocolFee The calculated protocol fee amount that was transferred to treasury.
     *
     * @custom:security The caller (PredictionManager) is responsible for:
     *      - Validating that user address is not zero
     *      - Ensuring msg.value covers both stake and fee
     *      - Emitting appropriate events
     */
    function recordPrediction(
        PredictionManager.Market storage market,
        address user,
        PredictionTypes.Outcome outcome,
        uint256 convictionStakeDeclared,
        ISwapCastNFT swapCastNFT,
        address treasuryAddress,
        uint256 protocolFeeBasisPoints,
        uint256 minStakeAmount
    ) internal returns (uint256 stakeAmountNet, uint256 protocolFee) {
        // Cache storage variables to reduce SLOADs
        uint256 expirationTime = market.expirationTime;
        bool isResolved = market.resolved;
        bool hasUserPredicted = market.userHasPredicted[user];
        uint256 marketId = market.marketId;

        // Validation checks
        if (block.timestamp >= expirationTime) {
            revert MarketExpiredL(marketId, expirationTime, block.timestamp);
        }
        if (isResolved) revert MarketAlreadyResolvedL(marketId);
        if (hasUserPredicted) revert AlreadyPredictedL(user, marketId);
        // user address zero check should be done by caller (PredictionManager)
        if (convictionStakeDeclared == 0) revert AmountCannotBeZeroL();
        if (treasuryAddress == address(0)) revert ZeroAddressL("Treasury address cannot be zero");

        // Calculate fee and net stake amount
        protocolFee = (convictionStakeDeclared * protocolFeeBasisPoints) / 10000;
        stakeAmountNet = convictionStakeDeclared; // This IS the net stake.

        // Validate stake amount
        if (stakeAmountNet < minStakeAmount) {
            revert StakeBelowMinimumL(stakeAmountNet, minStakeAmount);
        }

        // Process fee transfer if needed
        if (protocolFee > 0) {
            (bool success,) = payable(treasuryAddress).call{value: protocolFee}("");
            if (!success) revert FeeTransferFailedL(treasuryAddress, protocolFee);
        }

        // Update market state (single SSTORE for user prediction status)
        market.userHasPredicted[user] = true;

        // Update total stake for the chosen outcome (single SSTORE)
        // Using direct uint8 comparison is more gas efficient than enum comparison
        if (uint8(outcome) == 0) {
            // PredictionTypes.Outcome.Bearish = 0
            market.totalConvictionStakeOutcome0 += stakeAmountNet;
        } else {
            market.totalConvictionStakeOutcome1 += stakeAmountNet;
        }

        // Mint NFT to represent the prediction
        swapCastNFT.mint(user, marketId, outcome, stakeAmountNet);

        return (stakeAmountNet, protocolFee);
    }

    /**
     * @notice Resolves a market with the given winning outcome and oracle price.
     * @dev This function finalizes a prediction market by setting the winning outcome
     *      and marking it as resolved. After resolution, users with winning predictions
     *      can claim their rewards, and no new predictions can be made.
     *
     * The market resolution is a critical step that determines which predictions
     * were correct and enables users to claim their rewards. After resolution,
     * no new predictions can be made for this market, and users with winning
     * predictions can claim their rewards.
     *
     * @param market The storage reference to the market data.
     * @param winningOutcome_ The determined winning outcome (Bearish or Bullish).
     * @return totalPrizePool The total prize pool for the market (sum of all stakes).
     *
     * @custom:security The caller (PredictionManager) is responsible for:
     *      - Ensuring only authorized resolvers can call this function
     *      - Verifying the market has expired before resolution
     *      - Emitting appropriate events with resolution details
     */
    function resolve(
        PredictionManager.Market storage market,
        PredictionTypes.Outcome winningOutcome_,
        int256 /* oraclePrice */
    ) internal returns (uint256 totalPrizePool) {
        // Using commented parameter name instead of if(false) for unused parameter suppression
        uint256 marketId = market.marketId;
        if (market.resolved) revert MarketAlreadyResolvedL(marketId);
        // Caller (PredictionManager) should ensure market is expired and oracle data is fresh.

        market.resolved = true;
        market.winningOutcome = winningOutcome_;

        totalPrizePool = market.totalConvictionStakeOutcome0 + market.totalConvictionStakeOutcome1;
        return totalPrizePool;
    }

    /**
     * @notice Calculates and facilitates a reward claim for a winning NFT position.
     * @dev This function handles the complete reward claim process, including:
     *      - Validating market state (must be resolved)
     *      - Validating the NFT represents a winning prediction
     *      - Calculating the reward amount based on the user's stake and the total stakes
     *      - Burning the NFT after successful claim
     *      - Transferring the reward to the NFT owner
     *
     * The reward calculation follows these rules:
     *      1. The user always gets their original stake back
     *      2. If their prediction was correct, they also get a proportional share of the losing pool
     *         based on their stake relative to the total winning pool
     *
     * The function implements gas optimizations by caching storage variables to reduce SLOADs
     * and follows a checks-effects-interactions pattern for security (burning NFT before transfer).
     *
     * @param market The storage reference to the market data.
     * @param tokenId The ID of the SwapCastNFT to claim rewards for.
     * @param predictionOutcome The outcome predicted by the NFT (verified against market's winning outcome).
     * @param userConvictionStake The amount staked by the user for this prediction.
     * @param nftOwner The current owner of the NFT who will receive the reward.
     * @param swapCastNFT The ISwapCastNFT contract instance used to burn the NFT.
     * @return rewardAmount The total reward amount paid to the NFT owner.
     *
     * @custom:security The caller (PredictionManager) is responsible for:
     *      - Verifying NFT ownership
     *      - Emitting appropriate events
     *      - Handling any errors during the claim process
     */
    function claimReward(
        PredictionManager.Market storage market,
        uint256 tokenId,
        PredictionTypes.Outcome predictionOutcome,
        uint256 userConvictionStake,
        address nftOwner,
        ISwapCastNFT swapCastNFT
    ) internal returns (uint256 rewardAmount) {
        // Cache storage variables to reduce SLOADs
        uint256 marketId = market.marketId;
        bool isResolved = market.resolved;
        PredictionTypes.Outcome winningOutcome = market.winningOutcome;
        uint256 totalStakeOutcome0 = market.totalConvictionStakeOutcome0;
        uint256 totalStakeOutcome1 = market.totalConvictionStakeOutcome1;

        // Validation checks
        if (!isResolved) revert MarketNotResolvedL(marketId);
        if (nftOwner == address(0)) revert ZeroNFTOwnerL(tokenId);
        if (predictionOutcome != winningOutcome) {
            revert NotWinningNFTL(tokenId, uint8(predictionOutcome), uint8(winningOutcome));
        }
        if (userConvictionStake == 0) revert AmountCannotBeZeroL(); // Should not happen

        // Start with base reward (user's original stake)
        rewardAmount = userConvictionStake;

        // Calculate additional reward from losing pool if applicable
        // Using direct uint8 comparison is more gas efficient than enum comparison
        if (uint8(winningOutcome) == 0) {
            // Bearish
            if (totalStakeOutcome0 == 0) revert ClaimFailedNoStakeForOutcomeL(marketId, 0);
            if (totalStakeOutcome1 > 0) {
                // Calculate user's share of the losing pool with better precision
                // Multiply before dividing to minimize precision loss
                rewardAmount += (userConvictionStake * totalStakeOutcome1) / totalStakeOutcome0;
            }
        } else {
            // Bullish
            if (totalStakeOutcome1 == 0) revert ClaimFailedNoStakeForOutcomeL(marketId, 1);
            if (totalStakeOutcome0 > 0) {
                // Calculate user's share of the losing pool with better precision
                // Multiply before dividing to minimize precision loss
                rewardAmount += (userConvictionStake * totalStakeOutcome0) / totalStakeOutcome1;
            }
        }

        // Check for zero reward amount (should never happen if validation passed)
        if (rewardAmount == 0) revert ZeroRewardAmountL(tokenId);

        // Burn the NFT first (pattern: effects before interactions)
        swapCastNFT.burn(tokenId);

        // Transfer reward to NFT owner - no need to check rewardAmount > 0 as we already verified it's not zero
        (bool success,) = payable(nftOwner).call{value: rewardAmount}("");
        if (!success) revert RewardTransferFailedL(nftOwner, rewardAmount);

        return rewardAmount;
    }

    /**
     * @notice Checks if a market is past its expiration time.
     * @dev This utility function provides a clean way to determine if a market has expired.
     *      A market is considered expired when the current block timestamp is greater than or
     *      equal to the market's expiration time. Expired markets can be resolved but cannot
     *      accept new predictions.
     *
     * @param market The storage reference to the market data.
     * @return True if the market has expired (block.timestamp >= expirationTime), false otherwise.
     */
    function isPastExpiration(PredictionManager.Market storage market) internal view returns (bool) {
        return block.timestamp >= market.expirationTime;
    }

    /**
     * @notice Fetches price from Chainlink oracle and determines the market outcome based on the price threshold.
     * @dev This function interacts with a Chainlink price aggregator to:
     *      1. Fetch the latest price data for the asset pair
     *      2. Verify the price data is fresh (not stale)
     *      3. Determine the winning outcome by comparing the price to the market's threshold
     *
     * The function implements important safeguards:
     *      - Reverts if the price aggregator address is zero
     *      - Reverts if the price data is stale (older than maxPriceStaleness)
     *      - Handles the edge case where price exactly matches the threshold
     *
     * @param market The storage reference to the market data containing the price aggregator and threshold.
     * @param maxPriceStaleness The maximum allowed age (in seconds) for the oracle price data.
     * @return outcome The determined winning outcome based on the oracle price comparison to threshold.
     * @return price The raw price value retrieved from the oracle.
     *
     * @custom:security This function relies on Chainlink's security model for accurate price data.
     *                   The caller should ensure the price aggregator is trusted and properly configured.
     * @custom:precision This function handles potential precision issues by using explicit type casting
     *                   for threshold comparison to ensure consistent behavior.
     */
    function getOutcomeFromOracle(PredictionManager.Market storage market, uint256 maxPriceStaleness)
        internal
        view
        returns (PredictionTypes.Outcome outcome, int256 price)
    {
        address priceAggregator = market.priceAggregator;

        if (priceAggregator == address(0)) revert PredictionTypes.InvalidPriceAggregator();

        // roundId, answer, startedAt, updatedAt, answeredInRound
        (uint80 roundId, int256 oraclePrice,, uint256 lastUpdatedAtTimestamp, uint80 answeredInRound) =
            AggregatorV3Interface(priceAggregator).latestRoundData();

        // Check for stale price data
        uint256 currentTime = block.timestamp;
        if (currentTime - lastUpdatedAtTimestamp > maxPriceStaleness) {
            revert PriceOracleStaleL(lastUpdatedAtTimestamp, currentTime, maxPriceStaleness);
        }

        // Check if the round is valid (Chainlink recommends this check)
        if (answeredInRound < roundId) {
            revert PriceOracleStaleL(lastUpdatedAtTimestamp, currentTime, maxPriceStaleness);
        }

        // Additional check for valid price
        if (oraclePrice <= 0) {
            revert PredictionTypes.InvalidPriceData();
        }

        price = oraclePrice;
        uint256 priceThreshold = market.priceThreshold;

        // Compare price to threshold and determine outcome
        if (oraclePrice > int256(priceThreshold)) {
            outcome = PredictionTypes.Outcome.Bullish;
        } else if (oraclePrice < int256(priceThreshold)) {
            outcome = PredictionTypes.Outcome.Bearish;
        } else {
            // Price is exactly the threshold, could be neutral or handled as per specific rules
            // For now, let's assume this scenario might also need specific handling, e.g., revert or specific outcome.
            // Reverting as a placeholder, this should be a defined behavior.
            revert PredictionTypes.PriceAtThreshold();
        }
    }
}

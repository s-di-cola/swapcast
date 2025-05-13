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
 *         Functions in this library act on the MarketData storage struct defined in PredictionManager.
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

    // --- Errors (can be defined and used within the library) ---
    error MarketAlreadyResolvedL(); // Suffix 'L' for Library to avoid clashes if PM has same
    error MarketNotResolvedL();
    error AlreadyPredictedL(address user);
    error AmountCannotBeZeroL();
    error StakeBelowMinimumL(uint256 sentAmount, uint256 minRequiredAmount);
    error RewardTransferFailedL();
    error FeeTransferFailedL();
    error NotWinningNFTL();
    error ClaimFailedNoStakeForOutcomeL();
    error PriceOracleStaleL();
    error MarketExpiredL();
    error MarketNotYetExpiredL();

    /**
     * @notice Records a user's prediction for a given market.
     * @param market The storage reference to the market data in PredictionManager.
     * @param user The address of the user making the prediction.
     * @param outcome The predicted outcome.
     * @param convictionStakeDeclared The total ETH amount sent by the user for this prediction.
     * @param swapCastNFT The ISwapCastNFT contract instance.
     * @param treasuryAddress The address for protocol fees.
     * @param protocolFeeBasisPoints The fee percentage.
     * @param minStakeAmount The minimum net stake allowed.
     * @return stakeAmountNet The net stake amount after fees.
     * @return protocolFee The calculated protocol fee.
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
        if (block.timestamp >= market.expirationTime) revert MarketExpiredL();
        if (market.resolved) revert MarketAlreadyResolvedL();
        if (market.userHasPredicted[user]) revert AlreadyPredictedL(user);
        // user address zero check should be done by caller (PredictionManager)
        if (convictionStakeDeclared == 0) revert AmountCannotBeZeroL();

        // convictionStakeDeclared is the net amount the user wants to stake.
        // The msg.value (which is convictionStakeDeclared + fee) has already been
        // validated by the calling PredictionManager contract.
        protocolFee = (convictionStakeDeclared * protocolFeeBasisPoints) / 10000;
        stakeAmountNet = convictionStakeDeclared; // This IS the net stake.

        // The check below was for a scenario where stakeAmountNet could become zero
        // if protocolFee >= convictionStakeDeclared. Given PM ensures msg.value covers fee,
        // and convictionStakeDeclared is passed as the net, this specific check might be redundant
        // if minStakeAmount handles the effective minimum. However, if fee can consume the entire declared stake,
        // AmountCannotBeZeroL is still valid.
        if (stakeAmountNet == 0) revert AmountCannotBeZeroL(); // Should not happen if convictionStakeDeclared > 0
        if (stakeAmountNet < minStakeAmount) revert StakeBelowMinimumL(stakeAmountNet, minStakeAmount);

        if (protocolFee > 0) {
            (bool success,) = payable(treasuryAddress).call{value: protocolFee}("");
            if (!success) revert FeeTransferFailedL();
        }

        market.userHasPredicted[user] = true;
        if (outcome == PredictionTypes.Outcome.Bearish) {
            market.totalConvictionStakeOutcome0 += stakeAmountNet;
        } else {
            market.totalConvictionStakeOutcome1 += stakeAmountNet;
        }

        swapCastNFT.mint(user, market.marketId, outcome, stakeAmountNet);
        // PredictionManager should emit StakeRecorded and FeePaid events.
        return (stakeAmountNet, protocolFee);
    }

    /**
     * @notice Resolves a market with the given winning outcome and oracle price.
     * @param market The storage reference to the market data.
     * @param winningOutcome_ The determined winning outcome.
     * @return totalPrizePool The total prize pool in the market.
     */
    function resolve(
        PredictionManager.Market storage market,
        PredictionTypes.Outcome winningOutcome_,
        int256 /*oraclePrice_*/
    ) internal returns (uint256 totalPrizePool) {
        if (market.resolved) revert MarketAlreadyResolvedL();
        // Caller (PredictionManager) should ensure market is expired and oracle data is fresh.

        market.resolved = true;
        market.winningOutcome = winningOutcome_;
        // oraclePrice_ is passed in, could also be stored in market struct if needed.
        // For now, it's not directly used in this function but is available.

        totalPrizePool = market.totalConvictionStakeOutcome0 + market.totalConvictionStakeOutcome1;
        // PredictionManager should emit MarketResolved event.
        return totalPrizePool;
    }

    /**
     * @notice Calculates and facilitates a reward claim for a winning NFT.
     * @param market The storage reference to the market data.
     * @param tokenId The ID of the SwapCastNFT.
     * @param predictionOutcome The outcome predicted by the NFT.
     * @param userConvictionStake The stake amount from the NFT.
     * @param nftOwner The owner of the NFT.
     * @param swapCastNFT The ISwapCastNFT contract instance.
     * @return rewardAmount The total reward amount paid to the NFT owner.
     */
    function claimReward(
        PredictionManager.Market storage market,
        uint256 tokenId,
        PredictionTypes.Outcome predictionOutcome,
        uint256 userConvictionStake,
        address nftOwner,
        ISwapCastNFT swapCastNFT
    ) internal returns (uint256 rewardAmount) {
        if (!market.resolved) revert MarketNotResolvedL();
        if (predictionOutcome != market.winningOutcome) revert NotWinningNFTL();
        if (userConvictionStake == 0) revert AmountCannotBeZeroL(); // Should not happen

        rewardAmount = userConvictionStake; // Base: return of stake

        if (market.winningOutcome == PredictionTypes.Outcome.Bearish) {
            if (market.totalConvictionStakeOutcome0 == 0) revert ClaimFailedNoStakeForOutcomeL();
            if (market.totalConvictionStakeOutcome1 > 0) {
                // If there's a losing pool
                uint256 shareOfLosingPool =
                    (userConvictionStake * market.totalConvictionStakeOutcome1) / market.totalConvictionStakeOutcome0;
                rewardAmount += shareOfLosingPool;
            }
        } else {
            // Winning outcome is Bullish
            if (market.totalConvictionStakeOutcome1 == 0) revert ClaimFailedNoStakeForOutcomeL();
            if (market.totalConvictionStakeOutcome0 > 0) {
                // If there's a losing pool
                uint256 shareOfLosingPool =
                    (userConvictionStake * market.totalConvictionStakeOutcome0) / market.totalConvictionStakeOutcome1;
                rewardAmount += shareOfLosingPool;
            }
        }

        swapCastNFT.burn(tokenId);

        if (rewardAmount > 0) {
            (bool success,) = payable(nftOwner).call{value: rewardAmount}("");
            if (!success) revert RewardTransferFailedL();
        }
        // PredictionManager should emit RewardClaimed event.
        return rewardAmount;
    }

    /**
     * @notice Checks if a market is past its expiration time.
     * @param market The storage reference to the market data.
     * @return True if expired, false otherwise.
     */
    function isPastExpiration(PredictionManager.Market storage market) internal view returns (bool) {
        return block.timestamp >= market.expirationTime;
    }

    /**
     * @notice Fetches oracle price and determines outcome. Reverts if price is stale.
     * @param market The storage reference to the market data.
     * @param maxPriceStaleness The max allowed staleness for the oracle feed.
     * @return outcome The determined winning outcome based on the oracle price.
     * @return price The oracle price.
     */
    function getOutcomeFromOracle(PredictionManager.Market storage market, uint256 maxPriceStaleness)
        internal
        view
        returns (PredictionTypes.Outcome outcome, int256 price)
    {
        if (market.priceAggregator == address(0)) revert PredictionTypes.InvalidPriceAggregator();

        // roundId, answer, startedAt, updatedAt, answeredInRound
        // We only need answer (price) and updatedAt (lastUpdatedAt)
        (, int256 oraclePrice,, uint256 lastUpdatedAtTimestamp,) =
            AggregatorV3Interface(market.priceAggregator).latestRoundData();

        if (block.timestamp - lastUpdatedAtTimestamp > maxPriceStaleness) {
            revert PriceOracleStaleL();
        }

        price = oraclePrice;

        if (oraclePrice > int256(market.priceThreshold)) {
            outcome = PredictionTypes.Outcome.Bullish;
        } else if (oraclePrice < int256(market.priceThreshold)) {
            outcome = PredictionTypes.Outcome.Bearish;
        } else {
            // Price is exactly the threshold, could be neutral or handled as per specific rules
            // For now, let's assume this scenario might also need specific handling, e.g., revert or specific outcome.
            // Reverting as a placeholder, this should be a defined behavior.
            revert PredictionTypes.PriceAtThreshold();
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IPredictionPool Interface
 * @author SwapCast Developers
 * @notice Defines the interface for the PredictionPool contract, primarily for interaction from the SwapCastHook.
 */
interface IPredictionPool {
    /**
     * @notice Records a user's prediction and associated stake.
     * @param user The address of the user making the prediction.
     * @param marketId The ID of the market for which the prediction is made.
     * @param outcome The predicted outcome (e.g., 0 for Bearish, 1 for Bullish).
     * @dev This function is expected to be payable to receive the ETH stake for the prediction.
     */
    function recordPrediction(address user, uint256 marketId, uint8 outcome) external payable;
}

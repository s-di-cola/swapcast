// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PredictionTypes} from "../types/PredictionTypes.sol";

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
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStakeDeclared The amount of conviction (stake) declared for this prediction.
     * @dev This function is called by the hook, which passes the stake amount declared in hookData.
     */
    function recordPrediction(
        address user,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStakeDeclared
    ) external;
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PredictionTypes} from "../types/PredictionTypes.sol";

/**
 * @title IPredictionManager Interface
 * @author SwapCast Developers
 * @notice Defines the interface for the PredictionManager contract, primarily for interaction from the SwapCastHook.
 */
interface IPredictionManager {
    /**
     * @notice Enum for automation provider types
     */
    enum AutomationProvider {
        CHAINLINK,
        GELATO,
        NONE
    }

    /**
     * @notice Gelato automation checker function
     * @return canExec Whether upkeep is needed
     * @return execPayload The payload to execute
     */
    function checker() external view returns (bool canExec, bytes memory execPayload);

    /**
     * @notice Performs Gelato upkeep to resolve expired markets
     */
    function performGelatoUpkeep() external;

    /**
     * @notice Manually resolves a market (owner only)
     * @param marketId The ID of the market to resolve
     */
    function resolveMarketManual(uint256 marketId) external;

    /**
     * @notice Returns an array of expired market IDs
     * @return An array of market IDs that have expired
     */
    function getExpiredMarkets() external view returns (uint256[] memory);

    /**
     * @notice Checks if a market has expired
     * @param marketId The ID of the market to check
     * @return Whether the market has expired
     */
    function isMarketExpired(uint256 marketId) external view returns (bool);

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
    ) external payable;

    /**
     * @notice Returns the current protocol fee in basis points.
     * @return The protocol fee in basis points (e.g., 100 for 1%).
     */
    function protocolFeeBasisPoints() external view returns (uint256);
}

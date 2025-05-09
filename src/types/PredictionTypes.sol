// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title PredictionTypes
 * @notice Contains type definitions for the SwapCast prediction system
 * @author SwapCast Team
 */
contract PredictionTypes {
    /**
     * @notice Enum representing possible prediction outcomes
     * @dev Bearish (0) = price will go down, Bullish (1) = price will go up
     */
    enum Outcome {
        Bearish,
        Bullish
    }
}

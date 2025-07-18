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
        Bullish,
        Undetermined
    }

    error InvalidMarketId();
    error InvalidAssetSymbol();
    error InvalidMarketName();
    error InvalidPriceAggregator(); // Added this line
    error ValueMismatch(); // For when msg.value != declared conviction stake
    error PriceAtThreshold(); // Added this line
    error InvalidPriceData(); // For when oracle returns invalid price (zero or negative)
}

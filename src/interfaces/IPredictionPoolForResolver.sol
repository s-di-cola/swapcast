// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PredictionTypes} from "../types/PredictionTypes.sol";

/**
 * @title IPredictionPoolForResolver
 * @author SwapCast Developers
 * @notice Interface for the PredictionPool, specifically for functions called by the OracleResolver.
 */
interface IPredictionPoolForResolver {
    // --- Events ---
    /**
     * @notice Emitted when a market is resolved.
     * @param marketId The ID of the market resolved.
     * @param winningOutcome The determined winning outcome (Bearish or Bullish).
     * @param price The oracle price at the time of resolution.
     * @param totalPrizePool The total prize pool distributed for this market.
     */
    event MarketResolved(
        uint256 indexed marketId, PredictionTypes.Outcome winningOutcome, int256 price, uint256 totalPrizePool
    );

    // --- Errors ---
    // Custom errors relevant to these interactions would be defined in the PredictionPool implementation.
    // Example: error MarketAlreadyResolved(uint256 marketId);
    // Example: error InvalidWinningOutcome(PredictionTypes.Outcome outcome);

    // --- Functions ---
    /**
     * @notice Called by the OracleResolver to resolve a market and set its winning outcome.
     * @param marketId The ID of the market to resolve.
     * @param winningOutcome The determined winning outcome (Bearish or Bullish).
     * @param oraclePrice The price reported by the oracle at the time of resolution.
     * @dev The PredictionPool will update the market's state to resolved and store the winning outcome.
     *      It should ensure the market exists and is not already resolved.
     */
    function resolveMarket(uint256 marketId, PredictionTypes.Outcome winningOutcome, int256 oraclePrice) external;
}

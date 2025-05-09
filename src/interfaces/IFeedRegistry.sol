// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IFeedRegistry
 * @notice Interface for Chainlink's Feed Registry
 * @dev This is a simplified version of Chainlink's FeedRegistryInterface for use in the SwapCast system
 */
interface IFeedRegistry {
    /**
     * @notice Returns the address of the aggregator for a given base/quote pair
     * @param base The base asset address (e.g., ETH)
     * @param quote The quote asset address (e.g., USD)
     * @return aggregator The address of the price feed aggregator
     */
    function getFeed(address base, address quote) external view returns (address aggregator);

    /**
     * @notice Returns the latest round data for a given base/quote pair
     * @param base The base asset address (e.g., ETH)
     * @param quote The quote asset address (e.g., USD)
     * @return roundId The round ID
     * @return answer The price answer
     * @return startedAt When the round started
     * @return updatedAt When the round was updated
     * @return answeredInRound The round in which the answer was computed
     */
    function latestRoundData(address base, address quote)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

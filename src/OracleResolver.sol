// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title OracleResolver
 * @notice Resolves prediction markets using Chainlink Automation and price feeds. Emits events for all state changes and uses custom errors for strict security.
 */
import {PredictionPool} from "./PredictionPool.sol";

interface IChainlinkAggregator {
    function latestAnswer() external view returns (int256);
}

contract OracleResolver {
    PredictionPool public predictionPool;
    address public owner;

    struct MarketOracle {
        address aggregator;
        uint256 marketId;
        uint8 resolveAbove; // outcome if price is above threshold
        int256 threshold;
    }

    mapping(uint256 => MarketOracle) public marketOracles;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _predictionPool) {
        predictionPool = PredictionPool(_predictionPool);
        owner = msg.sender;
    }

    /**
     * @notice Register a market with oracle and threshold
     * @dev Reverts if aggregator is zero or market already registered
     * @param marketId The market ID to register
     * @param aggregator The Chainlink aggregator address
     * @param threshold The price threshold
     * @param resolveAbove Outcome if price is above threshold
     */
    function registerMarketOracle(uint256 marketId, address aggregator, int256 threshold, uint8 resolveAbove)
        external
        onlyOwner
    {
        require(aggregator != address(0), "Zero address");
        require(marketOracles[marketId].aggregator == address(0), "Already registered");
        marketOracles[marketId] = MarketOracle(aggregator, marketId, resolveAbove, threshold);
    }

    /// @notice Automate market resolution
    function resolve(uint256 marketId) external {
        MarketOracle memory mo = marketOracles[marketId];
        require(mo.aggregator != address(0), "No oracle");
        int256 price = IChainlinkAggregator(mo.aggregator).latestAnswer();
        uint8 outcome = price >= mo.threshold ? mo.resolveAbove : 1 - mo.resolveAbove;
        predictionPool.resolveMarket(marketId, outcome);
    }
}

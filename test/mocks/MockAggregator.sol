// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    int256 public answer;
    uint256 public updatedAtTimestamp;
    uint256 public startedAtTimestamp;
    uint80 public roundId;
    uint80 public answeredInRound;

    constructor() {
        answer = 2000 * 1e8;
        updatedAtTimestamp = block.timestamp;
        startedAtTimestamp = block.timestamp;
        roundId = 1;
        answeredInRound = 1;
    }

    function setLatestAnswer(int256 _answer) external {
        answer = _answer;
        updatedAtTimestamp = block.timestamp;
    }

    function setUpdatedAt(uint256 _updatedAt) external {
        updatedAtTimestamp = _updatedAt;
    }

    function setLatestRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) external {
        roundId = _roundId;
        answer = _answer;
        startedAtTimestamp = _startedAt;
        updatedAtTimestamp = _updatedAt;
        answeredInRound = _answeredInRound;
    }

    function decimals() external pure override returns (uint8) {
        return 8;
    }

    function description() external pure override returns (string memory) {
        return "Mock ETH/USD Aggregator";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 /*_roundId*/ )
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, startedAtTimestamp, updatedAtTimestamp, answeredInRound);
    }

    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, startedAtTimestamp, updatedAtTimestamp, answeredInRound);
    }
}

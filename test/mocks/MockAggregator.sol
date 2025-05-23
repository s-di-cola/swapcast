// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    mapping(uint80 => RoundData) public rounds;
    uint80 public latestRoundId;

    constructor() {
        // Initialize with default values for round 1
        latestRoundId = 1;
        rounds[1] = RoundData({
            roundId: 1,
            answer: 2000 * 1e8,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            answeredInRound: 1
        });
    }

    function setLatestAnswer(int256 _answer) external {
        RoundData storage round = rounds[latestRoundId];
        round.answer = _answer;
        round.updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 _updatedAt) external {
        rounds[latestRoundId].updatedAt = _updatedAt;
    }

    function setLatestRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) external {
        if (_roundId > 0) {
            latestRoundId = _roundId;
            rounds[latestRoundId] = RoundData({
                roundId: latestRoundId,
                answer: _answer,
                startedAt: _startedAt,
                updatedAt: _updatedAt,
                answeredInRound: _answeredInRound
            });
        } else {
            // For roundId = 0, set up an invalid round
            latestRoundId = 0;
            rounds[0] = RoundData({
                roundId: 0,
                answer: _answer,
                startedAt: _startedAt,
                updatedAt: _updatedAt,
                answeredInRound: _answeredInRound
            });
        }
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

    function getRoundData(uint80 _roundId) external view override returns (uint80, int256, uint256, uint256, uint80) {
        RoundData memory round = rounds[_roundId];
        return (round.roundId, round.answer, round.startedAt, round.updatedAt, round.answeredInRound);
    }

    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        RoundData memory round = rounds[latestRoundId];
        // If the latest round ID is 0, it's an invalid round
        if (round.roundId == 0) {
            return (0, 0, 0, 0, 0);
        }
        return (round.roundId, round.answer, round.startedAt, round.updatedAt, round.answeredInRound);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPredictionManagerForResolver} from "src/interfaces/IPredictionManagerForResolver.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";

contract MockPredictionManager is IPredictionManagerForResolver {
    mapping(address => uint256) public resolveMarketCallCounts;
    uint256 public resolveMarketCallCount;
    bool public shouldRevertResolveMarket;

    function resolveMarket(uint256, PredictionTypes.Outcome, int256) external override {
        resolveMarketCallCounts[msg.sender]++;
        resolveMarketCallCount++;
        if (shouldRevertResolveMarket) {
            revert("MockPredictionManager: ResolveMarket reverted as instructed");
        }
    }

    function setShouldRevertResolveMarket(bool _shouldRevert) external {
        shouldRevertResolveMarket = _shouldRevert;
    }
}

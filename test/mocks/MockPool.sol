// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PredictionPool} from "../../src/PredictionPool.sol";

contract MockPool is PredictionPool {
    PredictionPool.Market private _market;

    constructor(address _nft) PredictionPool(_nft) {}

    function setTestData(PredictionPool.Market memory market) public {
        _market = market;
    }

    function markets(uint256) public view override returns (PredictionPool.Market memory) {
        return _market;
    }
    // For OracleResolver tests

    function resolveMarket(uint256 marketId, uint8 outcome) public override {
        emit MarketResolved(marketId, outcome);
    }
}

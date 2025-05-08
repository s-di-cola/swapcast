// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PredictionPool} from "../../src/PredictionPool.sol";

contract MockPool is PredictionPool {
    PredictionPool.Market private _market;

    constructor(
        address _swapCastNFTAddress,
        address _treasuryAddress,
        uint256 _initialFeeBasisPoints,
        address _initialOwner,
        address _oracleResolverAddress,
        address _rewardDistributorAddress
    ) PredictionPool(_swapCastNFTAddress, _treasuryAddress, _initialFeeBasisPoints, _initialOwner, _oracleResolverAddress, _rewardDistributorAddress) {}

    function setTestData(
        uint256 marketId,
        bool exists,
        bool resolved,
        uint8 winningOutcome,
        uint256 totalConvictionStakeOutcome0,
        uint256 totalConvictionStakeOutcome1
    ) public {
        _market.marketId = marketId;
        _market.exists = exists;
        _market.resolved = resolved;
        _market.winningOutcome = winningOutcome;
        _market.totalConvictionStakeOutcome0 = totalConvictionStakeOutcome0;
        _market.totalConvictionStakeOutcome1 = totalConvictionStakeOutcome1;
        // Note: userPredictionCount mapping is not set here
    }

    // function markets(uint256) public view override returns (PredictionPool.Market memory) {
    //     return _market;
    // } // This conflicts with the public 'markets' state variable getter from PredictionPool

    // For OracleResolver tests

    function resolveMarket(uint256 marketId, uint8 outcome) public override {
        emit MarketResolved(marketId, outcome, 0); // Added 0 for price
    }
}

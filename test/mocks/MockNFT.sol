// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SwapCastNFT} from "../../src/SwapCastNFT.sol";

contract MockNFT is SwapCastNFT {
    address private _holder;
    SwapCastNFT.Metadata private _meta;

    constructor() SwapCastNFT(address(0)) {}

    // For RewardDistributor/PredictionPool tests
    function setTestData(address holder, SwapCastNFT.Metadata memory meta) public {
        _holder = holder;
        _meta = meta;
    }

    function ownerOf(uint256) public view override returns (address) {
        return _holder;
    }

    function tokenMetadata(uint256) public view override returns (SwapCastNFT.Metadata memory) {
        return _meta;
    }
    // For SwapCastHook tests

    function setPredictionPool(address pool) external {
        predictionPool = pool;
    }
    // For PredictionPool tests, override mint as no-op

    function mint(address, uint256, uint8, uint256) public override {}
}

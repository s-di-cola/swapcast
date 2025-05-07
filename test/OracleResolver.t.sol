// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IChainlinkAggregator {
    function latestAnswer() external view returns (int256);
}

event MarketResolved(uint256 indexed marketId, uint8 outcome);

import "forge-std/Test.sol";
import {OracleResolver} from "src/OracleResolver.sol";
import {PredictionPool} from "src/PredictionPool.sol";

contract MockAggregator is IChainlinkAggregator {
    int256 public answer;

    function setLatestAnswer(int256 _ans) external {
        answer = _ans;
    }

    function latestAnswer() external view override returns (int256) {
        return answer;
    }
}

import {SwapCastNFT} from "src/SwapCastNFT.sol";

contract TestableSwapCastNFT is SwapCastNFT {
    constructor(address _predictionPool) SwapCastNFT(_predictionPool) {}

    function setPredictionPool(address _pool) public {
        predictionPool = _pool;
    }
}

import {MockPool} from "./mocks/MockPool.sol";

contract OracleResolverTest is Test {
    OracleResolver resolver;
    MockAggregator aggregator;
    MockPool pool;
    uint256 marketId = 1;

    function setUp() public {
        TestableSwapCastNFT nft = new TestableSwapCastNFT(address(0));
        pool = new MockPool(address(nft));
        nft.setPredictionPool(address(pool));
        resolver = new OracleResolver(address(pool));
        aggregator = new MockAggregator();
        pool.setTestData(PredictionPool.Market(1, "desc", 0, true, 1));
        resolver.registerMarketOracle(marketId, address(aggregator), 100, 1);
    }

    /// @notice Test that only owner can register market oracle
    function testOnlyOwnerCanRegister() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("Not owner");
        resolver.registerMarketOracle(2, address(aggregator), 100, 1);
    }

    /// @notice Test that registering with zero address aggregator reverts
    function testRegisterZeroAddressAggregatorReverts() public {
        vm.expectRevert("Zero address");
        resolver.registerMarketOracle(2, address(0), 100, 1);
    }

    /// @notice Test that duplicate registration reverts
    function testDuplicateRegistrationReverts() public {
        vm.expectRevert("Already registered");
        resolver.registerMarketOracle(marketId, address(aggregator), 100, 1);
    }

    /// @notice Test that resolving above threshold emits MarketResolved event
    function testResolveAboveThreshold() public {
        aggregator.setLatestAnswer(150);
        vm.expectEmit(true, false, false, true);
        emit MarketResolved(marketId, 1);
        resolver.resolve(marketId);
    }

    /// @notice Test that resolving without oracle reverts with custom error
    function testResolveWithoutOracleReverts() public {
        OracleResolver newResolver = new OracleResolver(address(pool));
        vm.expectRevert("No oracle");
        newResolver.resolve(marketId);
    }

    /// @notice Test that resolving below threshold emits MarketResolved event
    function testResolveBelowThreshold() public {
        aggregator.setLatestAnswer(50);
        vm.expectEmit(true, false, false, true);
        emit MarketResolved(marketId, 0);

        resolver.resolve(marketId);
    }
}

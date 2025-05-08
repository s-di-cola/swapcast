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
    address public predictionPool;

    constructor(address _initialOwner, string memory _name, string memory _symbol) SwapCastNFT(_initialOwner, _name, _symbol) {}

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
        TestableSwapCastNFT nft = new TestableSwapCastNFT(address(this), "TestNFT", "TNFT");
        pool = new MockPool(address(nft), address(0x12345), 100, address(this));
        nft.setPredictionPool(address(pool));
        resolver = new OracleResolver(address(pool), address(this));
        aggregator = new MockAggregator();
        pool.setTestData(marketId, true, false, 0, 100 * 10**18, 50 * 10**18);
        resolver.registerOracle(marketId, address(aggregator), 100);
    }

    /// @notice Test that only owner can register market oracle
    function testOnlyOwnerCanRegister() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        resolver.registerOracle(2, address(aggregator), 100);
    }

    /// @notice Test that registering with zero address aggregator reverts
    function testRegisterZeroAddressAggregatorReverts() public {
        vm.expectRevert(OracleResolver.InvalidAggregatorAddress.selector);
        resolver.registerOracle(2, address(0), 100);
    }

    /// @notice Test that duplicate registration reverts
    function testDuplicateRegistrationReverts() public {
        vm.expectRevert(OracleResolver.OracleAlreadyRegistered.selector);
        resolver.registerOracle(marketId, address(aggregator), 100);
    }

    /// @notice Test that resolving above threshold emits MarketResolved event
    function testResolveAboveThreshold() public {
        aggregator.setLatestAnswer(150);
        vm.expectEmit(true, false, false, true);
        emit MarketResolved(marketId, 1);
        resolver.resolveMarket(marketId);
    }

    /// @notice Test that resolving without oracle reverts with custom error
    function testResolveWithoutOracleReverts() public {
        OracleResolver newResolver = new OracleResolver(address(pool), address(this));
        vm.expectRevert(OracleResolver.OracleNotRegistered.selector);
        newResolver.resolveMarket(marketId);
    }

    /// @notice Test that resolving below threshold emits MarketResolved event
    function testResolveBelowThreshold() public {
        aggregator.setLatestAnswer(50);
        vm.expectEmit(true, false, false, true);
        emit MarketResolved(marketId, 0);

        resolver.resolveMarket(marketId);
    }
}

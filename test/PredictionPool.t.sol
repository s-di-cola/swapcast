// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/PredictionPool.sol";

import {MockNFT} from "./mocks/MockNFT.sol";

contract PredictionPoolTest is Test {
    PredictionPool pool;
    MockNFT nft;

    function setUp() public {
        nft = new MockNFT();
        pool = new PredictionPool(address(nft));
    }

    /// @notice Test that market creation emits the correct event and stores correct data
    function testCreateMarket() public {
        uint256 endTime = block.timestamp + 1 days;
        vm.expectEmit(true, false, false, true);
        emit PredictionPool.MarketCreated(0, "Test Market", endTime);
        uint256 marketId = pool.createMarket("Test Market", endTime);
        PredictionPool.Market memory market = pool.markets(marketId);
        uint256 storedEndTime = market.endTime;
        assertEq(storedEndTime, endTime);
    }

    /// @notice Test that recording a prediction emits the correct event and stores data
    function testRecordPrediction() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        vm.expectEmit(true, true, false, true);
        emit PredictionPool.PredictionRecorded(address(1), marketId, 0, 100);
        pool.recordPrediction(address(1), marketId, 0, 100);
        (address user,,,,) = pool.positionsByMarket(marketId, 0);
        assertEq(user, address(1));
    }

    /// @notice Test that recording after market end reverts with custom error
    function testCannotRecordAfterEnd() public {
        uint256 endTime = block.timestamp + 1;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        vm.warp(endTime + 1);
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.MarketClosed.selector, marketId));
        pool.recordPrediction(address(1), marketId, 0, 100);
    }

    /// @notice Test that creating a market with zero address NFT reverts
    function testCreateMarketZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.InvalidNFT.selector, address(0)));
        new PredictionPool(address(0));
    }

    /// @notice Test that duplicate predictions revert
    function testDuplicatePredictionReverts() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        pool.recordPrediction(address(1), marketId, 0, 100);
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.AlreadyPredicted.selector, address(1), marketId));
        pool.recordPrediction(address(1), marketId, 0, 200);
    }

    /// @notice Test that prediction with invalid outcome reverts
    function testInvalidOutcomeReverts() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.InvalidOutcome.selector, 3));
        pool.recordPrediction(address(1), marketId, 3, 100);
    }

    /// @notice Test that zero address cannot record prediction
    function testZeroAddressPredictionReverts() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.InvalidNFT.selector, address(0)));
        pool.recordPrediction(address(0), marketId, 0, 100);
    }

    function testResolveMarket() public {
        uint256 endTime = block.timestamp + 1;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);
        PredictionPool.Market memory market = pool.markets(marketId);
        bool resolved = market.resolved;
        uint8 outcome = market.outcome;
        assertTrue(resolved);
        assertEq(outcome, 1);
    }

    function testGetOdds() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("Test Market", endTime);
        pool.recordPrediction(address(1), marketId, 0, 50);
        pool.recordPrediction(address(2), marketId, 1, 150);
        uint256 odds0 = pool.getOdds(marketId, 0);
        uint256 odds1 = pool.getOdds(marketId, 1);
        assertEq(odds0, 25e16); // 50/200 = 0.25
        assertEq(odds1, 75e16); // 150/200 = 0.75
    }
}

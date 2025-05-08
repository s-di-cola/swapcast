// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "src/RewardDistributor.sol";

import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {PredictionPool} from "src/PredictionPool.sol";

contract TestableSwapCastNFT is SwapCastNFT {

    address public predictionPool;

    constructor(address _predictionPool) SwapCastNFT(_predictionPool) {}

    function setPredictionPool(address _pool) public {
        predictionPool = _pool;
    }
}


contract RewardDistributorTest is Test {
    RewardDistributor distributor;
    TestableSwapCastNFT nft;
    PredictionPool pool;
    address user = address(0x123);

    function setUp() public {
        nft = new TestableSwapCastNFT(address(0));
        pool = new PredictionPool(address(nft));
        nft.setPredictionPool(address(pool));
        distributor = new RewardDistributor(address(pool), address(nft));
        // Create a market and mint an NFT to user via the pool
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 1, 10);
        // Do not resolve here; resolve in test after time passes if needed
        vm.deal(address(distributor), 1 ether);
    }

    /// @notice Test that claiming a reward emits the correct event and sets claimed
    function testClaimReward() public {
        // Advance time past endTime
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 1, 10);
        uint256 tokenId = marketId;
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);
        vm.expectEmit(true, true, false, true);
        emit RewardDistributor.RewardClaimed(user, tokenId, 1e16);
        vm.prank(user);
        distributor.claim(tokenId);
        // Check claimed flag
        assertTrue(distributor.claimed(tokenId));
    }

    /// @notice Test that double claiming reverts with custom error
    function testDoubleClaimReverts() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 1, 10);
        uint256 tokenId = marketId;
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);
        vm.prank(user);
        distributor.claim(tokenId);
        vm.prank(user);
        vm.expectRevert("Already claimed");
        distributor.claim(tokenId);
    }

    /// @notice Test that only the NFT holder can claim
    function testNonHolderCannotClaim() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 1, 10);
        uint256 tokenId = marketId;
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);
        vm.prank(address(0x456));
        vm.expectRevert("Not NFT holder");
        distributor.claim(tokenId);
    }

    /// @notice Test that cannot claim if market is unresolved
    function testCannotClaimUnresolvedMarket() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 1, 10);
        uint256 tokenId = marketId;
        // Do not resolve the market, keep it unresolved
        vm.prank(user);
        vm.expectRevert("Market not resolved");
        distributor.claim(tokenId);
    }

    /// @notice Test that cannot claim if outcome is wrong
    function testCannotClaimWrongOutcome() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 0, 10);
        uint256 tokenId = marketId;
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);
        vm.prank(user);
        vm.expectRevert("Not winning outcome");
        distributor.claim(tokenId);
    }

    /// @notice Test that zero address cannot claim
    function testZeroAddressCannotClaim() public {
        vm.prank(address(0));
        vm.expectRevert("Zero address");
        distributor.claim(0);
    }

    function testOnlyNFTHolderCanClaim() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("Not NFT holder");
        distributor.claim(0);
    }

    function testMustBeWinningOutcome() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 0, 10);
        uint256 tokenId = marketId;
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);
        vm.prank(user);
        vm.expectRevert("Not winning outcome");
        distributor.claim(tokenId);
    }

    function testMarketMustBeResolved() public {
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("desc", endTime);
        pool.recordPrediction(user, marketId, 1, 10);
        uint256 tokenId = marketId;
        // Do not resolve the market, keep it unresolved
        vm.prank(user);
        vm.expectRevert("Market not resolved");
        distributor.claim(tokenId);
    }
}

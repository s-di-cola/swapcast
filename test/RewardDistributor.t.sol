// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/RewardDistributor.sol";

contract MockNFT is SwapCastNFT {
    address private _holder;
    Metadata private _meta;

    constructor() SwapCastNFT(address(0)) {}

    function setTestData(address holder, Metadata memory meta) public {
        _holder = holder;
        _meta = meta;
    }

    function ownerOf(uint256) public view override returns (address) {
        return _holder;
    }

    function tokenMetadata(uint256) public view override returns (Metadata memory) {
        return _meta;
    }
}

contract MockPool is PredictionPool {
    Market private _market;

    constructor(address _nft) PredictionPool(_nft) {}

    function setTestData(Market memory market) public {
        _market = market;
    }

    function markets(uint256) public view override returns (Market memory) {
        return _market;
    }
}

contract RewardDistributorTest is Test {
    RewardDistributor distributor;
    MockNFT nft;
    MockPool pool;
    address user = address(0x123);

    function setUp() public {
        nft = new MockNFT();
        pool = new MockPool(address(nft));
        distributor = new RewardDistributor(address(pool), address(nft));
        nft.setTestData(user, SwapCastNFT.Metadata(1, 2, 10));
        pool.setTestData(PredictionPool.Market(0, "desc", 0, true, 2));
        vm.deal(address(distributor), 1 ether);
    }

    /// @notice Test that claiming a reward emits the correct event and sets claimed
    function testClaimReward() public {
        vm.expectEmit(true, true, false, true);
        emit RewardDistributor.RewardClaimed(user, 0, 1e16);
        vm.prank(user);
        distributor.claim(0);
        // Check claimed flag
        assertTrue(distributor.claimed(0));
    }

    /// @notice Test that double claiming reverts with custom error
    function testDoubleClaimReverts() public {
        vm.prank(user);
        distributor.claim(0);
        vm.prank(user);
        vm.expectRevert("Already claimed");
        distributor.claim(0);
    }

    /// @notice Test that only the NFT holder can claim
    function testNonHolderCannotClaim() public {
        vm.prank(address(0x456));
        vm.expectRevert("Not NFT holder");
        distributor.claim(0);
    }

    /// @notice Test that cannot claim if market is unresolved
    function testCannotClaimUnresolvedMarket() public {
        pool.setTestData(PredictionPool.Market(0, "desc", 0, false, 2));
        vm.prank(user);
        vm.expectRevert("Market not resolved");
        distributor.claim(0);
    }

    /// @notice Test that cannot claim if outcome is wrong
    function testCannotClaimWrongOutcome() public {
        pool.setTestData(PredictionPool.Market(0, "desc", 0, true, 1));
        vm.prank(user);
        vm.expectRevert("Not winning outcome");
        distributor.claim(0);
    }

    /// @notice Test that zero address cannot claim
    function testZeroAddressCannotClaim() public {
        nft.setTestData(address(0), SwapCastNFT.Metadata(1, 2, 10));
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
        pool.setTestData(PredictionPool.Market(0, "desc", 0, true, 0));
        vm.prank(user);
        vm.expectRevert("Not winning outcome");
        distributor.claim(0);
    }

    function testMarketMustBeResolved() public {
        pool.setTestData(PredictionPool.Market(0, "desc", 0, false, 2));
        vm.prank(user);
        vm.expectRevert("Market not resolved");
        distributor.claim(0);
    }
}

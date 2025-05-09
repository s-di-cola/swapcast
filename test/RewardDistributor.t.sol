// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";
import {MockPredictionPoolForDistributor} from "./mocks/MockPredictionPoolForDistributor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RewardDistributorTest is Test {
    RewardDistributor distributor;
    MockPredictionPoolForDistributor mockPool;

    address owner = address(this);
    address user = address(0x123);
    address nonOwner = address(0x456);

    function setUp() public {
        mockPool = new MockPredictionPoolForDistributor();
        distributor = new RewardDistributor(owner, address(mockPool));
    }

    // --- Constructor Tests ---

    function test_Constructor_SetsPredictionPool() public view {
        assertEq(
            address(distributor.predictionPool()),
            address(mockPool),
            "PredictionPool address not set correctly in constructor"
        );
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(distributor.owner(), owner, "Owner not set correctly in constructor");
    }

    function test_Constructor_RevertsIfPredictionPoolIsZeroAddress() public {
        vm.expectRevert(RewardDistributor.ZeroAddress.selector);
        new RewardDistributor(owner, address(0));
    }

    function test_Constructor_EmitsPredictionPoolAddressSet() public {
        vm.expectEmit(true, true, true, true); // Check all: from, to, old, new
        emit RewardDistributor.PredictionPoolAddressSet(address(0), address(mockPool));
        // Re-deploy within the test to capture its specific emission
        new RewardDistributor(owner, address(mockPool));
    }

    // --- setPredictionPoolAddress Tests ---

    function test_SetPredictionPoolAddress_UpdatesAddress() public {
        MockPredictionPoolForDistributor newMockPool = new MockPredictionPoolForDistributor();
        vm.prank(owner);
        distributor.setPredictionPoolAddress(address(newMockPool));
        assertEq(address(distributor.predictionPool()), address(newMockPool), "PredictionPool address not updated");
    }

    function test_SetPredictionPoolAddress_EmitsEvent() public {
        MockPredictionPoolForDistributor newMockPool = new MockPredictionPoolForDistributor();
        address oldPoolAddress = address(mockPool);

        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit RewardDistributor.PredictionPoolAddressSet(oldPoolAddress, address(newMockPool));
        distributor.setPredictionPoolAddress(address(newMockPool));
    }

    function test_SetPredictionPoolAddress_RevertsIfNewAddressIsZero() public {
        vm.prank(owner);
        vm.expectRevert(RewardDistributor.ZeroAddress.selector);
        distributor.setPredictionPoolAddress(address(0));
    }

    function test_SetPredictionPoolAddress_RevertsIfNotOwner() public {
        MockPredictionPoolForDistributor newMockPool = new MockPredictionPoolForDistributor();
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        distributor.setPredictionPoolAddress(address(newMockPool));
    }

    // --- claimReward Tests ---

    function test_ClaimReward_CallsPredictionPool() public {
        uint256 tokenIdToClaim = 1;

        // Sanity check: ensure mockPool hasn't been called yet
        assertFalse(mockPool.claimRewardCalled(), "MockPool claimRewardCalled should be false initially");

        // No vm.prank needed as claimReward in RewardDistributor is public
        distributor.claimReward(tokenIdToClaim);

        assertTrue(mockPool.claimRewardCalled(), "PredictionPool.claimReward was not called");
        assertEq(mockPool.lastTokenIdClaimed(), tokenIdToClaim, "TokenId passed to PredictionPool was incorrect");
        // Check that the RewardDistributor contract itself was the caller to the mock pool
        assertEq(mockPool.callerOfClaimReward(), address(distributor), "Caller to mock pool was not RewardDistributor");
    }

    function test_ClaimReward_RevertsWithClaimFailedInPool_IfPoolReverts() public {
        uint256 tokenIdToClaim = 2;
        mockPool.setShouldRevertOnClaim(true);

        vm.expectRevert(RewardDistributor.ClaimFailedInPool.selector);
        distributor.claimReward(tokenIdToClaim);
    }
}

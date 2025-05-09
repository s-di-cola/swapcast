// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";
import {MockPredictionManagerForDistributor} from "./mocks/MockPredictionPoolForDistributor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RewardDistributorTest is Test {
    RewardDistributor distributor;
    MockPredictionManagerForDistributor mockPool;

    address owner = address(this);
    address user = address(0x123);
    address nonOwner = address(0x456);

    function setUp() public {
        mockPool = new MockPredictionManagerForDistributor();
        distributor = new RewardDistributor(owner, address(mockPool));
    }

    // --- Constructor Tests ---

    function test_Constructor_SetsPredictionManager() public view {
        assertEq(
            address(distributor.predictionManager()),
            address(mockPool),
            "PredictionManager address not set correctly in constructor"
        );
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(distributor.owner(), owner, "Owner not set correctly in constructor");
    }

    function test_Constructor_RevertsIfPredictionManagerIsZeroAddress() public {
        vm.expectRevert(RewardDistributor.ZeroAddress.selector);
        new RewardDistributor(owner, address(0));
    }

    function test_Constructor_EmitsPredictionManagerAddressSet() public {
        vm.expectEmit(true, true, true, true); // Check all: from, to, old, new
        emit RewardDistributor.PredictionManagerAddressSet(address(0), address(mockPool));
        // Re-deploy within the test to capture its specific emission
        new RewardDistributor(owner, address(mockPool));
    }

    // --- setPredictionManagerAddress Tests ---

    function test_SetPredictionManagerAddress_UpdatesAddress() public {
        MockPredictionManagerForDistributor newMockPool = new MockPredictionManagerForDistributor();
        vm.prank(owner);
        distributor.setPredictionManagerAddress(address(newMockPool));
        assertEq(
            address(distributor.predictionManager()), address(newMockPool), "PredictionManager address not updated"
        );
    }

    function test_SetPredictionManagerAddress_EmitsEvent() public {
        MockPredictionManagerForDistributor newMockPool = new MockPredictionManagerForDistributor();
        address oldPoolAddress = address(mockPool);

        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit RewardDistributor.PredictionManagerAddressSet(oldPoolAddress, address(newMockPool));
        distributor.setPredictionManagerAddress(address(newMockPool));
    }

    function test_SetPredictionManagerAddress_RevertsIfNewAddressIsZero() public {
        vm.prank(owner);
        vm.expectRevert(RewardDistributor.ZeroAddress.selector);
        distributor.setPredictionManagerAddress(address(0));
    }

    function test_SetPredictionManagerAddress_RevertsIfNotOwner() public {
        MockPredictionManagerForDistributor newMockPool = new MockPredictionManagerForDistributor();
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        distributor.setPredictionManagerAddress(address(newMockPool));
    }

    // --- claimReward Tests ---

    function test_ClaimReward_CallsPredictionManager() public {
        uint256 tokenIdToClaim = 1;

        // Sanity check: ensure mockPool hasn't been called yet
        assertFalse(mockPool.claimRewardCalled(), "MockPool claimRewardCalled should be false initially");

        // No vm.prank needed as claimReward in RewardDistributor is public
        distributor.claimReward(tokenIdToClaim);

        assertTrue(mockPool.claimRewardCalled(), "PredictionManager.claimReward was not called");
        assertEq(mockPool.lastTokenIdClaimed(), tokenIdToClaim, "TokenId passed to PredictionManager was incorrect");
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

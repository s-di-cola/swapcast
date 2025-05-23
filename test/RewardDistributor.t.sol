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

    /// @notice Sets up the test environment for RewardDistributor tests.
    function setUp() public {
        mockPool = new MockPredictionManagerForDistributor();
        distributor = new RewardDistributor(owner, address(mockPool));
    }

    // --- Constructor Tests ---

    /// @notice Tests that the constructor sets the PredictionManager address correctly.
    function test_constructor_sets_prediction_manager() public view {
        assertEq(
            address(distributor.predictionManager()),
            address(mockPool),
            "PredictionManager address not set correctly in constructor"
        );
    }

    /// @notice Tests that the constructor sets the owner correctly.
    function test_constructor_sets_owner() public view {
        assertEq(distributor.owner(), owner, "Owner not set correctly in constructor");
    }

    /// @notice Tests that the constructor reverts if the PredictionManager address is zero.
    function test_constructor_reverts_if_prediction_manager_is_zero_address() public {
        vm.expectRevert(RewardDistributor.ZeroAddress.selector);
        new RewardDistributor(owner, address(0));
    }

    /// @notice Tests that the constructor emits the PredictionManagerAddressSet event.
    function test_constructor_emits_prediction_manager_address_set() public {
        vm.expectEmit(true, true, true, true); // Check all: from, to, old, new
        emit RewardDistributor.PredictionManagerAddressSet(address(0), address(mockPool));
        // Re-deploy within the test to capture its specific emission
        new RewardDistributor(owner, address(mockPool));
    }

    // --- setPredictionManagerAddress Tests ---

    /// @notice Tests that setPredictionManagerAddress updates the address correctly.
    function test_set_prediction_manager_address_updates_address() public {
        MockPredictionManagerForDistributor newMockPool = new MockPredictionManagerForDistributor();
        vm.prank(owner);
        distributor.setPredictionManagerAddress(address(newMockPool));
        assertEq(
            address(distributor.predictionManager()), address(newMockPool), "PredictionManager address not updated"
        );
    }

    /// @notice Tests that setPredictionManagerAddress emits the correct event.
    function test_set_prediction_manager_address_emits_event() public {
        MockPredictionManagerForDistributor newMockPool = new MockPredictionManagerForDistributor();
        address oldPoolAddress = address(mockPool);

        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit RewardDistributor.PredictionManagerAddressSet(oldPoolAddress, address(newMockPool));
        distributor.setPredictionManagerAddress(address(newMockPool));
    }

    /// @notice Tests that setPredictionManagerAddress reverts if the new address is zero.
    function test_set_prediction_manager_address_reverts_if_new_address_is_zero() public {
        vm.prank(owner);
        vm.expectRevert(RewardDistributor.ZeroAddress.selector);
        distributor.setPredictionManagerAddress(address(0));
    }

    /// @notice Tests that only the owner can call setPredictionManagerAddress.
    function test_set_prediction_manager_address_reverts_if_not_owner() public {
        MockPredictionManagerForDistributor newMockPool = new MockPredictionManagerForDistributor();
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        distributor.setPredictionManagerAddress(address(newMockPool));
    }

    // --- claimReward Tests ---

    /// @notice Tests that claimReward calls the PredictionManager and passes the correct tokenId.
    function test_claim_reward_calls_prediction_manager() public {
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

    /// @notice Tests that claimReward reverts with ClaimFailedInPool if the PredictionManager call fails.
    function test_claim_reward_reverts_with_claim_failed_in_pool_if_pool_reverts() public {
        uint256 tokenIdToClaim = 2;
        mockPool.setShouldRevertOnClaim(true);

        vm.expectRevert(RewardDistributor.ClaimFailedInPool.selector);
        distributor.claimReward(tokenIdToClaim);
    }
}

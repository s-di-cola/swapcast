// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPredictionManagerForDistributor} from "src/interfaces/IPredictionManagerForDistributor.sol";

/**
 * @title MockPredictionManagerForDistributor
 * @dev Mock contract for testing RewardDistributor
 */
contract MockPredictionManagerForDistributor is IPredictionManagerForDistributor {
    bool public claimRewardCalled;
    uint256 public lastTokenIdClaimed;
    bool public shouldRevertOnClaim;
    address public callerOfClaimReward;

    event ClaimRewardAttempted(uint256 tokenId, address caller);

    /// @notice Sets whether the claimReward function should revert
    /// @param _shouldRevert If true, claimReward will revert
    function setShouldRevertOnClaim(bool _shouldRevert) external {
        shouldRevertOnClaim = _shouldRevert;
    }

    /// @notice Mock implementation of claimReward
    /// @dev This will either succeed or revert based on shouldRevertOnClaim
    /// @param tokenId The ID of the token to claim rewards for
    function claimReward(uint256 tokenId) external override {
        // Store the caller for verification in tests
        callerOfClaimReward = msg.sender;
        claimRewardCalled = true;
        lastTokenIdClaimed = tokenId;

        emit ClaimRewardAttempted(tokenId, msg.sender);

        // Revert if configured to do so
        if (shouldRevertOnClaim) {
            revert("MockPredictionManager: ClaimReward reverted as instructed");
        }

        // In a real scenario, this is where the reward would be transferred
        // For the mock, we just record the successful call
    }

    // Helper to reset state for subsequent tests
    function reset() external {
        claimRewardCalled = false;
        lastTokenIdClaimed = 0;
        shouldRevertOnClaim = false;
        callerOfClaimReward = address(0);
    }
}

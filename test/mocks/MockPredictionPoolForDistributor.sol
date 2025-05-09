// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPredictionManagerForDistributor} from "src/interfaces/IPredictionManagerForDistributor.sol";

contract MockPredictionManagerForDistributor is IPredictionManagerForDistributor {
    bool public claimRewardCalled;
    uint256 public lastTokenIdClaimed;
    bool public shouldRevertOnClaim;
    address public callerOfClaimReward;

    event ClaimRewardAttempted(uint256 tokenId, address caller);

    function setShouldRevertOnClaim(bool _shouldRevert) external {
        shouldRevertOnClaim = _shouldRevert;
    }

    function claimReward(uint256 tokenId) external override {
        callerOfClaimReward = msg.sender; // Should be RewardDistributor
        claimRewardCalled = true;
        lastTokenIdClaimed = tokenId;
        emit ClaimRewardAttempted(tokenId, msg.sender);
        if (shouldRevertOnClaim) {
            revert("MockPredictionManager: ClaimReward reverted as instructed");
        }
        // If not reverting, successful execution implies reward distribution logic would happen here.
    }

    // Helper to reset state for subsequent tests
    function reset() external {
        claimRewardCalled = false;
        lastTokenIdClaimed = 0;
        shouldRevertOnClaim = false;
        callerOfClaimReward = address(0);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IPredictionManagerForDistributor Interface
 * @author SwapCast Developers
 * @notice Defines the interface for the PredictionManager contract, specifically for interactions
 *         initiated by the RewardDistributor.
 */
interface IPredictionManagerForDistributor {
    /**
     * @notice Called by the RewardDistributor to process a reward claim for a given NFT.
     * @param tokenId The ID of the SwapCastNFT representing the user's position.
     * @dev The implementation in PredictionManager needs to handle how the claimant is identified,
     *      as msg.sender will be the RewardDistributor contract.
     */
    function claimReward(uint256 tokenId) external;
}

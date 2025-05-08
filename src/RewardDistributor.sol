// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPredictionPoolForDistributor} from "./interfaces/IPredictionPoolForDistributor.sol";

/**
 * @title RewardDistributor
 * @author SwapCast Team (Please update with actual author/team name)
 * @notice This contract allows users to claim their prediction rewards. It acts as an intermediary,
 *         forwarding claim requests to the main PredictionPool contract.
 * @dev Inherits from Ownable for administrative control over settings like the PredictionPool address.
 *      It ensures that reward claim calls to the PredictionPool originate from a trusted source (this contract).
 */
contract RewardDistributor is Ownable {
    /**
     * @notice The address of the PredictionPool contract that this distributor interacts with.
     * @dev This is an instance of IPredictionPoolForDistributor, ensuring it has the claimReward function.
     */
    IPredictionPoolForDistributor public predictionPool;

    /**
     * @notice Emitted when the PredictionPool address is set or updated.
     * @param oldAddress The previous address of the PredictionPool contract (address(0) if initial setup).
     * @param newAddress The new address of the PredictionPool contract.
     */
    event PredictionPoolAddressSet(address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Reverts if an address parameter is the zero address where it's not allowed (e.g., setting PredictionPool address).
     */
    error ZeroAddress();
    /**
     * @notice Reverts if the call to `PredictionPool.claimReward()` fails for any reason.
     */
    error ClaimFailedInPool();

    /**
     * @notice Contract constructor.
     * @param initialOwner The initial owner of this RewardDistributor contract.
     * @param _predictionPoolAddress The address of the PredictionPool contract. Must not be the zero address.
     */
    constructor(address initialOwner, address _predictionPoolAddress) Ownable(initialOwner) {
        if (_predictionPoolAddress == address(0)) revert ZeroAddress();
        predictionPool = IPredictionPoolForDistributor(_predictionPoolAddress);
        emit PredictionPoolAddressSet(address(0), _predictionPoolAddress);
    }

    /**
     * @notice Updates the address of the PredictionPool contract.
     * @dev Only callable by the contract owner. Emits {PredictionPoolAddressSet}.
     * @param _newAddress The new address of the PredictionPool. Must not be the zero address.
     */
    function setPredictionPoolAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert ZeroAddress();
        address oldAddress = address(predictionPool);
        predictionPool = IPredictionPoolForDistributor(_newAddress);
        emit PredictionPoolAddressSet(oldAddress, _newAddress);
    }

    /**
     * @notice Allows any user to initiate a reward claim for a specific prediction NFT.
     * @dev This function acts as a passthrough to the `PredictionPool.claimReward` function.
     *      The `PredictionPool` is responsible for all validation, including NFT ownership (implicitly via burn) and reward calculation.
     *      If the underlying call to `PredictionPool.claimReward` fails, this function will revert with {ClaimFailedInPool}.
     * @param tokenId The ID of the SwapCastNFT for which the reward is being claimed.
     */
    function claimReward(uint256 tokenId) external {
        // The actual reward logic, NFT burning, and ETH transfer occur in PredictionPool.
        // This contract simply forwards the request.
        // PredictionPool's claimReward is restricted to only be called by this RewardDistributor address.
        try predictionPool.claimReward(tokenId) {
            // Optionally, re-emit an event here if needed, though PredictionPool should emit the primary event (RewardClaimed).
            // For example: emit RewardForwarded(msg.sender, tokenId);
        } catch {
            revert ClaimFailedInPool();
        }
    }

    // Note: Additional administrative functions, if required for future enhancements, can be added here.
    // For example, functions to pause/unpause claim functionality, or to manage other parameters.
}

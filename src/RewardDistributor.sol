// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPredictionManagerForDistributor} from "./interfaces/IPredictionManagerForDistributor.sol";

/**
 * @title RewardDistributor
 * @author Simone Di Cola
 * @notice This contract allows users to claim their prediction rewards. It acts as an intermediary,
 *         forwarding claim requests to the main PredictionManager contract.
 * @dev Inherits from Ownable for administrative control over settings like the PredictionManager address.
 *      It ensures that reward claim calls to the PredictionPool originate from a trusted source (this contract).
 */
contract RewardDistributor is Ownable {
    /**
     * @notice The address of the PredictionManager contract that this distributor interacts with.
     * @dev This is an instance of IPredictionManagerForDistributor, ensuring it has the claimReward function.
     */
    IPredictionManagerForDistributor public predictionManager;

    /**
     * @notice Emitted when the PredictionManager address is set or updated.
     * @param oldAddress The previous address of the PredictionManager contract (address(0) if initial setup).
     * @param newAddress The new address of the PredictionManager contract.
     */
    event PredictionManagerAddressSet(address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Reverts if an address parameter is the zero address where it's not allowed (e.g., setting PredictionManager address).
     */
    error ZeroAddress();
    /**
     * @notice Reverts if the call to `PredictionManager.claimReward()` fails for any reason.
     */
    error ClaimFailedInPool();

    /**
     * @notice Contract constructor.
     * @param initialOwner The initial owner of this RewardDistributor contract.
     * @param _predictionManagerAddress The address of the PredictionManager contract. Must not be the zero address.
     */
    constructor(address initialOwner, address _predictionManagerAddress) {
        if (_predictionManagerAddress == address(0)) revert ZeroAddress();
        predictionManager = IPredictionManagerForDistributor(_predictionManagerAddress);
        emit PredictionManagerAddressSet(address(0), _predictionManagerAddress);

        // Transfer ownership to the initialOwner if it's not the deployer
        if (initialOwner != msg.sender) {
            transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Updates the address of the PredictionManager contract.
     * @dev Only callable by the contract owner. Emits {PredictionPoolAddressSet}.
     * @param _newAddress The new address of the PredictionManager. Must not be the zero address.
     */
    function setPredictionManagerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert ZeroAddress();
        address oldAddress = address(predictionManager);
        predictionManager = IPredictionManagerForDistributor(_newAddress);
        emit PredictionManagerAddressSet(oldAddress, _newAddress);
    }

    /**
     * @notice Allows any user to initiate a reward claim for a specific prediction NFT.
     * @dev This function acts as a passthrough to the `PredictionManager.claimReward` function.
     *      The `PredictionManager` is responsible for all validation, including NFT ownership (implicitly via burn) and reward calculation.
     *      If the underlying call to `PredictionManager.claimReward` fails, this function will revert with {ClaimFailedInPool}.
     * @param tokenId The ID of the SwapCastNFT for which the reward is being claimed.
     */
    function claimReward(uint256 tokenId) external {
        // The actual reward logic, NFT burning, and ETH transfer occur in PredictionManager.
        // This contract simply forwards the request.
        // PredictionManager's claimReward is restricted to only be called by this RewardDistributor address.
        try predictionManager.claimReward(tokenId) {
            // Optionally, re-emit an event here if needed, though PredictionPool should emit the primary event (RewardClaimed).
            // For example: emit RewardForwarded(msg.sender, tokenId);
        } catch {
            revert ClaimFailedInPool();
        }
    }

    // Note: Additional administrative functions, if required for future enhancements, can be added here.
    // For example, functions to pause/unpause claim functionality, or to manage other parameters.
}

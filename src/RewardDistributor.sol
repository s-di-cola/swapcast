// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPredictionManagerForDistributor} from "./interfaces/IPredictionManagerForDistributor.sol";

/**
 * @title RewardDistributor
 * @author Simone Di Cola
 * @notice This contract allows users to claim their prediction rewards. It acts as an intermediary,
 *         forwarding claim requests to the main PredictionManager contract.
 * @dev Inherits from Ownable for administrative control over settings like the PredictionManager address.
 *      It ensures that reward claim calls to the PredictionPool originate from a trusted source (this contract).
 */
/// @custom:security-contact security@swapcast.io
contract RewardDistributor is Ownable, ReentrancyGuard, Pausable {
    /**
     * @notice The address of the PredictionManager contract that this distributor interacts with.
     * @dev This is an instance of IPredictionManagerForDistributor, ensuring it has the claimReward function.
     */
    /// @notice The PredictionManager contract address
    /// @dev Marked as immutable for gas savings as it's only set once in the constructor
    IPredictionManagerForDistributor public immutable predictionManager;

    /**
     * @notice Emitted when the PredictionManager address is set or updated.
     * @param oldAddress The previous address of the PredictionManager contract (address(0) if initial setup).
     * @param newAddress The new address of the PredictionManager contract.
     */
    event PredictionManagerAddressSet(address indexed oldAddress, address indexed newAddress);

    /// @notice Emitted when a reward is successfully claimed
    /// @param claimer The address that claimed the reward
    /// @param tokenId The ID of the token for which the reward was claimed
    event RewardClaimed(address indexed claimer, uint256 indexed tokenId);

    /// @notice Reverts if an address parameter is the zero address
    error ZeroAddress();

    /// @notice Reverts if the token ID is invalid (e.g., zero)
    error InvalidTokenId();

    /// @notice Custom error for when a claim fails in the PredictionManager
    /// @param tokenId The ID of the token for which the claim failed
    error ClaimFailedInPool(uint256 tokenId);

    /**
     * @notice Contract constructor.
     * @param initialOwner The initial owner of this RewardDistributor contract.
     * @param _predictionManagerAddress The address of the PredictionManager contract. Must not be the zero address.
     */
    constructor(address initialOwner, address _predictionManagerAddress) Ownable(initialOwner) {
        if (_predictionManagerAddress == address(0)) revert ZeroAddress();
        predictionManager = IPredictionManagerForDistributor(_predictionManagerAddress);
        emit PredictionManagerAddressSet(address(0), _predictionManagerAddress);
    }

    /**
     * @notice Updates the address of the PredictionManager contract.
     * @dev Only callable by the contract owner. Emits {PredictionPoolAddressSet}.
     * @param _newAddress The new address of the PredictionManager. Must not be the zero address.
     */
    function setPredictionManagerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert ZeroAddress();
        address oldAddress = address(predictionManager);
        emit PredictionManagerAddressSet(oldAddress, _newAddress);
        // Note: predictionManager is immutable, so we can't change it after deployment
        // This function is kept for backward compatibility but will revert
        revert("Cannot change predictionManager as it is immutable");
    }

    /**
     * @notice Allows any user to initiate a reward claim for a specific prediction NFT.
     * @dev This function acts as a passthrough to the `PredictionManager.claimReward` function.
     *      The `PredictionManager` is responsible for all validation, including NFT ownership (implicitly via burn) and reward calculation.
     *      If the underlying call to `PredictionManager.claimReward` fails, this function will revert with {ClaimFailedInPool}.
     * @param tokenId The ID of the SwapCastNFT for which the reward is being claimed.
     * @custom:reverts With `ZeroAddress` if the PredictionManager address is not set
     * @custom:reverts With `InvalidTokenId` if the tokenId is zero
     * @custom:reverts With `ClaimFailedInPool` if the underlying PredictionManager call fails
     * @custom:emits RewardClaimed On successful claim
     */
    /// @notice Pauses the contract, preventing claimReward from being called
    /// @dev Only callable by the owner when not paused
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract, allowing claimReward to be called again
    /// @dev Only callable by the owner when paused
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Allows any user to initiate a reward claim for a specific prediction NFT.
    /// @dev This function can be paused by the owner in case of emergency.
    ///      When paused, all calls to this function will revert.
    /// @param tokenId The ID of the SwapCastNFT for which the reward is being claimed.
    /// @custom:reverts With `Pausable.EnforcedPause` if the contract is paused
    /// @custom:reverts With `ZeroAddress` if the PredictionManager address is not set
    /// @custom:reverts With `InvalidTokenId` if the tokenId is zero
    /// @custom:reverts With `ClaimFailedInPool` if the underlying PredictionManager call fails
    /// @custom:emits RewardClaimed On successful claim
    function claimReward(uint256 tokenId) external nonReentrant whenNotPaused {
        if (tokenId == 0) revert InvalidTokenId();

        address sender = msg.sender;

        // The actual reward logic, NFT burning, and ETH transfer occur in PredictionManager.
        // This contract simply forwards the request.
        try predictionManager.claimReward(tokenId) {
            emit RewardClaimed(sender, tokenId);
        } catch Error(string memory) /* reason */ {
            revert ClaimFailedInPool(tokenId);
        } catch (bytes memory) /* lowLevelData */ {
            revert ClaimFailedInPool(tokenId);
        }
    }
}

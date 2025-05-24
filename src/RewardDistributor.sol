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
 * @dev Inherits from Ownable for administrative control, ReentrancyGuard to prevent reentrancy attacks,
 *      and Pausable to allow emergency stops. It ensures that reward claim calls to the PredictionManager
 *      originate from a trusted source (this contract).
 *
 *      The contract has the following key features:
 *      1. Secure reward claiming with reentrancy protection
 *      2. Emergency pause functionality for security incidents
 *      3. Immutable PredictionManager reference for gas efficiency
 *      4. Comprehensive error handling with detailed error messages
 *
 * @custom:security-contact security@swapcast.xyz
 */
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

    /**
     * @notice Thrown when a zero address is provided for a parameter that requires a non-zero address.
     * @dev This is used to validate that critical address parameters like the PredictionManager are not set to zero.
     */
    error ZeroAddress();

    /**
     * @notice Thrown when an invalid token ID (zero) is provided for a claim.
     * @dev Token IDs in this system start from 1, so a zero token ID is always invalid.
     */
    error InvalidTokenId();

    /**
     * @notice Thrown when a claim fails in the PredictionManager contract.
     * @dev This error wraps any errors that might occur in the PredictionManager during a claim,
     *      providing a consistent error interface to users of this contract.
     * @param tokenId The ID of the token for which the claim failed.
     */
    error ClaimFailedInPool(uint256 tokenId);

    /**
     * @notice Thrown when attempting to change the immutable PredictionManager address.
     * @dev This error is used in the setPredictionManagerAddress function which is kept for
     *      backward compatibility but will always revert since the address is immutable.
     */
    error ImmutablePredictionManager();

    /**
     * @notice Contract constructor that initializes the RewardDistributor with owner and PredictionManager addresses.
     * @dev Sets up the immutable reference to the PredictionManager contract and emits an event.
     *      The PredictionManager address is critical and cannot be the zero address.
     *      This address is set as immutable for gas efficiency and security, meaning it cannot be changed after deployment.
     *
     * @param initialOwner The initial owner of this RewardDistributor contract who can pause/unpause and perform admin functions.
     * @param _predictionManagerAddress The address of the PredictionManager contract that will handle the actual reward claims.
     * @custom:reverts ZeroAddress If the prediction manager address is zero.
     */
    constructor(address initialOwner, address _predictionManagerAddress) Ownable(initialOwner) {
        if (_predictionManagerAddress == address(0)) revert ZeroAddress();
        predictionManager = IPredictionManagerForDistributor(_predictionManagerAddress);
        emit PredictionManagerAddressSet(address(0), _predictionManagerAddress);
    }

    /**
     * @notice Updates the address of the PredictionManager contract.
     * @dev This function is kept for backward compatibility but will always revert since predictionManager is immutable.
     *      It still performs input validation and emits an event before reverting to maintain consistent behavior.
     *      In a future version, this function could be removed entirely since it cannot succeed.
     *
     * @param _newAddress The new address of the PredictionManager (which will never be set).
     * @custom:reverts ZeroAddress If the new address is zero.
     * @custom:reverts ImmutablePredictionManager Always, since the predictionManager cannot be changed.
     */
    function setPredictionManagerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert ZeroAddress();

        // Emit the event for logging purposes, even though the change won't happen
        address oldAddress = address(predictionManager);
        emit PredictionManagerAddressSet(oldAddress, _newAddress);

        // Revert with a custom error for better gas efficiency and clarity
        revert ImmutablePredictionManager();
    }

    /**
     * @notice Pauses the contract, preventing claimReward from being called.
     * @dev Only callable by the owner when the contract is not already paused.
     *      This is an emergency function that can be used to stop all reward claims
     *      in case of a security incident or critical bug.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract, allowing claimReward to be called again.
     * @dev Only callable by the owner when the contract is paused.
     *      This function restores normal operation after an emergency pause.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Allows any user to initiate a reward claim for a specific prediction NFT.
     * @dev This function acts as a secure passthrough to the PredictionManager.claimReward function.
     *      It includes multiple security features:
     *      1. Reentrancy protection via the nonReentrant modifier
     *      2. Pausability for emergency situations
     *      3. Input validation for the token ID
     *      4. Try-catch pattern to handle errors from the PredictionManager gracefully
     *
     *      The actual reward logic, NFT burning, and ETH transfer occur in the PredictionManager.
     *      This contract simply forwards the request and handles any errors that might occur.
     *
     * @param tokenId The ID of the SwapCastNFT for which the reward is being claimed.
     * @custom:reverts Pausable.EnforcedPause If the contract is paused
     * @custom:reverts InvalidTokenId If the tokenId is zero
     * @custom:reverts ClaimFailedInPool If the underlying PredictionManager call fails
     * @custom:emits RewardClaimed On successful claim with the claimer address and token ID
     */
    function claimReward(uint256 tokenId) external nonReentrant whenNotPaused {
        // Validate input - token ID must not be zero
        if (tokenId == 0) revert InvalidTokenId();

        // Cache msg.sender to avoid multiple CALLER opcodes
        address sender = msg.sender;

        // Forward the claim to the PredictionManager using try-catch for error handling
        try predictionManager.claimReward(tokenId) {
            // Emit success event if the claim succeeds
            emit RewardClaimed(sender, tokenId);
        } catch Error(string memory) /* reason */ {
            // Catch standard errors (revert with reason string)
            revert ClaimFailedInPool(tokenId);
        } catch (bytes memory) /* lowLevelData */ {
            // Catch panic errors and custom errors
            revert ClaimFailedInPool(tokenId);
        }
    }
}

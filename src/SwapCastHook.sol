// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPredictionManager} from "./interfaces/IPredictionManager.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

using PoolIdLibrary for PoolKey;

/**
 * @title SwapCastHook
 * @author Simone Di Cola
 * @notice A Uniswap V4 hook designed to enable users to make predictions on market outcomes
 *         concurrently with their swap transactions on a Uniswap V4 pool.
 * @dev This hook integrates with the SwapCast `PredictionManager`. When a user performs a swap via the `PoolManager`
 *      and includes specific `hookData` (market ID and predicted outcome), this hook's `_afterSwap` logic is triggered.
 *      The user's conviction (stake) is passed as `msg.value` with the swap call, which the `PoolManager` forwards to this hook.
 *      The hook then attempts to record this prediction in the `PredictionManager`.
 *      It inherits from `BaseHook` and primarily utilizes the `afterSwap` permission.
 */
contract SwapCastHook is BaseHook, Ownable {
    /**
     * @notice The instance of the PredictionManager contract where predictions are recorded.
     * @dev This address is set immutably during deployment via the constructor.
     *      It must conform to the {IPredictionManager} interface.
     */
    IPredictionManager public immutable predictionManager;

    /**
     * @notice Expected length in bytes for the `hookData` when making a prediction.
     * @dev This constant represents 20 bytes for `actualUser` (address) + 32 bytes for `marketId` (uint256) +
     *      1 byte for `outcome` (uint8) + 16 bytes for `convictionStake` (uint128).
     *      The `_afterSwap` function enforces this length for non-empty hookData.
     */
    uint256 private constant PREDICTION_HOOK_DATA_LENGTH = 69; // 20 bytes for actualUser (address) + 32 bytes for marketId (uint256) + 1 byte for outcome (uint8) + 16 bytes for convictionStake (uint128)

    /**
     * @notice Emitted when a user attempts to make a prediction during a swap.
     * @param user The address of the user making the prediction.
     * @param poolId The ID of the pool where the swap occurred.
     * @param marketId The ID of the prediction market.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) declared for this prediction.
     */
    event PredictionAttempted(
        address indexed user,
        PoolId indexed poolId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStake
    );

    /**
     * @notice Emitted when a prediction is successfully recorded in the PredictionPool.
     * @param user The address of the user making the prediction.
     * @param poolId The ID of the pool where the swap occurred.
     * @param marketId The ID of the prediction market.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) declared for this prediction.
     */
    event PredictionRecorded(
        address indexed user,
        PoolId indexed poolId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStake
    );

    /**
     * @notice Emitted when a prediction attempt fails to be recorded in the PredictionPool.
     * @param user The address of the user making the prediction.
     * @param poolId The ID of the pool where the swap occurred.
     * @param marketId The ID of the prediction market.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) declared for this prediction.
     * @param errorSelector The error selector from the PredictionPool's revert, if available.
     */
    event PredictionFailed(
        address indexed user,
        PoolId indexed poolId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStake,
        bytes4 errorSelector
    );

    /**
     * @notice Emitted when debug information about hookData is received.
     * @param receivedLength The actual length of the `hookData` received.
     * @param expectedLength The expected length for valid prediction `hookData`.
     * @param isUniversalRouter A boolean indicating whether the hookData was received from a Universal Router.
     */
    event HookDataDebug(uint256 receivedLength, uint256 expectedLength, bool isUniversalRouter);

    /**
     * @notice Reverts if the provided `hookData` cannot be parsed.
     * @dev Currently, this error is defined but not explicitly used to validate against `PREDICTION_HOOK_DATA_LENGTH`.
     *      It could be used if stricter `hookData` length validation is implemented.
     * @param reason A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.
     */
    error HookDataParsingFailed(string reason);

    /**
     * @notice Reverts if the provided `hookData` has an unexpected length.
     * @dev Currently, this error is defined but not explicitly used to validate against `PREDICTION_HOOK_DATA_LENGTH`.
     *      It could be used if stricter `hookData` length validation is implemented.
     * @param actualLength The actual length of the `hookData` received.
     * @param expectedLength The expected length for valid prediction `hookData`.
     */
    error InvalidHookDataLength(uint256 actualLength, uint256 expectedLength);
    /**
     * @notice Reverts during construction if the provided `_predictionManagerAddress` is the zero address.
     */
    error PredictionPoolZeroAddress();
    /**
     * @notice Reverts if a user attempts to make a prediction (`hookData` is provided) but the conviction stake declared in `hookData` is zero.
     * @dev This error is thrown in the _afterSwap function when a prediction attempt is made with zero conviction stake.
     *      A non-zero conviction stake is required to ensure users have skin in the game when making predictions.
     */
    error NoConvictionStakeDeclaredInHookData();

    /**
     * @notice Reverts if the call to `predictionManager.recordPrediction` fails for any reason.
     * @dev This error is thrown when the try/catch block in _afterSwap catches an exception from the PredictionManager.
     *      The error includes the reason for the failure to help with debugging and user feedback.
     * @param reason A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.
     */
    error PredictionRecordingFailed(string reason);

    /**
     * @notice Reverts if an ETH transfer fails during recovery.
     * @dev This error is thrown by the recoverETH function if the ETH transfer to the specified address fails.
     */
    error ETHTransferFailed();

    /**
     * @notice Reverts if a zero address is provided where a non-zero address is required.
     * @dev This error is used in functions that require valid addresses, such as recoverETH.
     */
    error ZeroAddress();

    /**
     * @notice Reverts if an attempt is made to recover more ETH than is available in the contract.
     * @dev This error is thrown by the recoverETH function if the requested amount exceeds the contract's balance.
     * @param requested The amount of ETH requested to recover.
     * @param available The actual balance available in the contract.
     */
    error InsufficientBalance(uint256 requested, uint256 available);

    /**
     * @notice Contract constructor.
     * @dev Initializes the contract with the PoolManager and PredictionManager addresses.
     *      Also initializes the Ownable contract with the deployer as the initial owner.
     *      This owner will have the ability to recover ETH in emergency situations.
     *
     * @param _poolManager The address of the Uniswap V4 PoolManager this hook will be registered with.
     *                     Passed to the `BaseHook` constructor.
     * @param _predictionManagerAddress The address of the `PredictionManager` contract where predictions will be recorded.
     *                               Cannot be the zero address.
     */
    constructor(IPoolManager _poolManager, address _predictionManagerAddress)
        BaseHook(_poolManager)
        Ownable(msg.sender) // Initialize Ownable with the deployer as the initial owner
    {
        if (_predictionManagerAddress == address(0)) {
            revert PredictionPoolZeroAddress();
        }
        predictionManager = IPredictionManager(_predictionManagerAddress);
    }

    /**
     * @dev Modifier to restrict function calls to the `PoolManager` only.
     *      Note: `BaseHook` already provides protection for its hook callback functions (e.g., `_afterSwap`),
     *      making them callable only by the `poolManager`. This modifier might be redundant for such overrides
     *      but could be used for other custom external functions if added to this hook.
     */
    modifier poolManagerOnly() {
        // This check is also implicitly handled by BaseHook for overridden hook functions.
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /**
     * @notice Defines the permissions for this hook, indicating which hook points it will implement.
     * @dev Overrides `BaseHook.getHookPermissions`.
     *      This implementation enables only the `afterSwap` hook point, meaning the hook logic
     *      in `_afterSwap` will be executed by the `PoolManager` after a swap transaction is processed.
     * @return permissions A `Hooks.Permissions` struct with `afterSwap` set to true and all others false.
     */
    function getHookPermissions() public pure override returns (Hooks.Permissions memory permissions) {
        permissions = Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false, // We only need afterSwap
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /**
     * @dev Internal callback function executed by the `PoolManager` after a swap on a pool where this hook is registered.
     *      This function contains the core logic for processing prediction attempts. It handles both direct PoolManager calls
     *      and Universal Router calls with different hookData formats.
     * @param key The PoolKey identifying the pool where the swap occurred.
     * @param hookData Additional data passed to the hook, containing prediction details:
     *                 - bytes 0-19: actualUser (address) - The actual user making the prediction (may differ from sender).
     *                 - bytes 20-51: marketId (uint256) - ID of the prediction market.
     *                 - bytes 52: outcome (uint8) - The predicted outcome (0 for Bearish, 1 for Bullish).
     *                 - bytes 53-68: convictionStake (uint128) - Amount of conviction (stake) declared.
     * @return hookReturnData The selector indicating which hook function was called.
     * @return currencyDelta Any currency delta to be applied (always 0 for this hook).
     */
    function _afterSwap(
        address, /*sender*/
        PoolKey calldata key,
        SwapParams calldata, /*params*/
        BalanceDelta, /*delta*/
        bytes calldata hookData
    ) internal override returns (bytes4 hookReturnData, int128 currencyDelta) {
        if (hookData.length == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }

        // Emit debug info about received hookData
        emit HookDataDebug(hookData.length, PREDICTION_HOOK_DATA_LENGTH, hookData.length > PREDICTION_HOOK_DATA_LENGTH);

        // Parse prediction data directly from hookData using assembly
        address actualUser;
        uint256 marketId;
        PredictionTypes.Outcome outcome;
        uint128 convictionStakeDeclared;
        bool isUniversalRouter = false;

        if (hookData.length == PREDICTION_HOOK_DATA_LENGTH) {
            // Direct PoolManager call - parse from beginning
            assembly {
                // Load address from bytes 0-19
                actualUser := shr(96, calldataload(add(hookData.offset, 0)))

                // Load marketId from bytes 20-51
                marketId := calldataload(add(hookData.offset, 20))

                // Load outcome from byte 52
                outcome := byte(0, calldataload(add(hookData.offset, 52)))

                // Load stake from bytes 53-68 (16 bytes)
                let stakeWord := calldataload(add(hookData.offset, 53))
                convictionStakeDeclared := shr(128, stakeWord)
            }
        } else if (hookData.length > PREDICTION_HOOK_DATA_LENGTH) {
            // Universal Router call - prediction data should be at the end
            isUniversalRouter = true;
            uint256 offset = hookData.length - PREDICTION_HOOK_DATA_LENGTH;

            assembly {
                // Load address from last 69 bytes, starting at offset
                actualUser := shr(96, calldataload(add(hookData.offset, offset)))

                // Load marketId
                marketId := calldataload(add(add(hookData.offset, offset), 20))

                // Load outcome
                outcome := byte(0, calldataload(add(add(hookData.offset, offset), 52)))

                // Load stake
                let stakeWord := calldataload(add(add(hookData.offset, offset), 53))
                convictionStakeDeclared := shr(128, stakeWord)
            }
        } else {
            // Data too short for any valid format
            revert InvalidHookDataLength(hookData.length, PREDICTION_HOOK_DATA_LENGTH);
        }

        emit PredictionAttempted(actualUser, key.toId(), marketId, outcome, convictionStakeDeclared);

        if (convictionStakeDeclared == 0) {
            revert NoConvictionStakeDeclaredInHookData();
        }

        // Calculate fee and total amount needed
        uint256 feeBps = predictionManager.protocolFeeBasisPoints();
        uint256 feeAmount = (uint256(convictionStakeDeclared) * feeBps) / 10000;
        uint256 totalEthToSend = uint256(convictionStakeDeclared) + feeAmount;

        // Check if hook has sufficient balance
        if (address(this).balance < totalEthToSend) {
            revert PredictionRecordingFailed("Hook has insufficient ETH balance");
        }

        // Attempt to record the prediction in the PredictionManager
        try predictionManager.recordPrediction{value: totalEthToSend}(
            actualUser, marketId, outcome, convictionStakeDeclared
        ) {
            emit PredictionRecorded(actualUser, key.toId(), marketId, outcome, convictionStakeDeclared);
            return (BaseHook.afterSwap.selector, 0);
        } catch (bytes memory lowLevelData) {
            bytes4 errorSelector = bytes4(0);
            string memory errorMessage = "PredictionManager reverted with an unspecified error.";

            // Extract error selector if available
            if (lowLevelData.length >= 4) {
                errorSelector = bytes4(lowLevelData);

                // Handle standard Error(string)
                if (errorSelector == bytes4(keccak256("Error(string)"))) {
                    if (lowLevelData.length > 4) {
                        errorMessage = _extractErrorMessage(lowLevelData);
                    }
                } else if (errorSelector == bytes4(keccak256("Panic(uint256)"))) {
                    uint256 errorCode;
                    if (lowLevelData.length >= 36) {
                        assembly {
                            errorCode := mload(add(add(lowLevelData, 0x20), 4))
                        }
                    }
                    errorMessage =
                        string(abi.encodePacked("PredictionManager Panic: Code ", _uint256ToString(errorCode)));
                } else {
                    errorMessage = _getCustomErrorMessage(errorSelector);
                }
            }

            emit PredictionFailed(actualUser, key.toId(), marketId, outcome, convictionStakeDeclared, errorSelector);
            revert PredictionRecordingFailed(errorMessage);
        }
    }

    /**
     * @dev Internal helper function to extract an error message from a standard Error(string) revert.
     * @param data The raw bytes data from the caught exception.
     * @return The extracted error message with a prefix.
     */
    function _extractErrorMessage(bytes memory data) internal pure returns (string memory) {
        // Skip the first 4 bytes (error selector) and decode the rest as a string
        if (data.length <= 4) return "PredictionManager Error: <no message>";

        // Create a new bytes array for the encoded string (without the selector)
        bytes memory encodedString = new bytes(data.length - 4);

        // Copy the encoded string part (skipping the selector)
        // This is still necessary but we're doing it in a single function rather than inline
        for (uint256 i = 0; i < encodedString.length; i++) {
            encodedString[i] = data[i + 4];
        }

        // Decode the string and return it with a prefix
        string memory reason = abi.decode(encodedString, (string));
        return string(abi.encodePacked("PredictionManager Error: ", reason));
    }

    /**
     * @dev Internal helper function to convert a uint256 to a string.
     * @param value The uint256 value to convert.
     * @return The string representation of the value.
     */
    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        // Handle the special case of 0
        if (value == 0) return "0";

        // Calculate the length of the resulting string
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        // Create the string
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }

    /**
     * @dev Internal helper function to map known error selectors to human-readable messages.
     * @param errorSelector The 4-byte error selector.
     * @return A human-readable error message.
     */
    function _getCustomErrorMessage(bytes4 errorSelector) internal pure returns (string memory) {
        // Map known error selectors to human-readable messages
        // This can be expanded as more custom errors are identified
        if (errorSelector == bytes4(keccak256("MarketDoesNotExist(uint256)"))) {
            return "PredictionManager Error: Market does not exist";
        } else if (errorSelector == bytes4(keccak256("MarketAlreadyResolved(uint256)"))) {
            return "PredictionManager Error: Market already resolved";
        } else if (errorSelector == bytes4(keccak256("MarketExpired(uint256)"))) {
            return "PredictionManager Error: Market has expired";
        } else if (errorSelector == bytes4(keccak256("InvalidConvictionStake()"))) {
            return "PredictionManager Error: Invalid conviction stake";
        } else {
            // Default message for unknown custom errors
            return "PredictionManager Error: Custom error";
        }
    }

    /**
     * @notice Allows the owner to recover ETH stuck in the contract in case of emergency.
     * @dev This function provides a safety mechanism to recover ETH that might get stuck in the contract
     *      due to failed prediction attempts or other unexpected scenarios. It includes the following
     *      security controls:
     *
     *      1. Only the contract owner can call this function (via the onlyOwner modifier)
     *      2. The recipient address cannot be the zero address
     *      3. The function reverts if the ETH transfer fails
     *
     *      This function should only be used in emergency situations when ETH is genuinely stuck
     *      and cannot be processed through normal means.
     *
     * @param _to The address to send the recovered ETH to.
     * @param _amount The amount of ETH to recover.
     */
    function recoverETH(address _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount > address(this).balance) {
            revert InsufficientBalance(_amount, address(this).balance);
        }

        (bool success,) = _to.call{value: _amount}("");
        if (!success) revert ETHTransferFailed();
    }

    /**
     * @notice Fallback function to allow the hook to receive ETH.
     * @dev This is crucial because the `PoolManager` forwards `msg.value` (the user's conviction stake)
     *      to this hook when `_afterSwap` is called. Without a payable fallback or receive function,
     *      such calls would revert.
     */
    receive() external payable {}
}

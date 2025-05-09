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
contract SwapCastHook is BaseHook {
    /**
     * @notice The instance of the PredictionManager contract where predictions are recorded.
     * @dev This address is set immutably during deployment via the constructor.
     *      It must conform to the {IPredictionManager} interface.
     */
    IPredictionManager public immutable predictionManager;

    /**
     * @notice Expected length in bytes for the `hookData` when making a prediction.
     * @dev This constant represents 32 bytes for `marketId` (uint256) + 1 byte for `outcome` (uint8) + 16 bytes for `convictionStake` (uint128).
     *      Currently, `_afterSwap` checks if `hookData.length == 0` but does not strictly enforce this length for non-empty data.
     *      Consider adding validation: `if (hookData.length != 0 && hookData.length != PREDICTION_HOOK_DATA_LENGTH) revert InvalidHookDataLength(...)`.
     */
    uint256 private constant PREDICTION_HOOK_DATA_LENGTH = 49; // 32 bytes for marketId (uint256) + 1 byte for outcome (uint8) + 16 bytes for convictionStake (uint128)

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
     */
    error NoConvictionStakeDeclaredInHookData();
    /**
     * @notice Reverts if the call to `predictionManager.recordPrediction` fails for any reason.
     * @param reason A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.
     */
    error PredictionRecordingFailed(string reason);

    /**
     * @notice Contract constructor.
     * @param _poolManager The address of the Uniswap V4 PoolManager this hook will be registered with.
     *                     Passed to the `BaseHook` constructor.
     * @param _predictionManagerAddress The address of the `PredictionManager` contract where predictions will be recorded.
     *                               Cannot be the zero address.
     */
    constructor(IPoolManager _poolManager, address _predictionManagerAddress) BaseHook(_poolManager) {
        if (_predictionManagerAddress == address(0)) revert PredictionPoolZeroAddress();
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
     *      This function contains the core logic for processing prediction attempts.
     * @param sender The address of the user who initiated the swap transaction (the `msg.sender` to `PoolManager`).
     * @param key The `PoolKey` identifying the pool where the swap occurred.
     * @param hookData Arbitrary data passed by the user with the swap. For this hook, it's expected to contain
     *                 the `marketId` (uint256), `outcome` (uint8), and `convictionStake` (uint128) for the prediction, abi-encoded.
     * @return hookReturnData The selector of the function in `BaseHook` to be called by `PoolManager` upon completion (typically `BaseHook.afterSwap.selector`).
     * @return currencyDelta A currency delta to be applied by the `PoolManager`. This hook returns 0, as it does not directly modify pool balances;
     *                       `convictionStake` is handled by forwarding to the `PredictionPool`.
     */
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata, /*params*/
        BalanceDelta, /*delta*/
        bytes calldata hookData
    ) internal override returns (bytes4 hookReturnData, int128 currencyDelta) {
        if (hookData.length == 0) {
            return (BaseHook.afterSwap.selector, 0); // Standard return for no-op or successful completion without currency delta.
        }

        // If hookData is present, it must be the correct length for a prediction.
        if (hookData.length != PREDICTION_HOOK_DATA_LENGTH) {
            revert InvalidHookDataLength(hookData.length, PREDICTION_HOOK_DATA_LENGTH);
        }

        // Decode marketId, outcome, and convictionStake from hookData.
        // Assumes hookData is abi.encodePacked(uint256 marketId, uint8 outcome, uint128 convictionStakeDeclared).
        uint256 marketId;
        PredictionTypes.Outcome outcome;
        uint128 convictionStakeDeclared;

        // PREDICTION_HOOK_DATA_LENGTH is 32 (marketId) + 1 (outcome) + 16 (convictionStakeDeclared) = 49 bytes.
        // hookData is abi.encodePacked(uint256 marketId, uint8 outcome, uint128 convictionStakeDeclared)
        assembly {
            // hookData.offset points to the start of the slice's data within calldata.

            // marketId (uint256 = 32 bytes) starts at hookData.offset + 0
            marketId := calldataload(hookData.offset)

            // outcome (uint8 = 1 byte) starts at hookData.offset + 32
            // calldataload loads a 32-byte word. outcome is the most significant byte of this word.
            // byte(0, word) extracts the 0-th byte (most significant) from the word.
            // Convert the uint8 to PredictionTypes.Outcome
            outcome := byte(0, calldataload(add(hookData.offset, 32)))

            // convictionStakeDeclared (uint128 = 16 bytes) starts at hookData.offset + 33
            // Load 32 bytes starting from hookData.offset + 33.
            let wordForStake := calldataload(add(hookData.offset, 33))
            // We want the upper 128 bits (16 bytes) of this 256-bit (32-byte) word.
            // shr(128, word) shifts right by 128 bits, keeping the upper 128 bits.
            convictionStakeDeclared := shr(128, wordForStake)
        }

        emit PredictionAttempted(sender, key.toId(), marketId, outcome, convictionStakeDeclared);

        if (convictionStakeDeclared == 0) {
            revert NoConvictionStakeDeclaredInHookData();
        }

        // Attempt to record the prediction in the PredictionManager.
        // The convictionStakeDeclared is passed as an argument. The PredictionManager handles the stake value.
        // This assumes IPredictionManager.recordPrediction signature is: recordPrediction(address user, uint256 marketId, PredictionTypes.Outcome outcome, uint128 convictionStake)
        try predictionManager.recordPrediction(sender, marketId, outcome, convictionStakeDeclared) {
            emit PredictionRecorded(sender, key.toId(), marketId, outcome, convictionStakeDeclared);
            return (BaseHook.afterSwap.selector, 0); // Success
        } catch (bytes memory lowLevelData) {
            bytes4 actualPoolErrorSelector = bytes4(keccak256(bytes("UnknownPoolError"))); // Default
            string memory revertMessageForHook = "PredictionManager reverted with an unspecified error.";

            if (lowLevelData.length >= 4) {
                assembly {
                    actualPoolErrorSelector := mload(add(lowLevelData, 0x20))
                }
                // Check if it's a standard Error(string)
                if (actualPoolErrorSelector == bytes4(keccak256("Error(string)"))) {
                    // Manually copy the slice lowLevelData[4:] to a new bytes memory variable
                    // to satisfy abi.decode's requirement for a `bytes memory` type, not `bytes memory slice`.
                    uint256 encodedStringLength = lowLevelData.length - 4;
                    bytes memory encodedStringBytes = new bytes(encodedStringLength);
                    for (uint256 j = 0; j < encodedStringLength; j++) {
                        encodedStringBytes[j] = lowLevelData[j + 4];
                    }
                    string memory reason = abi.decode(encodedStringBytes, (string));
                    revertMessageForHook = string(abi.encodePacked("PredictionManager Error: ", reason));
                } else {
                    // For custom errors, the selector is now in actualPoolErrorSelector.
                    // The revert message for PredictionRecordingFailed will be more generic.
                    revertMessageForHook = "PredictionManager reverted with a custom error.";
                }
            } else if (lowLevelData.length > 0) {
                revertMessageForHook = "PredictionManager reverted with non-standard error data.";
            } // else lowLevelData.length == 0 (e.g. assert failure), default message & selector are fine.

            emit PredictionFailed(
                sender, key.toId(), marketId, outcome, convictionStakeDeclared, actualPoolErrorSelector
            );
            revert PredictionRecordingFailed(revertMessageForHook);
        }
    }

    /**
     * @notice Fallback function to allow the hook to receive ETH.
     * @dev This is crucial because the `PoolManager` forwards `msg.value` (the user's conviction stake)
     *      to this hook when `_afterSwap` is called. Without a payable fallback or receive function,
     *      such calls would revert.
     */
    receive() external payable {}
}

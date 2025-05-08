// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPredictionPool} from "./interfaces/IPredictionPool.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";

using PoolIdLibrary for PoolKey;

/**
 * @title SwapCastHook
 * @author SwapCast Developers
 * @notice A Uniswap V4 hook designed to enable users to make predictions on market outcomes
 *         concurrently with their swap transactions on a Uniswap V4 pool.
 * @dev This hook integrates with the SwapCast `PredictionPool`. When a user performs a swap via the `PoolManager`
 *      and includes specific `hookData` (market ID and predicted outcome), this hook's `_afterSwap` logic is triggered.
 *      The user's conviction (stake) is passed as `msg.value` with the swap call, which the `PoolManager` forwards to this hook.
 *      The hook then attempts to record this prediction in the `PredictionPool`.
 *      It inherits from `BaseHook` and primarily utilizes the `afterSwap` permission.
 */
contract SwapCastHook is BaseHook {
    /**
     * @notice The instance of the PredictionPool contract where predictions are recorded.
     * @dev This address is set immutably during deployment via the constructor.
     *      It must conform to the {IPredictionPool} interface.
     */
    IPredictionPool public immutable predictionPool;

    /**
     * @notice Expected length in bytes for the `hookData` when making a prediction.
     * @dev This constant represents 32 bytes for `marketId` (uint256) + 1 byte for `outcome` (uint8).
     *      Currently, `_afterSwap` checks if `hookData.length == 0` but does not strictly enforce this length for non-empty data.
     *      Consider adding validation: `if (hookData.length != 0 && hookData.length != PREDICTION_HOOK_DATA_LENGTH) revert InvalidHookDataLength(...)`.
     */
    uint256 private constant PREDICTION_HOOK_DATA_LENGTH = 33; // 32 bytes for marketId (uint256) + 1 byte for outcome (uint8)

    /**
     * @notice Emitted when a user attempts to make a prediction via this hook during a swap.
     * @param sender The address of the user initiating the swap and prediction.
     * @param poolId The ID of the Uniswap V4 pool where the swap occurred.
     * @param marketId The specific market ID for which the prediction is being made.
     * @param outcome The outcome predicted by the user.
     * @param convictionValueSent The amount of ETH (in wei) sent by the user as their conviction stake for this prediction.
     */
    event PredictionAttempted(
        address indexed sender, PoolId indexed poolId, uint256 marketId, uint8 outcome, uint256 convictionValueSent
    );
    /**
     * @notice Emitted when a prediction is successfully recorded in the `PredictionPool` via this hook.
     * @param sender The address of the user whose prediction was recorded.
     * @param marketId The market ID for which the prediction was recorded.
     * @param outcome The outcome that was recorded.
     * @param convictionValue The amount of ETH (in wei) staked as conviction, successfully transferred to the PredictionPool.
     */
    event PredictionRecorded(address indexed sender, uint256 marketId, uint8 outcome, uint256 convictionValue);
    /**
     * @notice Emitted if an attempt to record a prediction in the `PredictionPool` fails.
     * @param sender The address of the user whose prediction attempt failed.
     * @param marketId The market ID for which the prediction attempt failed.
     * @param reason A string describing the reason for the failure, typically from the `PredictionPool` or this hook.
     */
    event PredictionFailed(address indexed sender, uint256 marketId, string reason);

    /**
     * @notice Reverts if the provided `hookData` has an unexpected length.
     * @dev Currently, this error is defined but not explicitly used to validate against `PREDICTION_HOOK_DATA_LENGTH`.
     *      It could be used if stricter `hookData` length validation is implemented.
     * @param actualLength The actual length of the `hookData` received.
     * @param expectedLength The expected length for valid prediction `hookData`.
     */
    error InvalidHookDataLength(uint256 actualLength, uint256 expectedLength);
    /**
     * @notice Reverts during construction if the provided `_predictionPoolAddress` is the zero address.
     */
    error PredictionPoolZeroAddress();
    /**
     * @notice Reverts if a user attempts to make a prediction (`hookData` is provided) but `msg.value` (conviction stake) is zero.
     */
    error NoConvictionValueSent();
    /**
     * @notice Reverts if the call to `predictionPool.recordPrediction` fails for any reason.
     * @param reason A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.
     */
    error PredictionRecordingFailed(string reason);

    /**
     * @notice Contract constructor.
     * @param _poolManager The address of the Uniswap V4 PoolManager this hook will be registered with.
     *                     Passed to the `BaseHook` constructor.
     * @param _predictionPoolAddress The address of the `PredictionPool` contract where predictions will be recorded.
     *                               Cannot be the zero address.
     */
    constructor(IPoolManager _poolManager, address _predictionPoolAddress) BaseHook(_poolManager) {
        if (_predictionPoolAddress == address(0)) revert PredictionPoolZeroAddress();
        predictionPool = IPredictionPool(_predictionPoolAddress);
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
            beforeSwap: false,
            afterSwap: true, // This hook logic runs after a swap
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
     *                 the `marketId` (uint256) and `outcome` (uint8) for the prediction, abi-encoded.
     * @return hookReturnData The selector of the function in `BaseHook` to be called by `PoolManager` upon completion (typically `BaseHook.afterSwap.selector`).
     * @return currencyDelta A currency delta to be applied by the `PoolManager`. This hook returns 0, as it does not directly modify pool balances;
     *                       `msg.value` (conviction stake) is handled by forwarding to the `PredictionPool`.
     */
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata, /*params*/
        BalanceDelta, /*delta*/
        bytes calldata hookData
    ) internal override returns (bytes4 hookReturnData, int128 currencyDelta) {
        if (hookData.length == 0) {
            // No hookData provided, so this is not a prediction attempt. Return early.
            return (BaseHook.afterSwap.selector, 0); // Standard return for no-op or successful completion without currency delta.
        }

        // If hookData is present, it must be the correct length for a prediction.
        if (hookData.length != PREDICTION_HOOK_DATA_LENGTH) {
            revert InvalidHookDataLength(hookData.length, PREDICTION_HOOK_DATA_LENGTH);
        }

        uint256 convictionValueSent = msg.value; // ETH sent with the swap call, forwarded by PoolManager to the hook.

        // Decode marketId and outcome from hookData.
        // Assumes hookData is abi.encode(uint256 marketId, uint8 outcome).
        (uint256 marketId, uint8 outcome) = abi.decode(hookData, (uint256, uint8));

        emit PredictionAttempted(sender, key.toId(), marketId, outcome, convictionValueSent);

        if (convictionValueSent == 0) {
            // Prediction attempt made (hookData provided) but no conviction stake sent.
            revert NoConvictionValueSent();
        }

        // Attempt to record the prediction in the PredictionPool.
        // The `msg.value` (convictionValueSent) is forwarded with this call.
        try predictionPool.recordPrediction{value: convictionValueSent}(sender, marketId, outcome) {
            emit PredictionRecorded(sender, marketId, outcome, convictionValueSent);
        } catch Error(string memory reason) {
            // Failure from PredictionPool (e.g., market closed, invalid stake, etc.)
            emit PredictionFailed(sender, marketId, reason);
            revert PredictionRecordingFailed(reason);
        } catch {
            // Generic failure (e.g., out of gas within the try block, or an error without a string reason)
            emit PredictionFailed(sender, marketId, "Unknown error during prediction recording in PredictionPool");
            revert PredictionRecordingFailed("Unknown error during prediction recording in PredictionPool");
        }

        // Return standard selector indicating successful completion of the afterSwap hook logic.
        // No currencyDelta is returned as the hook itself doesn't adjust pool balances; ETH was forwarded.
        return (BaseHook.afterSwap.selector, 0);
    }

    /**
     * @notice Fallback function to allow the hook to receive ETH.
     * @dev This is crucial because the `PoolManager` forwards `msg.value` (the user's conviction stake)
     *      to this hook when `_afterSwap` is called. Without a payable fallback or receive function,
     *      such calls would revert.
     */
    receive() external payable {}
}

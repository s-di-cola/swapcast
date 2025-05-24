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
            return (BaseHook.afterSwap.selector, 0); // Standard return for no-op or successful completion without currency delta.
        }

        // If hookData is present, it must be the correct length for a prediction.
        if (hookData.length != PREDICTION_HOOK_DATA_LENGTH) {
            revert InvalidHookDataLength(hookData.length, PREDICTION_HOOK_DATA_LENGTH);
        }

        // Decode actualUser, marketId, outcome, and convictionStake from hookData.
        // Assumes hookData is abi.encodePacked(address actualUser, uint256 marketId, uint8 outcome, uint128 convictionStakeDeclared).
        address actualUser;
        uint256 marketId;
        PredictionTypes.Outcome outcome;
        uint128 convictionStakeDeclared;

        // PREDICTION_HOOK_DATA_LENGTH is 20 (actualUser) + 32 (marketId) + 1 (outcome) + 16 (convictionStakeDeclared) = 69 bytes.
        // hookData is abi.encodePacked(address actualUser, uint256 marketId, uint8 outcome, uint128 convictionStakeDeclared)
        // Extract data from hookData more efficiently
        // First 20 bytes for the address
        actualUser = address(bytes20(hookData[:20]));

        // Next 32 bytes for marketId (bytes 20-51)
        marketId = uint256(bytes32(hookData[20:52]));

        // Next 1 byte for outcome (byte 52)
        outcome = PredictionTypes.Outcome(uint8(bytes1(hookData[52:53])));

        // Last 16 bytes for convictionStake (bytes 53-68)
        // We need to handle this carefully since we're extracting a uint128
        uint128 extractedStake;
        assembly {
            // Load the bytes starting at position 53
            let word := calldataload(add(hookData.offset, 53))
            // Extract the upper 128 bits
            extractedStake := shr(128, word)
        }
        convictionStakeDeclared = extractedStake;

        emit PredictionAttempted(actualUser, key.toId(), marketId, outcome, convictionStakeDeclared);

        if (convictionStakeDeclared == 0) {
            revert NoConvictionStakeDeclaredInHookData();
        }

        // Attempt to record the prediction in the PredictionManager.
        uint256 feeBps = predictionManager.protocolFeeBasisPoints();
        uint256 feeAmount = (uint256(convictionStakeDeclared) * feeBps) / 10000;
        uint256 totalEthToSend = uint256(convictionStakeDeclared) + feeAmount;

        // Note: msg.value in _afterSwap is 0 because the ETH is sent to the hook contract directly,
        // not as part of the _afterSwap call

        // The convictionStakeDeclared is passed as an argument. The PredictionManager handles the stake value.
        // This assumes IPredictionManager.recordPrediction signature is: recordPrediction(address user, uint256 marketId, PredictionTypes.Outcome outcome, uint128 convictionStake)
        try predictionManager.recordPrediction{value: totalEthToSend}(
            actualUser, marketId, outcome, convictionStakeDeclared
        ) {
            emit PredictionRecorded(actualUser, key.toId(), marketId, outcome, convictionStakeDeclared);
            return (BaseHook.afterSwap.selector, 0); // Success
        } catch (bytes memory lowLevelData) {
            bytes4 errorSelector = bytes4(0);
            string memory errorMessage = "PredictionManager reverted with an unspecified error.";

            // Extract error selector if available
            if (lowLevelData.length >= 4) {
                // More efficient way to extract the first 4 bytes
                errorSelector = bytes4(lowLevelData);

                // Handle standard Error(string)
                if (errorSelector == bytes4(keccak256("Error(string)"))) {
                    // Extract the error message using a more efficient approach
                    if (lowLevelData.length > 4) {
                        bytes memory encodedString = new bytes(lowLevelData.length - 4);
                        for (uint256 i = 0; i < encodedString.length; i++) {
                            encodedString[i] = lowLevelData[i + 4];
                        }
                        string memory reason = abi.decode(encodedString, (string));
                        errorMessage = string(abi.encodePacked("PredictionManager Error: ", reason));
                    }
                } else {
                    // Custom error
                    errorMessage = "PredictionManager reverted with a custom error.";
                }
            }

            emit PredictionFailed(actualUser, key.toId(), marketId, outcome, convictionStakeDeclared, errorSelector);
            revert PredictionRecordingFailed(errorMessage);
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

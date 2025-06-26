// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPredictionManager} from "./interfaces/IPredictionManager.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";

using PoolIdLibrary for PoolKey;
using SafeERC20 for IERC20;

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
     *      1 byte for `outcome` (uint8). No convictionStake needed as it's auto-calculated from swap amount.
     *      The `_afterSwap` function enforces this length for non-empty hookData.
     */
    uint256 private constant PREDICTION_HOOK_DATA_LENGTH = 53; // 20 bytes for actualUser (address) + 32 bytes for marketId (uint256) + 1 byte for outcome (uint8)

    /// @notice Placeholder address for native ETH
    /// @dev This is used to identify when a transaction intends to use ETH rather than an ERC20 token
    // address constant NATIVE_ETH_PLACEHOLDER = address(0);

    // ToDo: Receive the WETH address and Universal Router address from the constructor parameter
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // Mainnet WETH address
    address constant UNIVERSAL_ROUTER = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af; // Mainnet Universal Router address

    /**
     * @notice Emitted when a user attempts to make a prediction during a swap.
     * @param user The address of the user making the prediction.
     * @param poolId The ID of the pool where the swap occurred.
     * @param marketId The ID of the prediction market.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) automatically calculated from swap.
     * @param swapAmount The original swap amount before taking the 1% fee.
     */
    event PredictionAttempted(
        address indexed user,
        PoolId indexed poolId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStake,
        uint256 swapAmount
    );

    /**
     * @notice Emitted when a prediction is successfully recorded in the PredictionPool.
     * @param user The address of the user making the prediction.
     * @param poolId The ID of the pool where the swap occurred.
     * @param marketId The ID of the prediction market.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) automatically calculated from swap.
     * @param swapAmount The original swap amount before taking the 1% fee.
     */
    event PredictionRecorded(
        address indexed user,
        PoolId indexed poolId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStake,
        uint256 swapAmount
    );

    /**
     * @notice Emitted when a prediction attempt fails to be recorded in the PredictionPool.
     * @param user The address of the user making the prediction.
     * @param poolId The ID of the pool where the swap occurred.
     * @param marketId The ID of the prediction market.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) automatically calculated from swap.
     * @param swapAmount The original swap amount before taking the 1% fee.
     * @param errorSelector The error selector from the PredictionPool's revert, if available.
     */
    event PredictionFailed(
        address indexed user,
        PoolId indexed poolId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint128 convictionStake,
        uint256 swapAmount,
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
     * @notice Reverts if the calculated conviction stake from the swap amount is zero or too small.
     * @dev This error is thrown in the _afterSwap function when the 1% fee calculation results in zero stake.
     *      A non-zero conviction stake is required to ensure users have skin in the game when making predictions.
     */
    error InsufficientSwapAmountForStake();

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
     * @notice Fallback function to allow the hook to receive ETH.
     * @dev This is crucial because the `PoolManager` forwards `msg.value` (the user's conviction stake)
     *      to this hook when `_afterSwap` is called. Without a payable fallback or receive function,
     *      such calls would revert.
     */
    receive() external payable {}

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
     * @notice Internal function to swap tokens to ETH.
     * @dev Uses the Universal Router to perform the swap.
     * @param tokenIn The address of the token to swap.
     * @param amountIn The amount of the token to swap.
     * @param minAmountOut The minimum amount of ETH to receive.
     * @return The amount of ETH received from the swap.
     */
    function _swapTokensForETH(address tokenIn, uint256 amountIn, uint256 minAmountOut) internal returns (uint256) {
        IERC20(tokenIn).forceApprove(UNIVERSAL_ROUTER, amountIn);

        // For simplicity, just do a V3 exactInput swap
        // Command 0x00: V3_SWAP_EXACT_IN
        // ToDo: Import commands library or define commands properly
        bytes memory commands = hex"00";

        // Encode the swap parameters
        bytes[] memory inputs = new bytes[](1);

        // Universal Router V3 exactInput parameters:
        // path, recipient, amountIn, amountOutMinimum
        bytes memory path;
        if (tokenIn == WETH) {
            // If the token is already WETH, we just need to unwrap it
            IWETH9(WETH).withdraw(amountIn);
            return amountIn;
        } else {
            // Otherwise, create a path from tokenIn to WETH
            path = abi.encodePacked(tokenIn, uint24(3000), WETH);

            inputs[0] = abi.encode(path, address(this), amountIn, minAmountOut);

            uint256 ethBalanceBefore = address(this).balance;

            // Execute the swap
            IUniversalRouter(UNIVERSAL_ROUTER).execute(
                commands,
                inputs,
                block.timestamp + 60 // deadline
            );

            // Calculate how much ETH we received
            uint256 ethReceived = address(this).balance - ethBalanceBefore;

            return ethReceived;
        }
    }

    /**
     * @dev Internal callback function executed by the `PoolManager` after a swap on a pool where this hook is registered.
     *      This function contains the core logic for processing prediction attempts with automatic 1% fee staking.
     * @param key The PoolKey identifying the pool where the swap occurred.
     * @param delta The balance changes from the swap (used to calculate the 1% stake).
     * @param hookData Additional data passed to the hook, containing prediction details:
     *                 - bytes 0-19: actualUser (address) - The actual user making the prediction (may differ from sender).
     *                 - bytes 20-51: marketId (uint256) - ID of the prediction market.
     *                 - bytes 52: outcome (uint8) - The predicted outcome (0 for Bearish, 1 for Bullish).
     * @return hookReturnData The selector indicating which hook function was called.
     * @return currencyDelta Currency delta for the 1% fee taken from the swap.
     */
    function _afterSwap(
        address, /*sender*/
        PoolKey calldata key,
        SwapParams calldata, /*params*/
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4 hookReturnData, int128 currencyDelta) {
        // If no prediction data, just return early
        if (hookData.length == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }

        // Validate hookData length - allow 52 or 53 bytes for flexibility
        if (hookData.length != PREDICTION_HOOK_DATA_LENGTH && hookData.length != 52) {
            emit HookDataDebug(hookData.length, PREDICTION_HOOK_DATA_LENGTH, false);
            // If this is likely Universal Router hookData, just skip processing
            return (BaseHook.afterSwap.selector, 0);
        }

        // Try to decode prediction parameters safely
        address actualUser;
        uint256 marketId;
        uint8 outcome;

        // Safe decoding with try/catch to handle malformed Universal Router data
        bool decodingSuccessful = _tryDecodePredictionData(hookData);
        if (!decodingSuccessful) {
            // If decoding fails, this is probably Universal Router data, skip processing
            emit HookDataDebug(hookData.length, PREDICTION_HOOK_DATA_LENGTH, true);
            return (BaseHook.afterSwap.selector, 0);
        }

        // If decoding succeeded, manually extract the packed values
        // Extract address from bytes 0-19 (need to shift right to get the address)
        assembly {
            let data := calldataload(hookData.offset)
            actualUser := shr(96, data) // Shift right 96 bits (12 bytes) to get address from left-aligned 32 bytes
        }

        // Extract uint256 from bytes 20-51
        assembly {
            marketId := calldataload(add(hookData.offset, 20))
        }

        // Extract uint8 from byte 52
        assembly {
            let data := calldataload(add(hookData.offset, 52))
            outcome := byte(0, data) // Get the first byte
        }

        // Additional validation: marketId should be non-zero for valid predictions
        // and outcome should be 0 or 1
        if (marketId == 0 || outcome > 1) {
            emit HookDataDebug(hookData.length, PREDICTION_HOOK_DATA_LENGTH, true);
            return (BaseHook.afterSwap.selector, 0);
        }

        // Calculate the swap amounts
        int128 amount0 = BalanceDeltaLibrary.amount0(delta);
        int128 amount1 = BalanceDeltaLibrary.amount1(delta);

        // Determine which amount is the input (positive means tokens going out of pool to user)
        // For exactInput swaps: amount0 or amount1 will be positive (tokens user receives)
        // We want to take 1% of the input amount, which corresponds to the positive amount
        uint256 swapOutputAmount;
        Currency outputCurrency;

        if (amount0 > 0 && amount1 <= 0) {
            // User is receiving currency0, so they input currency1
            swapOutputAmount = uint256(uint128(amount0));
            outputCurrency = key.currency0;
        } else if (amount1 > 0 && amount0 <= 0) {
            // User is receiving currency1, so they input currency0
            swapOutputAmount = uint256(uint128(amount1));
            outputCurrency = key.currency1;
        } else {
            // Unexpected delta pattern, skip prediction
            return (BaseHook.afterSwap.selector, 0);
        }

        // Calculate 1% fee from the output amount
        uint256 feeAmount = swapOutputAmount / 100;

        // Check if fee amount is sufficient for staking
        if (feeAmount == 0) {
            revert InsufficientSwapAmountForStake();
        }

        // Calculate stake amount based on the 1% fee from swap
        // If the fee amount is too small, use a minimum threshold
        uint256 stakeAmount;
        if (feeAmount >= 0.001 ether) {
            // Use the calculated fee amount if it's substantial enough
            stakeAmount = feeAmount;
        } else if (feeAmount > 0) {
            // For very small swaps, use a minimum stake of 0.01 ETH
            stakeAmount = 0.01 ether;
        } else {
            // If fee calculation results in zero, revert
            revert InsufficientSwapAmountForStake();
        }

        uint128 convictionStake = SafeCast.toUint128(stakeAmount);

        // Calculate the total ETH needed (stake + protocol fee)
        // Get protocol fee basis points from prediction manager
        uint256 feeBasisPoints = predictionManager.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBasisPoints) / 10000;
        uint256 totalEthNeeded = stakeAmount + protocolFee;

        // Record the prediction with calculated stake and total ETH amount
        try predictionManager.recordPrediction{value: totalEthNeeded}(
            actualUser, marketId, PredictionTypes.Outcome(outcome), convictionStake
        ) {
            emit PredictionRecorded(
                actualUser, key.toId(), marketId, PredictionTypes.Outcome(outcome), convictionStake, swapOutputAmount
            );
        } catch Error(string memory reason) {
            string memory errorMessage = string(abi.encode("PredictionManager Error: ", reason));
            emit PredictionFailed(
                actualUser,
                key.toId(),
                marketId,
                PredictionTypes.Outcome(outcome),
                convictionStake,
                swapOutputAmount,
                bytes4(0)
            );
            revert PredictionRecordingFailed(errorMessage);
        } catch (bytes memory errorData) {
            bytes4 errorSelector;
            string memory errorMessage = "Unknown error";

            if (errorData.length >= 4) {
                errorSelector = bytes4(errorData);
                errorMessage = _getCustomErrorMessage(errorSelector);
            }

            emit PredictionFailed(
                actualUser,
                key.toId(),
                marketId,
                PredictionTypes.Outcome(outcome),
                convictionStake,
                swapOutputAmount,
                errorSelector
            );
            revert PredictionRecordingFailed(errorMessage);
        }

        // For now, don't try to take any currency delta
        // Just return zero delta to avoid complex currency handling

        return (BaseHook.afterSwap.selector, 0);
    }

    /**
     * @dev Internal function to safely try decoding hookData without reverting.
     * @param hookData The raw hookData bytes to test.
     * @return success True if decoding succeeded, false otherwise.
     */
    function _tryDecodePredictionData(bytes calldata hookData) internal pure returns (bool success) {
        // Use assembly for safe decoding to avoid reverts
        if (hookData.length < 53) {
            return false;
        }

        // Check if we can safely decode the first 20 bytes as an address
        // and the next 32 bytes as uint256, and the last byte as uint8
        assembly {
            // Load the address (first 20 bytes)
            let addr := shr(96, calldataload(hookData.offset))

            // Load the uint256 (next 32 bytes)
            let marketId := calldataload(add(hookData.offset, 20))

            // Load the uint8 (last byte)
            let outcome := byte(0, calldataload(add(hookData.offset, 52)))

            // Basic validation: address should not be zero, marketId should not be zero, outcome should be 0 or 1
            success := true
            if or(or(iszero(addr), iszero(marketId)), gt(outcome, 1)) { success := false }
        }
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
}

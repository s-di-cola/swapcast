// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "../lib/v4-periphery/src/utils/BaseHook.sol";

import {Currency} from "../lib/v4-periphery/lib/v4-core/src/types/Currency.sol";
import {PoolKey} from "../lib/v4-periphery/lib/v4-core/src/types/PoolKey.sol";
import {PoolId} from "../lib/v4-periphery/lib/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "../lib/v4-periphery/lib/v4-core/src/types/BalanceDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "../lib/v4-periphery/lib/v4-core/src/types/PoolOperation.sol";
import {IPoolManager} from "../lib/v4-periphery/lib/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "../lib/v4-periphery/lib/v4-core/src/libraries/Hooks.sol";
import {PredictionPool} from "./PredictionPool.sol";

/**
 * @title SwapCastHook
 * @notice Uniswap V4 hook for attaching predictions to swaps. Emits events for frontend integration and uses custom errors for strict security.
 * @author [Your Name]
 */
contract SwapCastHook is BaseHook {
    /// @notice The PredictionPool contract used to record predictions.
    PredictionPool public predictionPool;

    /// @notice Emitted when a prediction is successfully recorded for a swap.
    /// @param sender The address making the prediction (swapper)
    /// @param marketId The market ID for the prediction
    /// @param outcome The predicted outcome
    /// @param conviction The conviction (weight) assigned to the prediction
    event PredictionRecorded(address indexed sender, uint256 indexed marketId, uint8 outcome, uint256 conviction);

    /// @notice Emitted when a swap is processed by the hook (regardless of prediction)
    /// @param sender The address that initiated the swap
    /// @param poolKeyHash The hash of the pool key for the swap
    /// @param amount0 Amount of currency0 swapped
    /// @param amount1 Amount of currency1 swapped
    event SwapProcessed(address indexed sender, bytes32 indexed poolKeyHash, int128 amount0, int128 amount1);

    /// @notice Emitted when an invalid prediction attempt is detected
    /// @param sender The address that attempted the invalid prediction
    /// @param reason The reason for the invalid prediction
    event InvalidPrediction(address indexed sender, string reason);

    /// @notice Error for invalid prediction data
    /// @param length The length of the provided hookData
    error InvalidPredictionData(uint256 length);
    /// @notice Error for unauthorized prediction pool
    /// @param predictionPool Address of the prediction pool
    error InvalidPredictionPool(address predictionPool);

    /// @notice Contract constructor
    /// @param _manager The Uniswap V4 pool manager
    /// @param _predictionPool The PredictionPool contract address
    constructor(IPoolManager _manager, address _predictionPool) BaseHook(_manager) {
        if (_predictionPool == address(0)) revert InvalidPredictionPool(_predictionPool);
        predictionPool = PredictionPool(_predictionPool);
    }

    /**
     * @notice Returns the hook permissions for this contract.
     * @dev Only afterSwap is enabled.
     * @return The permissions struct
     */
    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: false,
                beforeAddLiquidity: false,
                beforeRemoveLiquidity: false,
                afterAddLiquidity: false,
                afterRemoveLiquidity: false,
                beforeSwap: false,
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
     * @notice Internal Uniswap V4 hook: called after swaps. Records prediction and emits events.
     * @param sender The swap initiator
     * @param key The pool key
     * @param params The swap parameters
     * @param delta The balance delta
     * @param hookData Encoded prediction data
     * @return selector The selector for afterSwap
     * @return zero Always zero (not used)
     */
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4 selector, int128 zero) {
        // Only act on ETH-TOKEN pools
        if (!key.currency0.isAddressZero()) {
            emit SwapProcessed(sender, keccak256(abi.encode(key)), 0, 0);
            return (this.afterSwap.selector, 0);
        }
        // Only act on zeroForOne swaps
        if (!params.zeroForOne) {
            emit SwapProcessed(sender, keccak256(abi.encode(key)), 0, 0);
            return (this.afterSwap.selector, 0);
        }
        // Parse prediction data from hookData (custom format)
        (uint256 marketId, uint8 outcome) = _decodePrediction(hookData, sender);
        // Calculate conviction weight (e.g., based on swap amount)
        (int128 amount0, int128 amount1, uint256 conviction) = _calculateConviction(delta);
        // Interact with PredictionPool to record prediction
        predictionPool.recordPrediction(sender, marketId, outcome, conviction);
        emit PredictionRecorded(sender, marketId, outcome, conviction);
        emit SwapProcessed(sender, keccak256(abi.encode(key)), amount0, amount1);
        return (this.afterSwap.selector, 0);
    }

    /**
     * @notice Decodes prediction data from hookData and validates length.
     * @param hookData The calldata bytes
     * @param sender The sender (for event emission)
     * @return marketId The marketId
     * @return outcome The predicted outcome
     */
    function _decodePrediction(bytes calldata hookData, address sender) internal returns (uint256 marketId, uint8 outcome) {
        if (hookData.length != 33) {
            emit InvalidPrediction(sender, "Invalid prediction data length");
            revert InvalidPredictionData(hookData.length);
        }
        marketId = uint256(bytes32(hookData[0:32]));
        outcome = uint8(hookData[32]);
    }

    /**
     * @notice Calculates conviction based on swap delta.
     * @param delta The BalanceDelta
     * @return amount0 The absolute value of amount0
     * @return amount1 The absolute value of amount1
     * @return conviction The sum of absolute values
     */
    function _calculateConviction(BalanceDelta delta) internal pure returns (int128 amount0, int128 amount1, uint256 conviction) {
        int256 raw = BalanceDelta.unwrap(delta);
        amount0 = int128(raw >> 128);
        amount1 = int128(uint128(uint256(raw)));
        uint128 abs0 = amount0 >= 0 ? uint128(uint64(uint128(amount0))) : uint128(uint64(uint128(-amount0)));
        uint128 abs1 = amount1 >= 0 ? uint128(uint64(uint128(amount1))) : uint128(uint64(uint128(-amount1)));
        conviction = uint256(abs0) + uint256(abs1);
    }

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleSwapRouter
 * @author SwapCast Team
 * @notice A simple router contract for executing swaps on Uniswap V4 pools with proper token settlement
 * @dev This router handles the complete swap lifecycle including token transfers, pool interactions,
 *      and proper settlement of both input and output tokens. It supports both native ETH and ERC20 tokens
 *      and properly implements Uniswap V4's flash accounting system.
 *
 *      Key features:
 *      - Handles swaps for any token pair (ETH/ERC20, ERC20/ERC20)
 *      - Properly settles input tokens (what user owes)
 *      - Properly takes output tokens (what user receives)
 *      - Supports hook data for additional functionality
 *      - Uses V4's unlock/lock mechanism for gas efficiency
 *
 * @custom:security-contact security@swapcast.xyz
 */
contract SimpleSwapRouter is IUnlockCallback {
    using CurrencyLibrary for Currency;

    /// @notice The Uniswap V4 PoolManager contract that manages all pools
    /// @dev Set as immutable for gas efficiency and security
    IPoolManager public immutable poolManager;

    /**
     * @notice Data structure passed to the unlock callback containing all swap information
     * @param poolKey The pool key identifying the specific pool to swap in
     * @param params The swap parameters (direction, amount, price limits)
     * @param hookData Additional data to pass to hooks (if any)
     * @param user The address that initiated the swap and will receive output tokens
     */
    struct SwapData {
        PoolKey poolKey;
        SwapParams params;
        bytes hookData;
        address user;
    }

    /// @notice Thrown when the swap output is less than expected
    error InsufficientOutput();

    /// @notice Thrown when the swap input exceeds the maximum allowed
    error ExcessiveInput();

    /**
     * @notice Initializes the router with the PoolManager address
     * @param _poolManager The address of the Uniswap V4 PoolManager contract
     */
    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    /**
     * @notice Executes a token swap on a Uniswap V4 pool
     * @dev This function initiates the swap process by calling the PoolManager's unlock mechanism.
     *      The actual swap logic is handled in the unlockCallback function to optimize gas usage
     *      through V4's flash accounting system.
     *
     *      For native ETH swaps, send ETH as msg.value.
     *      For ERC20 swaps, ensure the router has sufficient allowance from the user.
     *
     * @param poolKey The pool identification data including currencies, fee tier, tick spacing, and hooks
     * @param params The swap parameters including:
     *               - zeroForOne: Direction of the swap (true = currency0 -> currency1)
     *               - amountSpecified: The amount to swap (positive = exact input, negative = exact output)
     *               - sqrtPriceLimitX96: The price limit for the swap to prevent excessive slippage
     * @param hookData Additional data to pass to any hooks attached to the pool
     *
     * @custom:example
     * // Swap 1 ETH for USDC with 0.5% slippage protection
     * router.swap{value: 1 ether}(
     *     poolKey,
     *     SwapParams({
     *         zeroForOne: true,
     *         amountSpecified: 1 ether,
     *         sqrtPriceLimitX96: minSqrtPrice
     *     }),
     *     "0x" // No hook data
     * );
     */
    function swap(PoolKey calldata poolKey, SwapParams calldata params, bytes calldata hookData) external payable {
        bytes memory data =
            abi.encode(SwapData({poolKey: poolKey, params: params, hookData: hookData, user: msg.sender}));

        poolManager.unlock(data);
    }

    /**
     * @notice Callback function called by PoolManager during the unlock process
     * @dev This function is called by the PoolManager as part of V4's flash accounting system.
     *      It executes the actual swap and handles the settlement of input/output tokens.
     *
     *      The function:
     *      1. Decodes the swap data
     *      2. Executes the swap on the PoolManager
     *      3. Handles token settlement based on the swap results
     *      4. Ensures proper token transfers to/from the user
     *
     * @param data The encoded SwapData containing all swap information
     * @return Empty bytes (required by the interface)
     *
     * @custom:security Only callable by the PoolManager contract
     */
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");

        SwapData memory swapData = abi.decode(data, (SwapData));

        // Execute the swap
        BalanceDelta delta = poolManager.swap(swapData.poolKey, swapData.params, swapData.hookData);

        // Handle settlement based on swap direction
        _settleDelta(swapData.poolKey, delta, swapData.user);

        return "";
    }

    /**
     * @notice Internal function to handle token settlement after a swap
     * @dev This function processes the BalanceDelta returned by the swap and ensures proper
     *      token transfers. It handles both positive deltas (tokens we receive) and negative
     *      deltas (tokens we owe) for both currencies in the pool.
     *
     *      Delta interpretation:
     *      - Negative delta: We owe tokens to the pool (input tokens)
     *      - Positive delta: We receive tokens from the pool (output tokens)
     *
     *      For input tokens (negative delta):
     *      - Native ETH: Settle directly with msg.value
     *      - ERC20: Transfer from user, approve PoolManager, then settle
     *
     *      For output tokens (positive delta):
     *      - Take tokens from PoolManager and send directly to user
     *
     * @param poolKey The pool key containing currency information
     * @param delta The balance delta from the swap containing amounts owed/received
     * @param user The user address to transfer tokens to/from
     */
    function _settleDelta(PoolKey memory poolKey, BalanceDelta delta, address user) internal {
        // Get the currencies
        Currency currency0 = poolKey.currency0;
        Currency currency1 = poolKey.currency1;

        // Handle currency0 (negative = we owe, positive = we receive)
        if (delta.amount0() < 0) {
            // We owe currency0 to the pool
            // Fix: Properly handle int128 to uint256 conversion for negative values
            uint256 amountOwed = uint256(uint128(-delta.amount0()));

            // Fix: Check if currency is native ETH by comparing to address(0)
            if (Currency.unwrap(currency0) == address(0)) {
                // For native ETH, settle directly with the ETH sent in the transaction
                poolManager.settle{value: amountOwed}();
            } else {
                // For ERC20 tokens, transfer from user and settle
                IERC20(Currency.unwrap(currency0)).transferFrom(user, address(this), amountOwed);
                // Approve PoolManager to take the tokens
                IERC20(Currency.unwrap(currency0)).approve(address(poolManager), amountOwed);
                poolManager.settle();
            }
        } else if (delta.amount0() > 0) {
            // We receive currency0 from the pool - send directly to user
            uint256 amountReceived = uint256(uint128(delta.amount0()));
            poolManager.take(currency0, user, amountReceived);
        }

        // Handle currency1 (negative = we owe, positive = we receive)
        if (delta.amount1() < 0) {
            // We owe currency1 to the pool
            // Fix: Properly handle int128 to uint256 conversion for negative values
            uint256 amountOwed = uint256(uint128(-delta.amount1()));

            // Fix: Check if currency is native ETH by comparing to address(0)
            if (Currency.unwrap(currency1) == address(0)) {
                // For native ETH, settle directly with the ETH sent in the transaction
                poolManager.settle{value: amountOwed}();
            } else {
                // For ERC20 tokens, transfer from user and settle
                IERC20(Currency.unwrap(currency1)).transferFrom(user, address(this), amountOwed);
                // Approve PoolManager to take the tokens
                IERC20(Currency.unwrap(currency1)).approve(address(poolManager), amountOwed);
                poolManager.settle();
            }
        } else if (delta.amount1() > 0) {
            // We receive currency1 from the pool - send directly to user
            uint256 amountReceived = uint256(uint128(delta.amount1()));
            poolManager.take(currency1, user, amountReceived);
        }
    }

    /**
     * @notice Allows the contract to receive native ETH
     * @dev Required for handling native ETH swaps and receiving ETH from the PoolManager
     */
    receive() external payable {}
}

# SimpleSwapRouter
[Git Source](https://github.com/s-di-cola/swapcast/blob/2cc784f538ca7a73dcc2f008a2761d0d012508eb/src/SimpleSwapRouter.sol)

**Inherits:**
IUnlockCallback

**Author:**
SwapCast Team

A simple router contract for executing swaps on Uniswap V4 pools with proper token settlement

*This router handles the complete swap lifecycle including token transfers, pool interactions,
and proper settlement of both input and output tokens. It supports both native ETH and ERC20 tokens
and properly implements Uniswap V4's flash accounting system.
Key features:
- Handles swaps for any token pair (ETH/ERC20, ERC20/ERC20)
- Properly settles input tokens (what user owes)
- Properly takes output tokens (what user receives)
- Supports hook data for additional functionality
- Uses V4's unlock/lock mechanism for gas efficiency*

**Note:**
security-contact: security@swapcast.xyz


## State Variables
### poolManager
The Uniswap V4 PoolManager contract that manages all pools

*Set as immutable for gas efficiency and security*


```solidity
IPoolManager public immutable poolManager;
```


## Functions
### constructor

Initializes the router with the PoolManager address


```solidity
constructor(IPoolManager _poolManager);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolManager`|`IPoolManager`|The address of the Uniswap V4 PoolManager contract|


### swap

Executes a token swap on a Uniswap V4 pool

*This function initiates the swap process by calling the PoolManager's unlock mechanism.
The actual swap logic is handled in the unlockCallback function to optimize gas usage
through V4's flash accounting system.
For native ETH swaps, send ETH as msg.value.
For ERC20 swaps, ensure the router has sufficient allowance from the user.*

**Note:**
example: 
// Swap 1 ETH for USDC with 0.5% slippage protection
router.swap{value: 1 ether}(
poolKey,
SwapParams({
zeroForOne: true,
amountSpecified: 1 ether,
sqrtPriceLimitX96: minSqrtPrice
}),
"0x" // No hook data
);


```solidity
function swap(PoolKey calldata poolKey, SwapParams calldata params, bytes calldata hookData) external payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`poolKey`|`PoolKey`|The pool identification data including currencies, fee tier, tick spacing, and hooks|
|`params`|`SwapParams`|The swap parameters including: - zeroForOne: Direction of the swap (true = currency0 -> currency1) - amountSpecified: The amount to swap (positive = exact input, negative = exact output) - sqrtPriceLimitX96: The price limit for the swap to prevent excessive slippage|
|`hookData`|`bytes`|Additional data to pass to any hooks attached to the pool|


### unlockCallback

Callback function called by PoolManager during the unlock process

*This function is called by the PoolManager as part of V4's flash accounting system.
It executes the actual swap and handles the settlement of input/output tokens.
The function:
1. Decodes the swap data
2. Executes the swap on the PoolManager
3. Handles token settlement based on the swap results
4. Ensures proper token transfers to/from the user*

**Note:**
security: Only callable by the PoolManager contract


```solidity
function unlockCallback(bytes calldata data) external returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|The encoded SwapData containing all swap information|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes`|Empty bytes (required by the interface)|


### _settleDelta

Internal function to handle token settlement after a swap

*This function processes the BalanceDelta returned by the swap and ensures proper
token transfers. It handles both positive deltas (tokens we receive) and negative
deltas (tokens we owe) for both currencies in the pool.
Delta interpretation:
- Negative delta: We owe tokens to the pool (input tokens)
- Positive delta: We receive tokens from the pool (output tokens)
For input tokens (negative delta):
- Native ETH: Settle directly with msg.value
- ERC20: Transfer from user, approve PoolManager, then settle
For output tokens (positive delta):
- Take tokens from PoolManager and send directly to user*


```solidity
function _settleDelta(PoolKey memory poolKey, BalanceDelta delta, address user) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`poolKey`|`PoolKey`|The pool key containing currency information|
|`delta`|`BalanceDelta`|The balance delta from the swap containing amounts owed/received|
|`user`|`address`|The user address to transfer tokens to/from|


### receive

Allows the contract to receive native ETH

*Required for handling native ETH swaps and receiving ETH from the PoolManager*


```solidity
receive() external payable;
```

## Errors
### InsufficientOutput
Thrown when the swap output is less than expected


```solidity
error InsufficientOutput();
```

### ExcessiveInput
Thrown when the swap input exceeds the maximum allowed


```solidity
error ExcessiveInput();
```

## Structs
### SwapData
Data structure passed to the unlock callback containing all swap information


```solidity
struct SwapData {
    PoolKey poolKey;
    SwapParams params;
    bytes hookData;
    address user;
}
```

**Properties**

|Name|Type|Description|
|----|----|-----------|
|`poolKey`|`PoolKey`|The pool key identifying the specific pool to swap in|
|`params`|`SwapParams`|The swap parameters (direction, amount, price limits)|
|`hookData`|`bytes`|Additional data to pass to hooks (if any)|
|`user`|`address`|The address that initiated the swap and will receive output tokens|


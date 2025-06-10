# SwapCastHook
[Git Source](https://github.com/s-di-cola/swapcast/blob/2cc784f538ca7a73dcc2f008a2761d0d012508eb/src/SwapCastHook.sol)

**Inherits:**
BaseHook, Ownable

**Author:**
Simone Di Cola

A Uniswap V4 hook designed to enable users to make predictions on market outcomes
concurrently with their swap transactions on a Uniswap V4 pool.

*This hook integrates with the SwapCast `PredictionManager`. When a user performs a swap via the `PoolManager`
and includes specific `hookData` (market ID and predicted outcome), this hook's `_afterSwap` logic is triggered.
The user's conviction (stake) is passed as `msg.value` with the swap call, which the `PoolManager` forwards to this hook.
The hook then attempts to record this prediction in the `PredictionManager`.
It inherits from `BaseHook` and primarily utilizes the `afterSwap` permission.*


## State Variables
### predictionManager
The instance of the PredictionManager contract where predictions are recorded.

*This address is set immutably during deployment via the constructor.
It must conform to the {IPredictionManager} interface.*


```solidity
IPredictionManager public immutable predictionManager;
```


### PREDICTION_HOOK_DATA_LENGTH
Expected length in bytes for the `hookData` when making a prediction.

*This constant represents 20 bytes for `actualUser` (address) + 32 bytes for `marketId` (uint256) +
1 byte for `outcome` (uint8) + 16 bytes for `convictionStake` (uint128).
The `_afterSwap` function enforces this length for non-empty hookData.*


```solidity
uint256 private constant PREDICTION_HOOK_DATA_LENGTH = 69;
```


## Functions
### constructor

Contract constructor.

*Initializes the contract with the PoolManager and PredictionManager addresses.
Also initializes the Ownable contract with the deployer as the initial owner.
This owner will have the ability to recover ETH in emergency situations.*


```solidity
constructor(IPoolManager _poolManager, address _predictionManagerAddress) BaseHook(_poolManager) Ownable(msg.sender);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolManager`|`IPoolManager`|The address of the Uniswap V4 PoolManager this hook will be registered with. Passed to the `BaseHook` constructor.|
|`_predictionManagerAddress`|`address`|The address of the `PredictionManager` contract where predictions will be recorded. Cannot be the zero address.|


### poolManagerOnly

*Modifier to restrict function calls to the `PoolManager` only.
Note: `BaseHook` already provides protection for its hook callback functions (e.g., `_afterSwap`),
making them callable only by the `poolManager`. This modifier might be redundant for such overrides
but could be used for other custom external functions if added to this hook.*


```solidity
modifier poolManagerOnly();
```

### getHookPermissions

Defines the permissions for this hook, indicating which hook points it will implement.

*Overrides `BaseHook.getHookPermissions`.
This implementation enables only the `afterSwap` hook point, meaning the hook logic
in `_afterSwap` will be executed by the `PoolManager` after a swap transaction is processed.*


```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory permissions);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`permissions`|`Hooks.Permissions`|A `Hooks.Permissions` struct with `afterSwap` set to true and all others false.|


### _afterSwap

*Internal callback function executed by the `PoolManager` after a swap on a pool where this hook is registered.
This function contains the core logic for processing prediction attempts. It handles both direct PoolManager calls
and Universal Router calls with different hookData formats.*


```solidity
function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata hookData)
    internal
    override
    returns (bytes4 hookReturnData, int128 currencyDelta);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`||
|`key`|`PoolKey`|The PoolKey identifying the pool where the swap occurred.|
|`<none>`|`SwapParams`||
|`<none>`|`BalanceDelta`||
|`hookData`|`bytes`|Additional data passed to the hook, containing prediction details: - bytes 0-19: actualUser (address) - The actual user making the prediction (may differ from sender). - bytes 20-51: marketId (uint256) - ID of the prediction market. - bytes 52: outcome (uint8) - The predicted outcome (0 for Bearish, 1 for Bullish). - bytes 53-68: convictionStake (uint128) - Amount of conviction (stake) declared.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`hookReturnData`|`bytes4`|The selector indicating which hook function was called.|
|`currencyDelta`|`int128`|Any currency delta to be applied (always 0 for this hook).|


### _extractErrorMessage

*Internal helper function to extract an error message from a standard Error(string) revert.*


```solidity
function _extractErrorMessage(bytes memory data) internal pure returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`data`|`bytes`|The raw bytes data from the caught exception.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|The extracted error message with a prefix.|


### _uint256ToString

*Internal helper function to convert a uint256 to a string.*


```solidity
function _uint256ToString(uint256 value) internal pure returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`value`|`uint256`|The uint256 value to convert.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|The string representation of the value.|


### _getCustomErrorMessage

*Internal helper function to map known error selectors to human-readable messages.*


```solidity
function _getCustomErrorMessage(bytes4 errorSelector) internal pure returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`errorSelector`|`bytes4`|The 4-byte error selector.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|A human-readable error message.|


### recoverETH

Allows the owner to recover ETH stuck in the contract in case of emergency.

*This function provides a safety mechanism to recover ETH that might get stuck in the contract
due to failed prediction attempts or other unexpected scenarios. It includes the following
security controls:
1. Only the contract owner can call this function (via the onlyOwner modifier)
2. The recipient address cannot be the zero address
3. The function reverts if the ETH transfer fails
This function should only be used in emergency situations when ETH is genuinely stuck
and cannot be processed through normal means.*


```solidity
function recoverETH(address _to, uint256 _amount) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address`|The address to send the recovered ETH to.|
|`_amount`|`uint256`|The amount of ETH to recover.|


### receive

Fallback function to allow the hook to receive ETH.

*This is crucial because the `PoolManager` forwards `msg.value` (the user's conviction stake)
to this hook when `_afterSwap` is called. Without a payable fallback or receive function,
such calls would revert.*


```solidity
receive() external payable;
```

## Events
### PredictionAttempted
Emitted when a user attempts to make a prediction during a swap.


```solidity
event PredictionAttempted(
    address indexed user,
    PoolId indexed poolId,
    uint256 marketId,
    PredictionTypes.Outcome outcome,
    uint128 convictionStake
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user making the prediction.|
|`poolId`|`PoolId`|The ID of the pool where the swap occurred.|
|`marketId`|`uint256`|The ID of the prediction market.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStake`|`uint128`|The amount of conviction (stake) declared for this prediction.|

### PredictionRecorded
Emitted when a prediction is successfully recorded in the PredictionPool.


```solidity
event PredictionRecorded(
    address indexed user,
    PoolId indexed poolId,
    uint256 marketId,
    PredictionTypes.Outcome outcome,
    uint128 convictionStake
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user making the prediction.|
|`poolId`|`PoolId`|The ID of the pool where the swap occurred.|
|`marketId`|`uint256`|The ID of the prediction market.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStake`|`uint128`|The amount of conviction (stake) declared for this prediction.|

### PredictionFailed
Emitted when a prediction attempt fails to be recorded in the PredictionPool.


```solidity
event PredictionFailed(
    address indexed user,
    PoolId indexed poolId,
    uint256 marketId,
    PredictionTypes.Outcome outcome,
    uint128 convictionStake,
    bytes4 errorSelector
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user making the prediction.|
|`poolId`|`PoolId`|The ID of the pool where the swap occurred.|
|`marketId`|`uint256`|The ID of the prediction market.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStake`|`uint128`|The amount of conviction (stake) declared for this prediction.|
|`errorSelector`|`bytes4`|The error selector from the PredictionPool's revert, if available.|

### HookDataDebug
Emitted when debug information about hookData is received.


```solidity
event HookDataDebug(uint256 receivedLength, uint256 expectedLength, bool isUniversalRouter);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receivedLength`|`uint256`|The actual length of the `hookData` received.|
|`expectedLength`|`uint256`|The expected length for valid prediction `hookData`.|
|`isUniversalRouter`|`bool`|A boolean indicating whether the hookData was received from a Universal Router.|

## Errors
### HookDataParsingFailed
Reverts if the provided `hookData` cannot be parsed.

*Currently, this error is defined but not explicitly used to validate against `PREDICTION_HOOK_DATA_LENGTH`.
It could be used if stricter `hookData` length validation is implemented.*


```solidity
error HookDataParsingFailed(string reason);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`reason`|`string`|A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.|

### InvalidHookDataLength
Reverts if the provided `hookData` has an unexpected length.

*Currently, this error is defined but not explicitly used to validate against `PREDICTION_HOOK_DATA_LENGTH`.
It could be used if stricter `hookData` length validation is implemented.*


```solidity
error InvalidHookDataLength(uint256 actualLength, uint256 expectedLength);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`actualLength`|`uint256`|The actual length of the `hookData` received.|
|`expectedLength`|`uint256`|The expected length for valid prediction `hookData`.|

### PredictionPoolZeroAddress
Reverts during construction if the provided `_predictionManagerAddress` is the zero address.


```solidity
error PredictionPoolZeroAddress();
```

### NoConvictionStakeDeclaredInHookData
Reverts if a user attempts to make a prediction (`hookData` is provided) but the conviction stake declared in `hookData` is zero.

*This error is thrown in the _afterSwap function when a prediction attempt is made with zero conviction stake.
A non-zero conviction stake is required to ensure users have skin in the game when making predictions.*


```solidity
error NoConvictionStakeDeclaredInHookData();
```

### PredictionRecordingFailed
Reverts if the call to `predictionManager.recordPrediction` fails for any reason.

*This error is thrown when the try/catch block in _afterSwap catches an exception from the PredictionManager.
The error includes the reason for the failure to help with debugging and user feedback.*


```solidity
error PredictionRecordingFailed(string reason);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`reason`|`string`|A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.|

### ETHTransferFailed
Reverts if an ETH transfer fails during recovery.

*This error is thrown by the recoverETH function if the ETH transfer to the specified address fails.*


```solidity
error ETHTransferFailed();
```

### ZeroAddress
Reverts if a zero address is provided where a non-zero address is required.

*This error is used in functions that require valid addresses, such as recoverETH.*


```solidity
error ZeroAddress();
```

### InsufficientBalance
Reverts if an attempt is made to recover more ETH than is available in the contract.

*This error is thrown by the recoverETH function if the requested amount exceeds the contract's balance.*


```solidity
error InsufficientBalance(uint256 requested, uint256 available);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`requested`|`uint256`|The amount of ETH requested to recover.|
|`available`|`uint256`|The actual balance available in the contract.|


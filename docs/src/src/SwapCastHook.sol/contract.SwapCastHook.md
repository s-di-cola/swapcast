# SwapCastHook
[Git Source](https://github.com/s-di-cola/swapcast/blob/ebb783f801f69f45534f11abb1a8ca6315371d19/src/SwapCastHook.sol)

**Inherits:**
BaseHook

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


```solidity
constructor(IPoolManager _poolManager, address _predictionManagerAddress) BaseHook(_poolManager);
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
This function contains the core logic for processing prediction attempts.*


```solidity
function _afterSwap(address sender, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata hookData)
    internal
    override
    returns (bytes4 hookReturnData, int128 currencyDelta);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|The address of the user who initiated the swap transaction (the `msg.sender` to `PoolManager`).|
|`key`|`PoolKey`|The `PoolKey` identifying the pool where the swap occurred.|
|`<none>`|`SwapParams`||
|`<none>`|`BalanceDelta`||
|`hookData`|`bytes`|Arbitrary data passed by the user with the swap. For this hook, it's expected to contain the `actualUser` (address), `marketId` (uint256), `outcome` (uint8), and `convictionStake` (uint128) for the prediction, abi-encoded.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`hookReturnData`|`bytes4`|The selector of the function in `BaseHook` to be called by `PoolManager` upon completion (typically `BaseHook.afterSwap.selector`).|
|`currencyDelta`|`int128`|A currency delta to be applied by the `PoolManager`. This hook returns 0, as it does not directly modify pool balances; `convictionStake` is handled by forwarding to the `PredictionPool`.|


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

## Errors
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


```solidity
error NoConvictionStakeDeclaredInHookData();
```

### PredictionRecordingFailed
Reverts if the call to `predictionManager.recordPrediction` fails for any reason.


```solidity
error PredictionRecordingFailed(string reason);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`reason`|`string`|A string describing the reason for the failure, forwarded from the `PredictionPool` or a general message.|


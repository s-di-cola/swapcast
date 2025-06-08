# SimpleSwapRouter
[Git Source](https://github.com/s-di-cola/swapcast/blob/9e0c2c2136c1eba926018c594f314999e636e11f/src/SimpleSwapRouter.sol)

**Inherits:**
IUnlockCallback


## State Variables
### poolManager

```solidity
IPoolManager public immutable poolManager;
```


## Functions
### constructor


```solidity
constructor(IPoolManager _poolManager);
```

### swap


```solidity
function swap(PoolKey calldata poolKey, SwapParams calldata params, bytes calldata hookData) external payable;
```

### unlockCallback


```solidity
function unlockCallback(bytes calldata data) external returns (bytes memory);
```

## Structs
### SwapData

```solidity
struct SwapData {
    PoolKey poolKey;
    SwapParams params;
    bytes hookData;
}
```


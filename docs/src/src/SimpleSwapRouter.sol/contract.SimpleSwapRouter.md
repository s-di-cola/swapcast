# SimpleSwapRouter
[Git Source](https://github.com/s-di-cola/swapcast/blob/4b3bf884f5e8c2b3dd98a217f8f4199a2e53fc50/src/SimpleSwapRouter.sol)

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


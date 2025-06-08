# SimpleSwapRouter
[Git Source](https://github.com/s-di-cola/swapcast/blob/0e1182ac1eb5fba94f506ab0c9c3d9974c991b30/src/SimpleSwapRouter.sol)

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


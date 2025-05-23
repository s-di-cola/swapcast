# PredictionTypes
[Git Source](https://github.com/s-di-cola/swapcast/blob/2a5fbcf2444e0ac43b208ab177dd275c83817321/src/types/PredictionTypes.sol)

**Author:**
SwapCast Team

Contains type definitions for the SwapCast prediction system


## Errors
### InvalidMarketId

```solidity
error InvalidMarketId();
```

### InvalidAssetSymbol

```solidity
error InvalidAssetSymbol();
```

### InvalidMarketName

```solidity
error InvalidMarketName();
```

### InvalidPriceAggregator

```solidity
error InvalidPriceAggregator();
```

### ValueMismatch

```solidity
error ValueMismatch();
```

### PriceAtThreshold

```solidity
error PriceAtThreshold();
```

## Enums
### Outcome
Enum representing possible prediction outcomes

*Bearish (0) = price will go down, Bullish (1) = price will go up*


```solidity
enum Outcome {
    Bearish,
    Bullish,
    Undetermined
}
```


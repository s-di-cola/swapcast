# PredictionTypes
[Git Source](https://github.com/s-di-cola/swapcast/blob/2174af1482c339fd15fd6eb3baaa600ea7d38ee2/src/types/PredictionTypes.sol)

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
    Bullish
}
```


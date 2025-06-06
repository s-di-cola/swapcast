# IPredictionManagerForResolver
[Git Source](https://github.com/s-di-cola/swapcast/blob/10bd380d3ca954e00d476d112e2195c2a1a31bee/src/interfaces/IPredictionManagerForResolver.sol)

**Author:**
SwapCast Developers

Interface for the PredictionManager, specifically for functions called by the OracleResolver.


## Functions
### resolveMarket

Called by the OracleResolver to resolve a market and set its winning outcome.

*The PredictionManager will update the market's state to resolved and store the winning outcome.
It should ensure the market exists and is not already resolved.*


```solidity
function resolveMarket(uint256 marketId, PredictionTypes.Outcome winningOutcome, int256 oraclePrice) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market to resolve.|
|`winningOutcome`|`PredictionTypes.Outcome`|The determined winning outcome (Bearish or Bullish).|
|`oraclePrice`|`int256`|The price reported by the oracle at the time of resolution.|


## Events
### MarketResolved
Emitted when a market is resolved.


```solidity
event MarketResolved(
    uint256 indexed marketId, PredictionTypes.Outcome winningOutcome, int256 price, uint256 totalPrizePool
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market resolved.|
|`winningOutcome`|`PredictionTypes.Outcome`|The determined winning outcome (Bearish or Bullish).|
|`price`|`int256`|The oracle price at the time of resolution.|
|`totalPrizePool`|`uint256`|The total prize pool distributed for this market.|


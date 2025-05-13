# IPredictionManager
[Git Source](https://github.com/s-di-cola/swapcast/blob/eb5a7b8147991d5230d576543e0739ccc414f8e8/src/interfaces/IPredictionManager.sol)

**Author:**
SwapCast Developers

Defines the interface for the PredictionManager contract, primarily for interaction from the SwapCastHook.


## Functions
### recordPrediction

Records a user's prediction and associated stake.

*This function is called by the hook, which passes the stake amount declared in hookData.*


```solidity
function recordPrediction(
    address user,
    uint256 marketId,
    PredictionTypes.Outcome outcome,
    uint128 convictionStakeDeclared
) external payable;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user making the prediction.|
|`marketId`|`uint256`|The ID of the market for which the prediction is made.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStakeDeclared`|`uint128`|The amount of conviction (stake) declared for this prediction.|


### protocolFeeBasisPoints

Returns the current protocol fee in basis points.


```solidity
function protocolFeeBasisPoints() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The protocol fee in basis points (e.g., 100 for 1%).|



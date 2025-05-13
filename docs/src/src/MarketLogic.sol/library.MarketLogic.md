# MarketLogic
[Git Source](https://github.com/s-di-cola/swapcast/blob/aea5e87d52be7aa489f5233d1da4c98b586ed876/src/MarketLogic.sol)

**Author:**
Simone Di Cola

Provides the core logic for operating on individual prediction markets.
Functions in this library act on the MarketData storage struct defined in PredictionManager.


## Functions
### recordPrediction

Records a user's prediction for a given market.


```solidity
function recordPrediction(
    PredictionManager.Market storage market,
    address user,
    PredictionTypes.Outcome outcome,
    uint256 convictionStakeDeclared,
    ISwapCastNFT swapCastNFT,
    address treasuryAddress,
    uint256 protocolFeeBasisPoints,
    uint256 minStakeAmount
) internal returns (uint256 stakeAmountNet, uint256 protocolFee);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data in PredictionManager.|
|`user`|`address`|The address of the user making the prediction.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome.|
|`convictionStakeDeclared`|`uint256`|The total ETH amount sent by the user for this prediction.|
|`swapCastNFT`|`ISwapCastNFT`|The ISwapCastNFT contract instance.|
|`treasuryAddress`|`address`|The address for protocol fees.|
|`protocolFeeBasisPoints`|`uint256`|The fee percentage.|
|`minStakeAmount`|`uint256`|The minimum net stake allowed.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`stakeAmountNet`|`uint256`|The net stake amount after fees.|
|`protocolFee`|`uint256`|The calculated protocol fee.|


### resolve

Resolves a market with the given winning outcome and oracle price.


```solidity
function resolve(PredictionManager.Market storage market, PredictionTypes.Outcome winningOutcome_, int256)
    internal
    returns (uint256 totalPrizePool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data.|
|`winningOutcome_`|`PredictionTypes.Outcome`|The determined winning outcome.|
|`<none>`|`int256`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalPrizePool`|`uint256`|The total prize pool in the market.|


### claimReward

Calculates and facilitates a reward claim for a winning NFT.


```solidity
function claimReward(
    PredictionManager.Market storage market,
    uint256 tokenId,
    PredictionTypes.Outcome predictionOutcome,
    uint256 userConvictionStake,
    address nftOwner,
    ISwapCastNFT swapCastNFT
) internal returns (uint256 rewardAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data.|
|`tokenId`|`uint256`|The ID of the SwapCastNFT.|
|`predictionOutcome`|`PredictionTypes.Outcome`|The outcome predicted by the NFT.|
|`userConvictionStake`|`uint256`|The stake amount from the NFT.|
|`nftOwner`|`address`|The owner of the NFT.|
|`swapCastNFT`|`ISwapCastNFT`|The ISwapCastNFT contract instance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`rewardAmount`|`uint256`|The total reward amount paid to the NFT owner.|


### isPastExpiration

Checks if a market is past its expiration time.


```solidity
function isPastExpiration(PredictionManager.Market storage market) internal view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if expired, false otherwise.|


### getOutcomeFromOracle

Fetches oracle price and determines outcome. Reverts if price is stale.


```solidity
function getOutcomeFromOracle(PredictionManager.Market storage market, uint256 maxPriceStaleness)
    internal
    view
    returns (PredictionTypes.Outcome outcome, int256 price);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data.|
|`maxPriceStaleness`|`uint256`|The max allowed staleness for the oracle feed.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`outcome`|`PredictionTypes.Outcome`|The determined winning outcome based on the oracle price.|
|`price`|`int256`|The oracle price.|


## Errors
### MarketAlreadyResolvedL

```solidity
error MarketAlreadyResolvedL();
```

### MarketNotResolvedL

```solidity
error MarketNotResolvedL();
```

### AlreadyPredictedL

```solidity
error AlreadyPredictedL(address user);
```

### AmountCannotBeZeroL

```solidity
error AmountCannotBeZeroL();
```

### StakeBelowMinimumL

```solidity
error StakeBelowMinimumL(uint256 sentAmount, uint256 minRequiredAmount);
```

### RewardTransferFailedL

```solidity
error RewardTransferFailedL();
```

### FeeTransferFailedL

```solidity
error FeeTransferFailedL();
```

### NotWinningNFTL

```solidity
error NotWinningNFTL();
```

### ClaimFailedNoStakeForOutcomeL

```solidity
error ClaimFailedNoStakeForOutcomeL();
```

### PriceOracleStaleL

```solidity
error PriceOracleStaleL();
```

### MarketExpiredL

```solidity
error MarketExpiredL();
```

### MarketNotYetExpiredL

```solidity
error MarketNotYetExpiredL();
```


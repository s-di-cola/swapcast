# MarketLogic
[Git Source](https://github.com/s-di-cola/swapcast/blob/ba2fdc6e1d72f031c7a1c408325851028341c3b0/src/MarketLogic.sol)

**Author:**
Simone Di Cola

Provides the core logic for operating on individual prediction markets.

*Functions in this library act on the Market storage struct defined in PredictionManager.
This library centralizes the core business logic for prediction markets to improve code organization,
reduce duplication, and facilitate testing. It handles operations like recording predictions,
resolving markets, and calculating rewards.*


## Functions
### recordPrediction

Records a user's prediction for a given market and mints an NFT representing their position.

*This function handles the core logic for recording predictions, including:
- Validating market state (not expired, not resolved)
- Validating user eligibility (not already predicted)
- Calculating and transferring protocol fees
- Updating market state with the user's prediction
- Minting an NFT to represent the user's position
The function implements several gas optimizations by caching storage variables
to reduce SLOADs and follows a checks-effects-interactions pattern for security.*

**Note:**
security: The caller (PredictionManager) is responsible for:
- Validating that user address is not zero
- Ensuring msg.value covers both stake and fee
- Emitting appropriate events


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
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStakeDeclared`|`uint256`|The net ETH amount the user wants to stake (excluding fees).|
|`swapCastNFT`|`ISwapCastNFT`|The ISwapCastNFT contract instance used to mint the position NFT.|
|`treasuryAddress`|`address`|The address where protocol fees are sent.|
|`protocolFeeBasisPoints`|`uint256`|The fee percentage in basis points (1/100 of 1%).|
|`minStakeAmount`|`uint256`|The minimum net stake amount allowed.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`stakeAmountNet`|`uint256`|The net stake amount (same as convictionStakeDeclared).|
|`protocolFee`|`uint256`|The calculated protocol fee amount that was transferred to treasury.|


### resolve

Resolves a market with the given winning outcome and oracle price.

*This function finalizes a prediction market by:
- Validating the market is not already resolved
- Setting the winning outcome based on oracle data
- Calculating the total prize pool (sum of all stakes)
The market resolution is a critical step that determines which predictions
were correct and enables users to claim their rewards. After resolution,
no new predictions can be made for this market, and users with winning
predictions can claim their rewards.*

**Note:**
security: The caller (PredictionManager) is responsible for:
- Ensuring only authorized resolvers can call this function
- Verifying the market has expired before resolution
- Emitting appropriate events with resolution details


```solidity
function resolve(PredictionManager.Market storage market, PredictionTypes.Outcome winningOutcome_, int256 oraclePrice)
    internal
    returns (uint256 totalPrizePool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data.|
|`winningOutcome_`|`PredictionTypes.Outcome`|The determined winning outcome (Bearish or Bullish).|
|`oraclePrice`|`int256`|The price from the oracle at resolution time (unused but available).|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalPrizePool`|`uint256`|The total prize pool for the market (sum of all stakes).|


### claimReward

Calculates and facilitates a reward claim for a winning NFT position.

*This function handles the complete reward claim process, including:
- Validating market state (must be resolved)
- Validating the NFT represents a winning prediction
- Calculating the reward amount based on the user's stake and the total stakes
- Burning the NFT after successful claim
- Transferring the reward to the NFT owner
The reward calculation follows these rules:
1. The user always gets their original stake back
2. If their prediction was correct, they also get a proportional share of the losing pool
based on their stake relative to the total winning pool
The function implements gas optimizations by caching storage variables to reduce SLOADs
and follows a checks-effects-interactions pattern for security (burning NFT before transfer).*

**Note:**
security: The caller (PredictionManager) is responsible for:
- Verifying NFT ownership
- Emitting appropriate events
- Handling any errors during the claim process


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
|`tokenId`|`uint256`|The ID of the SwapCastNFT to claim rewards for.|
|`predictionOutcome`|`PredictionTypes.Outcome`|The outcome predicted by the NFT (verified against market's winning outcome).|
|`userConvictionStake`|`uint256`|The amount staked by the user for this prediction.|
|`nftOwner`|`address`|The current owner of the NFT who will receive the reward.|
|`swapCastNFT`|`ISwapCastNFT`|The ISwapCastNFT contract instance used to burn the NFT.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`rewardAmount`|`uint256`|The total reward amount paid to the NFT owner.|


### isPastExpiration

Checks if a market is past its expiration time.

*This utility function provides a clean way to determine if a market has expired.
A market is considered expired when the current block timestamp is greater than or
equal to the market's expiration time. Expired markets can be resolved but cannot
accept new predictions.*


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
|`<none>`|`bool`|True if the market has expired (block.timestamp >= expirationTime), false otherwise.|


### getOutcomeFromOracle

Fetches price from Chainlink oracle and determines the market outcome based on the price threshold.

*This function interacts with a Chainlink price aggregator to:
1. Fetch the latest price data for the asset pair
2. Verify the price data is fresh (not stale)
3. Determine the winning outcome by comparing the price to the market's threshold
The function implements important safeguards:
- Reverts if the price aggregator address is zero
- Reverts if the price data is stale (older than maxPriceStaleness)
- Handles the edge case where price exactly matches the threshold*

**Note:**
security: This function relies on Chainlink's security model for accurate price data.
The caller should ensure the price aggregator is trusted and properly configured.


```solidity
function getOutcomeFromOracle(PredictionManager.Market storage market, uint256 maxPriceStaleness)
    internal
    view
    returns (PredictionTypes.Outcome outcome, int256 price);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`market`|`PredictionManager.Market`|The storage reference to the market data containing the price aggregator and threshold.|
|`maxPriceStaleness`|`uint256`|The maximum allowed age (in seconds) for the oracle price data.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`outcome`|`PredictionTypes.Outcome`|The determined winning outcome based on the oracle price comparison to threshold.|
|`price`|`int256`|The raw price value retrieved from the oracle.|


## Errors
### MarketAlreadyResolved
Thrown when attempting to perform an action on a market that is already resolved.


```solidity
error MarketAlreadyResolved();
```

### MarketNotResolved
Thrown when attempting to claim a reward for a market that is not yet resolved.


```solidity
error MarketNotResolved();
```

### AlreadyPredicted
Thrown when a user attempts to make a prediction for a market they have already predicted on.


```solidity
error AlreadyPredicted(address user);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user who has already made a prediction.|

### AmountCannotBeZero
Thrown when attempting to record a prediction with zero stake amount.


```solidity
error AmountCannotBeZero();
```

### StakeBelowMinimum
Thrown when the stake amount is below the minimum required amount.


```solidity
error StakeBelowMinimum(uint256 sentAmount, uint256 minRequiredAmount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sentAmount`|`uint256`|The amount sent by the user.|
|`minRequiredAmount`|`uint256`|The minimum required stake amount.|

### RewardTransferFailed
Thrown when the transfer of a reward to the user fails.


```solidity
error RewardTransferFailed();
```

### FeeTransferFailed
Thrown when the transfer of a fee to the treasury fails.


```solidity
error FeeTransferFailed();
```

### NotWinningNFT
Thrown when attempting to claim a reward for an NFT that did not predict the winning outcome.


```solidity
error NotWinningNFT();
```

### ClaimFailedNoStakeForOutcome
Thrown when attempting to claim a reward but there are no stakes for the outcome.


```solidity
error ClaimFailedNoStakeForOutcome();
```

### PriceOracleStale
Thrown when the price data from the oracle is stale.


```solidity
error PriceOracleStale();
```

### MarketExpired
Thrown when attempting to record a prediction for a market that has already expired.


```solidity
error MarketExpired();
```

### MarketNotYetExpired
Thrown when attempting to resolve a market that has not yet expired.


```solidity
error MarketNotYetExpired();
```


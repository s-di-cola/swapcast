# IPredictionManagerForDistributor
[Git Source](https://github.com/s-di-cola/swapcast/blob/e3a4a8500a708ca47d37ab0d086dccb943c32a39/src/interfaces/IPredictionManagerForDistributor.sol)

**Author:**
SwapCast Developers

Defines the interface for the PredictionManager contract, specifically for interactions
initiated by the RewardDistributor.


## Functions
### claimReward

Called by the RewardDistributor to process a reward claim for a given NFT.

*The implementation in PredictionManager needs to handle how the claimant is identified,
as msg.sender will be the RewardDistributor contract.*


```solidity
function claimReward(uint256 tokenId) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The ID of the SwapCastNFT representing the user's position.|



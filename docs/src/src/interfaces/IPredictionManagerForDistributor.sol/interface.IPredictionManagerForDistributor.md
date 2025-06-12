# IPredictionManagerForDistributor
[Git Source](https://github.com/s-di-cola/swapcast/blob/dbcbac891458b32482c3b0b147075506087f6b7d/src/interfaces/IPredictionManagerForDistributor.sol)

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



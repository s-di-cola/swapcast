# IPredictionManagerForDistributor
[Git Source](https://github.com/s-di-cola/swapcast/blob/88d8bde27d6b1e5a64749c80e888344e6f0fdadc/src/interfaces/IPredictionManagerForDistributor.sol)

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



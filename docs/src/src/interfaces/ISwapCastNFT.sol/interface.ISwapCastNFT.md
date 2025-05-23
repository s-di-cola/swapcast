# ISwapCastNFT
[Git Source](https://github.com/s-di-cola/swapcast/blob/e3a4a8500a708ca47d37ab0d086dccb943c32a39/src/interfaces/ISwapCastNFT.sol)

**Author:**
SwapCast Developers

Interface for the SwapCastNFT contract, defining the external functions
callable by other contracts, particularly the PredictionPool.

*This interface ensures that implementing contracts adhere to a specific set of functions
for minting, burning, and retrieving details of prediction NFTs.*


## Functions
### mint

Mints a new NFT representing a prediction.

*This function should be implemented by the SwapCastNFT contract and be callable
by an authorized PredictionPool contract. It is responsible for creating a new NFT
and associating it with the provided prediction details.*


```solidity
function mint(address _to, uint256 _marketId, PredictionTypes.Outcome _outcome, uint256 _convictionStake)
    external
    returns (uint256 tokenId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address`|The address to mint the NFT to.|
|`_marketId`|`uint256`|The ID of the market the prediction is for.|
|`_outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`_convictionStake`|`uint256`|The amount of conviction (e.g., in wei) staked on this prediction.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The unique ID of the newly minted token.|


### burn

Burns an existing NFT.

*This function should be implemented by the SwapCastNFT contract and be callable
by an authorized PredictionPool contract. Burning typically occurs after a prediction
is resolved and any associated rewards are claimed, or if a position is otherwise invalidated.*


```solidity
function burn(uint256 _tokenId) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the token to burn.|


### getPredictionDetails

Retrieves the details associated with a specific prediction NFT.

*This function allows querying of the core attributes of a prediction NFT.
It should be implemented by the SwapCastNFT contract.*


```solidity
function getPredictionDetails(uint256 _tokenId)
    external
    view
    returns (uint256 marketId, PredictionTypes.Outcome outcome, uint256 convictionStake, address owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the token to query.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The market ID associated with the NFT.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome stored in the NFT (Bearish or Bullish).|
|`convictionStake`|`uint256`|The conviction stake amount recorded for this prediction NFT.|
|`owner`|`address`|The current owner of the NFT.|



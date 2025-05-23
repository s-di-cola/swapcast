# RewardDistributor
[Git Source](https://github.com/s-di-cola/swapcast/blob/2a5fbcf2444e0ac43b208ab177dd275c83817321/src/RewardDistributor.sol)

**Inherits:**
Ownable

**Author:**
Simone Di Cola

This contract allows users to claim their prediction rewards. It acts as an intermediary,
forwarding claim requests to the main PredictionManager contract.

*Inherits from Ownable for administrative control over settings like the PredictionManager address.
It ensures that reward claim calls to the PredictionPool originate from a trusted source (this contract).*


## State Variables
### predictionManager
The address of the PredictionManager contract that this distributor interacts with.

*This is an instance of IPredictionManagerForDistributor, ensuring it has the claimReward function.*


```solidity
IPredictionManagerForDistributor public predictionManager;
```


## Functions
### constructor

Contract constructor.


```solidity
constructor(address initialOwner, address _predictionManagerAddress) Ownable(initialOwner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`initialOwner`|`address`|The initial owner of this RewardDistributor contract.|
|`_predictionManagerAddress`|`address`|The address of the PredictionManager contract. Must not be the zero address.|


### setPredictionManagerAddress

Updates the address of the PredictionManager contract.

*Only callable by the contract owner. Emits {PredictionPoolAddressSet}.*


```solidity
function setPredictionManagerAddress(address _newAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newAddress`|`address`|The new address of the PredictionManager. Must not be the zero address.|


### claimReward

Allows any user to initiate a reward claim for a specific prediction NFT.

*This function acts as a passthrough to the `PredictionManager.claimReward` function.
The `PredictionManager` is responsible for all validation, including NFT ownership (implicitly via burn) and reward calculation.
If the underlying call to `PredictionManager.claimReward` fails, this function will revert with [ClaimFailedInPool](/src/RewardDistributor.sol/contract.RewardDistributor.md#claimfailedinpool).*


```solidity
function claimReward(uint256 tokenId) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The ID of the SwapCastNFT for which the reward is being claimed.|


## Events
### PredictionManagerAddressSet
Emitted when the PredictionManager address is set or updated.


```solidity
event PredictionManagerAddressSet(address indexed oldAddress, address indexed newAddress);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`oldAddress`|`address`|The previous address of the PredictionManager contract (address(0) if initial setup).|
|`newAddress`|`address`|The new address of the PredictionManager contract.|

## Errors
### ZeroAddress
Reverts if an address parameter is the zero address where it's not allowed (e.g., setting PredictionManager address).


```solidity
error ZeroAddress();
```

### ClaimFailedInPool
Reverts if the call to `PredictionManager.claimReward()` fails for any reason.


```solidity
error ClaimFailedInPool();
```


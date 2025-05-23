# RewardDistributor
[Git Source](https://github.com/s-di-cola/swapcast/blob/fd3e92ac000764a2f74374fcba21b9ac2c9b9c35/src/RewardDistributor.sol)

**Inherits:**
Ownable, ReentrancyGuard, Pausable

**Author:**
Simone Di Cola

This contract allows users to claim their prediction rewards. It acts as an intermediary,
forwarding claim requests to the main PredictionManager contract.

*Inherits from Ownable for administrative control over settings like the PredictionManager address.
It ensures that reward claim calls to the PredictionPool originate from a trusted source (this contract).*

**Note:**
security-contact: security@swapcast.io


## State Variables
### predictionManager
The address of the PredictionManager contract that this distributor interacts with.

The PredictionManager contract address

*This is an instance of IPredictionManagerForDistributor, ensuring it has the claimReward function.*

*Marked as immutable for gas savings as it's only set once in the constructor*


```solidity
IPredictionManagerForDistributor public immutable predictionManager;
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


### pause

Allows any user to initiate a reward claim for a specific prediction NFT.

Pauses the contract, preventing claimReward from being called

*This function acts as a passthrough to the `PredictionManager.claimReward` function.
The `PredictionManager` is responsible for all validation, including NFT ownership (implicitly via burn) and reward calculation.
If the underlying call to `PredictionManager.claimReward` fails, this function will revert with [ClaimFailedInPool](/src/RewardDistributor.sol/contract.RewardDistributor.md#claimfailedinpool).*

*Only callable by the owner when not paused*

**Notes:**
- reverts: With `ZeroAddress` if the PredictionManager address is not set

- reverts: With `InvalidTokenId` if the tokenId is zero

- reverts: With `ClaimFailedInPool` if the underlying PredictionManager call fails

- emits: RewardClaimed On successful claim


```solidity
function pause() external onlyOwner;
```

### unpause

Unpauses the contract, allowing claimReward to be called again

*Only callable by the owner when paused*


```solidity
function unpause() external onlyOwner;
```

### claimReward

Allows any user to initiate a reward claim for a specific prediction NFT.

*This function can be paused by the owner in case of emergency.
When paused, all calls to this function will revert.*

**Notes:**
- reverts: With `Pausable.EnforcedPause` if the contract is paused

- reverts: With `ZeroAddress` if the PredictionManager address is not set

- reverts: With `InvalidTokenId` if the tokenId is zero

- reverts: With `ClaimFailedInPool` if the underlying PredictionManager call fails

- emits: RewardClaimed On successful claim


```solidity
function claimReward(uint256 tokenId) external nonReentrant whenNotPaused;
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

### RewardClaimed
Emitted when a reward is successfully claimed


```solidity
event RewardClaimed(address indexed claimer, uint256 indexed tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`claimer`|`address`|The address that claimed the reward|
|`tokenId`|`uint256`|The ID of the token for which the reward was claimed|

## Errors
### ZeroAddress
Reverts if an address parameter is the zero address


```solidity
error ZeroAddress();
```

### InvalidTokenId
Reverts if the token ID is invalid (e.g., zero)


```solidity
error InvalidTokenId();
```

### ClaimFailedInPool
Custom error for when a claim fails in the PredictionManager


```solidity
error ClaimFailedInPool(uint256 tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The ID of the token for which the claim failed|


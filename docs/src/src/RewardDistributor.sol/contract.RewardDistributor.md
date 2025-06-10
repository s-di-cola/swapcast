# RewardDistributor
[Git Source](https://github.com/s-di-cola/swapcast/blob/2cc784f538ca7a73dcc2f008a2761d0d012508eb/src/RewardDistributor.sol)

**Inherits:**
Ownable, ReentrancyGuard, Pausable

**Author:**
Simone Di Cola

This contract allows users to claim their prediction rewards. It acts as an intermediary,
forwarding claim requests to the main PredictionManager contract.

*Inherits from Ownable for administrative control, ReentrancyGuard to prevent reentrancy attacks,
and Pausable to allow emergency stops. It ensures that reward claim calls to the PredictionManager
originate from a trusted source (this contract).
The contract has the following key features:
1. Secure reward claiming with reentrancy protection
2. Emergency pause functionality for security incidents
3. Immutable PredictionManager reference for gas efficiency
4. Comprehensive error handling with detailed error messages*

**Note:**
security-contact: security@swapcast.xyz


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

Contract constructor that initializes the RewardDistributor with owner and PredictionManager addresses.

*Sets up the immutable reference to the PredictionManager contract and emits an event.
The PredictionManager address is critical and cannot be the zero address.
This address is set as immutable for gas efficiency and security, meaning it cannot be changed after deployment.*

**Note:**
reverts: ZeroAddress If the prediction manager address is zero.


```solidity
constructor(address initialOwner, address _predictionManagerAddress) Ownable(initialOwner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`initialOwner`|`address`|The initial owner of this RewardDistributor contract who can pause/unpause and perform admin functions.|
|`_predictionManagerAddress`|`address`|The address of the PredictionManager contract that will handle the actual reward claims.|


### setPredictionManagerAddress

Updates the address of the PredictionManager contract.

*This function is kept for backward compatibility but will always revert since predictionManager is immutable.
It still performs input validation and emits an event before reverting to maintain consistent behavior.
In a future version, this function could be removed entirely since it cannot succeed.*

**Notes:**
- reverts: ZeroAddress If the new address is zero.

- reverts: ImmutablePredictionManager Always, since the predictionManager cannot be changed.


```solidity
function setPredictionManagerAddress(address _newAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newAddress`|`address`|The new address of the PredictionManager (which will never be set).|


### pause

Pauses the contract, preventing claimReward from being called.

*Only callable by the owner when the contract is not already paused.
This is an emergency function that can be used to stop all reward claims
in case of a security incident or critical bug.*


```solidity
function pause() external onlyOwner;
```

### unpause

Unpauses the contract, allowing claimReward to be called again.

*Only callable by the owner when the contract is paused.
This function restores normal operation after an emergency pause.*


```solidity
function unpause() external onlyOwner;
```

### claimReward

Allows any user to initiate a reward claim for a specific prediction NFT.

*This function acts as a secure passthrough to the PredictionManager.claimReward function.
It includes multiple security features:
1. Reentrancy protection via the nonReentrant modifier
2. Pausability for emergency situations
3. Input validation for the token ID
4. Try-catch pattern to handle errors from the PredictionManager gracefully
The actual reward logic, NFT burning, and ETH transfer occur in the PredictionManager.
This contract simply forwards the request and handles any errors that might occur.*

**Notes:**
- reverts: Pausable.EnforcedPause If the contract is paused

- reverts: InvalidTokenId If the tokenId is zero

- reverts: ClaimFailedInPool If the underlying PredictionManager call fails

- emits: RewardClaimed On successful claim with the claimer address and token ID


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
Thrown when a zero address is provided for a parameter that requires a non-zero address.

*This is used to validate that critical address parameters like the PredictionManager are not set to zero.*


```solidity
error ZeroAddress();
```

### InvalidTokenId
Thrown when an invalid token ID (zero) is provided for a claim.

*Token IDs in this system start from 1, so a zero token ID is always invalid.*


```solidity
error InvalidTokenId();
```

### ClaimFailedInPool
Thrown when a claim fails in the PredictionManager contract.

*This error wraps any errors that might occur in the PredictionManager during a claim,
providing a consistent error interface to users of this contract.*


```solidity
error ClaimFailedInPool(uint256 tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The ID of the token for which the claim failed.|

### ImmutablePredictionManager
Thrown when attempting to change the immutable PredictionManager address.

*This error is used in the setPredictionManagerAddress function which is kept for
backward compatibility but will always revert since the address is immutable.*


```solidity
error ImmutablePredictionManager();
```


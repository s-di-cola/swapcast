# SwapCastNFT
[Git Source](https://github.com/s-di-cola/swapcast/blob/9e0c2c2136c1eba926018c594f314999e636e11f/src/SwapCastNFT.sol)

**Inherits:**
ERC721, Ownable, [ISwapCastNFT](/src/interfaces/ISwapCastNFT.sol/interface.ISwapCastNFT.md)

**Author:**
Simone Di Cola

Represents a user's prediction position as an ERC721 Non-Fungible Token.
Each NFT stores metadata about the prediction, such as market ID, outcome, and conviction stake.

*This contract handles the lifecycle of prediction NFTs: minting, burning, and metadata provision.
Minting and burning operations are restricted to an authorized PredictionManager contract, set by the owner.
Token URIs, containing JSON metadata and attributes, are generated dynamically and on-chain.
The contract has the following key features:
1. ERC721-compliant NFT representation of prediction positions
2. Secure minting and burning restricted to the PredictionManager
3. Compact storage of prediction metadata using optimized data types
4. On-chain generation of JSON metadata with Base64 encoding
5. Comprehensive error handling with descriptive error messages
It inherits from OpenZeppelin's ERC721 and Ownable contracts and implements the ISwapCastNFT interface.*

**Note:**
security-contact: security@swapcast.xyz


## State Variables
### predictionManagerAddress
The address of the PredictionManager contract authorized to mint and burn these NFTs.

*This address is the only one that can call the restricted functions `mint()` and `burn()`.
It is settable only by the contract owner via the `setPredictionManagerAddress` function.
This security control ensures that NFTs can only be created or destroyed through the
proper protocol flow, preventing unauthorized minting or burning.
The address is initially set to address(0) and must be set to a valid address before
the contract can be used for minting or burning NFTs.*


```solidity
address public predictionManagerAddress;
```


### tokenPredictionMetadata
Mapping from token ID to its prediction metadata.

*This mapping stores all the critical information about each prediction NFT.
It is publicly accessible, allowing anyone to query the metadata for a given token ID
using the auto-generated getter `tokenPredictionMetadata(uint256 tokenId)`.
The mapping is updated in the following functions:
- `mint`: Adds a new entry with the prediction details
- `burn`: Deletes the entry to free up storage and get a gas refund
The metadata is used for both on-chain operations (e.g., claim validation) and
for generating the token URI with human-readable attributes.*


```solidity
mapping(uint256 => PredictionMetadata) public tokenPredictionMetadata;
```


### _nextTokenId
Counter for the next token ID to be minted, ensuring unique token IDs.

*This counter starts at 0 and is incremented after each mint operation.
It is private to control ID assignment strictly through the `mint()` function.
The counter uses unchecked increment in the mint function for gas efficiency,
which is safe because the counter would need to overflow 2^256 times before
causing any issues (practically impossible).
Token IDs are assigned sequentially, making it easy to track the total number
of NFTs ever minted (even if some have been burned) by checking this value.*


```solidity
uint256 private _nextTokenId;
```


## Functions
### constructor

Contract constructor that initializes the SwapCastNFT with an owner and token metadata.

*Sets up the ERC721 token with a name and symbol, and establishes the initial owner who will have
administrative privileges (such as setting the PredictionManager address). The owner address is validated
to ensure it's not the zero address, which would lock the contract's administrative functions permanently.
The constructor initializes the following:
1. The ERC721 name and symbol for the NFT collection
2. The Ownable contract with the initial owner address
3. Implicitly sets _nextTokenId to 0 (default value)*

**Note:**
reverts: ZeroAddress If the initialOwner is the zero address.


```solidity
constructor(address _initialOwner, string memory _name, string memory _symbol)
    ERC721(_name, _symbol)
    Ownable(_initialOwner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initialOwner`|`address`|The initial owner of the contract, who can set the PredictionManager address.|
|`_name`|`string`|The name of the ERC721 token collection (e.g., "SwapCast Prediction NFT").|
|`_symbol`|`string`|The symbol of the ERC721 token collection (e.g., "SCNFT").|


### setPredictionManagerAddress

Sets or updates the address of the PredictionManager contract authorized to mint/burn NFTs.

*This function is critical for the security of the contract as it determines which address has
permission to create and destroy NFTs. It includes the following security features:
1. Owner-only access control via the onlyOwner modifier
2. Validation to prevent setting the zero address
3. Event emission for transparency and off-chain tracking
The function caches the old address before updating to ensure accurate event emission.
This function would typically be called once after deployment to set the initial PredictionManager,
and potentially again if the PredictionManager contract is upgraded.*

**Notes:**
- reverts: ZeroAddress If the new address is the zero address.

- emits: PredictionManagerAddressSet With the old and new addresses.


```solidity
function setPredictionManagerAddress(address _newPredictionManagerAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newPredictionManagerAddress`|`address`|The new address for the PredictionManager contract.|


### onlyPredictionManager

*Modifier to restrict certain functions (like `mint` and `burn`) to be callable only by the `predictionManagerAddress`.
This is a critical security control that ensures only the authorized PredictionManager contract can create
or destroy NFTs, preventing unauthorized minting or burning of prediction positions.
The modifier performs a simple but effective check comparing msg.sender with the stored predictionManagerAddress.
If they don't match, it reverts with a custom error that clearly indicates the reason for the failure.*

**Note:**
reverts: NotPredictionManager If called by any address other than the authorized PredictionManager.


```solidity
modifier onlyPredictionManager();
```

### mint

Mints a new NFT representing a user's prediction position.

*This function creates a new NFT that represents a user's prediction on a specific market outcome.
It includes several key operations:
1. Input validation to ensure valid recipient and stake amount
2. Token ID generation using an incrementing counter
3. ERC721 token minting to the specified owner
4. Storage of prediction metadata with optimized data types
5. Event emission for off-chain tracking
The function uses unchecked arithmetic for the token ID increment since overflow is practically
impossible (would require 2^256 mints). It also performs type conversions to use compact storage
types (uint128, uint64) for gas efficiency while still supporting a wide range of values.*

**Notes:**
- reverts: ZeroAddress If the recipient address is the zero address.

- reverts: InvalidConvictionStake If the conviction stake is zero.

- reverts: NotPredictionManager If called by any address other than the authorized PredictionManager.

- emits: PositionNFTMinted When the NFT is successfully minted.


```solidity
function mint(address _to, uint256 _marketId, PredictionTypes.Outcome _outcome, uint256 _convictionStake)
    external
    override
    onlyPredictionManager
    returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address`|The address that will own the newly minted NFT.|
|`_marketId`|`uint256`|The market ID for which the prediction is made.|
|`_outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bullish or Bearish).|
|`_convictionStake`|`uint256`|The conviction stake amount for this prediction.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|tokenId The ID of the newly minted NFT.|


### burn

Burns (destroys) an existing NFT, typically after its prediction has been resolved and claimed.

*This function permanently removes an NFT from circulation, following the Checks-Effects-Interactions (CEI) pattern
to prevent reentrancy vulnerabilities. The function performs the following operations in order:
1. Checks: Verifies the token exists by checking its owner
2. Effects: Deletes the associated prediction metadata from storage
3. Events: Emits the PositionNFTBurned event
4. Interactions: Calls the _burn function which modifies state and may trigger external calls
This sequence is critical for security as it ensures all state changes are complete before any external
interactions occur. The function also optimizes gas usage by checking token existence via _ownerOf
rather than using _exists, as this provides the owner address which would be needed anyway.*

**Notes:**
- reverts: NonExistentToken If the token does not exist.

- reverts: NotPredictionManager If called by any address other than the authorized PredictionManager.

- emits: PositionNFTBurned When the NFT is successfully burned.


```solidity
function burn(uint256 _tokenId) external override onlyPredictionManager;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the NFT to burn.|


### totalSupply

Returns the total number of tokens that have been minted.

*This function returns the current value of the token ID counter.*


```solidity
function totalSupply() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The total supply of tokens minted (including burned tokens).|


### getPredictionDetails

Retrieves the core prediction details associated with a given NFT.

*This function provides a convenient way to access all relevant prediction data for a specific NFT
in a single call. It performs the following operations:
1. Validates that the token exists
2. Retrieves the prediction metadata from storage
3. Converts compact storage types (uint128) to full-size return types (uint256)
4. Returns both the metadata and the current owner in a single operation
This function is particularly useful for off-chain services that need to display prediction
information, as well as for other contracts that need to verify prediction details.*

**Note:**
reverts: NonExistentToken If the token does not exist.


```solidity
function getPredictionDetails(uint256 _tokenId)
    external
    view
    override
    returns (uint256 marketId, PredictionTypes.Outcome outcome, uint256 convictionStake, address owner_);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the NFT to query.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The market ID of the prediction.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bullish or Bearish).|
|`convictionStake`|`uint256`|The conviction stake amount.|
|`owner_`|`address`|The current owner of the NFT.|


### tokenURI

Returns the Uniform Resource Identifier (URI) for a given token ID.

*This function generates a complete on-chain JSON metadata structure for the NFT, which is then
Base64 encoded and returned as a data URI. The implementation follows these steps:
1. Validates token existence
2. Retrieves prediction metadata from storage
3. Converts the outcome enum to a human-readable string
4. Constructs a structured JSON object with name, description, and attributes
5. Base64 encodes the JSON and returns it as a data URI
The metadata includes important prediction details as attributes:
- Market ID: The identifier of the prediction market
- Predicted Outcome: Human-readable outcome (Bullish/Bearish)
- Conviction Stake: The amount staked on this prediction
- Minted At Timestamp: When the prediction was made
This on-chain metadata approach ensures that NFT data remains accessible even if off-chain
services are unavailable, enhancing the durability and decentralization of the protocol.*

**Note:**
reverts: NonExistentToken If the token does not exist.


```solidity
function tokenURI(uint256 _tokenId) public view override returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the token to get the URI for.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|A string URI containing Base64 encoded JSON metadata.|


### _formatJsonAttributeStringValue

*Internal helper function to format a JSON attribute where the attribute's value is a string.
This function constructs a properly formatted JSON object for an NFT attribute with a string value.
The function builds the JSON object in stages to maintain readability while optimizing gas usage.
It follows the OpenSea metadata standard format for traits, using the "trait_type" and "value" keys.
Example output: {"trait_type": "Predicted Outcome", "value": "Bullish"}*


```solidity
function _formatJsonAttributeStringValue(string memory _traitType, string memory _value)
    internal
    pure
    returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_traitType`|`string`|The type or name of the trait (e.g., "Predicted Outcome").|
|`_value`|`string`|The string value of the trait (e.g., "Bullish").|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|A string representing the JSON attribute object.|


### _formatJsonAttributeUintValue

*Internal helper function to format a JSON attribute where the attribute's value is a uint256.
This function constructs a properly formatted JSON object for an NFT attribute with a numeric value.
The function builds the JSON object in stages to maintain readability while optimizing gas usage.
It follows the OpenSea metadata standard format for traits, using the "trait_type" and "value" keys.
Note that numeric values are not quoted in JSON, unlike string values.
Example output: {"trait_type": "Market ID", "value": 123}*


```solidity
function _formatJsonAttributeUintValue(string memory _traitType, uint256 _value)
    internal
    pure
    returns (string memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_traitType`|`string`|The type or name of the trait (e.g., "Market ID", "Conviction Stake (Wei)").|
|`_value`|`uint256`|The uint256 value of the trait.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|A string representing the JSON attribute object.|


## Events
### PredictionManagerAddressSet
Emitted when the PredictionManager address is successfully updated.

*This event provides transparency for address changes, allowing off-chain services
to track when permissions for minting and burning NFTs are transferred to a new contract.
It includes both the old and new addresses for complete audit trails.
The event is emitted in the setPredictionManagerAddress function and is indexed
to make it efficiently searchable in event logs.*


```solidity
event PredictionManagerAddressSet(address indexed oldAddress, address indexed newAddress);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`oldAddress`|`address`|The previous address of the PredictionManager (address(0) if not previously set).|
|`newAddress`|`address`|The new, updated address of the PredictionManager.|

### PositionNFTMinted
Emitted when a new prediction NFT (position) is minted.

*This event captures all essential details about a newly created prediction position.
It provides a complete record of the prediction, including who made it, which market
it's for, the predicted outcome, and the conviction stake amount.
The event is indexed on both owner and tokenId to allow efficient filtering by either
the user who made the prediction or the specific NFT ID. This supports use cases like:
- Finding all predictions made by a specific user
- Looking up the creation details of a specific NFT
The event is emitted at the end of the mint function, after all state changes are complete.*


```solidity
event PositionNFTMinted(
    address indexed owner,
    uint256 indexed tokenId,
    uint256 marketId,
    PredictionTypes.Outcome outcome,
    uint256 convictionStake
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`owner`|`address`|The address receiving the minted NFT (the predictor).|
|`tokenId`|`uint256`|The unique identifier of the minted NFT.|
|`marketId`|`uint256`|The market ID for which the prediction is made.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStake`|`uint256`|The amount of conviction (stake) declared for this prediction.|

### PositionNFTBurned
Emitted when a prediction NFT (position) is burned, typically after a claim or resolution.

*This event signals that a prediction position has been permanently removed from circulation.
It is typically emitted when a user claims rewards for a correct prediction or when a
prediction is otherwise resolved and no longer needed.
The event only includes the tokenId as that's sufficient to look up historical details
about the prediction if needed. The tokenId is indexed to make it efficiently searchable.
The event is emitted in the burn function before the actual _burn call, following the
Checks-Effects-Interactions pattern for security.*


```solidity
event PositionNFTBurned(uint256 indexed tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The unique ID of the burned NFT.|

## Errors
### NotPredictionManager
Thrown when a restricted function is called by an address other than the authorized PredictionManager.

*This error is used to protect sensitive functions like mint and burn that should only be called by the
designated PredictionManager contract. This ensures that NFTs can only be created or destroyed through
the proper protocol flow.*


```solidity
error NotPredictionManager();
```

### ZeroAddress
Thrown when a function is called with the zero address where a non-zero address is required.

*This error is used in the constructor to validate the initial owner, and in the mint function to
validate the recipient address. Using the zero address in these contexts would result in tokens
that cannot be accessed or transferred.*


```solidity
error ZeroAddress();
```

### NonExistentToken
Thrown when a token URI is requested for a token that does not exist.

*This error is used in the tokenURI and burn functions to validate that the requested token exists.
It includes the token ID in the error to help with debugging.*


```solidity
error NonExistentToken(uint256 tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The ID of the non-existent token that was requested.|

### InvalidConvictionStake
Thrown when a mint operation is attempted with a conviction stake of zero.

*This error is used in the mint function to ensure that all predictions have a non-zero stake,
as zero-stake predictions would not make sense in the context of the prediction market.*


```solidity
error InvalidConvictionStake();
```

## Structs
### PredictionMetadata
Stores the detailed metadata associated with each prediction NFT.

*This struct uses optimized data types to minimize storage costs while still supporting
a wide range of values. The struct is packed efficiently to fit within two storage slots:
Slot 1: marketId (128 bits) + mintedAt (64 bits) + part of convictionStake (64 bits)
Slot 2: remainder of convictionStake (64 bits) + outcome (8 bits) + padding (184 bits)
The choice of data types balances gas efficiency with practical limits:
- uint128 for marketId: Supports up to 3.4e38 markets (effectively unlimited)
- uint64 for mintedAt: Timestamp valid until year ~292 billion (effectively unlimited)
- uint128 for convictionStake: Supports up to 3.4e38 wei (approximately 3.4e20 ETH)
- PredictionTypes.Outcome for outcome: Enum representing Bearish (0) or Bullish (1)*


```solidity
struct PredictionMetadata {
    uint128 marketId;
    uint64 mintedAt;
    uint128 convictionStake;
    PredictionTypes.Outcome outcome;
}
```


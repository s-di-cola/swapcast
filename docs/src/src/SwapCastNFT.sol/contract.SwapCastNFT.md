# SwapCastNFT
[Git Source](https://github.com/s-di-cola/swapcast/blob/2174af1482c339fd15fd6eb3baaa600ea7d38ee2/src/SwapCastNFT.sol)

**Inherits:**
ERC721, Ownable, [ISwapCastNFT](/src/interfaces/ISwapCastNFT.sol/interface.ISwapCastNFT.md)

**Author:**
Simone Di Cola

Represents a user's prediction position as an ERC721 Non-Fungible Token.
Each NFT stores metadata about the prediction, such as market ID, outcome, and conviction stake.

*This contract handles the lifecycle of prediction NFTs: minting, burning, and metadata provision.
Minting and burning operations are restricted to an authorized PredictionPool contract, set by the owner.
Token URIs, containing JSON metadata and attributes, are generated dynamically and on-chain.
It inherits from OpenZeppelin's ERC721 and Ownable contracts and implements the ISwapCastNFT interface.*


## State Variables
### predictionManagerAddress
The address of the PredictionManager contract authorized to mint and burn these NFTs.

*Only this address can call `mint()` and `burn()`. Settable by the contract owner.*


```solidity
address public predictionManagerAddress;
```


### tokenPredictionMetadata
Mapping from token ID to its [PredictionMetadata](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#predictionmetadata).

*Publicly accessible, allowing anyone to query the metadata for a given token ID using the auto-generated getter `tokenPredictionMetadata(uint256 tokenId)`.*


```solidity
mapping(uint256 => PredictionMetadata) public tokenPredictionMetadata;
```


### _nextTokenId
Counter for the next token ID to be minted, ensuring unique token IDs.

*Starts at 0. Incremented after each mint operation. Private to control ID assignment strictly through `mint()`.*


```solidity
uint256 private _nextTokenId;
```


## Functions
### constructor

Contract constructor.


```solidity
constructor(address _initialOwner, string memory _name, string memory _symbol) ERC721(_name, _symbol);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initialOwner`|`address`|The initial owner of this SwapCastNFT contract (e.g., a deployer or governance multisig). This owner can set the `predictionPoolAddress`.|
|`_name`|`string`|The name of the NFT collection (e.g., "SwapCast Positions"). Passed to the ERC721 constructor.|
|`_symbol`|`string`|The symbol of the NFT collection (e.g., "SCPOS"). Passed to the ERC721 constructor.|


### setPredictionManagerAddress

Sets or updates the address of the PredictionManager contract authorized to mint/burn NFTs.

*Only callable by the contract owner. Emits [PredictionManagerAddressSet](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#predictionmanageraddressset).
The provided `_newPredictionManagerAddress` must not be the zero address.*


```solidity
function setPredictionManagerAddress(address _newPredictionManagerAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newPredictionManagerAddress`|`address`|The new address for the PredictionManager contract.|


### onlyPredictionManager

*Modifier to restrict certain functions (like `mint` and `burn`) to be callable only by the `predictionManagerAddress`.
Reverts with [NotPredictionManager](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#notpredictionmanager) if called by any other address.*


```solidity
modifier onlyPredictionManager();
```

### mint

Mints a new NFT representing a user's prediction position.

*Implements `ISwapCastNFT.mint`. Only callable by the authorized `predictionManagerAddress` (via [onlyPredictionManager](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#onlypredictionmanager) modifier).
Assigns a new unique token ID, mints the ERC721 token to the specified owner (`_to`),
and stores the associated {PredictionMetadata}. Emits {PositionNFTMinted}.*


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
|`_outcome`|`PredictionTypes.Outcome`|The predicted outcome.|
|`_convictionStake`|`uint256`|The conviction stake amount for this prediction.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|tokenId The ID of the newly minted NFT.|


### burn

Burns (destroys) an existing NFT, typically after its prediction has been resolved and claimed.

*Implements `ISwapCastNFT.burn`. Only callable by the authorized `predictionManagerAddress` (via [onlyPredictionManager](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#onlypredictionmanager) modifier).
Deletes the associated {PredictionMetadata} and burns the ERC721 token. Emits {PositionNFTBurned}.
The `PredictionPool` is responsible for verifying token ownership and authorization before calling this function.*


```solidity
function burn(uint256 _tokenId) external override onlyPredictionManager;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the NFT to burn.|


### getPredictionDetails

Retrieves the core prediction details associated with a given NFT.

*Implements `ISwapCastNFT.getPredictionDetails`. View function.
Reverts with [NonExistentToken](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#nonexistenttoken) if the `_tokenId` does not exist.*


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
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome.|
|`convictionStake`|`uint256`|The conviction stake amount.|
|`owner_`|`address`|The current owner of the NFT.|


### tokenURI

Returns the Uniform Resource Identifier (URI) for a given token ID.

*Overrides `ERC721.tokenURI`. Generates on-chain JSON metadata, Base64 encoded.
The JSON includes name, description, and attributes: Market ID, Predicted Outcome, Conviction Stake, and Minted At Timestamp.
Reverts with [NonExistentToken](/src/SwapCastNFT.sol/contract.SwapCastNFT.md#nonexistenttoken) if the token does not exist.
Note: This implementation does not currently include an 'image' field in the JSON metadata.*


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
|`<none>`|`string`|A string URI containing Base64 encoded JSON metadata (e.g., "data:application/json;base64,eyJuYW1lIjoiU3dhcENhc3QgTkZUIyIsICJkZXNjcmlwdGlvbiI6IkEgUHJlZGljdGlvbiBwb3NpdGlvbiIsICJhdHRyaWJ1dGVzIjpbXX0=").|


### _formatJsonAttributeStringValue

*Internal helper function to format a JSON attribute where the attribute's value is a string.
Used for constructing the `attributes` array in the token URI JSON.*


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
|`<none>`|`string`|A string representing the JSON attribute object (e.g., '{"trait_type": "Predicted Outcome", "value": "Bullish"}').|


### _formatJsonAttributeUintValue

*Internal helper function to format a JSON attribute where the attribute's value is a uint256.
Used for constructing the `attributes` array in the token URI JSON.*


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
|`<none>`|`string`|A string representing the JSON attribute object (e.g., '{"trait_type": "Market ID", "value": 123}').|


## Events
### PredictionManagerAddressSet
Emitted when the `predictionPoolAddress` is successfully updated.


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


```solidity
event PositionNFTBurned(uint256 indexed tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The unique ID of the burned NFT.|

## Errors
### NotPredictionManager
Reverts if a restricted function is called by an address other than the authorized `predictionManagerAddress`.


```solidity
error NotPredictionManager();
```

### ZeroAddress
Reverts if an address parameter is the zero address when a non-zero address is required (e.g., setting PredictionManager address).


```solidity
error ZeroAddress();
```

### NonExistentToken
Reverts if an operation (e.g., querying `tokenURI` or `getPredictionDetails`) is attempted on a non-existent token ID.


```solidity
error NonExistentToken(uint256 tokenId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The token ID that does not exist.|

## Structs
### PredictionMetadata
Stores the detailed metadata associated with each prediction NFT.


```solidity
struct PredictionMetadata {
    uint256 marketId;
    PredictionTypes.Outcome outcome;
    uint256 convictionStake;
    uint256 mintedAt;
}
```

**Properties**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The unique identifier of the market this prediction pertains to.|
|`outcome`|`PredictionTypes.Outcome`|The predicted outcome (Bearish or Bullish).|
|`convictionStake`|`uint256`|The amount of value (e.g., in Wei) staked on this prediction, representing its conviction.|
|`mintedAt`|`uint256`|The Unix timestamp indicating when the NFT was minted.|


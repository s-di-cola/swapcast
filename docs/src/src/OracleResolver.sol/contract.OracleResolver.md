# OracleResolver
[Git Source](https://github.com/s-di-cola/swapcast/blob/88d8bde27d6b1e5a64749c80e888344e6f0fdadc/src/OracleResolver.sol)

**Inherits:**
Ownable

**Author:**
Simone Di Cola

This contract is responsible for resolving prediction markets by fetching prices from Chainlink oracles.

*It allows the owner to register Chainlink price feed aggregators for specific market IDs and price thresholds.
Anyone can then trigger the resolution of a registered market. Upon resolution, it calls the PredictionManager
to update the market's state with the winning outcome. The PredictionManager address is set immutably at deployment.*

*Price feeds are expected to return values with 8 decimal places, which is the standard for most Chainlink feeds.
The contract validates the integrity of the price feed data before using it for market resolution.*

**Note:**
security-contact: security@swapcast.xyz


## State Variables
### predictionManager
The address of the PredictionManager contract this resolver interacts with.

*This address is set immutably during contract deployment to prevent changes.
It must implement the {IPredictionManagerForResolver} interface.*


```solidity
IPredictionManagerForResolver public immutable predictionManager;
```


### feedRegistry
The address of the Chainlink Feed Registry contract.

*This is set immutably during contract deployment.*


```solidity
IFeedRegistry public immutable feedRegistry;
```


### marketOracles
Maps market IDs to their respective oracle configurations.

*Public visibility allows anyone to query the oracle configuration for a given market.*


```solidity
mapping(uint256 => MarketOracle) public marketOracles;
```


### maxPriceStalenessSeconds
Maximum acceptable delay (in seconds) for a Chainlink price feed update.

*If a price feed's `updatedAt` timestamp is older than `block.timestamp - maxPriceStalenessSeconds`,
the price is considered stale, and market resolution will be prevented.
Defaulted to 1 hour, settable by the owner.*


```solidity
uint256 public maxPriceStalenessSeconds;
```


## Functions
### constructor

Constructs a new OracleResolver instance.

**Notes:**
- reverts: PredictionManagerZeroAddress If the prediction manager address is zero.

- reverts: InvalidTokenAddress If the feed registry address is zero.


```solidity
constructor(address _predictionManagerAddress, address _feedRegistryAddress, address initialOwner)
    Ownable(initialOwner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_predictionManagerAddress`|`address`|The address of the PredictionManager contract this resolver will interact with.|
|`_feedRegistryAddress`|`address`|The address of the Chainlink Feed Registry contract.|
|`initialOwner`|`address`|The address that will be set as the initial owner of this contract.|


### registerOracle

Registers an oracle for a market using token pair from the Feed Registry.

*Only callable by the contract owner. Emits [OracleRegistered](/src/OracleResolver.sol/contract.OracleResolver.md#oracleregistered).*

**Notes:**
- reverts: InvalidTokenAddress If either token address is zero

- reverts: OracleAlreadyRegistered If an oracle is already registered for this market

- reverts: FeedRegistryNotSet If the feed registry returns a zero address for the feed

- reverts: InvalidPriceThreshold If the price threshold is set to zero


```solidity
function registerOracle(uint256 _marketId, address _baseToken, address _quoteToken, uint256 _priceThreshold)
    external
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_marketId`|`uint256`|The ID of the market to register the oracle for.|
|`_baseToken`|`address`|The base token address (e.g., ETH).|
|`_quoteToken`|`address`|The quote token address (e.g., USD).|
|`_priceThreshold`|`uint256`|The price threshold for determining the winning outcome. Must be greater than zero and is assumed to be in the feed's native decimals (typically 8).|


### setMaxPriceStaleness

Sets the maximum allowed staleness period for oracle price feeds.

*Only callable by the contract owner. Emits [MaxPriceStalenessSet](/src/OracleResolver.sol/contract.OracleResolver.md#maxpricestalenessset).
This value determines how old a price feed update can be before it's considered stale.
A lower value provides more up-to-date prices but may cause more failures during high network congestion.
A higher value allows for more tolerance during network congestion but may use outdated prices.*


```solidity
function setMaxPriceStaleness(uint256 _newStalenessSeconds) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newStalenessSeconds`|`uint256`|The new staleness period in seconds (e.g., 3600 for 1 hour).|


### resolveMarket

Resolves a prediction market using its registered Chainlink oracle.

*This function can be called by anyone. It fetches the latest price from the specified Chainlink aggregator.
The market outcome is determined as follows:
- Bullish (Outcome 0) wins if `oracle_price >= priceThreshold`.
- Bearish (Outcome 1) wins if `oracle_price < priceThreshold`.
The function performs extensive validation of the price feed data to ensure reliability:
1. Verifies the oracle is registered for the market
2. Checks that the round ID is valid (not zero)
3. Ensures the round is not stale (answeredInRound >= roundId)
4. Validates the price is positive (> 0)
5. Confirms the price data is not too old (within maxPriceStalenessSeconds)
After validation, it calls `PredictionManager.resolveMarket()` to finalize the resolution
and emits a [MarketResolved](/src/OracleResolver.sol/contract.OracleResolver.md#marketresolved) event on success.*

**Notes:**
- reverts: OracleNotRegistered If no oracle is set for the market

- reverts: InvalidRound If the round ID is invalid (zero)

- reverts: StaleRound If the round is not the latest (answeredInRound < roundId)

- reverts: InvalidPrice If the price is zero or negative

- reverts: PriceIsStale If the price data is too old (beyond maxPriceStalenessSeconds)

- reverts: ResolutionFailedInManager If the call to PredictionManager fails


```solidity
function resolveMarket(uint256 _marketId) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_marketId`|`uint256`|The ID of the market to resolve.|


## Events
### OracleRegistered
Emitted when a new oracle is registered for a market.


```solidity
event OracleRegistered(uint256 indexed marketId, address baseToken, address quoteToken, uint256 priceThreshold);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market for which the oracle is registered.|
|`baseToken`|`address`|The base token address.|
|`quoteToken`|`address`|The quote token address.|
|`priceThreshold`|`uint256`|The price threshold set for this market's resolution.|

### MarketResolved
Emitted when a market is successfully resolved by this contract.


```solidity
event MarketResolved(uint256 indexed marketId, int256 price, PredictionTypes.Outcome winningOutcome);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market that was resolved.|
|`price`|`int256`|The price reported by the oracle at the time of resolution.|
|`winningOutcome`|`PredictionTypes.Outcome`|The determined winning outcome (0 or 1).|

### MaxPriceStalenessSet
Emitted when the `maxPriceStalenessSeconds` value is updated by the owner.


```solidity
event MaxPriceStalenessSet(uint256 oldStaleness, uint256 newStaleness);
```

## Errors
### OracleAlreadyRegistered
Reverts if an attempt is made to register an oracle for a market that already has one registered.


```solidity
error OracleAlreadyRegistered(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market for which registration was attempted.|

### OracleNotRegistered
Reverts if an attempt is made to resolve a market that doesn't have a registered oracle.


```solidity
error OracleNotRegistered(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market for which resolution was attempted.|

### InvalidTokenAddress
Reverts if an attempt is made to register an oracle with a zero address for the token.


```solidity
error InvalidTokenAddress();
```

### PredictionManagerZeroAddress
Reverts if the PredictionManager address provided during construction is the zero address.


```solidity
error PredictionManagerZeroAddress();
```

### ResolutionFailedInManager
Reverts if the call to `PredictionManager.resolveMarket()` fails during market resolution.


```solidity
error ResolutionFailedInManager(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market for which resolution failed.|

### PriceIsStale
Reverts if the Chainlink price feed data is older than `maxPriceStalenessSeconds`.


```solidity
error PriceIsStale(uint256 marketId, uint256 lastUpdatedAt, uint256 currentBlockTimestamp);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market being resolved.|
|`lastUpdatedAt`|`uint256`|The timestamp when the price feed was last updated.|
|`currentBlockTimestamp`|`uint256`|The current block timestamp.|

### InvalidRound
Reverts if the price feed returns an invalid round ID.

*This occurs when the roundId returned by the Chainlink oracle is 0, which indicates an invalid round.*


```solidity
error InvalidRound();
```

### StaleRound
Reverts if the price feed returns a stale round.

*This occurs when the answeredInRound value is less than the roundId, indicating the round data is stale.*


```solidity
error StaleRound();
```

### InvalidPrice
Reverts if the price feed returns an invalid price (zero or negative).

*Chainlink prices should always be positive for asset prices. A zero or negative value indicates an error.*


```solidity
error InvalidPrice();
```

### InvalidPriceThreshold
Reverts if the price threshold is set to zero.

*A price threshold of zero is invalid as it cannot be used to determine a winning outcome.*


```solidity
error InvalidPriceThreshold();
```

### FeedRegistryNotSet
Reverts if the feed registry returns a zero address for the feed.

*This occurs when the requested token pair does not have a registered price feed in the Chainlink Feed Registry.*


```solidity
error FeedRegistryNotSet();
```

## Structs
### MarketOracle
Represents the oracle configuration for a specific market.


```solidity
struct MarketOracle {
    address baseToken;
    address quoteToken;
    uint256 priceThreshold;
    bool isRegistered;
}
```

**Properties**

|Name|Type|Description|
|----|----|-----------|
|`baseToken`|`address`|The base token address (e.g., ETH)|
|`quoteToken`|`address`|The quote token address (e.g., USD)|
|`priceThreshold`|`uint256`|The price level that determines the winning outcome. If the oracle price is at or above this threshold, outcome 0 wins; otherwise, outcome 1 wins.|
|`isRegistered`|`bool`|A flag indicating whether an oracle has been registered for this market ID.|


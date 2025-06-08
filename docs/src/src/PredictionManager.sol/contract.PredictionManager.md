# PredictionManager
[Git Source](https://github.com/s-di-cola/swapcast/blob/9e0c2c2136c1eba926018c594f314999e636e11f/src/PredictionManager.sol)

**Inherits:**
Ownable, [IPredictionManager](/src/interfaces/IPredictionManager.sol/interface.IPredictionManager.md), [IPredictionManagerForResolver](/src/interfaces/IPredictionManagerForResolver.sol/interface.IPredictionManagerForResolver.md), [IPredictionManagerForDistributor](/src/interfaces/IPredictionManagerForDistributor.sol/interface.IPredictionManagerForDistributor.md), ILogAutomation, AutomationCompatibleInterface, IERC721Receiver

**Author:**
SwapCast Team

Manages the creation and registry of prediction markets. Coordinates with OracleResolver,
RewardDistributor, and SwapCastNFT. Uses MarketLogic library for core market operations.
Integrates with Chainlink Automation for market expiration and resolution.

**Note:**
security-contact: security@swapcast.xyz


## State Variables
### MARKET_EXPIRED_SIGNATURE

```solidity
bytes32 public constant MARKET_EXPIRED_SIGNATURE = keccak256("MarketExpired(uint256,uint256)");
```


### MAX_BASIS_POINTS

```solidity
uint256 public constant MAX_BASIS_POINTS = 10_000;
```


### treasuryAddress

```solidity
address public treasuryAddress;
```


### oracleResolverAddress

```solidity
address public oracleResolverAddress;
```


### rewardDistributorAddress

```solidity
address public rewardDistributorAddress;
```


### swapCastNFT

```solidity
ISwapCastNFT public swapCastNFT;
```


### protocolFeeBasisPoints

```solidity
uint256 public protocolFeeBasisPoints;
```


### minStakeAmount

```solidity
uint256 public minStakeAmount;
```


### defaultMarketMinStake

```solidity
uint256 public defaultMarketMinStake;
```


### maxPriceStalenessSeconds

```solidity
uint256 public maxPriceStalenessSeconds;
```


### markets

```solidity
mapping(uint256 => Market) internal markets;
```


### marketMinStakes

```solidity
mapping(uint256 => uint256) public marketMinStakes;
```


### marketIdToPoolKey

```solidity
mapping(uint256 => PoolKey) public marketIdToPoolKey;
```


### _marketIdsList

```solidity
uint256[] private _marketIdsList;
```


### _nextMarketId

```solidity
uint256 private _nextMarketId = 1;
```


## Functions
### onlyOracleResolverContract


```solidity
modifier onlyOracleResolverContract();
```

### onlyRewardDistributorContract


```solidity
modifier onlyRewardDistributorContract();
```

### constructor


```solidity
constructor(
    address _initialOwner,
    address _swapCastNFTAddress,
    address _treasuryAddress,
    uint256 _initialFeeBasisPoints,
    uint256 _initialMinStakeAmount,
    uint256 _maxPriceStalenessSeconds,
    address _oracleResolverAddress,
    address _rewardDistributorAddress
) Ownable(_initialOwner);
```

### createMarket


```solidity
function createMarket(
    string memory _name,
    string memory _assetSymbol,
    uint256 _expirationTime,
    address _priceAggregator,
    uint256 _priceThreshold,
    PoolKey calldata _poolKey
) external onlyOwner returns (uint256 marketId);
```

### setFeeConfiguration


```solidity
function setFeeConfiguration(address _newTreasuryAddress, uint256 _newFeeBasisPoints) external onlyOwner;
```

### setMinStakeAmount

Sets the global minimum stake amount for all markets

*This affects the minimum stake amount for all markets, but doesn't update
the default for new markets or existing market-specific minimums.*


```solidity
function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newMinStakeAmount`|`uint256`|The new minimum stake amount in wei|


### setDefaultMarketMinStake

Sets the default minimum stake amount for new markets

*This affects only markets created after this call*


```solidity
function setDefaultMarketMinStake(uint256 _newDefaultMinStake) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newDefaultMinStake`|`uint256`|The new default minimum stake amount in wei|


### setMarketMinStake

Sets the minimum stake amount for a specific market

*This allows for market-specific minimum stakes that can be adjusted based on
market conditions, popularity, or risk profile*


```solidity
function setMarketMinStake(uint256 _marketId, uint256 _marketMinStake) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_marketId`|`uint256`|The ID of the market to update|
|`_marketMinStake`|`uint256`|The new minimum stake amount for this market in wei|


### setMaxPriceStaleness


```solidity
function setMaxPriceStaleness(uint256 _newStalenessSeconds) external onlyOwner;
```

### setOracleResolverAddress

Sets the OracleResolver address

*Only callable by the contract owner*


```solidity
function setOracleResolverAddress(address _newOracleResolverAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newOracleResolverAddress`|`address`|The address of the new OracleResolver contract|


### setRewardDistributorAddress

Sets the RewardDistributor address

*Only callable by the contract owner*


```solidity
function setRewardDistributorAddress(address _newRewardDistributorAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newRewardDistributorAddress`|`address`|The address of the new RewardDistributor contract|


### recordPrediction

Records a prediction for a user on a specific market.

*This function handles the complete prediction recording process, including:
1. Validating inputs and market existence
2. Calculating and transferring protocol fees
3. Minting an NFT representing the prediction position
4. Updating market state with the new prediction
The function uses the MarketLogic library for core prediction logic.*

**Notes:**
- reverts: ZeroAddressInput If the user address is zero.

- reverts: AmountCannotBeZero If the conviction stake is zero.

- reverts: StakeMismatch If the ETH value sent doesn't match the expected amount.

- reverts: MarketDoesNotExist If the specified market doesn't exist.

- reverts: MarketAlreadyResolved If the market has already been resolved.

- reverts: AlreadyPredicted If the user has already predicted on this market.

- reverts: StakeBelowMinimum If the stake amount is below the minimum required.


```solidity
function recordPrediction(
    address _user,
    uint256 _marketId,
    PredictionTypes.Outcome _outcome,
    uint128 _convictionStakeDeclared
) external payable override;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The address of the user making the prediction.|
|`_marketId`|`uint256`|The ID of the market to predict on.|
|`_outcome`|`PredictionTypes.Outcome`|The outcome being predicted (Bullish or Bearish).|
|`_convictionStakeDeclared`|`uint128`|The amount of ETH being staked on this prediction.|


### resolveMarket

Called by OracleResolver to submit resolution data for a market.

*This function finalizes a market by setting the winning outcome and marking it as resolved.
It can only be called by the authorized OracleResolver contract.
The actual resolution logic is handled by the MarketLogic library.
The function performs the following steps:
1. Validates that the market exists
2. Calls the MarketLogic library to handle the resolution logic
3. Emits a MarketResolved event with the outcome and total prize pool*

**Notes:**
- reverts: NotOracleResolver If called by an address other than the authorized oracle resolver.

- reverts: MarketDoesNotExist If the specified market doesn't exist.

- reverts: MarketAlreadyResolved If the market has already been resolved.


```solidity
function resolveMarket(uint256 _marketId, PredictionTypes.Outcome _winningOutcome, int256 _oraclePrice)
    external
    virtual
    override
    onlyOracleResolverContract;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_marketId`|`uint256`|The ID of the market to resolve.|
|`_winningOutcome`|`PredictionTypes.Outcome`|The winning outcome determined by the oracle (Bullish or Bearish).|
|`_oraclePrice`|`int256`|The price reported by the oracle, used for verification and event emission.|


### claimReward

Called by RewardDistributor to process a reward claim for an NFT.

*This function handles the complete reward claim process for a winning NFT position.
It can only be called by the authorized RewardDistributor contract.
The actual reward calculation and transfer logic is handled by the MarketLogic library.
The function performs the following steps:
1. Retrieves the prediction details from the NFT
2. Validates that the market exists
3. Calls the MarketLogic library to handle the reward claim logic
4. Emits a RewardClaimed event with the reward amount*

**Notes:**
- reverts: NotRewardDistributor If called by an address other than the authorized reward distributor.

- reverts: MarketDoesNotExist If the market associated with the NFT doesn't exist.

- reverts: MarketNotResolved If the market hasn't been resolved yet.

- reverts: NotWinningNFT If the NFT's prediction doesn't match the winning outcome.

- reverts: ClaimFailedNoStakeForOutcome If there's no stake for the winning outcome.

- reverts: RewardTransferFailed If the reward transfer fails.


```solidity
function claimReward(uint256 _tokenId) external virtual override onlyRewardDistributorContract;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the SwapCastNFT representing the winning position.|


### getMarketDetails


```solidity
function getMarketDetails(uint256 _marketId)
    external
    view
    returns (
        uint256 marketId_,
        string memory name_,
        string memory assetSymbol_,
        bool exists_,
        bool resolved_,
        PredictionTypes.Outcome winningOutcome_,
        uint256 totalConvictionStakeOutcome0_,
        uint256 totalConvictionStakeOutcome1_,
        uint256 expirationTime_,
        address priceAggregator_,
        uint256 priceThreshold_
    );
```

### getUserHasPredicted


```solidity
function getUserHasPredicted(uint256 _marketId, address _user) external view returns (bool);
```

### getMarketCount


```solidity
function getMarketCount() external view returns (uint256);
```

### getMarketIdAtIndex


```solidity
function getMarketIdAtIndex(uint256 _index) external view returns (uint256);
```

### getActiveMarkets


```solidity
function getActiveMarkets() external view returns (uint256[] memory);
```

### checkLog


```solidity
function checkLog(Log calldata _log, bytes calldata)
    external
    view
    override
    returns (bool upkeepNeeded, bytes memory performData);
```

### performUpkeep


```solidity
function performUpkeep(bytes calldata performData) external override(ILogAutomation, AutomationCompatibleInterface);
```

### _triggerMarketResolution

Internal function to fetch oracle price and resolve a market.

*This function is called by performUpkeep when triggered by a MarketExpired log event.
It handles the automated resolution of markets using their configured price oracles.
The function performs the following steps:
1. Validates that the market exists, is not already resolved, and has a valid price aggregator
2. Confirms that the market has actually expired
3. Fetches the current price from the oracle and determines the winning outcome
4. Calls the MarketLogic library to handle the resolution logic
5. Emits a MarketResolved event with the outcome and total prize pool
If any validation fails, the function returns early without taking action.
If the oracle call fails (e.g., due to stale price data), the function will revert.*

**Note:**
reverts: PriceOracleStale If the oracle price data is stale.


```solidity
function _triggerMarketResolution(uint256 _marketId) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_marketId`|`uint256`|The ID of the market to resolve.|


### checkUpkeep

Checks for markets that have expired and need the MarketExpired event emitted.

*Called by Chainlink Automation on a time-based schedule.*


```solidity
function checkUpkeep(bytes calldata)
    external
    view
    override(AutomationCompatibleInterface)
    returns (bool upkeepNeeded, bytes memory performData);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`upkeepNeeded`|`bool`|Boolean indicating if there are markets needing event emission.|
|`performData`|`bytes`|Encoded array of market IDs for which to emit MarketExpired.|


### onERC721Received


```solidity
function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4);
```

## Events
### MarketCreated

```solidity
event MarketCreated(
    uint256 indexed marketId,
    string name,
    string assetSymbol,
    uint256 expirationTime,
    address priceAggregator,
    uint256 priceThreshold
);
```

### FeeConfigurationChanged

```solidity
event FeeConfigurationChanged(address indexed newTreasuryAddress, uint256 newFeeBasisPoints);
```

### MinStakeAmountChanged

```solidity
event MinStakeAmountChanged(uint256 newMinStakeAmount);
```

### DefaultMarketMinStakeChanged

```solidity
event DefaultMarketMinStakeChanged(uint256 newDefaultMinStake);
```

### MarketMinStakeChanged

```solidity
event MarketMinStakeChanged(uint256 indexed marketId, uint256 marketMinStake);
```

### FeePaid

```solidity
event FeePaid(uint256 indexed marketId, address indexed user, uint256 protocolFee);
```

### OracleResolverAddressSet

```solidity
event OracleResolverAddressSet(address indexed oldAddress, address indexed newAddress);
```

### RewardDistributorAddressSet

```solidity
event RewardDistributorAddressSet(address indexed oldAddress, address indexed newAddress);
```

### StakeRecorded

```solidity
event StakeRecorded(uint256 indexed marketId, address indexed user, PredictionTypes.Outcome outcome, uint256 amount);
```

### RewardClaimed

```solidity
event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 rewardAmount);
```

### MarketExpired

```solidity
event MarketExpired(uint256 indexed marketId, uint256 expirationTimestamp);
```

### MarketResolutionFailed

```solidity
event MarketResolutionFailed(uint256 indexed marketId, string reason);
```

## Errors
### InvalidFeeBasisPoints
Thrown when invalid fee basis points are provided.


```solidity
error InvalidFeeBasisPoints(uint256 feeBasisPoints);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`feeBasisPoints`|`uint256`|The invalid fee basis points value that was provided.|

### InvalidMinStakeAmount
Thrown when an invalid minimum stake amount is provided.


```solidity
error InvalidMinStakeAmount(uint256 minStakeAmount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`minStakeAmount`|`uint256`|The invalid minimum stake amount that was provided.|

### MarketAlreadyExists
Thrown when attempting to create a market with an ID that already exists.


```solidity
error MarketAlreadyExists(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market that already exists.|

### MarketDoesNotExist
Thrown when attempting to access a market that doesn't exist.


```solidity
error MarketDoesNotExist(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market that was requested.|

### MarketAlreadyResolved
Thrown when attempting to resolve a market that has already been resolved.


```solidity
error MarketAlreadyResolved(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market that was attempted to be resolved.|

### MarketNotResolved
Thrown when attempting to claim rewards for a market that hasn't been resolved yet.


```solidity
error MarketNotResolved(uint256 marketId);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market that was attempted to claim rewards from.|

### AlreadyPredicted
Thrown when a user attempts to make a prediction on a market they've already predicted on.


```solidity
error AlreadyPredicted(uint256 marketId, address user);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market.|
|`user`|`address`|The address of the user who has already made a prediction.|

### ZeroAddressInput
Thrown when a zero address is provided for a parameter that requires a non-zero address.


```solidity
error ZeroAddressInput();
```

### InvalidExpirationTime
Thrown when an invalid expiration time is provided for a market.


```solidity
error InvalidExpirationTime(uint256 expirationTime, uint256 currentTime);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`expirationTime`|`uint256`|The provided expiration time.|
|`currentTime`|`uint256`|The current block timestamp.|

### InvalidPriceThreshold
Thrown when an invalid price threshold is provided for a market.


```solidity
error InvalidPriceThreshold();
```

### InvalidPoolKey
Thrown when an invalid pool key is provided for a market.


```solidity
error InvalidPoolKey();
```

### InvalidAssetSymbol
Thrown when an invalid asset symbol is provided for a market.


```solidity
error InvalidAssetSymbol();
```

### AmountCannotBeZero
Thrown when a zero amount is provided for a prediction stake.


```solidity
error AmountCannotBeZero();
```

### StakeBelowMinimum
Thrown when a stake amount is below the minimum required amount.


```solidity
error StakeBelowMinimum(uint256 sentAmount, uint256 minRequiredAmount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sentAmount`|`uint256`|The amount that was sent.|
|`minRequiredAmount`|`uint256`|The minimum required amount.|

### NotWinningNFT
Thrown when attempting to claim rewards for an NFT that didn't win.


```solidity
error NotWinningNFT(uint256 tokenId, uint8 predictedOutcome, uint8 winningOutcome);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenId`|`uint256`|The ID of the NFT.|
|`predictedOutcome`|`uint8`|The outcome that was predicted.|
|`winningOutcome`|`uint8`|The actual winning outcome.|

### ClaimFailedNoStakeForOutcome
Thrown when attempting to claim rewards for an outcome with no stake.


```solidity
error ClaimFailedNoStakeForOutcome(uint256 marketId, uint8 outcomeIndex);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|The ID of the market.|
|`outcomeIndex`|`uint8`|The index of the outcome with no stake.|

### RewardTransferFailed
Thrown when a reward transfer fails.


```solidity
error RewardTransferFailed(address to, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|The address that was supposed to receive the reward.|
|`amount`|`uint256`|The amount that was supposed to be transferred.|

### FeeTransferFailed
Thrown when a fee transfer fails.


```solidity
error FeeTransferFailed(address to, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|The address that was supposed to receive the fee.|
|`amount`|`uint256`|The amount that was supposed to be transferred.|

### NotRewardDistributor
Thrown when a function that should only be called by the reward distributor is called by another address.


```solidity
error NotRewardDistributor();
```

### InvalidMarketId
Thrown when an invalid market ID is provided.


```solidity
error InvalidMarketId();
```

### NotOracleResolver
Thrown when a function that should only be called by the oracle resolver is called by another address.


```solidity
error NotOracleResolver();
```

### PriceOracleStale
Thrown when a price oracle's data is stale.


```solidity
error PriceOracleStale(uint256 lastUpdatedAt, uint256 currentTime, uint256 maxStaleness);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`lastUpdatedAt`|`uint256`|The timestamp when the price feed was last updated.|
|`currentTime`|`uint256`|The current block timestamp.|
|`maxStaleness`|`uint256`|The maximum allowed staleness in seconds.|

### ResolutionFailedOracleError
Thrown when market resolution fails due to an oracle error.


```solidity
error ResolutionFailedOracleError();
```

### InvalidUpkeepData
Thrown when invalid upkeep data is provided.


```solidity
error InvalidUpkeepData(string reason);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`reason`|`string`|A description of why the data is invalid.|

### StakeMismatch
Thrown when there's a mismatch between the declared stake and the actual value sent.


```solidity
error StakeMismatch(uint256 actual, uint256 declared);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`actual`|`uint256`|The actual value sent.|
|`declared`|`uint256`|The declared stake amount.|

### EmptyMarketName
Thrown when an empty market name is provided.


```solidity
error EmptyMarketName();
```

## Structs
### Market
*Defines the structure for a prediction market. Logic is handled by MarketLogic library.*


```solidity
struct Market {
    uint256 marketId;
    string name;
    string assetSymbol;
    bool exists;
    bool resolved;
    PredictionTypes.Outcome winningOutcome;
    uint256 totalConvictionStakeOutcome0;
    uint256 totalConvictionStakeOutcome1;
    mapping(address => bool) userHasPredicted;
    uint256 expirationTime;
    address priceAggregator;
    uint256 priceThreshold;
}
```

**Properties**

|Name|Type|Description|
|----|----|-----------|
|`marketId`|`uint256`|Unique identifier for the market.|
|`name`|`string`|User-friendly name of the market.|
|`assetSymbol`|`string`|The symbol of the asset being predicted.|
|`exists`|`bool`|True if the market has been created and exists.|
|`resolved`|`bool`|True if the market has been resolved.|
|`winningOutcome`|`PredictionTypes.Outcome`|The outcome that was determined as the winner.|
|`totalConvictionStakeOutcome0`|`uint256`|Total ETH staked on Outcome 0.|
|`totalConvictionStakeOutcome1`|`uint256`|Total ETH staked on Outcome 1.|
|`userHasPredicted`|`mapping(address => bool)`|Mapping to track if a user has already predicted.|
|`expirationTime`|`uint256`|Timestamp when the market expires.|
|`priceAggregator`|`address`|Chainlink price feed aggregator address.|
|`priceThreshold`|`uint256`|The price threshold for determining the outcome.|

## Enums
### LogAction

```solidity
enum LogAction {
    None,
    EmitMarketExpired,
    ResolveMarket
}
```


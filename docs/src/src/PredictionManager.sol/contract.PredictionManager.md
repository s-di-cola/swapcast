# PredictionManager
[Git Source](https://github.com/s-di-cola/swapcast/blob/ba2fdc6e1d72f031c7a1c408325851028341c3b0/src/PredictionManager.sol)

**Inherits:**
Ownable, [IPredictionManager](/src/interfaces/IPredictionManager.sol/interface.IPredictionManager.md), [IPredictionManagerForResolver](/src/interfaces/IPredictionManagerForResolver.sol/interface.IPredictionManagerForResolver.md), [IPredictionManagerForDistributor](/src/interfaces/IPredictionManagerForDistributor.sol/interface.IPredictionManagerForDistributor.md), ILogAutomation, AutomationCompatibleInterface, IERC721Receiver

**Author:**
SwapCast Team

Manages the creation and registry of prediction markets. Coordinates with OracleResolver,
RewardDistributor, and SwapCastNFT. Uses MarketLogic library for core market operations.
Integrates with Chainlink Automtion for market expiration and resolution.


## State Variables
### MARKET_EXPIRED_SIGNATURE

```solidity
bytes32 public constant MARKET_EXPIRED_SIGNATURE = keccak256("MarketExpired(uint256,uint256)");
```


### swapCastNFT

```solidity
ISwapCastNFT public swapCastNFT;
```


### treasuryAddress

```solidity
address public treasuryAddress;
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


### markets

```solidity
mapping(uint256 => Market) internal markets;
```


### marketMinStakes

```solidity
mapping(uint256 => uint256) public marketMinStakes;
```


### _marketIdsList

```solidity
uint256[] private _marketIdsList;
```


### maxPriceStalenessSeconds

```solidity
uint256 public maxPriceStalenessSeconds;
```


### oracleResolverAddress

```solidity
address public oracleResolverAddress;
```


### rewardDistributorAddress

```solidity
address public rewardDistributorAddress;
```


### marketIdToPoolKey

```solidity
mapping(uint256 => PoolKey) public marketIdToPoolKey;
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


```solidity
function recordPrediction(
    address _user,
    uint256 _marketId,
    PredictionTypes.Outcome _outcome,
    uint128 _convictionStakeDeclared
) external payable override;
```

### resolveMarket

Called by OracleResolver to submit resolution data for a market.
This function then calls the internal logic to finalize resolution.


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
|`_winningOutcome`|`PredictionTypes.Outcome`|The winning outcome determined by the oracle.|
|`_oraclePrice`|`int256`|The price reported by the oracle.|


### claimReward

Called by RewardDistributor to process a reward claim for an NFT.


```solidity
function claimReward(uint256 _tokenId) external virtual override onlyRewardDistributorContract;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenId`|`uint256`|The ID of the SwapCastNFT.|


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
Called by performUpkeep (log-based path).


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

```solidity
error InvalidFeeBasisPoints(uint256 feeBasisPoints);
```

### InvalidMinStakeAmount

```solidity
error InvalidMinStakeAmount(uint256 minStakeAmount);
```

### MarketAlreadyExists

```solidity
error MarketAlreadyExists(uint256 marketId);
```

### MarketDoesNotExist

```solidity
error MarketDoesNotExist(uint256 marketId);
```

### MarketAlreadyResolved

```solidity
error MarketAlreadyResolved(uint256 marketId);
```

### MarketNotResolved

```solidity
error MarketNotResolved(uint256 marketId);
```

### AlreadyPredicted

```solidity
error AlreadyPredicted(uint256 marketId, address user);
```

### ZeroAddressInput

```solidity
error ZeroAddressInput();
```

### InvalidExpirationTime

```solidity
error InvalidExpirationTime();
```

### AmountCannotBeZero

```solidity
error AmountCannotBeZero();
```

### StakeBelowMinimum

```solidity
error StakeBelowMinimum(uint256 sentAmount, uint256 minRequiredAmount);
```

### NotWinningNFT

```solidity
error NotWinningNFT();
```

### ClaimFailedNoStakeForOutcome

```solidity
error ClaimFailedNoStakeForOutcome();
```

### RewardTransferFailed

```solidity
error RewardTransferFailed();
```

### FeeTransferFailed

```solidity
error FeeTransferFailed();
```

### NotRewardDistributor

```solidity
error NotRewardDistributor();
```

### InvalidMarketId

```solidity
error InvalidMarketId();
```

### NotOracleResolver

```solidity
error NotOracleResolver();
```

### PriceOracleStale

```solidity
error PriceOracleStale();
```

### ResolutionFailedOracleError

```solidity
error ResolutionFailedOracleError();
```

### InvalidUpkeepData

```solidity
error InvalidUpkeepData(string reason);
```

### StakeMismatch

```solidity
error StakeMismatch(uint256 actual, uint256 declared);
```

### EmptyMarketName

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


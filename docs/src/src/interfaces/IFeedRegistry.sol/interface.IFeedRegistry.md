# IFeedRegistry
[Git Source](https://github.com/s-di-cola/swapcast/blob/fd3e92ac000764a2f74374fcba21b9ac2c9b9c35/src/interfaces/IFeedRegistry.sol)

Interface for Chainlink's Feed Registry

*This is a simplified version of Chainlink's FeedRegistryInterface for use in the SwapCast system*


## Functions
### getFeed

Returns the address of the aggregator for a given base/quote pair


```solidity
function getFeed(address base, address quote) external view returns (address aggregator);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`base`|`address`|The base asset address (e.g., ETH)|
|`quote`|`address`|The quote asset address (e.g., USD)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`aggregator`|`address`|The address of the price feed aggregator|


### latestRoundData

Returns the latest round data for a given base/quote pair


```solidity
function latestRoundData(address base, address quote)
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`base`|`address`|The base asset address (e.g., ETH)|
|`quote`|`address`|The quote asset address (e.g., USD)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`roundId`|`uint80`|The round ID|
|`answer`|`int256`|The price answer|
|`startedAt`|`uint256`|When the round started|
|`updatedAt`|`uint256`|When the round was updated|
|`answeredInRound`|`uint80`|The round in which the answer was computed|



# PoolStateReader
[Git Source](https://github.com/s-di-cola/swapcast/blob/2cc784f538ca7a73dcc2f008a2761d0d012508eb/src/PoolStateReader.sol)

A contract to read Uniswap V4 pool state directly from the PoolManager

*Uses StateLibrary for efficient low-level storage access*


## State Variables
### poolManager

```solidity
IPoolManager public immutable poolManager;
```


## Functions
### constructor

Constructor that sets the PoolManager reference


```solidity
constructor(IPoolManager _poolManager);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolManager`|`IPoolManager`|Address of the Uniswap V4 PoolManager|


### getPoolState

Get the current state of a pool (price, tick, fees)


```solidity
function getPoolState(PoolKey calldata key)
    external
    view
    returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`key`|`PoolKey`|The PoolKey of the pool to query|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`sqrtPriceX96`|`uint160`|The current price as a sqrt(price) * 2^96|
|`tick`|`int24`|The current tick|
|`protocolFee`|`uint24`|The current protocol fee|
|`lpFee`|`uint24`|The current LP fee|


### getPoolLiquidity

Get the current liquidity in a pool


```solidity
function getPoolLiquidity(PoolKey calldata key) external view returns (uint128 liquidity);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`key`|`PoolKey`|The PoolKey of the pool to query|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint128`|The current total liquidity in the pool|


### getPositionInfo

Get information about a specific position


```solidity
function getPositionInfo(PoolKey calldata key, address owner, int24 tickLower, int24 tickUpper, bytes32 salt)
    external
    view
    returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`key`|`PoolKey`|The PoolKey of the pool|
|`owner`|`address`|The owner of the position|
|`tickLower`|`int24`|The lower tick boundary|
|`tickUpper`|`int24`|The upper tick boundary|
|`salt`|`bytes32`|A unique identifier for the position|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint128`|The amount of liquidity in the position|
|`feeGrowthInside0LastX128`|`uint256`|The last recorded fee growth for token0|
|`feeGrowthInside1LastX128`|`uint256`|The last recorded fee growth for token1|


### getTickInfo

Get the tick info at a specific tick


```solidity
function getTickInfo(PoolKey calldata key, int24 tick)
    external
    view
    returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`key`|`PoolKey`|The PoolKey of the pool|
|`tick`|`int24`|The tick to query|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`liquidityGross`|`uint128`|The total liquidity at this tick|
|`liquidityNet`|`int128`|The net liquidity crossing this tick|
|`feeGrowthOutside0X128`|`uint256`|The fee growth outside for token0|
|`feeGrowthOutside1X128`|`uint256`|The fee growth outside for token1|



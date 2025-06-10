// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

/**
 * @title PoolStateReader
 * @notice A contract to read Uniswap V4 pool state directly from the PoolManager
 * @dev Uses StateLibrary for efficient low-level storage access
 */
contract PoolStateReader {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    IPoolManager public immutable poolManager;

    /**
     * @notice Constructor that sets the PoolManager reference
     * @param _poolManager Address of the Uniswap V4 PoolManager
     */
    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    /**
     * @notice Get the current state of a pool (price, tick, fees)
     * @param key The PoolKey of the pool to query
     * @return sqrtPriceX96 The current price as a sqrt(price) * 2^96
     * @return tick The current tick
     * @return protocolFee The current protocol fee
     * @return lpFee The current LP fee
     */
    function getPoolState(PoolKey calldata key)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
    {
        return poolManager.getSlot0(key.toId());
    }

    /**
     * @notice Get the current liquidity in a pool
     * @param key The PoolKey of the pool to query
     * @return liquidity The current total liquidity in the pool
     */
    function getPoolLiquidity(PoolKey calldata key) external view returns (uint128 liquidity) {
        return poolManager.getLiquidity(key.toId());
    }

    /**
     * @notice Get information about a specific position
     * @param key The PoolKey of the pool
     * @param owner The owner of the position
     * @param tickLower The lower tick boundary
     * @param tickUpper The upper tick boundary
     * @param salt A unique identifier for the position
     * @return liquidity The amount of liquidity in the position
     * @return feeGrowthInside0LastX128 The last recorded fee growth for token0
     * @return feeGrowthInside1LastX128 The last recorded fee growth for token1
     */
    function getPositionInfo(PoolKey calldata key, address owner, int24 tickLower, int24 tickUpper, bytes32 salt)
        external
        view
        returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)
    {
        return poolManager.getPositionInfo(key.toId(), owner, tickLower, tickUpper, salt);
    }

    /**
     * @notice Get the tick info at a specific tick
     * @param key The PoolKey of the pool
     * @param tick The tick to query
     * @return liquidityGross The total liquidity at this tick
     * @return liquidityNet The net liquidity crossing this tick
     * @return feeGrowthOutside0X128 The fee growth outside for token0
     * @return feeGrowthOutside1X128 The fee growth outside for token1
     */
    function getTickInfo(PoolKey calldata key, int24 tick)
        external
        view
        returns (
            uint128 liquidityGross,
            int128 liquidityNet,
            uint256 feeGrowthOutside0X128,
            uint256 feeGrowthOutside1X128
        )
    {
        return poolManager.getTickInfo(key.toId(), tick);
    }
}

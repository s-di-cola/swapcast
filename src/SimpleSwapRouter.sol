// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";

contract SimpleSwapRouter is IUnlockCallback {
    IPoolManager public immutable poolManager;

    struct SwapData {
        PoolKey poolKey;
        SwapParams params;
        bytes hookData;
    }

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function swap(PoolKey calldata poolKey, SwapParams calldata params, bytes calldata hookData) external payable {
        bytes memory data = abi.encode(poolKey, params, hookData);
        poolManager.unlock(data);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager));

        (PoolKey memory poolKey, SwapParams memory params, bytes memory hookData) =
            abi.decode(data, (PoolKey, SwapParams, bytes));

        poolManager.swap(poolKey, params, hookData);
        return "";
    }
}

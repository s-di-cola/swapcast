// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => PythStructs.Price) public prices;
    mapping(bytes32 => bool) public priceExists;
    uint256 public updateFee = 1 wei;
    bool public shouldRevertOnUpdate;
    
    event PriceUpdate(bytes32 indexed priceId, int64 price, uint64 conf, int32 expo, uint256 timestamp);

    function setPrice(
        bytes32 priceId,
        int64 price,
        uint64 conf,
        int32 expo,
        uint256 publishTime
    ) external {
        prices[priceId] = PythStructs.Price({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: publishTime
        });
        priceExists[priceId] = true;
        emit PriceUpdate(priceId, price, conf, expo, publishTime);
    }

    function setUpdateFee(uint256 _fee) external {
        updateFee = _fee;
    }

    function setShouldRevertOnUpdate(bool _shouldRevert) external {
        shouldRevertOnUpdate = _shouldRevert;
    }

    function getPrice(bytes32 id) external view override returns (PythStructs.Price memory price) {
        require(priceExists[id], "MockPyth: Price not found");
        
        // Get the price
        price = prices[id];
        
        // Additional validation can be added here if needed for specific test scenarios
        return price;
    }

    function getEmaPrice(bytes32 id) external view override returns (PythStructs.Price memory price) {
        require(priceExists[id], "MockPyth: Price not found");
        return prices[id];
    }

    function getPriceUnsafe(bytes32 id) external view override returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getEmaPriceUnsafe(bytes32 id) external view override returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getPriceNoOlderThan(bytes32 id, uint age) external view override returns (PythStructs.Price memory price) {
        require(priceExists[id], "MockPyth: Price not found");
        require(block.timestamp - prices[id].publishTime <= age, "MockPyth: Price too old");
        return prices[id];
    }

    function getEmaPriceNoOlderThan(bytes32 id, uint age) external view override returns (PythStructs.Price memory price) {
        require(priceExists[id], "MockPyth: Price not found");
        require(block.timestamp - prices[id].publishTime <= age, "MockPyth: Price too old");
        return prices[id];
    }

    function updatePriceFeeds(bytes[] calldata /* updateData */) external payable override {
        if (shouldRevertOnUpdate) {
            revert("MockPyth: Update reverted as instructed");
        }
        require(msg.value >= updateFee, "MockPyth: Insufficient fee");
    }

    function updatePriceFeedsIfNecessary(
        bytes[] calldata /* updateData */,
        bytes32[] calldata priceIds,
        uint64[] calldata publishTimes
    ) external payable override {
        if (shouldRevertOnUpdate) {
            revert("MockPyth: Update reverted as instructed");
        }
        require(msg.value >= updateFee, "MockPyth: Insufficient fee");
        
        // Simple mock implementation
        for (uint i = 0; i < priceIds.length; i++) {
            if (priceExists[priceIds[i]] && prices[priceIds[i]].publishTime < publishTimes[i]) {
                // Would normally update the price here, but for testing we'll just check the fee
                continue;
            }
        }
    }

    function getUpdateFee(bytes[] calldata /* updateData */) external view override returns (uint feeAmount) {
        return updateFee;
    }

    function parsePriceFeedUpdates(
        bytes[] calldata /* updateData */,
        bytes32[] calldata priceIds,
        uint64 /* minPublishTime */,
        uint64 /* maxPublishTime */
    ) external payable override returns (PythStructs.PriceFeed[] memory priceFeeds) {
        // Simple mock implementation
        priceFeeds = new PythStructs.PriceFeed[](priceIds.length);
        // In a real implementation, this would parse the updateData
        // For testing, we'll return empty feeds
        return priceFeeds;
    }

    function getValidTimePeriod() external pure override returns (uint validTimePeriod) {
        return 60; // 60 seconds
    }
}

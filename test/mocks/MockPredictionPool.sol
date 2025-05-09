pragma solidity 0.8.26;

import {IPredictionPoolForResolver} from "src/interfaces/IPredictionPoolForResolver.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";

contract MockPredictionPool is IPredictionPoolForResolver {
    mapping(address => uint256) public resolveMarketCallCounts;
    uint256 public resolveMarketCallCount;
    bool public shouldRevertResolveMarket;

    function resolveMarket(uint256, PredictionTypes.Outcome, int256) external override {
        resolveMarketCallCounts[msg.sender]++;
        resolveMarketCallCount++;
        if (shouldRevertResolveMarket) {
            revert("MockPredictionPool: ResolveMarket reverted as instructed");
        }
    }

    function setShouldRevertResolveMarket(bool _shouldRevert) external {
        shouldRevertResolveMarket = _shouldRevert;
    }
}

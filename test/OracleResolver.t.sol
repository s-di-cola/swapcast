pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {OracleResolver} from "../src/OracleResolver.sol";
import {IPredictionPoolForResolver} from "../src/interfaces/IPredictionPoolForResolver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockPredictionPool} from "./mocks/MockPredictionPool.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract OracleResolverTest is Test {
    OracleResolver public oracleResolver;
    MockPredictionPool public mockPredictionPool;
    MockAggregator public mockAggregatorEthUsd;

    address public owner;
    address public user1;
    address payable public user2;

    uint256 constant DEFAULT_MARKET_ID = 1;
    uint256 constant DEFAULT_PRICE_THRESHOLD = 2000 * 1e8;
    uint256 constant DEFAULT_MAX_STALENESS = 3600;

    event OracleRegistered(uint256 indexed marketId, address indexed oracleAddress, uint256 priceThreshold);

    event MarketResolved(uint256 indexed marketId, int256 price, uint8 winningOutcome);

    event MaxPriceStalenessSet(uint256 oldStaleness, uint256 newStaleness);

    error OracleNotRegistered(uint256 marketId);
    error InvalidAggregatorAddress();
    error OracleAlreadyRegistered(uint256 marketId);
    error PriceIsStale(uint256 marketId, uint256 priceTimestamp, uint256 currentTimestamp);
    error ResolutionFailedInPool(uint256 marketId);

    modifier prankOwner() {
        vm.prank(owner);
        _;
    }

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = payable(makeAddr("user2"));

        mockPredictionPool = new MockPredictionPool();
        mockAggregatorEthUsd = new MockAggregator();

        oracleResolver = new OracleResolver(address(mockPredictionPool), owner);
    }

    function testConstructor_SuccessfulDeployment() public view {
        assertEq(
            address(oracleResolver.predictionPool()), address(mockPredictionPool), "PredictionPool address mismatch"
        );
        assertEq(oracleResolver.owner(), owner, "Owner mismatch");
        assertEq(oracleResolver.maxPriceStalenessSeconds(), DEFAULT_MAX_STALENESS, "MaxPriceStalenessSeconds mismatch");
    }

    function testConstructor_RevertsIfPredictionPoolIsZeroAddress() public {
        vm.expectRevert(OracleResolver.PredictionPoolZeroAddress.selector);
        new OracleResolver(address(0), owner);
    }

    function testRegisterOracle_Success() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit OracleRegistered(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);

        (address aggregator, uint256 priceThreshold, bool isRegistered) =
            oracleResolver.marketOracles(DEFAULT_MARKET_ID);
        assertTrue(isRegistered, "Oracle should be registered");
        assertEq(aggregator, address(mockAggregatorEthUsd), "Aggregator address mismatch");
        assertEq(priceThreshold, DEFAULT_PRICE_THRESHOLD, "Price threshold mismatch");
    }

    function testRegisterOracle_RevertsIfNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);
    }

    function testRegisterOracle_RevertsIfOracleAlreadyRegistered() public {
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(OracleResolver.OracleAlreadyRegistered.selector, DEFAULT_MARKET_ID));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD + 1);
    }

    function testRegisterOracle_RevertsIfAggregatorIsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(OracleResolver.InvalidAggregatorAddress.selector);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(0), DEFAULT_PRICE_THRESHOLD);
    }

    function testSetMaxPriceStaleness_Success() public {
        uint256 newStaleness = 7200;
        uint256 oldStaleness = oracleResolver.maxPriceStalenessSeconds();

        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit MaxPriceStalenessSet(oldStaleness, newStaleness);
        oracleResolver.setMaxPriceStaleness(newStaleness);

        assertEq(oracleResolver.maxPriceStalenessSeconds(), newStaleness, "MaxPriceStalenessSeconds should be updated");
    }

    function testSetMaxPriceStaleness_RevertsIfNotOwner() public {
        uint256 newStaleness = 7200;

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        oracleResolver.setMaxPriceStaleness(newStaleness);
    }

    function testResolveMarket_Success_Outcome0Wins() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD);
        uint256 currentTime = block.timestamp;
        mockAggregatorEthUsd.setLatestRoundData(1, price, currentTime - 10 minutes, currentTime, 1);

        vm.prank(user1);
        vm.expectCall(
            address(mockPredictionPool),
            abi.encodeWithSelector(MockPredictionPool.resolveMarket.selector, DEFAULT_MARKET_ID, 0, price)
        );
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit MarketResolved(DEFAULT_MARKET_ID, price, 0);
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function testResolveMarket_Success_Outcome1Wins() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD - 1e8);
        uint256 currentTime = block.timestamp;
        mockAggregatorEthUsd.setLatestRoundData(1, price, currentTime - 10 minutes, currentTime, 1);

        vm.prank(user1);
        vm.expectCall(
            address(mockPredictionPool),
            abi.encodeWithSelector(MockPredictionPool.resolveMarket.selector, DEFAULT_MARKET_ID, 1, price)
        );
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit MarketResolved(DEFAULT_MARKET_ID, price, 1);
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function testResolveMarket_RevertsIfOracleNotRegistered() public {
        uint256 unregisteredMarketId = 99;
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(OracleResolver.OracleNotRegistered.selector, unregisteredMarketId));
        oracleResolver.resolveMarket(unregisteredMarketId);
    }

    function testResolveMarket_RevertsIfPriceIsStale() public {
        vm.warp(oracleResolver.maxPriceStalenessSeconds() + 1000 seconds);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD);
        uint256 staleTimestamp = block.timestamp - oracleResolver.maxPriceStalenessSeconds() - 1 seconds;
        mockAggregatorEthUsd.setLatestRoundData(1, price, staleTimestamp - 10 minutes, staleTimestamp, 1);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                OracleResolver.PriceIsStale.selector, DEFAULT_MARKET_ID, staleTimestamp, block.timestamp
            )
        );
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function testResolveMarket_RevertsIfPredictionPoolCallFails() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(mockAggregatorEthUsd), DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD);
        uint256 currentTime = block.timestamp;
        mockAggregatorEthUsd.setLatestRoundData(1, price, currentTime - 10 minutes, currentTime, 1);

        mockPredictionPool.setShouldRevertResolveMarket(true);

        vm.expectRevert(abi.encodeWithSelector(OracleResolver.ResolutionFailedInPool.selector, DEFAULT_MARKET_ID));
        vm.prank(user1);
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }
}

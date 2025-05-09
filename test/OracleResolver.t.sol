// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {OracleResolver} from "../src/OracleResolver.sol";
import {IFeedRegistry} from "../src/interfaces/IFeedRegistry.sol";
import {IPredictionManagerForResolver} from "src/interfaces/IPredictionManagerForResolver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockPredictionManager} from "./mocks/MockPredictionPool.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {PredictionTypes} from "../src/types/PredictionTypes.sol";

// Mock implementation of FeedRegistry for testing
contract MockFeedRegistry is IFeedRegistry {
    address public mockFeed;
    int256 public mockPrice;
    uint256 public mockTimestamp;

    constructor(address _mockFeed) {
        mockFeed = _mockFeed;
        mockTimestamp = block.timestamp;
    }

    function setMockPrice(int256 _price, uint256 _timestamp) external {
        mockPrice = _price;
        mockTimestamp = _timestamp;
    }

    function getFeed(address, address) external view override returns (address) {
        return mockFeed;
    }

    function latestRoundData(address, address)
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, mockPrice, mockTimestamp - 10 minutes, mockTimestamp, 1);
    }
}

contract OracleResolverTest is Test {
    OracleResolver public oracleResolver;
    MockPredictionManager public mockPredictionPool;
    MockAggregator public mockAggregatorEthUsd;

    address public owner;
    address public user1;
    address payable public user2;

    uint256 constant DEFAULT_MARKET_ID = 1;
    uint256 constant DEFAULT_PRICE_THRESHOLD = 2000 * 1e8;
    uint256 constant DEFAULT_MAX_STALENESS = 3600;

    event OracleRegistered(uint256 indexed marketId, address baseToken, address quoteToken, uint256 priceThreshold);

    event MarketResolved(uint256 indexed marketId, int256 price, PredictionTypes.Outcome winningOutcome);

    event MaxPriceStalenessSet(uint256 oldStaleness, uint256 newStaleness);

    error OracleNotRegistered(uint256 marketId);
    error InvalidTokenAddress();
    error OracleAlreadyRegistered(uint256 marketId);
    error PriceIsStale(uint256 marketId, uint256 priceTimestamp, uint256 currentTimestamp);
    error ResolutionFailedInManager(uint256 marketId);
    error FeedRegistryNotSet();
    error PredictionManagerZeroAddress();

    modifier prankOwner() {
        vm.prank(owner);
        _;
    }

    MockFeedRegistry public mockFeedRegistry;
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address public constant USD_ADDRESS = 0x0000000000000000000000000000000000000348;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = payable(makeAddr("user2"));

        mockPredictionPool = new MockPredictionManager();
        mockAggregatorEthUsd = new MockAggregator();
        mockFeedRegistry = new MockFeedRegistry(address(mockAggregatorEthUsd));

        oracleResolver = new OracleResolver(address(mockPredictionPool), address(mockFeedRegistry), owner);
    }

    function testConstructor_SuccessfulDeployment() public view {
        assertEq(
            address(oracleResolver.predictionManager()),
            address(mockPredictionPool),
            "PredictionManager address mismatch"
        );
        assertEq(address(oracleResolver.feedRegistry()), address(mockFeedRegistry), "FeedRegistry address mismatch");
        assertEq(oracleResolver.owner(), owner, "Owner mismatch");
        assertEq(oracleResolver.maxPriceStalenessSeconds(), DEFAULT_MAX_STALENESS, "MaxPriceStalenessSeconds mismatch");
    }

    function testConstructor_RevertsIfPredictionManagerIsZeroAddress() public {
        vm.expectRevert(OracleResolver.PredictionManagerZeroAddress.selector);
        new OracleResolver(address(0), address(mockFeedRegistry), owner);
    }

    function testConstructor_RevertsIfFeedRegistryIsZeroAddress() public {
        vm.expectRevert(OracleResolver.InvalidTokenAddress.selector);
        new OracleResolver(address(mockPredictionPool), address(0), owner);
    }

    function testRegisterOracle_Success() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit OracleRegistered(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        (address baseToken, address quoteToken, uint256 priceThreshold, bool isRegistered) =
            oracleResolver.marketOracles(DEFAULT_MARKET_ID);
        assertTrue(isRegistered, "Oracle should be registered");
        assertEq(baseToken, ETH_ADDRESS, "Base token address mismatch");
        assertEq(quoteToken, USD_ADDRESS, "Quote token address mismatch");
        assertEq(priceThreshold, DEFAULT_PRICE_THRESHOLD, "Price threshold mismatch");
    }

    function testRegisterOracle_RevertsIfNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);
    }

    function testRegisterOracle_RevertsIfOracleAlreadyRegistered() public {
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(OracleResolver.OracleAlreadyRegistered.selector, DEFAULT_MARKET_ID));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD + 1);
    }

    function testRegisterOracle_RevertsIfTokenAddressIsZero() public {
        vm.prank(owner);
        vm.expectRevert(OracleResolver.InvalidTokenAddress.selector);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(0), USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        vm.prank(owner);
        vm.expectRevert(OracleResolver.InvalidTokenAddress.selector);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, address(0), DEFAULT_PRICE_THRESHOLD);
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
        vm.expectRevert("Ownable: caller is not the owner");
        oracleResolver.setMaxPriceStaleness(newStaleness);
    }

    function testResolveMarket_Success_Outcome0Wins() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD);
        uint256 currentTime = block.timestamp;
        mockFeedRegistry.setMockPrice(price, currentTime);

        vm.prank(user1);
        vm.expectCall(
            address(mockPredictionPool),
            abi.encodeWithSelector(
                MockPredictionManager.resolveMarket.selector, DEFAULT_MARKET_ID, PredictionTypes.Outcome.Bullish, price
            )
        );
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit MarketResolved(DEFAULT_MARKET_ID, price, PredictionTypes.Outcome.Bullish);
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function testResolveMarket_Success_Outcome1Wins() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD - 1e8);
        uint256 currentTime = block.timestamp;
        mockFeedRegistry.setMockPrice(price, currentTime);

        vm.prank(user1);
        vm.expectCall(
            address(mockPredictionPool),
            abi.encodeWithSelector(
                MockPredictionManager.resolveMarket.selector, DEFAULT_MARKET_ID, PredictionTypes.Outcome.Bearish, price
            )
        );
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit MarketResolved(DEFAULT_MARKET_ID, price, PredictionTypes.Outcome.Bearish);
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
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD);
        uint256 staleTimestamp = block.timestamp - oracleResolver.maxPriceStalenessSeconds() - 1 seconds;
        mockFeedRegistry.setMockPrice(price, staleTimestamp);

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
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD);
        uint256 currentTime = block.timestamp;
        mockFeedRegistry.setMockPrice(price, currentTime);

        mockPredictionPool.setShouldRevertResolveMarket(true);

        vm.expectRevert(abi.encodeWithSelector(OracleResolver.ResolutionFailedInManager.selector, DEFAULT_MARKET_ID));
        vm.prank(user1);
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }
}

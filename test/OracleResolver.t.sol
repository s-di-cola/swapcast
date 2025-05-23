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
    mapping(address => mapping(address => uint80)) public roundIds;
    mapping(address => mapping(address => bool)) public shouldUseMockData;

    constructor(address _mockFeed) {
        mockFeed = _mockFeed;
        mockTimestamp = block.timestamp;
    }

    function setMockPrice(int256 _price, uint256 _timestamp) external {
        mockPrice = _price;
        mockTimestamp = _timestamp;
    }

    function setRoundData(
        address base,
        address quote,
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) external {
        roundIds[base][quote] = roundId;
        MockAggregator(mockFeed).setLatestRoundData(roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function setUseMockData(address base, address quote, bool useMock) external {
        shouldUseMockData[base][quote] = useMock;
    }

    function getFeed(address, address) external view override returns (address) {
        return mockFeed;
    }

    function latestRoundData(address base, address quote)
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        // If we're using mock data, return the mock values
        if (shouldUseMockData[base][quote]) {
            return (1, mockPrice, mockTimestamp - 10 minutes, mockTimestamp, 1);
        }
        // Otherwise, use the mock aggregator
        return MockAggregator(mockFeed).latestRoundData();
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
    error InvalidRound();
    error StaleRound();
    error InvalidPrice();
    error InvalidPriceThreshold();

    modifier prankOwner() {
        vm.prank(owner);
        _;
    }

    MockFeedRegistry public mockFeedRegistry;
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address public constant USD_ADDRESS = 0x0000000000000000000000000000000000000348;

    /// @notice Sets up the test environment for OracleResolver tests.
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = payable(makeAddr("user2"));

        mockPredictionPool = new MockPredictionManager();
        mockAggregatorEthUsd = new MockAggregator();
        mockFeedRegistry = new MockFeedRegistry(address(mockAggregatorEthUsd));

        oracleResolver = new OracleResolver(address(mockPredictionPool), address(mockFeedRegistry), owner);
    }

    /// @notice Tests that the OracleResolver constructor sets all addresses and values correctly.
    function test_constructor_successful_deployment() public {
        // Create a new instance with the correct maxPriceStaleness
        OracleResolver newResolver = new OracleResolver(address(mockPredictionPool), address(mockFeedRegistry), owner);

        assertEq(
            address(newResolver.predictionManager()), address(mockPredictionPool), "PredictionManager address mismatch"
        );
        assertEq(address(newResolver.feedRegistry()), address(mockFeedRegistry), "FeedRegistry address mismatch");
        assertEq(newResolver.owner(), owner, "Owner mismatch");
        assertEq(newResolver.maxPriceStalenessSeconds(), DEFAULT_MAX_STALENESS, "MaxPriceStalenessSeconds mismatch");
    }

    /// @notice Tests that the constructor reverts if the PredictionManager address is zero.
    function test_constructor_reverts_if_prediction_manager_is_zero_address() public {
        vm.expectRevert(OracleResolver.PredictionManagerZeroAddress.selector);
        new OracleResolver(address(0), address(mockFeedRegistry), owner);
    }

    /// @notice Tests that the constructor reverts if the FeedRegistry address is zero.
    function test_constructor_reverts_if_feed_registry_is_zero_address() public {
        vm.expectRevert(OracleResolver.InvalidTokenAddress.selector);
        new OracleResolver(address(mockPredictionPool), address(0), owner);
    }

    /// @notice Tests successful registration of an oracle and event emission.
    function test_register_oracle_success() public {
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
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);
    }

    /// @notice Tests that registering an oracle twice for the same market reverts.
    function test_register_oracle_reverts_if_oracle_already_registered() public {
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(OracleResolver.OracleAlreadyRegistered.selector, DEFAULT_MARKET_ID));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD + 1);
    }

    function test_register_oracle_reverts_on_zero_address() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenAddress.selector));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, address(0), USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenAddress.selector));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, address(0), DEFAULT_PRICE_THRESHOLD);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(InvalidPriceThreshold.selector));
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, 0);
    }

    /// @notice Tests successful update of max price staleness and event emission.
    function test_set_max_price_staleness_success() public {
        uint256 newStaleness = 7200;
        uint256 oldStaleness = oracleResolver.maxPriceStalenessSeconds();

        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(oracleResolver));
        emit MaxPriceStalenessSet(oldStaleness, newStaleness);
        oracleResolver.setMaxPriceStaleness(newStaleness);

        assertEq(oracleResolver.maxPriceStalenessSeconds(), newStaleness, "MaxPriceStalenessSeconds should be updated");
    }

    /// @notice Tests that only the owner can update max price staleness.
    function test_set_max_price_staleness_reverts_if_not_owner() public {
        uint256 newStaleness = 7200;

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        oracleResolver.setMaxPriceStaleness(newStaleness);
    }

    /// @notice Tests resolving a market where outcome 0 (Bullish) wins and emits the correct event.
    function test_resolve_market_successful_resolution() public {
        // Register an oracle for the market
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        // Set up the mock price data
        mockAggregatorEthUsd.setLatestRoundData(
            1, // roundId
            int256(DEFAULT_PRICE_THRESHOLD + 1e8), // Price above threshold
            block.timestamp - 1,
            block.timestamp,
            1 // answeredInRound
        );

        // Expect the MarketResolved event
        vm.expectEmit(true, true, true, true);
        emit MarketResolved(DEFAULT_MARKET_ID, int256(DEFAULT_PRICE_THRESHOLD + 1e8), PredictionTypes.Outcome.Bullish);

        // Resolve the market
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function test_resolve_market_reverts_on_invalid_round() public {
        // Register an oracle for the market
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        // Set up the mock to return an invalid round (roundId = 0)
        mockAggregatorEthUsd.setLatestRoundData(
            0, // Invalid round ID
            2000 * 1e8,
            block.timestamp - 1,
            block.timestamp,
            1
        );

        // Expect the InvalidRound error
        vm.expectRevert(abi.encodeWithSignature("InvalidRound()"));
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function test_resolve_market_reverts_on_stale_round() public {
        // Register an oracle for the market
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        // Set mock to return stale round (answeredInRound < roundId)
        mockAggregatorEthUsd.setLatestRoundData(
            2, // roundId
            2000 * 1e8,
            block.timestamp - 1,
            block.timestamp,
            1 // answeredInRound < roundId (stale)
        );

        vm.expectRevert(abi.encodeWithSignature("StaleRound()"));
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    function test_resolve_market_reverts_on_invalid_price() public {
        // Register an oracle for the market
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        // Set mock to return invalid price (0)
        mockAggregatorEthUsd.setLatestRoundData(
            1, // roundId
            0, // Invalid price (0)
            block.timestamp - 1,
            block.timestamp,
            1
        );

        vm.expectRevert(abi.encodeWithSignature("InvalidPrice()"));
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    /// @notice Tests resolving a market where outcome 1 (Bearish) wins and emits the correct event.
    function test_resolve_market_success_outcome1_wins() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        int256 price = int256(DEFAULT_PRICE_THRESHOLD - 1);
        uint256 currentTime = block.timestamp;

        // Set up the mock price data
        mockAggregatorEthUsd.setLatestRoundData(
            1, // roundId
            price,
            currentTime - 1,
            currentTime,
            1 // answeredInRound
        );

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

    /// @notice Tests that resolving a market with no registered oracle reverts.
    function test_resolve_market_reverts_if_oracle_not_registered() public {
        uint256 unregisteredMarketId = 99;
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(OracleResolver.OracleNotRegistered.selector, unregisteredMarketId));
        oracleResolver.resolveMarket(unregisteredMarketId);
    }

    /// @notice Tests that resolving a market with a stale price reverts.
    function test_resolve_market_reverts_if_price_is_stale() public {
        vm.warp(oracleResolver.maxPriceStalenessSeconds() + 1000 seconds);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        // Set a stale price (updatedAt is too old)
        uint256 staleTimestamp = block.timestamp - oracleResolver.maxPriceStalenessSeconds() - 1;
        mockAggregatorEthUsd.setLatestRoundData(
            1, // roundId
            int256(DEFAULT_PRICE_THRESHOLD),
            staleTimestamp - 1,
            staleTimestamp,
            1 // answeredInRound
        );

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                OracleResolver.PriceIsStale.selector, DEFAULT_MARKET_ID, staleTimestamp, block.timestamp
            )
        );
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }

    /// @notice Tests that a failed call to PredictionManager during resolution reverts with the correct error.
    function test_resolve_market_reverts_if_prediction_pool_call_fails() public {
        vm.warp(1 days);
        vm.prank(owner);
        oracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_ADDRESS, USD_ADDRESS, DEFAULT_PRICE_THRESHOLD);

        // Disable mock data to use the mock aggregator directly
        mockFeedRegistry.setUseMockData(ETH_ADDRESS, USD_ADDRESS, false);

        // Set up the mock price data
        mockAggregatorEthUsd.setLatestRoundData(
            1, // roundId
            int256(DEFAULT_PRICE_THRESHOLD - 1),
            block.timestamp - 1,
            block.timestamp,
            1 // answeredInRound
        );

        // Make the mock revert when resolveMarket is called
        mockPredictionPool.setShouldRevertResolveMarket(true);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(OracleResolver.ResolutionFailedInManager.selector, DEFAULT_MARKET_ID));
        oracleResolver.resolveMarket(DEFAULT_MARKET_ID);
    }
}

//SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {PredictionManager, Log, ILogAutomation} from "src/PredictionManager.sol";
import {MockSwapCastNFT} from "./mocks/MockSwapCastNFT.sol";
import {ISwapCastNFT} from "src/interfaces/ISwapCastNFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";

// Mock Chainlink Price Feed
contract MockAggregatorV3 is AggregatorV3Interface {
    int256 private _answer;
    uint256 private _updatedAt;
    uint8 private _decimals;
    string private _description;
    uint256 private _version;

    constructor(int256 initialAnswer) {
        _answer = initialAnswer;
        _updatedAt = block.timestamp;
        _decimals = 8;
        _description = "Mock Aggregator";
        _version = 1;
    }

    function setLatestAnswer(int256 answer) external {
        _answer = answer;
        _updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 timestamp) external {
        _updatedAt = timestamp;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external view override returns (string memory) {
        return _description;
    }

    function version() external view override returns (uint256) {
        return _version;
    }

    function getRoundData(uint80)
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _answer, block.timestamp, _updatedAt, 1);
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _answer, block.timestamp, _updatedAt, 1);
    }
}

contract LogAutomationTest is Test {
    PredictionManager internal pool;
    MockSwapCastNFT internal mockNft;
    MockAggregatorV3 internal mockPriceFeed;

    address internal owner;
    address payable internal treasuryAddress;
    address internal oracleResolverAddress;
    address internal rewardDistributorAddress;
    address internal user1;
    address internal user2;

    uint256 internal initialFeeBasisPoints = 100;
    uint256 internal initialMinStakeAmount = 0.01 ether;

    // Event signatures
    bytes32 constant MARKET_EXPIRED_SIGNATURE = keccak256("MarketExpired(uint256,uint256)");

    function setUp() public {
        // Set block timestamp to a non-zero value
        vm.warp(1000000);

        owner = makeAddr("owner");
        treasuryAddress = payable(makeAddr("treasury"));
        oracleResolverAddress = makeAddr("MockOracleResolver");
        rewardDistributorAddress = makeAddr("MockRewardDistributor");

        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(owner, 1 ether);

        vm.startPrank(owner);
        mockNft = new MockSwapCastNFT();
        vm.stopPrank();
        mockPriceFeed = new MockAggregatorV3(5000 * 10 ** 8); // $5000 with 8 decimals

        pool = new PredictionManager(
            address(mockNft),
            treasuryAddress,
            initialFeeBasisPoints,
            owner,
            initialMinStakeAmount,
            3600 // maxPriceStalenessSeconds (1 hour)
        );

        vm.prank(owner);
        mockNft.setPredictionPoolAddress(address(pool));
    }

    function testCreateMarketWithOracle() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp + 1 days;
        uint256 priceThreshold = 5500 * 10 ** 8; // $5500 with 8 decimals

        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), priceThreshold);

        // Verify market was created with oracle data
        (
            uint256 mId,
            bool mExists,
            bool mResolved,
            ,
            ,
            ,
            uint256 mExpirationTime,
            address mPriceAggregator,
            uint256 mPriceThreshold
        ) = pool.getMarketDetails(marketId);

        assertEq(mId, marketId, "Market ID mismatch");
        assertTrue(mExists, "Market should exist");
        assertFalse(mResolved, "Market should not be resolved yet");
        assertEq(mExpirationTime, expirationTime, "Expiration time mismatch");
        assertEq(mPriceAggregator, address(mockPriceFeed), "Price aggregator mismatch");
        assertEq(mPriceThreshold, priceThreshold, "Price threshold mismatch");
    }

    function testCreateMarketWithOracle_Reverts_InvalidExpirationTime() public {
        uint256 marketId = 1;
        uint256 pastExpirationTime = block.timestamp - 1 hours;

        vm.prank(owner);
        vm.expectRevert(PredictionManager.InvalidExpirationTime.selector);
        pool.createMarketWithOracle(marketId, pastExpirationTime, address(mockPriceFeed), 5000 * 10 ** 8);
    }

    function testCheckMarketExpiration_EmitsEvent() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp + 1 days;

        // Create market
        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), 5000 * 10 ** 8);

        // Warp to expiration time
        vm.warp(expirationTime);

        // Check expiration and expect event
        vm.expectEmit(true, true, true, true);
        emit MarketExpired(marketId, expirationTime);
        pool.checkMarketExpiration(marketId);
    }

    function testCheckMarketExpiration_NoEventBeforeExpiration() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp + 1 days;

        // Create market
        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), 5000 * 10 ** 8);

        // Warp to a time before expiration
        vm.warp(expirationTime - 1 hours);

        // Record all events
        vm.recordLogs();

        // Check expiration
        pool.checkMarketExpiration(marketId);

        // Verify no MarketExpired event was emitted
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool foundMarketExpiredEvent = false;

        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == MARKET_EXPIRED_SIGNATURE) {
                foundMarketExpiredEvent = true;
                break;
            }
        }

        assertFalse(foundMarketExpiredEvent, "MarketExpired event should not be emitted before expiration");
    }

    function testCheckLog_ReturnsTrue_ForExpiredMarket() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp;

        // Create market
        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), 5000 * 10 ** 8);

        // Emit MarketExpired event
        vm.warp(expirationTime);
        vm.recordLogs();
        pool.checkMarketExpiration(marketId);

        // Get the emitted log
        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory marketExpiredLog;
        bool foundLog = false;

        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == MARKET_EXPIRED_SIGNATURE) {
                marketExpiredLog = entries[i];
                foundLog = true;
                break;
            }
        }

        assertTrue(foundLog, "MarketExpired event should be emitted");

        // Create a Log struct for checkLog
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = MARKET_EXPIRED_SIGNATURE;
        topics[1] = bytes32(marketId);

        Log memory log = Log({
            index: 0,
            timestamp: block.timestamp,
            txHash: bytes32(0),
            blockNumber: block.number,
            blockHash: bytes32(0),
            source: address(pool),
            topics: topics,
            data: marketExpiredLog.data
        });

        // Call checkLog
        (bool upkeepNeeded, bytes memory performData) = pool.checkLog(log, "");

        assertTrue(upkeepNeeded, "Upkeep should be needed for expired market");
        assertEq(abi.decode(performData, (uint256)), marketId, "Perform data should contain market ID");
    }

    function testPerformUpkeep_ResolvesMarket() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp;
        uint256 priceThreshold = 5500 * 10 ** 8; // $5500 with 8 decimals

        // Create market
        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), priceThreshold);

        // Set price below threshold (should resolve as Bullish)
        mockPriceFeed.setLatestAnswer(5000 * 10 ** 8); // $5000 < $5500

        // Encode market ID for performUpkeep
        bytes memory performData = abi.encode(marketId);

        // Perform upkeep
        pool.performUpkeep(performData);

        // Verify market was resolved
        (,, bool mResolved, PredictionTypes.Outcome mWinningOutcome,,,,,) = pool.getMarketDetails(marketId);

        assertTrue(mResolved, "Market should be resolved");
        assertEq(uint8(mWinningOutcome), uint8(PredictionTypes.Outcome.Bullish), "Winning outcome should be Bullish");
    }

    function testPerformUpkeep_SkipsResolution_StalePriceData() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp;

        // Create market
        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), 5000 * 10 ** 8);

        // Set price feed's updatedAt to a stale timestamp
        uint256 staleTimestamp = block.timestamp - 2 hours;
        mockPriceFeed.setUpdatedAt(staleTimestamp);

        // Set max staleness to 1 hour
        vm.prank(owner);
        pool.setMaxPriceStaleness(1 hours);

        // Encode market ID for performUpkeep
        bytes memory performData = abi.encode(marketId);

        // Perform upkeep
        pool.performUpkeep(performData);

        // Verify market was NOT resolved due to stale data
        (,, bool mResolved,,,,,,) = pool.getMarketDetails(marketId);

        assertFalse(mResolved, "Market should not be resolved with stale price data");
    }

    function testEndToEnd_LogTriggeredAutomation() public {
        uint256 marketId = 1;
        uint256 expirationTime = block.timestamp + 1 days;
        uint256 priceThreshold = 5500 * 10 ** 8; // $5500 with 8 decimals

        // Create market with oracle
        vm.prank(owner);
        pool.createMarketWithOracle(marketId, expirationTime, address(mockPriceFeed), priceThreshold);

        // Make predictions
        vm.prank(user1);
        vm.deal(address(pool), 1 ether);
        pool.recordPrediction(user1, marketId, PredictionTypes.Outcome.Bearish, uint128(1 ether));

        vm.prank(user2);
        vm.deal(address(pool), 1 ether);
        pool.recordPrediction(user2, marketId, PredictionTypes.Outcome.Bullish, uint128(1 ether));

        // Warp to expiration time
        vm.warp(expirationTime);

        // Emit MarketExpired event
        vm.recordLogs();
        pool.checkMarketExpiration(marketId);

        // Get the emitted log
        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory marketExpiredLog;

        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == MARKET_EXPIRED_SIGNATURE) {
                marketExpiredLog = entries[i];
                break;
            }
        }

        // Create a Log struct for checkLog
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = MARKET_EXPIRED_SIGNATURE;
        topics[1] = bytes32(marketId);

        Log memory log = Log({
            index: 0,
            timestamp: block.timestamp,
            txHash: bytes32(0),
            blockNumber: block.number,
            blockHash: bytes32(0),
            source: address(pool),
            topics: topics,
            data: marketExpiredLog.data
        });

        // Call checkLog
        (bool upkeepNeeded, bytes memory performData) = pool.checkLog(log, "");

        assertTrue(upkeepNeeded, "Upkeep should be needed for expired market");

        // Set price above threshold (should resolve as Bearish)
        mockPriceFeed.setLatestAnswer(6000 * 10 ** 8); // $6000 > $5500

        // Perform upkeep
        pool.performUpkeep(performData);

        // Verify market was resolved correctly
        (,, bool mResolved, PredictionTypes.Outcome mWinningOutcome,,,,,) = pool.getMarketDetails(marketId);

        assertTrue(mResolved, "Market should be resolved");
        assertEq(uint8(mWinningOutcome), uint8(PredictionTypes.Outcome.Bearish), "Winning outcome should be Bearish");
    }

    // Event definition for testing
    event MarketExpired(uint256 indexed marketId, uint256 expirationTime);
}

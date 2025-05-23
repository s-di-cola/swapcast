//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {PredictionManager} from "src/PredictionManager.sol"; // For PredictionManager.LogAction and the contract instance
import {ILogAutomation, Log} from "@chainlink/contracts/v0.8/automation/interfaces/ILogAutomation.sol"; // Correct Chainlink import
import {PoolKey} from "v4-core/types/PoolKey.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ISwapCastNFT} from "src/interfaces/ISwapCastNFT.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";
import {MarketLogic} from "src/MarketLogic.sol"; // Import MarketLogic.sol
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {MockSwapCastNFT} from "./mocks/MockSwapCastNFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";
import {OracleResolver} from "src/OracleResolver.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract LogAutomationTest is Test {
    PredictionManager internal pool;
    PoolKey internal testPoolKey; // Added testPoolKey state variable
    address internal owner;
    address internal user1;
    address internal user2;
    address internal treasuryAddress;
    MockSwapCastNFT internal mockNft;
    MockAggregator internal mockPriceFeed;

    uint256 internal initialFeeBasisPoints = 100; // 1%
    uint256 internal initialMinStakeAmount = 0.1 ether;

    bytes32 public constant MARKET_EXPIRED_SIGNATURE = keccak256("MarketExpired(uint256,uint256)");

    bytes32 public constant PREDICTION_MANAGER_LOG_TOPIC_0 = keccak256("AutomationLog(uint8,uint8,uint256,bytes)");

    // Local event definitions matching PredictionManager's events
    event MarketExpired(uint256 indexed marketId, uint256 timestamp);
    event MarketResolved(
        uint256 indexed marketId, PredictionTypes.Outcome outcome, int256 price, uint256 totalPrizePool
    );

    /// @notice Sets up the test environment for LogAutomation tests.
    function setUp() public {
        vm.warp(1 days); // Set a baseline timestamp to avoid underflows
        owner = address(this); // Test contract itself is the owner for simplicity
        user1 = vm.addr(1);
        user2 = vm.addr(2);
        treasuryAddress = vm.addr(3);

        vm.startPrank(owner);
        mockNft = new MockSwapCastNFT();
        vm.stopPrank();
        mockPriceFeed = new MockAggregator();
        mockPriceFeed.setLatestAnswer(5000 * 10 ** 8); // Set initial answer as tests expect it

        address mockOracleResolver = vm.addr(4); // Assign a mock address
        address mockRewardDistributor = vm.addr(5); // Assign a mock address

        pool = new PredictionManager(
            address(mockNft),
            treasuryAddress,
            initialFeeBasisPoints,
            initialMinStakeAmount,
            3600, // maxPriceStalenessSeconds (1 hour)
            mockOracleResolver,
            mockRewardDistributor
        );

        vm.prank(owner);
        mockNft.setPredictionPoolAddress(address(pool));
        vm.stopPrank();

        // Initialize testPoolKey with example values
        testPoolKey = PoolKey({
            currency0: Currency.wrap(vm.addr(0xA0)), // Convert address to Currency type
            currency1: Currency.wrap(vm.addr(0xB0)), // Convert address to Currency type
            fee: 3000, // Standard fee, e.g., 0.3%
            tickSpacing: 60, // Standard tick spacing
            hooks: IHooks(address(0)) // Cast address to IHooks interface
        });
    }

    /// @notice Tests that a newly created market has correct initial details.
    function test_get_market_details_initial_values() public {
        uint256 expirationTime = block.timestamp + 1 days;
        uint256 priceThreshold = 5500 * 10 ** 8; // $5500 with 8 decimals

        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "TEST", expirationTime, address(mockPriceFeed), priceThreshold, testPoolKey
        ); // New: marketId is returned, PoolKey added

        (
            uint256 mId,
            string memory mName,
            string memory mAssetSymbol,
            bool mExists,
            bool mResolved,
            PredictionTypes.Outcome mWinningOutcome,
            ,
            ,
            uint256 mExpirationTime,
            address mPriceAggregator,
            uint256 mPriceThresholdVal
        ) = pool.getMarketDetails(marketId);

        assertEq(mId, marketId, "Market ID mismatch");
        assertEq(mName, "Test Market", "Market name mismatch");
        assertEq(mAssetSymbol, "TEST", "Market asset symbol mismatch");
        assertTrue(mExists, "Market should exist");
        assertFalse(mResolved, "Market should not be resolved yet");
        assertEq(
            uint256(mWinningOutcome),
            uint256(PredictionTypes.Outcome.Bearish),
            "Default winningOutcome should be Bearish"
        );
        assertEq(mExpirationTime, expirationTime, "Market expiration time mismatch");
        assertEq(mPriceAggregator, address(mockPriceFeed), "Market price aggregator mismatch");
        assertEq(mPriceThresholdVal, priceThreshold, "Market price threshold mismatch");
    }

    /// @notice Tests that creating a market with a past expiration time reverts.
    function test_create_market_invalid_expiration_time() public {
        // uint256 marketId = 1; // Old: marketId was an input parameter
        uint256 pastExpirationTime = block.timestamp - 1 hours;

        vm.prank(owner);
        vm.expectRevert(PredictionManager.InvalidExpirationTime.selector);
        pool.createMarket(
            "Test Market", "TEST", pastExpirationTime, address(mockPriceFeed), 5000 * 10 ** 8, testPoolKey
        ); // New: marketId not passed, PoolKey added
    }

    /// @notice Tests that performUpkeep emits MarketExpired when a market expires.
    function test_check_market_expiration_emits_event() public {
        // uint256 marketId = 1; // Old: marketId was an input parameter
        uint256 expirationTime = block.timestamp + 1 hours;
        uint256 priceThreshold = 5000 * 10 ** 8;

        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "TEST", expirationTime, address(mockPriceFeed), priceThreshold, testPoolKey
        ); // New: marketId is returned, PoolKey added

        vm.warp(expirationTime);

        (bool upkeepNeeded, bytes memory performData) = pool.checkUpkeep("");
        assertTrue(upkeepNeeded, "Upkeep should be needed for expired market");

        vm.expectEmit(true, true, true, true, address(pool));
        emit MarketExpired(marketId, expirationTime);
        pool.performUpkeep(performData);
    }

    /// @notice Tests that checkUpkeep returns false when there are no expired markets.
    function test_check_upkeep_no_expired_markets() public {
        // uint256 marketId = 1; // Old: marketId was an input parameter
        uint256 expirationTime = block.timestamp + 1 days;
        uint256 priceThreshold = 5000 * 10 ** 8;

        vm.prank(owner);
        pool.createMarket("Test Market", "TEST", expirationTime, address(mockPriceFeed), priceThreshold, testPoolKey); // New: marketId is returned, PoolKey added

        (bool upkeepNeeded,) = pool.checkUpkeep("");
        assertFalse(upkeepNeeded, "Upkeep should not be needed for non-expired market");
    }

    /// @notice Tests that MarketExpired is not emitted before the market expiration.
    function test_check_market_expiration_no_event_before_expiration() public {
        // uint256 marketId = 1; // Old: marketId was an input parameter
        uint256 expirationTime = block.timestamp + 1 days;

        vm.prank(owner);
        pool.createMarket("Test Market", "TEST", expirationTime, address(mockPriceFeed), 5000 * 10 ** 8, testPoolKey); // New: marketId is returned, PoolKey added

        vm.warp(expirationTime - 1 hours);

        vm.recordLogs();

        (bool upkeepNeeded,) = pool.checkUpkeep("");
        assertFalse(upkeepNeeded, "Upkeep should not be needed as market is not yet expired");

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

    /// @notice Tests that checkLog would return true for an expired market, but only event emission is verified here.
    function test_check_log_returns_true_for_expired_market() public {
        // uint256 localMarketId = 1; // Old: localMarketId was an input parameter
        uint256 marketExpirationTime = block.timestamp + 1 days;
        vm.prank(address(this));
        uint256 localMarketId = pool.createMarket( // New: localMarketId is returned, PoolKey added
        "Test Market", "TEST", marketExpirationTime, address(mockPriceFeed), 500_000_000_000, testPoolKey);

        uint256 expectedEmitTimestamp = marketExpirationTime + 1;
        vm.warp(expectedEmitTimestamp);

        (bool upkeepNeededForEvent, bytes memory performDataForUpkeep) = pool.checkUpkeep("");
        assertTrue(upkeepNeededForEvent, "Upkeep should be needed to emit MarketExpired");

        vm.expectEmit(true, true, true, true, address(pool));
        emit MarketExpired(localMarketId, expectedEmitTimestamp);
        pool.performUpkeep(performDataForUpkeep);
    }

    /// @notice Tests the full two-stage process: event emission and then market resolution via performUpkeep.
    function test_perform_upkeep_resolves_market_and_logs() public {
        // uint256 localMarketId = 1; // Old: localMarketId was an input parameter
        uint256 marketExpirationTime = block.timestamp + 1 days;
        uint256 priceThreshold = 500_000_000_000;
        int256 finalPrice = 500_000_000_100; // Bullish outcome

        // Prank as owner to create market
        vm.prank(address(this));
        uint256 localMarketId = pool.createMarket( // New: localMarketId is returned, PoolKey added
        "Test Market", "TEST", marketExpirationTime, address(mockPriceFeed), priceThreshold, testPoolKey);

        mockPriceFeed.setLatestAnswer(finalPrice);
        uint256 resolutionAttemptTimestamp = marketExpirationTime + 1;
        mockPriceFeed.setUpdatedAt(resolutionAttemptTimestamp); // Fresh price at the time of resolution

        vm.warp(resolutionAttemptTimestamp); // Warp time to after expiration for both stages

        (bool upkeepNeededForEvent, bytes memory performDataForEmit) = pool.checkUpkeep("");
        assertTrue(upkeepNeededForEvent, "Upkeep for event emission should be needed (Stage 1)");

        vm.expectEmit(true, true, true, true, address(pool));
        emit MarketExpired(localMarketId, resolutionAttemptTimestamp);
        pool.performUpkeep(performDataForEmit);

        bytes memory performDataForResolve = abi.encode(PredictionManager.LogAction.ResolveMarket, localMarketId);

        vm.expectEmit(true, true, true, true, address(pool));
        emit MarketResolved(localMarketId, PredictionTypes.Outcome.Bullish, finalPrice, 0);
        pool.performUpkeep(performDataForResolve);

        (,,,, bool isResolved, PredictionTypes.Outcome finalOutcome,,,,,) = pool.getMarketDetails(localMarketId);
        assertTrue(isResolved, "Market should BE resolved");
        assertEq(uint8(finalOutcome), uint8(PredictionTypes.Outcome.Bullish), "Market outcome should be Bullish");
    }

    /// @notice Tests that performUpkeep reverts with PriceOracleStale if the oracle price is stale during resolution.
    function test_perform_upkeep_price_oracle_stale() public {
        // uint256 localMarketId = 1; // Old: localMarketId was an input parameter
        uint256 marketExpirationTime = block.timestamp + 1 days;
        vm.prank(address(this));
        uint256 localMarketId = pool.createMarket( // New: localMarketId is returned, PoolKey added
        "Test Market", "TEST", marketExpirationTime, address(mockPriceFeed), 500_000_000_000, testPoolKey);

        // Make oracle stale BEFORE market expires and resolution is attempted
        // The staleness check happens during _triggerMarketResolution, called by performUpkeep(ResolveMarket, ...)
        mockPriceFeed.setUpdatedAt(block.timestamp - pool.maxPriceStalenessSeconds() - 100); // Make it clearly stale, timestamp is current block
        mockPriceFeed.setLatestAnswer(500_000_000_100); // Set a price anyway, it's the timestamp that matters for staleness

        uint256 resolutionAttemptTimestamp = marketExpirationTime + 1;
        vm.warp(resolutionAttemptTimestamp); // Warp time to after expiration

        // STAGE 1: Trigger and perform upkeep to emit MarketExpired event (this part should succeed)
        // This simulates the first part of the automation: time-based checkUpkeep and performUpkeep
        (bool upkeepNeededForEvent, bytes memory performDataForEmit) = pool.checkUpkeep(bytes(""));
        assertTrue(upkeepNeededForEvent, "Upkeep for event emission should be needed (Stage 1)");

        // We expect MarketExpired to be emitted by this call. Let's be explicit.
        vm.expectEmit(true, true, true, true, address(pool));
        emit MarketExpired(localMarketId, resolutionAttemptTimestamp); // performUpkeep will use current block.timestamp
        pool.performUpkeep(performDataForEmit); // Emits MarketExpired

        // STAGE 2: Simulate the log-triggered upkeep for market resolution.
        // Construct performData as if checkLog returned it for the MarketExpired event of localMarketId.
        bytes memory performDataForResolve = abi.encode(PredictionManager.LogAction.ResolveMarket, localMarketId);

        // Now, with the oracle price being stale, performUpkeep with ResolveMarket action should revert.
        vm.expectRevert(MarketLogic.PriceOracleStale.selector); // Expect revert due to stale price data
        pool.performUpkeep(performDataForResolve); // This call should attempt resolution and revert due to stale price

        // Verify market is NOT resolved
        (,,,, bool isResolved,,,,,,) = pool.getMarketDetails(localMarketId);
        assertFalse(isResolved, "Market should NOT be resolved if price was stale");
    }
}

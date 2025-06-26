// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {PythOracleResolver} from "../src/PythOracleResolver.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {IPredictionManagerForResolver} from "src/interfaces/IPredictionManagerForResolver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockPredictionManager} from "./mocks/MockPredictionPool.sol";
import {MockPyth} from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";
import {PredictionTypes} from "../src/types/PredictionTypes.sol";

contract PythOracleResolverTest is Test {
    PythOracleResolver public pythOracleResolver;
    MockPredictionManager public mockPredictionManager;
    MockPyth public mockPyth;

    address public owner;
    address public user1;
    address payable public user2;

    // Test constants
    uint256 constant DEFAULT_MARKET_ID = 1;
    uint256 constant DEFAULT_PRICE_THRESHOLD = 2000; // $2000 in user-friendly format
    int32 constant DEFAULT_EXPECTED_EXPO = -8; // Standard USD pair exponent
    uint256 constant DEFAULT_MAX_STALENESS = 3600; // 1 hour
    bytes32 constant ETH_USD_PRICE_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    // Pyth price constants (raw format with exponent)
    int64 constant PYTH_PRICE_ABOVE_THRESHOLD = 200000000000; // $2000 with -8 exponent (2000 * 10^8)
    int64 constant PYTH_PRICE_BELOW_THRESHOLD = 199999999999; // $1999.99999999 with -8 exponent
    uint64 constant PYTH_CONF_LOW = 1000000; // 0.01 with -8 exponent (1% confidence)
    uint64 constant PYTH_CONF_HIGH = 10000000000; // 100 with -8 exponent (too high confidence)

    event OracleRegistered(uint256 indexed marketId, bytes32 priceId, uint256 priceThreshold);
    event MarketResolved(uint256 indexed marketId, int64 price, PredictionTypes.Outcome winningOutcome);
    event MaxPriceStalenessSet(uint256 oldStaleness, uint256 newStaleness);

    error OracleAlreadyRegistered(uint256 marketId);
    error OracleNotRegistered(uint256 marketId);
    error PredictionManagerZeroAddress();
    error PythContractZeroAddress();
    error ResolutionFailedInManager(uint256 marketId);
    error PriceIsStale(uint256 marketId, uint256 lastUpdatedAt, uint256 currentBlockTimestamp);
    error InvalidPriceThreshold();
    error InvalidPriceId();
    error InvalidPrice();
    error InsufficientUpdateFee(uint256 provided, uint256 required);
    error PriceConfidenceTooLow(uint256 confidence, uint256 price);
    error PriceTooOld(uint256 marketId, uint256 age, uint256 maxAge);
    error UnexpectedPriceExponent(int32 expected, int32 actual);

    modifier prankOwner() {
        vm.prank(owner);
        _;
    }

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = payable(makeAddr("user2"));

        mockPredictionManager = new MockPredictionManager();
        // Official MockPyth constructor: (validTimePeriod, singleUpdateFeeInWei)
        mockPyth = new MockPyth(60, 1 wei); // 60 second valid time period, 1 wei fee

        pythOracleResolver = new PythOracleResolver(address(mockPredictionManager), address(mockPyth), owner);

        // Set up default price in Pyth mock using createPriceFeedUpdateData
        _updateMockPythPrice(
            ETH_USD_PRICE_ID,
            PYTH_PRICE_ABOVE_THRESHOLD,
            PYTH_CONF_LOW,
            DEFAULT_EXPECTED_EXPO,
            1 // Use timestamp 1 for initial setup
        );
    }

    // ===== Constructor Tests =====

    /// @notice Tests that the constructor sets all addresses and values correctly.
    function test_constructor_successful_deployment() public {
        PythOracleResolver newResolver =
            new PythOracleResolver(address(mockPredictionManager), address(mockPyth), owner);

        assertEq(
            address(newResolver.predictionManager()),
            address(mockPredictionManager),
            "PredictionManager address mismatch"
        );
        assertEq(address(newResolver.pyth()), address(mockPyth), "Pyth contract address mismatch");
        assertEq(newResolver.owner(), owner, "Owner mismatch");
        assertEq(newResolver.maxPriceStalenessSeconds(), DEFAULT_MAX_STALENESS, "MaxPriceStalenessSeconds mismatch");
    }

    /// @notice Tests that the constructor reverts if the PredictionManager address is zero.
    function test_constructor_reverts_if_prediction_manager_is_zero_address() public {
        vm.expectRevert(PythOracleResolver.PredictionManagerZeroAddress.selector);
        new PythOracleResolver(address(0), address(mockPyth), owner);
    }

    /// @notice Tests that the constructor reverts if the Pyth contract address is zero.
    function test_constructor_reverts_if_pyth_contract_is_zero_address() public {
        vm.expectRevert(PythOracleResolver.PythContractZeroAddress.selector);
        new PythOracleResolver(address(mockPredictionManager), address(0), owner);
    }

    // ===== Oracle Registration Tests =====

    /// @notice Tests successful registration of an oracle and event emission.
    function test_register_oracle_success() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(pythOracleResolver));
        emit OracleRegistered(DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD);

        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        (bytes32 priceId, uint256 priceThreshold, int32 expectedExpo, bool isRegistered) =
            pythOracleResolver.marketOracles(DEFAULT_MARKET_ID);

        assertTrue(isRegistered, "Oracle should be registered");
        assertEq(priceId, ETH_USD_PRICE_ID, "Price ID mismatch");
        assertEq(priceThreshold, DEFAULT_PRICE_THRESHOLD, "Price threshold mismatch");
        assertEq(expectedExpo, DEFAULT_EXPECTED_EXPO, "Expected exponent mismatch");
    }

    /// @notice Tests that registering an oracle reverts if not called by owner.
    function test_register_oracle_reverts_if_not_owner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );
    }

    /// @notice Tests that registering an oracle twice for the same market reverts.
    function test_register_oracle_reverts_if_oracle_already_registered() public {
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PythOracleResolver.OracleAlreadyRegistered.selector, DEFAULT_MARKET_ID));
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD + 1, DEFAULT_EXPECTED_EXPO
        );
    }

    /// @notice Tests that registering an oracle with invalid parameters reverts.
    function test_register_oracle_reverts_on_invalid_parameters() public {
        // Test zero price ID
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PythOracleResolver.InvalidPriceId.selector));
        pythOracleResolver.registerOracle(DEFAULT_MARKET_ID, bytes32(0), DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO);

        // Test zero price threshold
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PythOracleResolver.InvalidPriceThreshold.selector));
        pythOracleResolver.registerOracle(DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, 0, DEFAULT_EXPECTED_EXPO);
    }

    // ===== Max Price Staleness Tests =====

    /// @notice Tests successful update of max price staleness and event emission.
    function test_set_max_price_staleness_success() public {
        uint256 newStaleness = 7200;
        uint256 oldStaleness = pythOracleResolver.maxPriceStalenessSeconds();

        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(pythOracleResolver));
        emit MaxPriceStalenessSet(oldStaleness, newStaleness);
        pythOracleResolver.setMaxPriceStaleness(newStaleness);

        assertEq(
            pythOracleResolver.maxPriceStalenessSeconds(), newStaleness, "MaxPriceStalenessSeconds should be updated"
        );
    }

    /// @notice Tests that only the owner can update max price staleness.
    function test_set_max_price_staleness_reverts_if_not_owner() public {
        uint256 newStaleness = 7200;

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        pythOracleResolver.setMaxPriceStaleness(newStaleness);
    }

    // ===== Market Resolution Tests =====

    /// @notice Tests resolving a market where outcome 0 (Bullish) wins.
    function test_resolve_market_successful_resolution_bullish_wins() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Create price update data using official MockPyth API
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, PYTH_PRICE_ABOVE_THRESHOLD, PYTH_CONF_LOW, DEFAULT_EXPECTED_EXPO, block.timestamp + 10
        );

        vm.deal(user1, 1 ether);

        // Expect the MarketResolved event
        vm.expectEmit(true, true, true, true);
        emit MarketResolved(DEFAULT_MARKET_ID, PYTH_PRICE_ABOVE_THRESHOLD, PredictionTypes.Outcome.Bullish);

        // Resolve the market
        vm.prank(user1);
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    /// @notice Tests resolving a market where outcome 1 (Bearish) wins.
    function test_resolve_market_successful_resolution_bearish_wins() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Create price update data using official MockPyth API
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, PYTH_PRICE_BELOW_THRESHOLD, PYTH_CONF_LOW, DEFAULT_EXPECTED_EXPO, block.timestamp + 10
        );

        vm.deal(user1, 1 ether);

        // Expect the MarketResolved event
        vm.expectEmit(true, true, true, true);
        emit MarketResolved(DEFAULT_MARKET_ID, PYTH_PRICE_BELOW_THRESHOLD, PredictionTypes.Outcome.Bearish);

        // Resolve the market
        vm.prank(user1);
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    /// @notice Tests that resolving a market with no registered oracle reverts.
    function test_resolve_market_reverts_if_oracle_not_registered() public {
        uint256 unregisteredMarketId = 99;
        bytes[] memory priceUpdateData = new bytes[](1);
        priceUpdateData[0] = "";

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(PythOracleResolver.OracleNotRegistered.selector, unregisteredMarketId));
        pythOracleResolver.resolveMarket(unregisteredMarketId, priceUpdateData);
    }

    /// @notice Tests that resolving a market with insufficient fee reverts.
    function test_resolve_market_reverts_if_insufficient_fee() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        bytes[] memory priceUpdateData = new bytes[](1);
        priceUpdateData[0] = "";

        bytes[] memory validUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, PYTH_PRICE_ABOVE_THRESHOLD, PYTH_CONF_LOW, DEFAULT_EXPECTED_EXPO, block.timestamp
        );

        uint256 requiredFee = pythOracleResolver.getUpdateFee(validUpdateData);
        uint256 insufficientFee = requiredFee - 1;

        vm.deal(user1, insufficientFee);
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(PythOracleResolver.InsufficientUpdateFee.selector, insufficientFee, requiredFee)
        );
        pythOracleResolver.resolveMarket{value: insufficientFee}(DEFAULT_MARKET_ID, validUpdateData);
    }

    /// @notice Tests that excess fee is refunded to the caller.
    function test_resolve_market_refunds_excess_fee() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Create valid price update data
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, PYTH_PRICE_ABOVE_THRESHOLD, PYTH_CONF_LOW, DEFAULT_EXPECTED_EXPO, block.timestamp
        );

        uint256 requiredFee = pythOracleResolver.getUpdateFee(priceUpdateData);
        uint256 excessFee = 1 ether;
        uint256 totalSent = requiredFee + excessFee;

        vm.deal(user1, totalSent);
        uint256 balanceBefore = user1.balance;

        vm.prank(user1);
        pythOracleResolver.resolveMarket{value: totalSent}(DEFAULT_MARKET_ID, priceUpdateData);

        uint256 balanceAfter = user1.balance;
        assertEq(balanceAfter, balanceBefore - requiredFee, "Should refund excess fee");
    }

    /// @notice Tests that resolving a market with invalid price reverts.
    function test_resolve_market_reverts_on_invalid_price() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Create price update data with invalid price (0) and newer timestamp
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID,
            0, // Invalid price
            PYTH_CONF_LOW,
            DEFAULT_EXPECTED_EXPO,
            block.timestamp + 10 // Use newer timestamp to ensure update
        );

        vm.deal(user1, 1 ether);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(PythOracleResolver.InvalidPrice.selector));
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    /// @notice Tests that resolving a market with unexpected exponent reverts.
    function test_resolve_market_reverts_on_unexpected_exponent() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Create price update data with wrong exponent
        int32 wrongExponent = -6; // Different from expected -8
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, PYTH_PRICE_ABOVE_THRESHOLD, PYTH_CONF_LOW, wrongExponent, block.timestamp + 10
        );

        vm.deal(user1, 1 ether);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                PythOracleResolver.UnexpectedPriceExponent.selector, DEFAULT_EXPECTED_EXPO, wrongExponent
            )
        );
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    /// @notice Tests that resolving a market with low confidence reverts.
    function test_resolve_market_reverts_on_low_confidence() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Create price update data with high confidence interval (low confidence)
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID,
            PYTH_PRICE_ABOVE_THRESHOLD,
            PYTH_CONF_HIGH, // High confidence interval (bad)
            DEFAULT_EXPECTED_EXPO,
            block.timestamp + 10
        );

        vm.deal(user1, 1 ether);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                PythOracleResolver.PriceConfidenceTooLow.selector,
                PYTH_CONF_HIGH,
                uint256(uint64(PYTH_PRICE_ABOVE_THRESHOLD))
            )
        );
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    /// @notice Tests that resolving a market with stale price reverts (handled by getPriceNoOlderThan).
    function test_resolve_market_reverts_if_price_is_stale() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Warp time forward to make any update data we create stale
        vm.warp(block.timestamp + 65); // Move past 60 second threshold

        // Create price update data with old timestamp (will be rejected by getPriceNoOlderThan)
        uint256 staleTimestamp = block.timestamp - 65;
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, PYTH_PRICE_ABOVE_THRESHOLD, PYTH_CONF_LOW, DEFAULT_EXPECTED_EXPO, staleTimestamp
        );

        vm.deal(user1, 1 ether);

        vm.prank(user1);
        // This should revert with Pyth's internal staleness check from getPriceNoOlderThan()
        vm.expectRevert(); // Generic revert since Pyth handles the specific error
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    /// @notice Tests that a failed call to PredictionManager during resolution reverts.
    function test_resolve_market_reverts_if_prediction_manager_call_fails() public {
        // Register oracle for the market
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Make the mock prediction manager revert
        mockPredictionManager.setShouldRevertResolveMarket(true);

        // Create valid price update data so we reach the prediction manager call
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID,
            PYTH_PRICE_ABOVE_THRESHOLD,
            PYTH_CONF_LOW,
            DEFAULT_EXPECTED_EXPO,
            block.timestamp + 20 // Use newer timestamp
        );

        vm.deal(user1, 1 ether);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(PythOracleResolver.ResolutionFailedInManager.selector, DEFAULT_MARKET_ID)
        );
        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    // ===== Utility Function Tests =====

    /// @notice Tests getUpdateFee function.
    function test_get_update_fee() public view {
        bytes[] memory priceUpdateData = new bytes[](1);
        priceUpdateData[0] = "";

        uint256 fee = pythOracleResolver.getUpdateFee(priceUpdateData);
        assertEq(fee, 1 wei, "Update fee should be 1 wei as configured in MockPyth");
    }

    /// @notice Tests getCurrentPrice function.
    function test_get_current_price() public view {
        PythStructs.Price memory price = pythOracleResolver.getCurrentPrice(ETH_USD_PRICE_ID);

        assertEq(price.price, PYTH_PRICE_ABOVE_THRESHOLD, "Price should match mock");
        assertEq(price.conf, PYTH_CONF_LOW, "Confidence should match mock");
        assertEq(price.expo, DEFAULT_EXPECTED_EXPO, "Exponent should match mock");
    }

    // ===== Fuzz Tests =====

    /// @notice Fuzz test for registerOracle with various valid parameters.
    function testFuzz_register_oracle_valid_parameters(
        uint256 marketId,
        bytes32 priceId,
        uint256 priceThreshold,
        int32 expectedExpo
    ) public {
        // Bound inputs to valid ranges
        vm.assume(priceId != bytes32(0));
        vm.assume(priceThreshold > 0);
        vm.assume(marketId > 0);

        vm.prank(owner);
        pythOracleResolver.registerOracle(marketId, priceId, priceThreshold, expectedExpo);

        (bytes32 storedPriceId, uint256 storedThreshold, int32 storedExpo, bool isRegistered) =
            pythOracleResolver.marketOracles(marketId);

        assertTrue(isRegistered, "Oracle should be registered");
        assertEq(storedPriceId, priceId, "Price ID should match");
        assertEq(storedThreshold, priceThreshold, "Threshold should match");
        assertEq(storedExpo, expectedExpo, "Exponent should match");
    }

    /// @notice Fuzz test for price threshold edge cases.
    function testFuzz_resolve_market_price_threshold_edge_cases(uint256 priceOffset) public {
        // Bound the offset to reasonable values
        priceOffset = bound(priceOffset, 0, 1000000000); // 0 to 10 USD with 8 decimals

        // Register oracle
        vm.prank(owner);
        pythOracleResolver.registerOracle(
            DEFAULT_MARKET_ID, ETH_USD_PRICE_ID, DEFAULT_PRICE_THRESHOLD, DEFAULT_EXPECTED_EXPO
        );

        // Set price exactly at threshold + offset
        int64 testPrice = PYTH_PRICE_ABOVE_THRESHOLD + int64(int256(priceOffset));

        // Create price update data using official MockPyth API
        bytes[] memory priceUpdateData = _createPriceUpdateData(
            ETH_USD_PRICE_ID, testPrice, PYTH_CONF_LOW, DEFAULT_EXPECTED_EXPO, block.timestamp + 10
        );

        vm.deal(user1, 1 ether);
        vm.prank(user1);

        // Should always resolve to Bullish since we're above threshold
        vm.expectEmit(true, true, true, true);
        emit MarketResolved(DEFAULT_MARKET_ID, testPrice, PredictionTypes.Outcome.Bullish);

        pythOracleResolver.resolveMarket{value: 1 wei}(DEFAULT_MARKET_ID, priceUpdateData);
    }

    // ===== Helper Functions =====

    /// @notice Helper function to update MockPyth price using the official API
    function _updateMockPythPrice(bytes32 priceId, int64 price, uint64 conf, int32 expo, uint256 publishTime)
        internal
    {
        bytes memory updateData = mockPyth.createPriceFeedUpdateData(
            priceId,
            price,
            conf,
            expo,
            price, // emaPrice (same as price for simplicity)
            conf, // emaConf (same as conf for simplicity)
            uint64(publishTime),
            uint64(publishTime - 1)
        );

        bytes[] memory updateDataArray = new bytes[](1);
        updateDataArray[0] = updateData;

        mockPyth.updatePriceFeeds{value: 1 wei}(updateDataArray);
    }

    /// @notice Helper function to create price update data for resolution tests
    function _createPriceUpdateData(bytes32 priceId, int64 price, uint64 conf, int32 expo, uint256 publishTime)
        internal
        view
        returns (bytes[] memory)
    {
        bytes memory updateData = mockPyth.createPriceFeedUpdateData(
            priceId,
            price,
            conf,
            expo,
            price, // emaPrice
            conf, // emaConf
            uint64(publishTime),
            uint64(publishTime - 1) // prevPublishTime (one second earlier)
        );

        bytes[] memory updateDataArray = new bytes[](1);
        updateDataArray[0] = updateData;
        return updateDataArray;
    }
}

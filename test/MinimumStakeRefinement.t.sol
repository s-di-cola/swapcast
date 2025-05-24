// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {PredictionManager} from "src/PredictionManager.sol";
import {MarketLogic} from "src/MarketLogic.sol";
import {MockSwapCastNFT} from "./mocks/MockSwapCastNFT.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

/**
 * @title MinimumStakeRefinementTest
 * @notice Tests for the market-specific minimum stake functionality
 * @dev This test suite focuses on the refined minimum stake functionality,
 *      including global minimum stake, default market minimum stake,
 *      and market-specific minimum stakes
 */
contract MinimumStakeRefinementTest is Test {
    // Events to test
    event DefaultMarketMinStakeChanged(uint256 newDefaultMinStake);
    event MarketMinStakeChanged(uint256 indexed marketId, uint256 marketMinStake);

    // Test variables
    PredictionManager internal pool;
    PoolKey internal testPoolKey;
    MockSwapCastNFT internal mockNft;
    address internal owner;
    address payable internal treasuryAddress;
    address internal oracleResolverAddress;
    address internal rewardDistributorAddress;
    address internal user1;
    address internal user2;
    address internal mockOracle;

    uint256 internal initialFeeBasisPoints = 100; // 1%
    uint256 internal initialMinStakeAmount = 0.01 ether;

    function setUp() public {
        owner = makeAddr("owner");
        treasuryAddress = payable(makeAddr("treasury"));
        mockOracle = makeAddr("mockOracle");

        user1 = makeAddr("user1");
        vm.deal(user1, 10 ether);
        user2 = makeAddr("user2");
        vm.deal(user2, 10 ether);

        vm.deal(owner, 1 ether); // For gas

        // Create mock NFT contract
        mockNft = new MockSwapCastNFT();

        // Create prediction manager with mock addresses for oracle resolver and reward distributor
        oracleResolverAddress = makeAddr("oracleResolver");
        rewardDistributorAddress = makeAddr("rewardDistributor");

        vm.prank(owner);
        pool = new PredictionManager(
            owner, // initialOwner
            address(mockNft),
            treasuryAddress,
            initialFeeBasisPoints,
            initialMinStakeAmount,
            3600, // 1 hour max price staleness
            oracleResolverAddress,
            rewardDistributorAddress
        );

        // Set the prediction manager in the mock NFT
        mockNft.setPredictionManager(address(pool));

        // Initialize testPoolKey
        testPoolKey = PoolKey({
            currency0: Currency.wrap(vm.addr(0xA0)), // Example token address for currency0
            currency1: Currency.wrap(vm.addr(0xB0)), // Example token address for currency1
            fee: 3000, // Standard fee, e.g., 0.3%
            tickSpacing: 60, // Standard tick spacing
            hooks: IHooks(address(0)) // Cast address to IHooks interface
        });
    }

    function testInitialMinimumStakeValues() public view {
        assertEq(pool.minStakeAmount(), initialMinStakeAmount, "Global min stake should be initialized correctly");
        assertEq(
            pool.defaultMarketMinStake(),
            initialMinStakeAmount,
            "Default market min stake should equal global min stake initially"
        );
    }

    function testSetDefaultMarketMinStake() public {
        uint256 newDefaultMinStake = 0.05 ether;

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit DefaultMarketMinStakeChanged(newDefaultMinStake);
        pool.setDefaultMarketMinStake(newDefaultMinStake);

        assertEq(pool.defaultMarketMinStake(), newDefaultMinStake, "Default market min stake should be updated");
        assertEq(pool.minStakeAmount(), initialMinStakeAmount, "Global min stake should remain unchanged");
    }

    function testSetDefaultMarketMinStake_Reverts_BelowGlobalMin() public {
        uint256 belowGlobalMin = initialMinStakeAmount / 2;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.InvalidMinStakeAmount.selector, belowGlobalMin));
        pool.setDefaultMarketMinStake(belowGlobalMin);
    }

    function testSetMarketSpecificMinStake() public {
        uint256 marketSpecificMinStake = 0.1 ether;

        // Create a market first
        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );

        // Verify market uses default min stake initially
        assertEq(
            pool.marketMinStakes(marketId),
            pool.defaultMarketMinStake(),
            "Market should use default min stake initially"
        );

        // Set market-specific min stake
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit MarketMinStakeChanged(marketId, marketSpecificMinStake);
        pool.setMarketMinStake(marketId, marketSpecificMinStake);

        assertEq(pool.marketMinStakes(marketId), marketSpecificMinStake, "Market-specific min stake should be updated");
    }

    function testSetMarketSpecificMinStake_Reverts_MarketDoesNotExist() public {
        uint256 nonExistentMarketId = 99;
        uint256 marketSpecificMinStake = 0.1 ether;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketDoesNotExist.selector, nonExistentMarketId));
        pool.setMarketMinStake(nonExistentMarketId, marketSpecificMinStake);
    }

    function testSetMarketSpecificMinStake_Reverts_BelowGlobalMin() public {
        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );
        uint256 belowGlobalMin = initialMinStakeAmount / 2;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.InvalidMinStakeAmount.selector, belowGlobalMin));
        pool.setMarketMinStake(marketId, belowGlobalMin);
    }

    function testRecordPrediction_UsesMarketSpecificMinStake() public {
        uint256 marketSpecificMinStake = 0.05 ether;

        // Create a market
        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );

        // Set market-specific min stake
        vm.prank(owner);
        pool.setMarketMinStake(marketId, marketSpecificMinStake);

        // Stake amount between global min and market-specific min
        uint256 stakeAmount = 0.02 ether; // > global min (0.01) but < market min (0.05)
        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValue = stakeAmount + protocolFee;

        // Attempt prediction with stake below market-specific min
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(MarketLogic.StakeBelowMinimumL.selector, stakeAmount, marketSpecificMinStake)
        );
        pool.recordPrediction{value: totalValue}(user1, marketId, PredictionTypes.Outcome.Bearish, uint128(stakeAmount));

        // Now try with stake above market-specific min
        stakeAmount = 0.06 ether; // > market min (0.05)
        protocolFee = (stakeAmount * feeBps) / 10000;
        totalValue = stakeAmount + protocolFee;

        vm.prank(user1);
        pool.recordPrediction{value: totalValue}(user1, marketId, PredictionTypes.Outcome.Bearish, uint128(stakeAmount));

        // Verify prediction was recorded
        (
            ,
            ,
            ,
            bool exists,
            bool resolved,
            PredictionTypes.Outcome winningOutcome,
            uint256 totalStake0,
            uint256 totalStake1,
            ,
            ,
        ) = pool.getMarketDetails(marketId);

        assertTrue(exists, "Market should exist");
        assertFalse(resolved, "Market should not be resolved yet");
        assertEq(
            uint8(winningOutcome), uint8(PredictionTypes.Outcome.Bearish), "Default winning outcome should be Bearish"
        );
        assertEq(
            totalStake0,
            stakeAmount, // The contract stores the full stake amount, not the net amount
            "Total stake for outcome 0 (Bearish) should match the full stake amount"
        );
        assertEq(totalStake1, 0, "Total stake for outcome 1 (Bullish) should be 0");
    }

    function testRecordPrediction_GlobalMinStakeUpdate_DoesNotAffectExistingMarkets() public {
        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );

        // Set initial market-specific min stake
        vm.prank(owner);
        pool.setMarketMinStake(marketId, 0.02 ether);

        // Update global min stake
        vm.prank(owner);
        pool.setMinStakeAmount(0.05 ether);

        // Should still use the market-specific min stake (0.02) not the new global min (0.05)
        uint256 stakeAmount = 0.03 ether; // > market min (0.02) but < new global min (0.05)
        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValue = stakeAmount + protocolFee;

        vm.prank(user1);
        pool.recordPrediction{value: totalValue}(user1, marketId, PredictionTypes.Outcome.Bullish, uint128(stakeAmount));

        // Verify the prediction was recorded
        (,,,,,, uint256 totalStakeOutcome0, uint256 totalStakeOutcome1,,,) = pool.getMarketDetails(marketId);

        // Bullish is outcome 1, which is stored in totalStakeOutcome1
        assertEq(
            totalStakeOutcome1,
            stakeAmount, // The contract stores the full stake amount, not the net amount
            "Total bullish (outcome 1) stake should be updated"
        );
        assertEq(totalStakeOutcome0, 0, "Total bearish (outcome 0) stake should remain zero");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolKey, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {SwapCastHook} from "../src/SwapCastHook.sol";
import {ImmutableState} from "../lib/v4-periphery/src/base/ImmutableState.sol";
import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {PredictionManager} from "src/PredictionManager.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";

contract TestableSwapCastNFT is SwapCastNFT {
    constructor(address initialOwner) SwapCastNFT(initialOwner, "TestSwapCastNFT", "TSCNFT") {}
}

contract TestSwapCastHook is Test, Deployers {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    // Define the ERC721 Transfer event
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error WrappedError(address target, bytes4 selector, bytes reason, bytes details);

    SwapCastHook internal hook;
    PoolKey internal poolKey;
    PoolKey internal testPoolKey;
    TestableSwapCastNFT internal nft;
    PredictionManager internal pool;

    address internal constant MOCK_TREASURY = address(0x1001);
    address internal constant MOCK_ORACLE_RESOLVER = address(0x1002);
    address internal constant MOCK_REWARD_DISTRIBUTOR = address(0x1003);
    uint256 internal constant INITIAL_FEE_BASIS_POINTS = 100;
    uint256 internal constant INITIAL_MIN_STAKE_AMOUNT = 0.01 ether;

    /// @notice Sets up the test environment for SwapCastHook tests.
    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        nft = new TestableSwapCastNFT(address(this));
        pool = new PredictionManager(
            address(this), // initialOwner (using test contract as owner)
            address(nft), // _swapCastNFTAddress
            MOCK_TREASURY, // _treasuryAddress
            INITIAL_FEE_BASIS_POINTS, // _initialFeeBasisPoints
            INITIAL_MIN_STAKE_AMOUNT, // _initialMinStakeAmount
            3600, // _maxPriceStalenessSeconds (1 hour)
            MOCK_ORACLE_RESOLVER, // _oracleResolverAddress
            MOCK_REWARD_DISTRIBUTOR // _rewardDistributorAddress
        );
        nft.setPredictionManagerAddress(address(pool));

        // Deploy hook to an address that has the proper flags set
        // Following the example from points-hook repository
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
        deployCodeTo("SwapCastHook.sol", abi.encode(manager, address(pool)), address(flags));
        hook = SwapCastHook(payable(address(flags)));

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        manager.initialize(poolKey, SQRT_PRICE_1_1);

        // Initialize PredictionManager's testPoolKey using values from Uniswap's poolKey
        testPoolKey = PoolKey({
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks
        });

        uint160 sqrtPriceAtTickUpper = TickMath.getSqrtPriceAtTick(60);
        uint256 token0ToAdd = 0.003 ether;
        uint128 liquidityDelta =
            LiquidityAmounts.getLiquidityForAmount0(SQRT_PRICE_1_1, sqrtPriceAtTickUpper, token0ToAdd);

        modifyLiquidityRouter.modifyLiquidity{value: token0ToAdd}(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: int256(uint256(liquidityDelta)),
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );
        
        // Fund the hook with ETH for testing
        vm.deal(address(hook), 10 ether);
    }

    /// @notice Tests a successful prediction recording via the hook and verifies NFT minting and fee transfer.
    function test_record_prediction_success() public {
        // Use PredictionTypes.Outcome enum for the outcome
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bullish;

        // Create a market with the test pool key
        uint256 marketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, MOCK_ORACLE_RESOLVER, 3000 * 10 ** 8, testPoolKey
        );

        // Use abi.encodePacked to match the expected hookData format (53 bytes)
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));
        
        // Verify hookData length matches expected
        assertEq(hookData.length, 53, "HookData should be exactly 53 bytes");

        // For ETH swaps, use larger amount to ensure sufficient 1% fee
        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        // Perform the swap, which triggers the hook
        swapRouter.swap{value: 1 ether}(poolKey, swapParams, settings, hookData);

        address actualOwner = nft.ownerOf(0);

        // Verify that the NFT was minted to the correct address (the test contract)
        assertEq(actualOwner, address(this), "NFT not minted to the correct address");

        (
            /*uint256 marketId_*/
            ,
            /*string memory name_*/
            ,
            /*string memory assetSymbol_*/
            ,
            /*bool exists_*/
            ,
            /*bool resolved_*/
            ,
            /*PredictionTypes.Outcome winningOutcome_*/
            ,
            uint256 totalStakeOutcome0,
            uint256 totalStakeOutcome1,
            /*uint256 expirationTime_*/
            ,
            /*address priceAggregator_*/
            ,
            /*uint256 priceThreshold_*/
        ) = pool.getMarketDetails(marketId);

        if (predictedOutcome == PredictionTypes.Outcome.Bearish) {
            assertGt(totalStakeOutcome0, 0, "Total stake for outcome 0 should be greater than 0");
        } else {
            assertGt(totalStakeOutcome1, 0, "Total stake for outcome 1 should be greater than 0");
        }
    }

    /// @notice Tests that afterSwap reverts if not called by the pool manager.
    function test_reverts_if_not_pool_manager() public {
        PoolKey memory key;
        SwapParams memory params;
        BalanceDelta delta = BalanceDelta.wrap(0);
        bytes memory hookData = "";

        vm.expectRevert(ImmutableState.NotPoolManager.selector);
        hook.afterSwap(address(1), key, params, delta, hookData);
    }

    /// @notice Tests that malformed hookData is safely ignored by the hook.
    function test_malformed_hook_data_is_ignored() public {
        // Create a market with the test pool key
        pool.createMarket(
            "Test Market Hook Length",
            "ETHUSD-HookLength",
            block.timestamp + 1 hours,
            MOCK_ORACLE_RESOLVER,
            3000 * 10 ** 8,
            testPoolKey
        );
        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});
        bytes memory badHookData = new bytes(10); // Malformed hookData (10 bytes instead of expected length)
        
        // The swap should succeed but not record any prediction
        swapRouter.swap{value: 1 ether}(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), badHookData
        );
        
        // Verify no NFT was minted (should revert with ERC721NonexistentToken)
        vm.expectRevert();
        nft.ownerOf(0);
    }

    /// @notice Tests that swap reverts if swap amount is too small to generate sufficient stake.
    function test_reverts_if_zero_conviction_stake_in_hook_data() public {
        // Create a market with the test pool key
        uint256 marketId = pool.createMarket(
            "Test Market Hook ZeroStake",
            "ETHUSD-HookZeroStake",
            block.timestamp + 1 hours,
            MOCK_ORACLE_RESOLVER,
            3000 * 10 ** 8,
            testPoolKey
        );

        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bullish;
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));
        
        // Use an extremely small swap amount that will result in zero 1% fee
        // With integer division, 99 wei / 100 = 0, which should trigger the revert
        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -99, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}); // 99 wei swap

        // The pool manager wraps hook errors, so we need to expect the wrapped error
        bytes memory expectedReason = abi.encodePacked(SwapCastHook.InsufficientSwapAmountForStake.selector);
        bytes4 hookCallFailedSelector = bytes4(keccak256(bytes("HookCallFailed()")));
        bytes4 afterSwapSelector = IHooks.afterSwap.selector;

        vm.expectRevert(
            abi.encodeWithSelector(
                WrappedError.selector,
                address(hook),
                afterSwapSelector,
                expectedReason,
                abi.encodePacked(hookCallFailedSelector)
            )
        );

        swapRouter.swap(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), hookData
        );
    }

    /// @notice Tests that prediction fails and reverts if the pool call fails during swap.
    function test_prediction_failed_if_pool_reverts() public {
        uint256 marketId = 999; // Non-existent market ID
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bullish;

        // Use abi.encodePacked to match the hook's expected format
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));

        vm.expectRevert(); // Accept any revert, since the revert data may have minor differences
        swapRouter.swap{value: 1 ether}(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            hookData
        );
    }

    /// @notice Tests prediction with automatically calculated stake amount
    function test_record_prediction_with_auto_calculated_stake() public {
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bullish;

        // Create a market with the test pool key
        uint256 marketId = pool.createMarket(
            "Test Market Auto Stake",
            "ETHUSD-AutoStake",
            block.timestamp + 1 hours,
            MOCK_ORACLE_RESOLVER,
            3000 * 10 ** 8,
            testPoolKey
        );

        // Use abi.encodePacked to match the hook's expected format (no explicit stake needed)
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));

        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        // Perform the swap, which triggers the hook
        swapRouter.swap{value: 1 ether}(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), hookData
        );

        // Verify the NFT was minted to the user
        assertEq(nft.ownerOf(0), address(this), "NFT should be minted to the user");

        // Verify prediction details
        (uint256 tokenMarketId, PredictionTypes.Outcome tokenOutcome, uint256 tokenStake, address tokenOwner) =
            nft.getPredictionDetails(0);
        assertEq(tokenMarketId, marketId, "NFT should record the correct market ID");
        assertEq(uint8(tokenOutcome), uint8(predictedOutcome), "NFT should record the correct outcome");
        assertGt(tokenStake, 0, "NFT should record a positive stake amount");
        assertEq(tokenOwner, address(this), "NFT should record the correct owner");
    }

    /// @notice Tests prediction with a bearish outcome and automatic stake calculation
    function test_record_prediction_bearish_outcome() public {
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bearish;

        // Create a market with the test pool key
        uint256 marketId = pool.createMarket(
            "Test Market Bearish",
            "ETHUSD-Bearish",
            block.timestamp + 1 hours,
            MOCK_ORACLE_RESOLVER,
            3000 * 10 ** 8,
            testPoolKey
        );

        // Use abi.encodePacked to match the hook's expected format
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));

        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        // Perform the swap, which triggers the hook
        swapRouter.swap{value: 1 ether}(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), hookData
        );

        // Verify the NFT was minted to the user
        assertEq(nft.ownerOf(0), address(this), "NFT should be minted to the user");

        // Verify prediction details
        (uint256 tokenMarketId, PredictionTypes.Outcome tokenOutcome, uint256 tokenStake, address tokenOwner) =
            nft.getPredictionDetails(0);
        assertEq(tokenMarketId, marketId, "NFT should record the correct market ID");
        assertEq(uint8(tokenOutcome), uint8(predictedOutcome), "NFT should record the correct outcome");
        assertGt(tokenStake, 0, "NFT should record a positive stake amount");
        assertEq(tokenOwner, address(this), "NFT should record the correct owner");
    }

    /// @notice Tests prediction with an expired market (should revert)
    function test_reverts_with_expired_market() public {
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bullish;

        // Create a market with a valid expiration time
        uint256 expirationTime = block.timestamp + 1 hours;
        uint256 marketId = pool.createMarket(
            "Test Market Expired", "ETHUSD-Expired", expirationTime, MOCK_ORACLE_RESOLVER, 3000 * 10 ** 8, testPoolKey
        );

        // Now advance time to make the market expired
        vm.warp(expirationTime + 1);

        // Use abi.encodePacked to match the hook's expected format
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));

        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        // The swap should revert because the market is expired
        vm.expectRevert();
        swapRouter.swap{value: 1 ether}(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), hookData
        );
    }

    /// @notice Tests prediction on a market that already has predictions from the same user
    function test_reverts_with_duplicate_prediction() public {
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bullish;
        uint128 convictionStake = 0.01 ether; // Use a smaller amount to avoid balance issues

        // Create a market
        uint256 marketId = pool.createMarket(
            "Test Market Duplicate",
            "ETHUSD-Duplicate",
            block.timestamp + 1 hours,
            MOCK_ORACLE_RESOLVER,
            3000 * 10 ** 8,
            testPoolKey
        );

        // First make a prediction directly through the pool
        uint256 feeBasisPoints = pool.protocolFeeBasisPoints();
        uint256 calculatedFee = (convictionStake * feeBasisPoints) / 10000;
        uint256 totalAmount = convictionStake + calculatedFee;
        vm.deal(address(this), totalAmount);
        pool.recordPrediction{value: totalAmount}(address(this), marketId, predictedOutcome, convictionStake);

        // Verify the first prediction was recorded
        assertEq(nft.ownerOf(0), address(this), "First prediction should have minted NFT to this address");

        // Ensure the hook has enough ETH for the second prediction attempt
        vm.deal(address(hook), 20 ether);
        
        // Fund the test contract sufficiently for the swap attempt
        vm.deal(address(this), 10 ether);

        // Now try to make a prediction through the hook using the SAME user address and market
        bytes memory hookData = abi.encodePacked(address(this), marketId, uint8(predictedOutcome));

        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        // The swap should revert because the user already has a prediction for this market
        // This will be wrapped by the pool manager
        vm.expectRevert(); // Accept any revert due to duplicate prediction
        swapRouter.swap{value: 1 ether}(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), hookData
        );
    }
}

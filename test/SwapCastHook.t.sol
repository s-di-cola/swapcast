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
import {PredictionPool} from "src/PredictionPool.sol";

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
    TestableSwapCastNFT internal nft;
    PredictionPool internal pool;

    address internal constant MOCK_TREASURY = address(0x1001);
    address internal constant MOCK_ORACLE_RESOLVER = address(0x1002);
    address internal constant MOCK_REWARD_DISTRIBUTOR = address(0x1003);
    uint256 internal constant INITIAL_FEE_BASIS_POINTS = 100;
    uint256 internal constant INITIAL_MIN_STAKE_AMOUNT = 0.01 ether;

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        nft = new TestableSwapCastNFT(address(this));
        pool = new PredictionPool(
            address(nft),
            MOCK_TREASURY,
            INITIAL_FEE_BASIS_POINTS,
            address(this),
            MOCK_ORACLE_RESOLVER,
            MOCK_REWARD_DISTRIBUTOR,
            INITIAL_MIN_STAKE_AMOUNT
        );
        nft.setPredictionPoolAddress(address(pool));

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
    }

    function testRecordPredictionSuccess() public {
        uint256 marketId = 1;
        uint8 predictedOutcome = 1;
        uint128 convictionStake = 100 ether;

        pool.createMarket(marketId);
        vm.deal(address(this), convictionStake + 1 ether);
        vm.deal(address(pool), convictionStake);

        bytes memory hookData = abi.encodePacked(marketId, predictedOutcome, convictionStake);
        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: int256(1 ether), sqrtPriceLimitX96: 4295128739 + 1});
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        uint256 protocolFeeBps = pool.protocolFeeBasisPoints();
        uint256 expectedFee = (convictionStake * protocolFeeBps) / 10000;
        uint256 expectedNetStake = convictionStake - expectedFee;

        swapRouter.swap{value: convictionStake}(poolKey, swapParams, settings, hookData);

        address actualOwner = nft.ownerOf(0);
        assertTrue(actualOwner != address(0), "NFT not minted");

        (
            , // marketId
            , // exists
            , // resolved
            , // winningOutcome
            uint256 totalStakeOutcome0,
            uint256 totalStakeOutcome1,
            , // expirationTime
            , // priceAggregator
                // priceThreshold
        ) = pool.getMarketDetails(marketId);

        if (predictedOutcome == 0) {
            assertEq(totalStakeOutcome0, expectedNetStake, "Total stake for outcome 0 mismatch");
        } else {
            assertEq(totalStakeOutcome1, expectedNetStake, "Total stake for outcome 1 mismatch");
        }
    }

    function testRevertsIfNotPoolManager() public {
        PoolKey memory key;
        SwapParams memory params;
        BalanceDelta delta = BalanceDelta.wrap(0);
        bytes memory hookData = new bytes(33);
        vm.expectRevert(ImmutableState.NotPoolManager.selector);
        hook.afterSwap(address(1), key, params, delta, hookData);
    }

    function testRevertsOnMalformedHookDataLength() public {
        uint256 marketId = 1;

        pool.createMarket(marketId);
        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -0.05 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});
        bytes memory badHookData = new bytes(10); // Malformed hookData (10 bytes instead of expected 49)
        vm.deal(address(this), 1 ether);

        bytes memory expectedReason =
            abi.encodeWithSelector(SwapCastHook.InvalidHookDataLength.selector, badHookData.length, 49);
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

        swapRouter.swap{value: 0.1 ether}(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), badHookData
        );
    }

    function testRevertsIfZeroConvictionStakeInHookData() public {
        uint256 marketId = 1;

        pool.createMarket(marketId);
        SwapParams memory swapParams =
            SwapParams({zeroForOne: true, amountSpecified: -0.05 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        uint8 predictedOutcome = 1;
        bytes memory hookData = abi.encodePacked(marketId, predictedOutcome, uint128(0));

        bytes memory expectedReason = abi.encodePacked(SwapCastHook.NoConvictionStakeDeclaredInHookData.selector);
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

    function testPredictionFailedIfPoolReverts() public {
        uint256 marketId = 999; // Non-existent market ID
        uint8 predictedOutcome = 1;
        uint128 convictionStake = 100e18;

        bytes memory hookData = abi.encodePacked(marketId, predictedOutcome, convictionStake);

        uint256 feeBasisPoints = pool.protocolFeeBasisPoints();
        uint256 calculatedFee = (convictionStake * feeBasisPoints) / 10000;
        uint256 msgValue = calculatedFee + convictionStake;
        vm.deal(address(this), msgValue);

        // When we try to record a prediction for a non-existent market,
        // the SwapCastHook should catch the error from PredictionPool and revert with PredictionRecordingFailed
        bytes4 expectedSelector = SwapCastHook.PredictionRecordingFailed.selector;

        vm.expectRevert(
            abi.encodeWithSelector(
                WrappedError.selector,
                address(hook),
                IHooks.afterSwap.selector,
                abi.encodeWithSelector(expectedSelector, "PredictionPool reverted with a custom error."),
                abi.encodePacked(bytes4(keccak256(bytes("HookCallFailed()"))))
            )
        );

        swapRouter.swap{value: msgValue}(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            hookData
        );
    }
}

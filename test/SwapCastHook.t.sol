// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {PoolKey} from "v4-core/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {SqrtPriceMath} from "v4-core/libraries/SqrtPriceMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import "forge-std/console.sol";
import {SwapCastHook} from "../src/SwapCastHook.sol";
import {ImmutableState} from "../lib/v4-periphery/src/base/ImmutableState.sol";
import {SwapCastNFT} from "../src/SwapCastNFT.sol";
import {PredictionPool} from "../src/PredictionPool.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";

contract MockNFT is SwapCastNFT {
    constructor() SwapCastNFT(address(0)) {}
    function setPredictionPool(address pool) external {
        predictionPool = pool;
    }
}

contract TestSwapCastHook is Test, Deployers {
    MockERC20 token;
    Currency ethCurrency = Currency.wrap(address(0));
    Currency tokenCurrency;
    SwapCastHook hook;

    function setUp() public {
        // Deploy PoolManager and routers
        deployFreshManagerAndRouters();

        // Deploy test token
        token = new MockERC20("Test Token", "TEST", 18);
        tokenCurrency = Currency.wrap(address(token));
        token.mint(address(this), 1000 ether);
        token.mint(address(1), 1000 ether);

        // Deploy a mock NFT for SwapCastHook dependency
        MockNFT nft = new MockNFT();
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
        deployCodeTo("SwapCastHook.sol", abi.encode(manager, address(nft)), address(flags));
        hook = SwapCastHook(address(flags));

        // Approve tokens for routers
        token.approve(address(swapRouter), type(uint256).max);
        token.approve(address(modifyLiquidityRouter), type(uint256).max);

        // Initialize a pool
        (key, ) = initPool(
            ethCurrency,
            tokenCurrency,
            hook,
            3000, // Swap Fees
            SQRT_PRICE_1_1
        );

        // Add liquidity
        uint160 sqrtPriceAtTickLower = TickMath.getSqrtPriceAtTick(-60);
        uint160 sqrtPriceAtTickUpper = TickMath.getSqrtPriceAtTick(60);
        uint256 ethToAdd = 0.1 ether;
        uint128 liquidityDelta = LiquidityAmounts.getLiquidityForAmount0(
            SQRT_PRICE_1_1,
            sqrtPriceAtTickUpper,
            ethToAdd
        );
        uint256 tokenToAdd = LiquidityAmounts.getAmount1ForLiquidity(
            sqrtPriceAtTickLower,
            SQRT_PRICE_1_1,
            liquidityDelta
        );
        modifyLiquidityRouter.modifyLiquidity{value: ethToAdd}(
            key,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: int256(uint256(liquidityDelta)),
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );
    }

    // Add/expand tests here following this structure

    function testAliceWinsBobLosesIntegration() public {
        // Use Deployers helper to set up tokens
        (Currency currency0, Currency currency1) = deployAndMint2Currencies();
        // Deploy the NFT and prediction pool
        MockNFT nft = new MockNFT();
        PredictionPool pool = new PredictionPool(address(nft));
        nft.setPredictionPool(address(pool));
        RewardDistributor distributor = new RewardDistributor(address(pool), address(nft));
        
        // Fund distributor with ETH for reward payout
        vm.deal(address(distributor), 10 ether);

        // Create a market
        uint256 endTime = block.timestamp + 1 days;
        uint256 marketId = pool.createMarket("Alice vs Bob", endTime);

        // Alice and Bob addresses
        address alice = address(0xA11CE);
        address bob = address(0xB0B);

        // Alice and Bob place predictions (Alice: outcome 1, Bob: outcome 2)
        vm.prank(alice);
        pool.recordPrediction(alice, marketId, 1, 100);
        vm.prank(bob);
        pool.recordPrediction(bob, marketId, 0, 100);

        // Warp to after market end and resolve in Alice's favor
        vm.warp(endTime + 1);
        pool.resolveMarket(marketId, 1);

        // Alice claims reward (should succeed)
        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        distributor.claim(0); // tokenId 0 should be Alice's
        uint256 aliceBalanceAfter = alice.balance;
        assertTrue(aliceBalanceAfter > aliceBalanceBefore, "Alice should get paid");
        assertTrue(distributor.claimed(0));

        // Bob tries to claim (should revert)
        vm.prank(bob);
        vm.expectRevert("Not winning outcome");
        distributor.claim(1);
    }


    function testDecodePredictionRevertsOnBadData() public {
        PoolKey memory key;
        SwapParams memory params;
        BalanceDelta delta = BalanceDelta.wrap(0);
        bytes memory badData = new bytes(10);
        vm.expectRevert(ImmutableState.NotPoolManager.selector);
        hook.afterSwap(address(1), key, params, delta, badData);
    }
}

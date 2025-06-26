// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {LiquidityAmounts} from "v4-periphery/src/libraries/LiquidityAmounts.sol";

// Import the Uniswap V4 periphery libraries
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {Planner, Plan} from "v4-periphery/test/shared/Planner.sol";

// Permit2 interface for approvals
interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
    function allowance(address owner, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce);
}

/**
 * @title AddLiquidity  
 * @notice Script to add liquidity to SwapCast Uniswap V4 pools on Sepolia testnet
 * @dev This script adds liquidity to both ETH/USDC and WETH/USDC pools created by your deployment
 */
contract AddLiquidity is Script {
    using Planner for Plan;

    // Sepolia Uniswap V4 addresses
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    // Token addresses from your deployment
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    // Your SwapCastHook address (from deployment)
    address constant SWAPCAST_HOOK = 0x94e52bcb77a04481361444241bcEd2f3e2368040;
    
    // Liquidity parameters
    uint256 constant ETH_AMOUNT = 0.1 ether;      // 0.1 ETH for ETH/USDC pool
    uint256 constant WETH_AMOUNT = 0.1 ether;     // 0.1 WETH for WETH/USDC pool  
    uint256 constant USDC_AMOUNT_1 = 10e6;        // 10 USDC for ETH/USDC pool (you have 19 total)
    uint256 constant USDC_AMOUNT_2 = 8e6;         // 8 USDC for WETH/USDC pool
    
    // Tick range (wide range for better liquidity)
    int24 constant TICK_LOWER = -887220;  // Full range lower
    int24 constant TICK_UPPER = 887220;   // Full range upper
    
    IPositionManager positionManager;
    address deployer;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        positionManager = IPositionManager(POSITION_MANAGER);
        
        console.log("=== Adding Liquidity to SwapCast Pools ===");
        console.log("Deployer:", deployer);
        console.log("Initial ETH Balance:", deployer.balance);
        console.log("Initial WETH Balance:", IERC20(WETH).balanceOf(deployer));
        console.log("Initial USDC Balance:", IERC20(USDC).balanceOf(deployer));
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Prepare tokens (wrap ETH to WETH if needed)
        _prepareTokens();
        
        // Step 2: Initialize pools if needed
        console.log("Initializing pools...");
        _initializePools();
        
        // Step 3: Add liquidity to ETH/USDC pool (Pool 1)
        console.log("Adding liquidity to ETH/USDC pool...");
        _addLiquidityETHUSDC();
        
        // Step 3: Add liquidity to WETH/USDC pool (Pool 2)  
        console.log("Adding liquidity to WETH/USDC pool...");
        _addLiquidityWETHUSDC();
        
        vm.stopBroadcast();
        
        // Final balances
        console.log("");
        console.log("=== Final Balances ===");
        console.log("Final ETH Balance:", deployer.balance);
        console.log("Final WETH Balance:", IERC20(WETH).balanceOf(deployer));
        console.log("Final USDC Balance:", IERC20(USDC).balanceOf(deployer));
        console.log("");
        console.log("[SUCCESS] Liquidity addition complete!");
    }
    
    function _prepareTokens() private {
        console.log("Preparing tokens...");
        
        // Check current balances
        uint256 currentWETH = IERC20(WETH).balanceOf(deployer);
        uint256 currentUSDC = IERC20(USDC).balanceOf(deployer);
        
        console.log("Current WETH:", currentWETH);
        console.log("Current USDC:", currentUSDC);
        
        // Wrap ETH to WETH if we don't have enough WETH
        if (currentWETH < WETH_AMOUNT) {
            uint256 ethToWrap = WETH_AMOUNT - currentWETH;
            console.log("Wrapping", ethToWrap, "ETH to WETH...");
            
            (bool success,) = WETH.call{value: ethToWrap}(abi.encodeWithSignature("deposit()"));
            require(success, "WETH wrap failed");
            
            console.log("[SUCCESS] Wrapped", ethToWrap, "ETH to WETH");
        }
        
        // Check minimum USDC requirement
        require(currentUSDC >= (USDC_AMOUNT_1 + USDC_AMOUNT_2), "Insufficient USDC for both pools");
        
        console.log("[SUCCESS] Token preparation complete");
    }
    
    function _initializePools() private {
        // Initialize ETH/USDC pool
        PoolKey memory ethUsdcPool = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(SWAPCAST_HOOK)
        });
        
        // Initialize WETH/USDC pool (USDC as currency0, WETH as currency1 for proper ordering)
        PoolKey memory wethUsdcPool = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(SWAPCAST_HOOK)
        });
        
        // Calculate initial price: $4000 per ETH
        uint160 sqrtPriceX96 = _getSqrtPriceX96(4000);
        
        try positionManager.initializePool(ethUsdcPool, sqrtPriceX96) {
            console.log("[SUCCESS] Initialized ETH/USDC pool");
        } catch {
            console.log("[INFO] ETH/USDC pool already initialized");
        }
        
        try positionManager.initializePool(wethUsdcPool, sqrtPriceX96) {
            console.log("[SUCCESS] Initialized WETH/USDC pool");
        } catch {
            console.log("[INFO] WETH/USDC pool already initialized");
        }
    }
    
    function _addLiquidityETHUSDC() private {
        // Create pool key for ETH/USDC
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(SWAPCAST_HOOK)
        });
        
        // Approve USDC through Permit2
        _approveToken(USDC, USDC_AMOUNT_1);
        
        // Calculate liquidity amount 
        // For simplicity, we'll provide equal value in both assets
        uint160 sqrtPriceX96 = _getSqrtPriceX96(4000); // Assuming ~$4000 per ETH
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(TICK_LOWER),
            TickMath.getSqrtPriceAtTick(TICK_UPPER),
            ETH_AMOUNT,
            USDC_AMOUNT_1
        );
        
        console.log("ETH/USDC Pool - Adding liquidity:", liquidity);
        console.log("- ETH Amount:", ETH_AMOUNT);
        console.log("- USDC Amount:", USDC_AMOUNT_1);
        
        // Create the mint position plan
        Plan memory plan = Planner.init();
        plan = plan.add(
            Actions.MINT_POSITION,
            abi.encode(
                poolKey,           // PoolKey
                TICK_LOWER,        // tickLower
                TICK_UPPER,        // tickUpper
                liquidity,         // liquidity amount
                type(uint128).max, // amount0Max (ETH)
                type(uint128).max, // amount1Max (USDC)
                deployer,          // recipient
                ""                 // hookData
            )
        );
        
        bytes memory calls = plan.finalizeModifyLiquidityWithClose(poolKey);
        
        // Execute the liquidity addition with ETH value
        positionManager.modifyLiquidities{value: ETH_AMOUNT}(calls, block.timestamp + 60);
        
        console.log("[SUCCESS] Added liquidity to ETH/USDC pool");
    }
    
    function _addLiquidityWETHUSDC() private {
        // Create pool key for WETH/USDC (USDC as currency0, WETH as currency1)
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH), 
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(SWAPCAST_HOOK)
        });
        
        // Approve tokens through Permit2
        _approveToken(WETH, WETH_AMOUNT);
        _approveToken(USDC, USDC_AMOUNT_2);
        
        // Calculate liquidity amount (USDC first since it's currency0)
        uint160 sqrtPriceX96 = _getSqrtPriceX96(4000); // Assuming ~$4000 per ETH
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(TICK_LOWER),
            TickMath.getSqrtPriceAtTick(TICK_UPPER),
            USDC_AMOUNT_2,
            WETH_AMOUNT
        );
        
        console.log("WETH/USDC Pool - Adding liquidity:", liquidity);
        console.log("- WETH Amount:", WETH_AMOUNT);
        console.log("- USDC Amount:", USDC_AMOUNT_2);
        
        // Create the mint position plan
        Plan memory plan = Planner.init();
        plan = plan.add(
            Actions.MINT_POSITION,
            abi.encode(
                poolKey,           // PoolKey
                TICK_LOWER,        // tickLower
                TICK_UPPER,        // tickUpper  
                liquidity,         // liquidity amount
                type(uint128).max, // amount0Max (WETH)
                type(uint128).max, // amount1Max (USDC)
                deployer,          // recipient
                ""                 // hookData
            )
        );
        
        bytes memory calls = plan.finalizeModifyLiquidityWithClose(poolKey);
        
        // Execute the liquidity addition
        positionManager.modifyLiquidities(calls, block.timestamp + 60);
        
        console.log("[SUCCESS] Added liquidity to WETH/USDC pool");
    }
    
    /**
     * @dev Simple helper to calculate sqrtPriceX96 from price
     * @param price The price in USD (e.g., 4000 for $4000)
     * @return sqrtPriceX96 The sqrt price in X96 format
     */
    function _getSqrtPriceX96(uint256 price) private pure returns (uint160) {
        // For ETH/USDC: price = amount of USDC per 1 ETH
        // sqrtPriceX96 = sqrt(price) * 2^96
        // This is a simplified calculation - in production you'd want more precision
        return uint160(sqrt(price) * (2**96) / 1e6); // Adjust for USDC decimals
    }
    
    /**
     * @dev Simple integer square root function
     */
    function sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
    
    /**
     * @dev Helper function to approve tokens through Permit2
     * @param token The token address to approve
     * @param amount The amount to approve
     */
    function _approveToken(address token, uint256 amount) private {
        // First approve token to Permit2 if needed
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(deployer, PERMIT2);
        
        if (currentAllowance < amount) {
            // Approve maximum amount to Permit2 to avoid future approval issues
            tokenContract.approve(PERMIT2, type(uint256).max);
            console.log("[SUCCESS] Approved", token, "to Permit2");
        }
        
        // Then approve Position Manager through Permit2
        IPermit2 permit2 = IPermit2(PERMIT2);
        
        // Check current Permit2 allowance
        (uint160 currentPermit2Allowance,,) = permit2.allowance(deployer, token, POSITION_MANAGER);
        
        if (currentPermit2Allowance < amount) {
            // Approve Position Manager through Permit2 with 1 hour expiration
            permit2.approve(token, POSITION_MANAGER, type(uint160).max, uint48(block.timestamp + 3600));
            console.log("[SUCCESS] Approved", token, "to Position Manager through Permit2");
        }
    }
}

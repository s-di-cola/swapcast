// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {IStateView} from "v4-periphery/src/interfaces/IStateView.sol";

// Import your contracts interfaces
interface IPredictionManager {
    function getMarketDetails(uint256 _marketId) external view returns (
        uint256 marketId_,
        string memory name_,
        string memory assetSymbol_,
        bool exists_,
        bool resolved_,
        uint8 winningOutcome_, // PredictionTypes.Outcome is uint8
        uint256 totalConvictionStakeOutcome0_,
        uint256 totalConvictionStakeOutcome1_,
        uint256 expirationTime_,
        address priceAggregator_,
        uint256 priceThreshold_
    );
    
    function getMarketCount() external view returns (uint256);
    function marketIdToPoolKey(uint256 marketId) external view returns (PoolKey memory);
    function getMarketIdAtIndex(uint256 _index) external view returns (uint256);
}

/**
 * @title ValidateMarkets
 * @notice Script to validate SwapCast markets and liquidity pools on Sepolia testnet
 * @dev This script checks pool states, liquidity amounts, and market data
 */
contract ValidateMarkets is Script {
    using PoolIdLibrary for PoolKey;

    // Sepolia Uniswap V4 addresses
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    
    // Token addresses
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    // Your deployed contract addresses
    address constant SWAPCAST_HOOK = 0x94e52bcb77a04481361444241bcEd2f3e2368040;
    address constant PREDICTION_MANAGER = 0x82b3ECa5e552808D97b37E71E580b245141d2e7b;
    
    function run() external view {
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        IPredictionManager predictionManager = IPredictionManager(PREDICTION_MANAGER);
        
        console.log("=== SwapCast Markets & Pools Validation ===");
        console.log("Block Number:", block.number);
        console.log("Block Timestamp:", block.timestamp);
        console.log("");
        
        // Step 1: Validate Uniswap V4 Pools
        console.log("1. Validating Uniswap V4 Pools");
        console.log("==============================");
        _validateEthUsdcPool();
        _validateWethUsdcPool();
        
        // Step 2: Validate Token Balances in Pools
        console.log("2. Validating Pool Token Balances");
        console.log("=================================");
        _validatePoolBalances();
        
        // Step 3: Validate Prediction Markets
        console.log("3. Validating Prediction Markets");
        console.log("================================");
        _validatePredictionMarkets();
        
        // Step 4: Validate Hook Integration
        console.log("4. Validating Hook Integration");
        console.log("==============================");
        _validateHookIntegration();
        
        console.log("");
        console.log("=== Validation Complete ===");
    }
    
    function _validateEthUsdcPool() private view {
        // Create ETH/USDC pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(SWAPCAST_HOOK)
        });
        
        PoolId poolId = poolKey.toId();
        console.log("ETH/USDC Pool ID:", vm.toString(PoolId.unwrap(poolId)));
        
        // Pool is identified - we'll check balances to infer if it has liquidity
        console.log("[INFO] Pool identified - checking if it has been used...");
        console.log("");
    }
    
    function _validateWethUsdcPool() private view {
        // Create WETH/USDC pool key (USDC as currency0, WETH as currency1)
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(SWAPCAST_HOOK)
        });
        
        PoolId poolId = poolKey.toId();
        console.log("WETH/USDC Pool ID:", vm.toString(PoolId.unwrap(poolId)));
        
        // Pool is identified - we'll check balances to infer if it has liquidity
        console.log("[INFO] Pool identified - checking if it has been used...");
        console.log("");
    }
    
    function _validatePoolBalances() private view {
        // Check ETH balance in PoolManager
        uint256 ethBalance = POOL_MANAGER.balance;
        console.log("PoolManager ETH Balance:", ethBalance, "wei");
        console.log("PoolManager ETH Balance:", ethBalance / 1e18, "ETH");
        
        // Check WETH balance in PoolManager
        uint256 wethBalance = IERC20(WETH).balanceOf(POOL_MANAGER);
        console.log("PoolManager WETH Balance:", wethBalance, "wei");
        console.log("PoolManager WETH Balance:", wethBalance / 1e18, "WETH");
        
        // Check USDC balance in PoolManager
        uint256 usdcBalance = IERC20(USDC).balanceOf(POOL_MANAGER);
        console.log("PoolManager USDC Balance:", usdcBalance, "units");
        console.log("PoolManager USDC Balance:", usdcBalance / 1e6, "USDC");
        console.log("");
    }
    
    function _validatePredictionMarkets() private view {
        IPredictionManager predictionManager = IPredictionManager(PREDICTION_MANAGER);
        try predictionManager.getMarketCount() returns (uint256 count) {
            console.log("Total Markets Created:", count);
            
            // Validate each market by getting market IDs from indices
            for (uint256 i = 0; i < count; i++) {
                try predictionManager.getMarketIdAtIndex(i) returns (uint256 marketId) {
                    console.log("--- Market Index:", i);
                    console.log("--- Market ID:", marketId);
                    _validateMarket(marketId);
                } catch {
                    console.log("[ERROR] Could not get market ID at index", i);
                }
            }
        } catch {
            console.log("[ERROR] Could not read from PredictionManager");
            console.log("Make sure PREDICTION_MANAGER address is correct");
        }
        console.log("");
    }
    
    function _validateMarket(uint256 marketId) private view {
        IPredictionManager predictionManager = IPredictionManager(PREDICTION_MANAGER);
        try predictionManager.getMarketDetails(marketId) returns (
            uint256 /* marketId_ */,
            string memory name_,
            string memory assetSymbol_,
            bool exists_,
            bool resolved_,
            uint8 winningOutcome_,
            uint256 totalConvictionStakeOutcome0_,
            uint256 totalConvictionStakeOutcome1_,
            uint256 expirationTime_,
            address priceAggregator_,
            uint256 priceThreshold_
        ) {
            console.log("Name:", name_);
            console.log("Asset Symbol:", assetSymbol_);
            console.log("Exists:", exists_);
            console.log("Resolved:", resolved_);
            console.log("Winning Outcome:", winningOutcome_);
            console.log("Expiration Time:", expirationTime_);
            console.log("Price Aggregator:", priceAggregator_);
            console.log("Price Threshold:", priceThreshold_);
            console.log("Total Outcome 0 Stakes:", totalConvictionStakeOutcome0_);
            console.log("Total Outcome 1 Stakes:", totalConvictionStakeOutcome1_);
            
            // Get the associated pool key
            try predictionManager.marketIdToPoolKey(marketId) returns (PoolKey memory poolKey) {
                PoolId poolId = poolKey.toId();
                console.log("Associated Pool ID:", vm.toString(PoolId.unwrap(poolId)));
            } catch {
                console.log("[ERROR] Could not get pool key for market", marketId);
            }
            
        } catch {
            console.log("[ERROR] Could not read market", marketId);
        }
    }
    
    function _validateHookIntegration() private view {
        console.log("SwapCast Hook Address:", SWAPCAST_HOOK);
        
        // Check if hook address is a contract
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(SWAPCAST_HOOK)
        }
        
        if (codeSize > 0) {
            console.log("[SUCCESS] Hook contract is deployed");
            console.log("Hook code size:", codeSize, "bytes");
        } else {
            console.log("[ERROR] Hook address has no code");
        }
        console.log("");
    }
    
    /**
     * @dev Helper function to calculate approximate USD price from sqrtPriceX96
     * This is a simplified calculation for display purposes
     */
    function _calculatePriceFromSqrtPrice(uint160 sqrtPriceX96) private pure returns (uint256) {
        // Convert sqrtPriceX96 to price
        // price = (sqrtPriceX96 / 2^96)^2
        // For ETH/USDC, this gives us USDC per ETH
        
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> (96 * 2);
        
        // Adjust for decimals (USDC has 6 decimals, ETH has 18)
        // So we multiply by 10^12 to get the right scale
        return price * 1e12 / 1e18;
    }
}

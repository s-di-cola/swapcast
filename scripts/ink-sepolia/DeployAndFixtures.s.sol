// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {StdCheats} from "forge-std/StdCheats.sol";

import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {Treasury} from "src/Treasury.sol";
import {PythOracleResolver} from "src/PythOracleResolver.sol";
import {RewardDistributor} from "src/RewardDistributor.sol";
import {PredictionManager} from "src/PredictionManager.sol";
import {SwapCastHook} from "src/SwapCastHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";
import {MarketLogic} from "src/MarketLogic.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/**
 * @title DeployAndFixturesInk
 * @notice Combined deployment and fixtures script for Ink testnet
 * @dev This script deploys all SwapCast contracts, sets up Pyth oracles, creates sample markets,
 *      and configures the system for immediate use on Ink testnet.
 */
contract DeployAndFixturesInk is Script, StdCheats {
    using PoolIdLibrary for PoolKey;

    // =============================================================================
    // CONFIGURATION CONSTANTS
    // =============================================================================
    
    // Contract Configuration
    uint256 public constant FEE_PERCENTAGE = 200; // 2% fee (in basis points)
    uint256 public constant MIN_STAKE_AMOUNT = 0.001 ether; // Minimum stake amount
    uint256 public constant MAX_PRICE_STALENESS = 3600; // 1 hour

    // NFT Configuration
    string public constant NFT_NAME = "SwapCast NFT";
    string public constant NFT_SYMBOL = "SCNFT";
    string public constant NFT_BASE_URI = "https://swapcast.xyz/metadata/";

    // Ink Mainnet Addresses
    address public constant POOL_MANAGER_ADDRESS = 0x360e68faccca8ca495c1b759fd9eee466db9fb32;
    
    // Note: This should be updated with the actual Pyth contract address on Ink
    address public constant PYTH_CONTRACT = 0x2880aB155794e7179c9eE2e38200202908C17B43; // Placeholder - verify this
    
    // =============================================================================
    // PYTH PRICE FEED IDS (Mainnet feeds - some may work on testnet)
    // =============================================================================
    
    // ETH/USD Price Feed
    bytes32 public constant ETH_USD_PRICE_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    
    // BTC/USD Price Feed  
    bytes32 public constant BTC_USD_PRICE_ID = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    
    // LINK/USD Price Feed
    bytes32 public constant LINK_USD_PRICE_ID = 0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221;
    
    // UNI/USD Price Feed
    bytes32 public constant UNI_USD_PRICE_ID = 0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501;
    
    // AAVE/USD Price Feed
    bytes32 public constant AAVE_USD_PRICE_ID = 0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445;

    // =============================================================================
    // MARKET CONFIGURATION
    // =============================================================================
    
    struct MarketConfig {
        string description;
        bytes32 priceId;
        uint256 priceThreshold;
        int32 expectedExpo;
        uint256 expirationDays;
    }
    
    // Sample markets to create
    MarketConfig[] public marketConfigs;
    
    // =============================================================================
    // DEPLOYED CONTRACTS
    // =============================================================================
    
    SwapCastNFT public swapCastNFT;
    Treasury public treasury;
    PredictionManager public predictionManager;
    PythOracleResolver public pythOracleResolver;
    RewardDistributor public rewardDistributor;
    SwapCastHook public swapCastHook;
    
    // Market tracking
    uint256[] public createdMarketIds;
    uint256 public nextMarketId = 1;

    function run() external {
        // Get the private key from the environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console2.log("Deploying SwapCast with fixtures on Ink testnet");
        console2.log("Deployer address:", deployerAddress);
        console2.log("Chain ID:", block.chainid);
        console2.log("Expected Ink Chain ID: 763373");

        // Validate we're on Ink testnet
        if (block.chainid != 763373) {
            console2.log("⚠️  WARNING: Expected Ink Chain ID (763373), got:", block.chainid);
        }

        // Validate critical addresses
        if (POOL_MANAGER_ADDRESS == address(0)) {
            revert("POOL_MANAGER_ADDRESS must be set for Ink deployment");
        }
        if (PYTH_CONTRACT == address(0)) {
            revert("PYTH_CONTRACT must be set for Ink deployment");
        }

        // Initialize market configurations
        _initializeMarketConfigs();

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        console2.log("\n STEP 1: Deploying Core Contracts");
        _deployContracts(deployerAddress);

        console2.log("\n STEP 2: Linking Contracts");
        _linkContracts();

        console2.log("\n STEP 3: Setting Up Pyth Oracles");
        _setupPythOracles();

        console2.log("\n STEP 4: Creating Sample Markets");
        _createSampleMarkets();

        console2.log("\n  STEP 5: Gelato Automation Setup");
        _setupGelatoAutomation();

        // Stop broadcasting transactions
        vm.stopBroadcast();

        console2.log("\n STEP 6: Deployment Summary");
        _printDeploymentSummary();

        console2.log("\n STEP 7: Environment Variables for Frontend");
        _printEnvironmentVariables();
    }

    function _initializeMarketConfigs() internal {
        // ETH will hit $4000 by next month?
        marketConfigs.push(MarketConfig({
            description: "Will ETH reach $4000 by next month?",
            priceId: ETH_USD_PRICE_ID,
            priceThreshold: 4000 * 1e8, // $4000 with 8 decimals
            expectedExpo: -8,
            expirationDays: 30
        }));

        // BTC will stay above $70000?
        marketConfigs.push(MarketConfig({
            description: "Will BTC stay above $70000 in the next 2 weeks?",
            priceId: BTC_USD_PRICE_ID,
            priceThreshold: 70000 * 1e8, // $70000 with 8 decimals
            expectedExpo: -8,
            expirationDays: 14
        }));

        // LINK will reach $30?
        marketConfigs.push(MarketConfig({
            description: "Will LINK reach $30 in the next month?",
            priceId: LINK_USD_PRICE_ID,
            priceThreshold: 30 * 1e8, // $30 with 8 decimals
            expectedExpo: -8,
            expirationDays: 30
        }));

        // UNI will double in 3 months?
        marketConfigs.push(MarketConfig({
            description: "Will UNI reach $25 in the next 3 months?",
            priceId: UNI_USD_PRICE_ID,
            priceThreshold: 25 * 1e8, // $25 with 8 decimals
            expectedExpo: -8,
            expirationDays: 90
        }));

        // AAVE will reach $500?
        marketConfigs.push(MarketConfig({
            description: "Will AAVE reach $500 in the next 2 months?",
            priceId: AAVE_USD_PRICE_ID,
            priceThreshold: 500 * 1e8, // $500 with 8 decimals
            expectedExpo: -8,
            expirationDays: 60
        }));
    }

    function _deployContracts(address deployerAddress) internal {
        // 1. Deploy SwapCastNFT
        swapCastNFT = new SwapCastNFT(deployerAddress, NFT_NAME, NFT_SYMBOL);
        console2.log("✓ SwapCastNFT deployed at:", address(swapCastNFT));

        // 2. Deploy Treasury
        treasury = new Treasury(deployerAddress);
        console2.log("✓ Treasury deployed at:", address(treasury));

        // 3. Deploy PredictionManager
        predictionManager = new PredictionManager(
            deployerAddress, // _initialOwner
            address(swapCastNFT), // _swapCastNFTAddress
            address(treasury), // _treasuryAddress
            FEE_PERCENTAGE, // _initialFeeBasisPoints
            MIN_STAKE_AMOUNT, // _initialMinStakeAmount
            MAX_PRICE_STALENESS, // _maxPriceStalenessSeconds
            address(0), // Zero address for OracleResolver (will be set later)
            address(0)  // Zero address for RewardDistributor (will be set later)
        );
        console2.log("✓ PredictionManager deployed at:", address(predictionManager));

        // 4. Deploy PythOracleResolver
        pythOracleResolver = new PythOracleResolver(
            address(predictionManager),
            PYTH_CONTRACT,
            deployerAddress
        );
        console2.log("✓ PythOracleResolver deployed at:", address(pythOracleResolver));

        // 5. Deploy RewardDistributor
        rewardDistributor = new RewardDistributor(deployerAddress, address(predictionManager));
        console2.log("✓ RewardDistributor deployed at:", address(rewardDistributor));

        // 6. Deploy SwapCastHook
        _deploySwapCastHook();
    }

    function _deploySwapCastHook() internal {
        console2.log("Deploying SwapCastHook with correct permissions...");

        // Set the hook flags - SwapCastHook only uses afterSwap
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);

        // The CREATE2 deployer address used by Foundry
        address CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        // Prepare constructor arguments
        bytes memory constructorArgs = abi.encode(IPoolManager(POOL_MANAGER_ADDRESS), address(predictionManager));

        // Mine for a salt that will produce a hook address with the correct flags
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(SwapCastHook).creationCode,
            constructorArgs
        );

        console2.log("Found salt for hook deployment:", vm.toString(salt));
        console2.log("Expected hook address:", hookAddress);

        // Deploy the hook using CREATE2 with the mined salt
        swapCastHook = new SwapCastHook{salt: salt}(IPoolManager(POOL_MANAGER_ADDRESS), address(predictionManager));

        // Verify the deployed address matches the mined address
        require(address(swapCastHook) == hookAddress, "Hook address mismatch");

        console2.log("✓ SwapCastHook deployed at:", address(swapCastHook));
    }

    function _linkContracts() internal {
        // Set the oracle resolver and reward distributor in PredictionManager
        predictionManager.setOracleResolverAddress(address(pythOracleResolver));
        predictionManager.setRewardDistributorAddress(address(rewardDistributor));
        console2.log("✓ Set OracleResolver and RewardDistributor in PredictionManager");

        // Set the PredictionManager address in SwapCastNFT
        swapCastNFT.setPredictionManagerAddress(address(predictionManager));
        console2.log("✓ Set PredictionManager address in SwapCastNFT");
    }

    function _setupPythOracles() internal {
        console2.log("Registering Pyth price feed oracles...");

        for (uint256 i = 0; i < marketConfigs.length; i++) {
            MarketConfig memory config = marketConfigs[i];
            
            // Register oracle for this market (market IDs start from 1)
            uint256 marketId = i + 1;
            
            pythOracleResolver.registerOracle(
                marketId,
                config.priceId,
                config.priceThreshold,
                config.expectedExpo
            );
            
            console2.log("✓ Registered oracle for market", marketId, "- Price Feed:", vm.toString(config.priceId));
        }
    }

    function _createSampleMarkets() internal {
        console2.log("Creating sample prediction markets...");

        for (uint256 i = 0; i < marketConfigs.length; i++) {
            MarketConfig memory config = marketConfigs[i];
            
            uint256 expirationTime = block.timestamp + (config.expirationDays * 24 * 60 * 60);
            
            // Create the market
            uint256 marketId = predictionManager.createMarket(
                config.description,
                expirationTime
            );
            
            createdMarketIds.push(marketId);
            
            console2.log("✓ Created market", marketId, ":", config.description);
            console2.log("  Expires:", expirationTime);
            console2.log("  Price Threshold:", config.priceThreshold / 1e8, "USD");
        }
    }

    function _setupGelatoAutomation() internal {
        console2.log("Setting up Gelato automation for Ink testnet...");
        
        // Since we're on Ink (Chain ID 763373), PredictionManager will automatically use Gelato
        // The automation provider is determined by chain ID in the contract
        
        // For Gelato, we need to ensure the contract has the proper automation functions
        // which are already implemented in PredictionManager:
        // - checker() function for Gelato to determine when to execute
        // - performGelatoUpkeep() function for Gelato to call
        
        console2.log("✓ Gelato automation is configured in PredictionManager");
        console2.log("  - Chain ID:", block.chainid, "(Gelato will be used automatically)");
        console2.log("  - Checker function: available for Gelato to monitor markets");
        console2.log("  - Execute function: performGelatoUpkeep() ready for Gelato calls");
        
        // Note: The actual Gelato task registration would typically be done through
        // the Gelato Network interface or SDK, not in this deployment script
        console2.log("📋 Next steps for Gelato setup:");
        console2.log("  1. Register tasks with Gelato Network");
        console2.log("  2. Fund the Gelato balance for automated executions");
        console2.log("  3. Monitor task execution through Gelato dashboard");
    }

    function _printDeploymentSummary() internal view {
        console2.log("================================");
        console2.log("SwapCast Ink Deployment Summary");
        console2.log("================================");
        console2.log("Network: Ink Testnet (Chain ID:", block.chainid, ")");
        console2.log("SwapCastNFT:       ", address(swapCastNFT));
        console2.log("Treasury:          ", address(treasury));
        console2.log("PredictionManager: ", address(predictionManager));
        console2.log("PythOracleResolver:", address(pythOracleResolver));
        console2.log("RewardDistributor: ", address(rewardDistributor));
        console2.log("SwapCastHook:      ", address(swapCastHook));
        console2.log("Pool Manager:      ", POOL_MANAGER_ADDRESS);
        console2.log("Pyth Contract:     ", PYTH_CONTRACT);
        console2.log("================================");
        console2.log("Markets Created:   ", createdMarketIds.length);
        for (uint256 i = 0; i < createdMarketIds.length; i++) {
            console2.log("  Market", createdMarketIds[i], ":", marketConfigs[i].description);
        }
        console2.log("================================");
    }

    function _printEnvironmentVariables() internal view {
        console2.log("# Copy these environment variables to your .env file:");
        console2.log("");
        console2.log("# Contract Addresses");
        console2.log("VITE_SWAPCAST_NFT_ADDRESS=", address(swapCastNFT));
        console2.log("VITE_TREASURY_ADDRESS=", address(treasury));
        console2.log("VITE_PREDICTION_MANAGER_ADDRESS=", address(predictionManager));
        console2.log("VITE_ORACLE_RESOLVER_ADDRESS=", address(pythOracleResolver));
        console2.log("VITE_REWARD_DISTRIBUTOR_ADDRESS=", address(rewardDistributor));
        console2.log("VITE_SWAPCAST_HOOK_ADDRESS=", address(swapCastHook));
        console2.log("");
        console2.log("# Network Configuration");
        console2.log("VITE_POOL_MANAGER_ADDRESS=", POOL_MANAGER_ADDRESS);
        console2.log("VITE_PYTH_CONTRACT_ADDRESS=", PYTH_CONTRACT);
        console2.log("VITE_CHAIN_ID=", vm.toString(block.chainid));
        console2.log("");
        console2.log("# Market IDs (for testing)");
        for (uint256 i = 0; i < createdMarketIds.length; i++) {
            console2.log("VITE_SAMPLE_MARKET_", i + 1, "_ID=", vm.toString(createdMarketIds[i]));
        }
        console2.log("");
        console2.log("# Automation Provider");
        console2.log("VITE_AUTOMATION_PROVIDER=gelato");
    }
}

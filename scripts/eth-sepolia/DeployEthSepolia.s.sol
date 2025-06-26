// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PredictionManager} from "../../src/PredictionManager.sol";
import {SwapCastNFT} from "../../src/SwapCastNFT.sol";
import {SwapCastHook} from "../../src/SwapCastHook.sol";
import {Treasury} from "../../src/Treasury.sol";
import {RewardDistributor} from "../../src/RewardDistributor.sol";
import {OracleResolver} from "../../src/OracleResolver.sol";
import {PredictionTypes} from "../../src/types/PredictionTypes.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/**
 * @title DeployEthSepolia
 * @notice Combined deployment and fixtures script for Ethereum Sepolia testnet
 * @dev This script deploys all SwapCast contracts and sets up sample data
 */
contract DeployEthSepolia is Script {
    // Ethereum Sepolia Uniswap V4 addresses
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant UNIVERSAL_ROUTER = 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant QUOTER = 0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // Ethereum Sepolia Chainlink addresses
    address constant CHAINLINK_AUTOMATION_REGISTRY = 0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad;
    address constant CHAINLINK_AUTOMATION_REGISTRAR = 0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976;
    address constant CHAINLINK_FEED_REGISTRY = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1; // Sepolia Feed Registry

    // Chainlink Price Feed addresses on Sepolia
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant BTC_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant BTC_ETH_FEED = 0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22;
    address constant EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant DAI_USD_FEED = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;

    // Common test tokens on Sepolia (you may need to deploy your own or use existing ones)
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14; // Sepolia WETH
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // Sepolia USDC (or similar)

    // Deployment configuration
    uint256 constant INITIAL_FEE_BASIS_POINTS = 100; // 1%
    uint256 constant INITIAL_MIN_STAKE_AMOUNT = 0.001 ether; // Lower for testnet
    uint256 constant MAX_PRICE_STALENESS_SECONDS = 3600; // 1 hour

    // Market fixtures configuration
    uint256 constant MARKET_DURATION = 7 days; // 1 week markets
    
    // Deployed contract addresses (will be set during deployment)
    Treasury treasury;
    SwapCastNFT nft;
    PredictionManager predictionManager;
    RewardDistributor rewardDistributor;
    OracleResolver oracleResolver;
    SwapCastHook hook;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== SwapCast Ethereum Sepolia Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy Treasury
        console.log("1. Deploying Treasury...");
        treasury = new Treasury(deployer);
        console.log("Treasury deployed at:", address(treasury));

        // Step 2: Deploy SwapCastNFT
        console.log("2. Deploying SwapCastNFT...");
        nft = new SwapCastNFT(deployer, "SwapCast Position NFT", "SCNFT");
        console.log("SwapCastNFT deployed at:", address(nft));

        // Step 3: Deploy a temporary PredictionManager to get address for dependencies
        // First, deploy RewardDistributor and OracleResolver with placeholder addresses
        console.log("3. Deploying dependent contracts with computed PredictionManager address...");
        
        // Compute the future PredictionManager address using CREATE opcode prediction
        uint256 predictionManagerNonce = vm.getNonce(deployer) + 2; // +2 because we deploy RewardDistributor and OracleResolver first
        address predictedPredictionManagerAddress = vm.computeCreateAddress(deployer, predictionManagerNonce);
        console.log("Predicted PredictionManager address:", predictedPredictionManagerAddress);
        
        // Deploy RewardDistributor with predicted address
        console.log("4. Deploying RewardDistributor...");
        rewardDistributor = new RewardDistributor(deployer, predictedPredictionManagerAddress);
        console.log("RewardDistributor deployed at:", address(rewardDistributor));

        // Deploy OracleResolver with predicted address
        console.log("5. Deploying OracleResolver...");
        oracleResolver = new OracleResolver(
            predictedPredictionManagerAddress,
            CHAINLINK_FEED_REGISTRY,
            deployer
        );
        console.log("OracleResolver deployed at:", address(oracleResolver));

        // Deploy PredictionManager
        console.log("6. Deploying PredictionManager...");
        predictionManager = new PredictionManager(
            deployer,
            address(nft),
            address(treasury),
            INITIAL_FEE_BASIS_POINTS,
            INITIAL_MIN_STAKE_AMOUNT,
            MAX_PRICE_STALENESS_SECONDS,
            address(oracleResolver),
            address(rewardDistributor)
        );
        console.log("PredictionManager deployed at:", address(predictionManager));
        
        // Verify the address matches prediction
        if (address(predictionManager) != predictedPredictionManagerAddress) {
            console.log("WARNING: PredictionManager address does not match prediction!");
            console.log("Expected:", predictedPredictionManagerAddress);
            console.log("Actual:", address(predictionManager));
        }

        // Step 7: Set PredictionManager address in dependent contracts
        console.log("7. Configuring contract relationships...");
        nft.setPredictionManagerAddress(address(predictionManager));
        // Note: RewardDistributor and OracleResolver have immutable prediction manager addresses
        // set in their constructors with the predicted address

        // Step 8: Deploy SwapCastHook using CREATE2 to get correct address flags
        console.log("8. Deploying SwapCastHook with CREATE2...");
        
        // Set the hook flags - SwapCastHook only uses afterSwap
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
        
        // The CREATE2 deployer address used by Foundry
        address CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        
        // Prepare constructor arguments
        bytes memory constructorArgs = abi.encode(IPoolManager(POOL_MANAGER), address(predictionManager));
        
        // Mine for a salt that will produce a hook address with the correct flags
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, // Use the standard CREATE2 deployer
            flags,
            type(SwapCastHook).creationCode,
            constructorArgs
        );
        
        console.log("Found salt for hook address:", vm.toString(salt));
        console.log("Expected hook address:", hookAddress);
        
        // Deploy the hook using CREATE2 with the mined salt
        hook = new SwapCastHook{salt: salt}(IPoolManager(POOL_MANAGER), address(predictionManager));
        
        // Verify the deployed address matches the mined address
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("SwapCastHook deployed at:", address(hook));

        // Step 9: Register Oracle price feeds for created markets
        console.log("9. Registering Oracle price feeds...");
        // Note: Oracle registration will be done after market creation
        // when we have the actual market IDs
        console.log("Oracle feeds will be registered with market creation");

        // Step 10: Create sample markets
        console.log("10. Creating sample prediction markets...");
        _createSampleMarkets();

        vm.stopBroadcast();

        // Step 11: Output deployment information
        console.log("");
        console.log("=== Deployment Complete ===");
        _outputDeploymentInfo();
        _outputEnvironmentVariables();
        _outputNextSteps();
    }

    function _createSampleMarkets() private {
        uint256 expirationTime = block.timestamp + MARKET_DURATION;

        // Create ETH/USD market
        PoolKey memory ethPoolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        uint256 ethMarketId = predictionManager.createMarket(
            "Ethereum Price Prediction",
            "ETH/USD",
            expirationTime,
            address(oracleResolver),
            4000 * 10**8, // $4000 threshold
            ethPoolKey
        );
        console.log("Created ETH/USD market with ID:", ethMarketId);

        // Create BTC/USD market
        PoolKey memory btcPoolKey = PoolKey({
            currency0: Currency.wrap(WETH),
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        uint256 btcMarketId = predictionManager.createMarket(
            "Bitcoin Price Prediction",
            "BTC/USD", 
            expirationTime,
            address(oracleResolver),
            100000 * 10**8, // $100,000 threshold
            btcPoolKey
        );
        console.log("Created BTC/USD market with ID:", btcMarketId);

        // Create EUR/USD market
        PoolKey memory eurPoolKey = PoolKey({
            currency0: Currency.wrap(WETH),
            currency1: Currency.wrap(USDC),
            fee: 500, // 0.05%
            tickSpacing: 10,
            hooks: IHooks(address(hook))
        });

        uint256 eurMarketId = predictionManager.createMarket(
            "Euro Exchange Rate Prediction",
            "EUR/USD",
            expirationTime,
            address(oracleResolver),
            110 * 10**6, // $1.10 threshold (scaled to 8 decimals: 1.10 * 10^8)
            eurPoolKey
        );
        console.log("Created EUR/USD market with ID:", eurMarketId);
    }

    function _outputDeploymentInfo() private view {
        console.log("Contract Addresses:");
        console.log("==================");
        console.log("Treasury:", address(treasury));
        console.log("SwapCastNFT:", address(nft));
        console.log("PredictionManager:", address(predictionManager));
        console.log("RewardDistributor:", address(rewardDistributor));
        console.log("OracleResolver:", address(oracleResolver));
        console.log("SwapCastHook:", address(hook));
        console.log("");
        console.log("External Contract Addresses:");
        console.log("============================");
        console.log("PoolManager:", POOL_MANAGER);
        console.log("Universal Router:", UNIVERSAL_ROUTER);
        console.log("Position Manager:", POSITION_MANAGER);
        console.log("Quoter:", QUOTER);
        console.log("Permit2:", PERMIT2);
        console.log("Chainlink Feed Registry:", CHAINLINK_FEED_REGISTRY);
        console.log("ETH/USD Feed:", ETH_USD_FEED);
        console.log("");
    }

    function _outputEnvironmentVariables() private view {
        console.log("Environment Variables for Frontend:");
        console.log("===================================");
        console.log("NEXT_PUBLIC_NETWORK=eth-sepolia");
        console.log("NEXT_PUBLIC_CHAIN_ID=11155111");
        console.log("NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY");
        console.log("NEXT_PUBLIC_TREASURY_ADDRESS=%s", address(treasury));
        console.log("NEXT_PUBLIC_SWAPCAST_NFT_ADDRESS=%s", address(nft));
        console.log("NEXT_PUBLIC_PREDICTION_MANAGER_ADDRESS=%s", address(predictionManager));
        console.log("NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=%s", address(rewardDistributor));
        console.log("NEXT_PUBLIC_ORACLE_RESOLVER_ADDRESS=%s", address(oracleResolver));
        console.log("NEXT_PUBLIC_SWAPCAST_HOOK_ADDRESS=%s", address(hook));
        console.log("NEXT_PUBLIC_POOL_MANAGER_ADDRESS=%s", POOL_MANAGER);
        console.log("NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS=%s", UNIVERSAL_ROUTER);
        console.log("NEXT_PUBLIC_POSITION_MANAGER_ADDRESS=%s", POSITION_MANAGER);
        console.log("NEXT_PUBLIC_QUOTER_ADDRESS=%s", QUOTER);
        console.log("NEXT_PUBLIC_PERMIT2_ADDRESS=%s", PERMIT2);
        console.log("");
    }

    function _outputNextSteps() private view {
        console.log("Next Steps:");
        console.log("===========");
        console.log("1. Fund the Treasury contract with initial ETH for testing");
        console.log("2. Set up Chainlink Automation:");
        console.log("   - Register upkeep at: %s", CHAINLINK_AUTOMATION_REGISTRAR);
        console.log("   - Target contract: %s", address(predictionManager));
        console.log("   - Admin address: %s", msg.sender);
        console.log("3. Update frontend environment variables with the addresses above");
        console.log("4. Test market creation and predictions on Sepolia");
        console.log("5. Verify contracts on Etherscan:");
        console.log("   forge verify-contract <address> <contract> --chain sepolia");
        console.log("");
        console.log("Chainlink Automation Setup:");
        console.log("- Registry: %s", CHAINLINK_AUTOMATION_REGISTRY);
        console.log("- Registrar: %s", CHAINLINK_AUTOMATION_REGISTRAR);
        console.log("- Minimum LINK for upkeep: 5 LINK");
        console.log("- Suggested gas limit: 2,000,000");
        console.log("");
        console.log("Deployment completed successfully!");
    }

}

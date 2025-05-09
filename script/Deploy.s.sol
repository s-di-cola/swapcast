// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {Treasury} from "src/Treasury.sol";
import {OracleResolver} from "src/OracleResolver.sol";
import {RewardDistributor} from "src/RewardDistributor.sol";
import {PredictionManager} from "src/PredictionManager.sol";
import {SwapCastHook} from "src/SwapCastHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";

/**
 * @title DeploySwapCast
 * @notice Script to deploy all SwapCast contracts in the correct order
 * @dev This script handles the deployment and initialization of all SwapCast contracts
 */
contract DeploySwapCast is Script {
    // Configuration parameters
    uint256 public constant FEE_PERCENTAGE = 200; // 2% fee (in basis points)
    uint256 public constant MIN_STAKE_AMOUNT = 0.001 ether; // Minimum stake amount
    uint256 public constant MAX_PRICE_STALENESS = 3600; // 1 hour

    // NFT configuration
    string public constant NFT_NAME = "SwapCast NFT";
    string public constant NFT_SYMBOL = "SCNFT";
    string public constant NFT_BASE_URI = "https://swapcast.example.com/metadata/";

    // Deployed contract addresses
    SwapCastNFT public swapCastNFT;
    Treasury public treasury;
    PredictionManager public predictionManager;
    OracleResolver public oracleResolver;
    RewardDistributor public rewardDistributor;
    SwapCastHook public swapCastHook;

    function run() external {
        // Get the private key from the environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console2.log("Deploying SwapCast contracts with address:", deployerAddress);

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SwapCastNFT
        swapCastNFT = new SwapCastNFT(deployerAddress, NFT_NAME, NFT_SYMBOL);
        console2.log("SwapCastNFT deployed at:", address(swapCastNFT));

        // 2. Deploy Treasury
        treasury = new Treasury(deployerAddress);
        console2.log("Treasury deployed at:", address(treasury));

        // 3. Deploy PredictionManager which internally creates OracleResolver and RewardDistributor
        predictionManager = new PredictionManager(
            address(swapCastNFT),
            address(treasury),
            FEE_PERCENTAGE,
            deployerAddress,
            MIN_STAKE_AMOUNT,
            MAX_PRICE_STALENESS
        );
        console2.log("PredictionManager deployed at:", address(predictionManager));

        // 4. Get the addresses of the OracleResolver and RewardDistributor created by PredictionManager
        oracleResolver = OracleResolver(predictionManager.oracleResolverAddress());
        rewardDistributor = RewardDistributor(predictionManager.rewardDistributorAddress());
        console2.log("OracleResolver deployed at:", address(oracleResolver));
        console2.log("RewardDistributor deployed at:", address(rewardDistributor));

        // 5. Set the PredictionManager address in the SwapCastNFT
        swapCastNFT.setPredictionManagerAddress(address(predictionManager));
        console2.log("Set PredictionManager address in SwapCastNFT");

        // 7. Deploy SwapCastHook (if PoolManager address is available)
        // Note: This requires a Uniswap v4 PoolManager address which may vary by network
        // For testing purposes, we can use a placeholder address
        address poolManagerAddress = vm.envOr("POOL_MANAGER_ADDRESS", address(0));
        if (poolManagerAddress != address(0)) {
            // Import IPoolManager interface or use address cast
            swapCastHook = new SwapCastHook(IPoolManager(poolManagerAddress), address(predictionManager));
            console2.log("SwapCastHook deployed at:", address(swapCastHook));
        } else {
            console2.log("SwapCastHook not deployed - POOL_MANAGER_ADDRESS not provided");
        }

        // 8. Create a sample market for testing (optional)
        if (vm.envOr("CREATE_SAMPLE_MARKET", false)) {
            uint256 marketId = 1;
            uint256 expirationTime = block.timestamp + 1 days;
            address mockAggregator = vm.envOr("MOCK_AGGREGATOR_ADDRESS", address(0));
            uint256 priceThreshold = 1000; // Example price threshold

            if (mockAggregator != address(0)) {
                // First register the oracle for this market
                oracleResolver.registerOracle(marketId, mockAggregator, priceThreshold);
                console2.log("Registered oracle for market ID:", marketId);

                // Then create the market with oracle
                predictionManager.createMarketWithOracle(marketId, expirationTime, mockAggregator, priceThreshold);
                console2.log("Created sample market with ID:", marketId);
            } else {
                predictionManager.createMarket(marketId);
                console2.log("Created basic sample market with ID:", marketId);
            }
        }

        // Stop broadcasting transactions
        vm.stopBroadcast();

        // Log deployment summary
        console2.log("\n--- SwapCast Deployment Summary ---");
        console2.log("SwapCastNFT:      ", address(swapCastNFT));
        console2.log("Treasury:         ", address(treasury));
        console2.log("PredictionManager:", address(predictionManager));
        console2.log("OracleResolver:   ", address(oracleResolver));
        console2.log("RewardDistributor:", address(rewardDistributor));
        if (poolManagerAddress != address(0)) {
            console2.log("SwapCastHook:     ", address(swapCastHook));
        }
        console2.log("--------------------------------");
    }
}

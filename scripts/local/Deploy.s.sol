// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {StdCheats} from "forge-std/StdCheats.sol";

import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {Treasury} from "src/Treasury.sol";
import {OracleResolver} from "src/OracleResolver.sol";
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
 * @title DeploySwapCast
 * @notice Script to deploy all SwapCast contracts in the correct order
 * @dev This script handles the deployment and initialization of all SwapCast contracts
 * @dev Updated to work with PredictionManager (renamed from PredictionPool)
 */
contract DeploySwapCast is Script, StdCheats {
    using PoolIdLibrary for PoolKey;

    // Configuration parameters
    uint256 public constant FEE_PERCENTAGE = 200; // 2% fee (in basis points)
    uint256 public constant MIN_STAKE_AMOUNT = 0.001 ether; // Minimum stake amount
    uint256 public constant MAX_PRICE_STALENESS = 3600; // 1 hour

    // NFT configuration
    string public constant NFT_NAME = "SwapCast NFT";
    string public constant NFT_SYMBOL = "SCNFT";
    string public constant NFT_BASE_URI = "https://swapcast.example.com/metadata/";

    // Uniswap v4 PoolManager address - you need to set this for your network
    // For mainnet fork testing, use the actual deployed PoolManager address
    address public constant POOL_MANAGER_ADDRESS =  0x000000000004444c5dc75cB358380D2e3dE08A90;

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

        // Validate PoolManager address
        require(POOL_MANAGER_ADDRESS != address(0), "POOL_MANAGER_ADDRESS must be set");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SwapCastNFT
        swapCastNFT = new SwapCastNFT(deployerAddress, NFT_NAME, NFT_SYMBOL);
        console2.log("SwapCastNFT deployed at:", address(swapCastNFT));

        // 2. Deploy Treasury
        treasury = new Treasury(deployerAddress);
        console2.log("Treasury deployed at:", address(treasury));

        // 3. Deploy PredictionManager first with zero addresses for OracleResolver and RewardDistributor
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
        console2.log("PredictionManager deployed at:", address(predictionManager));
        console2.log("ADMIN_ADDRESS:", predictionManager.owner());

        // 4. Deploy OracleResolver with the real Chainlink Feed Registry and PredictionManager address
        // Chainlink Feed Registry on Ethereum mainnet: 0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf
        address feedRegistry = 0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf;
        oracleResolver = new OracleResolver(address(predictionManager), feedRegistry, deployerAddress);
        console2.log("OracleResolver deployed at:", address(oracleResolver));

        // 5. Deploy RewardDistributor with the PredictionManager address
        rewardDistributor = new RewardDistributor(deployerAddress, address(predictionManager));
        console2.log("RewardDistributor deployed at:", address(rewardDistributor));

        // 6. Set the proper addresses in PredictionManager using the new setter methods
        predictionManager.setOracleResolverAddress(address(oracleResolver));
        predictionManager.setRewardDistributorAddress(address(rewardDistributor));
        console2.log("Set OracleResolver and RewardDistributor addresses in PredictionManager");

        // 7. Set the PredictionManager address in the SwapCastNFT
        swapCastNFT.setPredictionManagerAddress(address(predictionManager));
        console2.log("Set PredictionManager address in SwapCastNFT");

        // 8. Deploy SwapCastHook with the Uniswap v4 PoolManager
        console2.log("Deploying SwapCastHook at an address that encodes its permissions");

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

        console2.log("SwapCastHook deployed at:", address(swapCastHook));

        // The hook is now deployed at the correct address with the proper permissions
        console2.log("SwapCastHook successfully deployed at address:", address(swapCastHook));
        console2.log("Hook is ready to be used with Uniswap v4 pools");

        // Define the pool key for reference (not initializing yet)
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2), // WETH
            currency1: Currency.wrap(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48), // USDC
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(swapCastHook))
        });

        // Calculate and log the pool ID for reference
        PoolId poolId = poolKey.toId();
        bytes32 poolIdBytes;
        assembly {
            poolIdBytes := poolId
        }
        console2.log("5. Expected Pool ID: ", vm.toString(poolIdBytes));
        console2.log("\nNote: Pool initialization should be done in a separate transaction");
        console2.log("after ensuring the tokens are properly sorted and the hook is valid.");
        console2.log("\nIMPORTANT: Use the hook with the PoolManager for swaps with predictions!");

        // Stop broadcasting transactions
        vm.stopBroadcast();

        // Log deployment summary
        console2.log("\n--------------------------------");
        console2.log("SwapCast Deployment Summary");
        console2.log("--------------------------------");
        console2.log("SwapCastNFT:     ", address(swapCastNFT));
        console2.log("Treasury:        ", address(treasury));
        console2.log("PredictionManager:", address(predictionManager));
        console2.log("OracleResolver:  ", address(oracleResolver));
        console2.log("RewardDistributor:", address(rewardDistributor));
        console2.log("SwapCastHook:    ", address(swapCastHook));
        console2.log("Pool Manager:    ", POOL_MANAGER_ADDRESS);
        console2.log("--------------------------------");
    }
}

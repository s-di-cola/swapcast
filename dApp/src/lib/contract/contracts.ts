// Simple Contract interaction module using viem for SwapCast prediction markets
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

// Network configuration
const RPC_URL = 'http://localhost:8545';

// Get contract addresses from environment variables
// These are populated by the start.sh script which exports the contract_addresses.env file
// The environment variables should be loaded in the vite.config.ts file
const PREDICTION_MANAGER_ADDRESS = import.meta.env.VITE_PREDICTION_MANAGER_ADDRESS;
const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS;
const SWAPCAST_NFT_ADDRESS = import.meta.env.VITE_SWAPCAST_NFT_ADDRESS;
const ORACLE_RESOLVER_ADDRESS = import.meta.env.VITE_ORACLE_RESOLVER_ADDRESS;
const REWARD_DISTRIBUTOR_ADDRESS = import.meta.env.VITE_REWARD_DISTRIBUTOR_ADDRESS;

// Use default addresses for local development if environment variables are not set
const DEFAULT_PREDICTION_MANAGER_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const DEFAULT_ADMIN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Admin private key for contract interactions (only used in development)
const ADMIN_PRIVATE_KEY = import.meta.env.VITE_ADMIN_PRIVATE_KEY || DEFAULT_ADMIN_PRIVATE_KEY;

// Create a public client for read operations
export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(RPC_URL)
});

// Create a wallet client for admin operations
export const adminClient = createWalletClient({
  account: privateKeyToAccount(ADMIN_PRIVATE_KEY as `0x${string}`),
  chain: hardhat,
  transport: http(RPC_URL)
});

// Chainlink Price Feed addresses for common pairs on mainnet
// These will be used in the local Anvil fork
const CHAINLINK_PRICE_FEEDS: Record<string, `0x${string}`> = {
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
  'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'
};

// Minimal ABI for market creation and interaction
const predictionManagerAbi = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_marketId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_expirationTime",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_priceAggregator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_priceThreshold",
        "type": "uint256"
      }
    ],
    "name": "createMarketWithOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_marketId",
        "type": "uint256"
      }
    ],
    "name": "getMarketDetails",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "marketId_",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "exists_",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "resolved_",
        "type": "bool"
      },
      {
        "internalType": "enum PredictionTypes.Outcome",
        "name": "winningOutcome_",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "totalConvictionStakeOutcome0_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalConvictionStakeOutcome1_",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "expirationTime_",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "priceAggregator_",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "priceThreshold_",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

/**
 * Create a new prediction market
 * @param marketName Name of the market
 * @param expirationHours Duration of the market in hours
 * @param targetPrice Target price threshold for the market
 * @param priceFeedKey Key for the price feed (e.g., 'ETH/USD')
 * @returns Object containing success status, market ID, and transaction hash
 */
export async function createMarket(
  marketName: string,
  expirationHours: number,
  targetPrice: number,
  priceFeedKey: string = 'ETH/USD'
): Promise<{ success: boolean, marketId: string, txHash?: string, error?: string }> {
  try {
    // Generate a unique market ID based on timestamp
    const marketId = BigInt(Date.now());
    
    // Calculate expiration time (current time + hours)
    const expirationTime = BigInt(Math.floor(Date.now() / 1000) + (expirationHours * 3600));
    
    // Get price feed address
    const priceFeedAddress = CHAINLINK_PRICE_FEEDS[priceFeedKey] || CHAINLINK_PRICE_FEEDS['ETH/USD'];
    
    // Convert target price to wei format (18 decimals)
    const priceThreshold = BigInt(Math.floor(targetPrice * 10**18));
    
    console.log('Creating market with parameters:', {
      marketId: marketId.toString(),
      expirationTime: new Date(Number(expirationTime) * 1000).toISOString(),
      priceFeedAddress,
      priceThreshold: priceThreshold.toString()
    });
    
    // Send the transaction
    const hash = await adminClient.writeContract({
      address: (PREDICTION_MANAGER_ADDRESS || DEFAULT_PREDICTION_MANAGER_ADDRESS) as `0x${string}`,
      abi: predictionManagerAbi,
      functionName: 'createMarketWithOracle',
      args: [marketId, expirationTime, priceFeedAddress, priceThreshold]
    });
    
    return {
      success: true,
      marketId: marketId.toString(),
      txHash: hash
    };
  } catch (error: any) {
    console.error('Error creating market:', error);
    return {
      success: false,
      marketId: '0',
      error: error.message
    };
  }
}

/**
 * Get details for a specific market
 * @param marketId ID of the market to check
 * @returns Market details from the contract
 */
export async function getMarketDetails(marketId: string | bigint) {
  try {
    const id = typeof marketId === 'string' ? BigInt(marketId) : marketId;
    
    const details = await publicClient.readContract({
      address: (PREDICTION_MANAGER_ADDRESS || DEFAULT_PREDICTION_MANAGER_ADDRESS) as `0x${string}`,
      abi: predictionManagerAbi,
      functionName: 'getMarketDetails',
      args: [id]
    });
    
    return {
      marketId: details[0],
      exists: details[1],
      resolved: details[2],
      winningOutcome: details[3],
      totalConvictionStakeOutcome0: details[4],
      totalConvictionStakeOutcome1: details[5],
      expirationTime: details[6],
      priceAggregator: details[7],
      priceThreshold: details[8]
    };
  } catch (error: any) {
    console.error('Error getting market details:', error);
    throw error;
  }
}

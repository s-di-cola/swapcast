// Market service for fetching and managing prediction markets
import { publicClient, adminClient } from '$lib/contract/contracts';
import type { Address, Abi } from 'viem'; 
import predictionManagerGeneratedAbi from '../../generated-abis/PredictionManager.sol/PredictionManager.abi.json';

// Get the PredictionManager address from environment variables
const PREDICTION_MANAGER_ADDRESS: Address = (import.meta.env.VITE_PREDICTIONMANAGER_ADDRESS || 
                                    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address; 

// Cast the imported array directly to the Abi type
const predictionManagerAbi = predictionManagerGeneratedAbi as Abi;

// Chainlink Price Feed addresses for common pairs
const CHAINLINK_PRICE_FEEDS: Record<string, string> = {
  '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419': 'ETH/USD',
  '0xf4030086522a5beea4988f8ca5b36dbc97bee88c': 'BTC/USD',
  '0x2c1d072e956affc0d435cb7ac38ef18d24d9127c': 'LINK/USD',
  '0x8fffffd4afb6115b954bd326cbe7b4ba576818f6': 'USDC/USD'
};

// Market interface
export interface Market {
  id: string;
  name?: string; 
  status: 'Open' | 'Expired' | 'Resolved';
  assetPair: string;
  expirationTime: number;
  expirationDisplay: string;
  priceThreshold: string;
  totalStake: string;
  exists: boolean;
  resolved: boolean;
  winningOutcome?: number;
  priceAggregator: string;
}

// Define the expected return type for getMarketDetails based on ABI
type MarketDetailsTuple = readonly [bigint, boolean, boolean, number, bigint, bigint, bigint, Address, bigint];

/**
 * Get the total number of markets
 * @returns Promise with the total market count
 */
export async function getMarketCount(): Promise<number> {
  try {
    const count = await publicClient.readContract({
      address: PREDICTION_MANAGER_ADDRESS,
      abi: predictionManagerAbi,
      functionName: 'getMarketCount'
    });
    
    return Number(count);
  } catch (error) {
    console.error('Error getting market count:', error);
    return 0;
  }
}

/**
 * Get all markets
 * @returns Promise with an array of markets
 */
export async function getAllMarkets(): Promise<Market[]> {
  try {
    const count = await getMarketCount();
    const markets: Market[] = [];
    
    const marketIds: bigint[] = [];
    for (let i = 0; i < count; i++) {
      try {
        // Explicitly type the return value as bigint
        const marketId = await publicClient.readContract({
          address: PREDICTION_MANAGER_ADDRESS,
          abi: predictionManagerAbi,
          functionName: 'getMarketIdAtIndex',
          args: [BigInt(i)]
        }) as bigint; // Type assertion
        marketIds.push(marketId);
      } catch (error) {
        console.error(`Error getting market ID at index ${i}:`, error);
      }
    }
    
    for (const marketId of marketIds) {
      try {
        const details = await getMarketDetails(marketId);
        if (details.exists) {
          markets.push(details);
        }
      } catch (error) {
        console.error(`Error getting market details for ID ${marketId}:`, error);
      }
    }
    
    return markets;
  } catch (error) {
    console.error('Error getting all markets:', error);
    return [];
  }
}

/**
 * Get details for a specific market
 * @param marketId ID of the market to get details for
 * @returns Promise with market details
 */
export async function getMarketDetails(marketId: string | bigint): Promise<Market> {
  try {
    const id = typeof marketId === 'string' ? BigInt(marketId) : marketId;
    
    // Explicitly type the return value as MarketDetailsTuple
    const details = await publicClient.readContract({
      address: PREDICTION_MANAGER_ADDRESS,
      abi: predictionManagerAbi,
      functionName: 'getMarketDetails',
      args: [id]
    }) as MarketDetailsTuple; // Type assertion
    
    const expirationTime = Number(details[6]);
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = expirationTime - now;
    
    let expirationDisplay = 'Expired';
    let status: 'Open' | 'Expired' | 'Resolved' = 'Expired';
    
    if (details[2]) { 
      status = 'Resolved';
      expirationDisplay = 'Resolved';
    } else if (timeRemaining > 0) {
      status = 'Open';
      
      const days = Math.floor(timeRemaining / 86400);
      const hours = Math.floor((timeRemaining % 86400) / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      
      if (days > 0) {
        expirationDisplay = `${days}d ${hours}h`;
      } else if (hours > 0) {
        expirationDisplay = `${hours}h ${minutes}m`;
      } else {
        expirationDisplay = `${minutes}m`;
      }
    }
    
    const priceAggregator = details[7] as Address;
    const assetPair = CHAINLINK_PRICE_FEEDS[priceAggregator.toLowerCase()] || 'Unknown';
    
    const totalStake0 = details[4];
    const totalStake1 = details[5];
    const totalStake = (totalStake0 + totalStake1) / BigInt(10**18);
    
    const priceThreshold = Number(details[8]) / 10**18;
    
    const name = `Will ${assetPair} price be above $${priceThreshold.toFixed(2)}?`;
    
    return {
      id: id.toString(),
      name,
      status,
      assetPair,
      expirationTime,
      expirationDisplay,
      priceThreshold: priceThreshold.toFixed(2),
      totalStake: totalStake.toString(),
      exists: details[1],
      resolved: details[2],
      winningOutcome: details[2] ? Number(details[3]) : undefined,
      priceAggregator
    };
  } catch (error) {
    console.error(`Error getting market details for ID ${marketId}:`, error);
    return {
      id: typeof marketId === 'string' ? marketId : marketId.toString(),
      status: 'Open',
      assetPair: 'Unknown',
      expirationTime: 0,
      expirationDisplay: 'Unknown',
      priceThreshold: '0',
      totalStake: '0',
      exists: false,
      resolved: false,
      priceAggregator: '0x0000000000000000000000000000000000000000'
    };
  }
}

/**
 * Create a new prediction market.
 * Requires the admin wallet client to send the transaction.
 * @param name The name or question for the market.
 * @param tokenA Address of the base token.
 * @param tokenB Address of the quote token.
 * @param marketEndTime The market's end time as a Unix timestamp (BigInt).
 * @param priceThreshold The target price threshold (BigInt, formatted with appropriate decimals).
 * @returns Promise with the transaction hash.
 */
export async function createMarket(
  name: string,
  tokenA: Address,
  tokenB: Address,
  marketEndTime: bigint,
  priceThreshold: bigint
): Promise<`0x${string}`> {
  try {
    console.log('[marketService] Attempting to create market with:', {
        name,
        tokenA,
        tokenB,
        marketEndTime,
        priceThreshold,
        address: PREDICTION_MANAGER_ADDRESS
    });

    const txHash = await adminClient.writeContract({
      address: PREDICTION_MANAGER_ADDRESS,
      abi: predictionManagerAbi,
      functionName: 'createMarket',
      args: [
        name,
        tokenA,
        tokenB,
        marketEndTime,
        priceThreshold
      ]
    });

    console.log('[marketService] Market creation transaction sent:', txHash);
    
    // Optional: Wait for transaction confirmation
    // const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    // console.log('[marketService] Market creation transaction confirmed:', receipt);
    // If the contract emits an event with the market ID, we could extract it here.

    return txHash;
  } catch (error) {
    console.error('[marketService] Error creating market:', error);
    // Re-throw the error so the UI layer (modal) can catch it and display feedback
    throw error; 
  }
}

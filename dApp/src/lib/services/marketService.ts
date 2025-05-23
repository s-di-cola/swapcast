// Market service for fetching and managing prediction markets
import { publicClient, adminClient } from '$lib/contract/contracts';
import type { Address, Abi } from 'viem'; 
import predictionManagerGeneratedAbi from '../../generated-abis/PredictionManager.sol/PredictionManager.abi.json';

// Get the PredictionManager address from environment variables
const PREDICTION_MANAGER_ADDRESS: Address = (import.meta.env.VITE_PREDICTIONMANAGER_ADDRESS || 
                                    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address; 

// Get the SwapCastHook address from environment variables
const SWAPCAST_HOOK_ADDRESS: Address = (import.meta.env.VITE_SWAPCAST_HOOK_ADDRESS ||
                                    '0x0000000000000000000000000000000000000000') as Address; // Replace with a sensible default or ensure it's always set

// Uniswap V4 PoolManager address (typically fixed for a given network/deployment)
const POOL_MANAGER_ADDRESS: Address = (import.meta.env.VITE_POOL_MANAGER_ADDRESS || 
                                    '0x000000000004444c5dc75cB358380D2e3dE08A90') as Address;

// Cast the imported array directly to the Abi type
const predictionManagerAbi = predictionManagerGeneratedAbi as Abi;

// Minimal ABI for IPoolManager's initialize function
const iPoolManagerAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "currency0", "type": "address" },
      { "internalType": "address", "name": "currency1", "type": "address" },
      { "internalType": "uint24", "name": "fee", "type": "uint24" },
      { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
      { "internalType": "address", "name": "hooks", "type": "address" }
    ],
    "name": "initialize",
    "outputs": [{ "internalType": "int256", "name": "tick", "type": "int256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const; // Use 'as const' for better type inference with Viem

// Import Chainlink Denominations from the contract if needed
// These are the special addresses used by Chainlink for denominations
const Denominations = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address, // Special Chainlink ETH address
  BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address, // wBTC
  LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA' as Address,
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address,
  USD: '0x0000000000000000000000000000000000000348' as Address // Special Chainlink USD address
};

// Helper function to derive tickSpacing from feeTier
function getTickSpacingFromFeeTier(feeTier: number): number {
  switch (feeTier) {
    case 100: return 1;
    case 500: return 10;
    case 3000: return 60;
    case 10000: return 200;
    default: throw new Error(`Unsupported fee tier for tick spacing: ${feeTier}`);
  }
}

// For display purposes - mapping asset pairs to readable formats
const ASSET_PAIR_DISPLAY: Record<string, string> = {
  'ETH/USD': 'ETH/USD',
  'BTC/USD': 'BTC/USD',
  'LINK/USD': 'LINK/USD',
  'USDC/USD': 'USDC/USD',
  'DAI/USD': 'DAI/USD'
};

// Helper function to get token address from symbol
function getTokenAddress(symbol: string): Address {
  const normalizedSymbol = symbol.toUpperCase();
  if (!(normalizedSymbol in Denominations)) {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }
  return Denominations[normalizedSymbol as keyof typeof Denominations];
}

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

// TypeScript interface for PoolKey, mirroring the Solidity struct
export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number; // uint24
  tickSpacing: number; // int24
  hooks: Address;
}

// TypeScript interface for MarketParams, mirroring the Solidity struct
export interface MarketParams {
  name: string;
  assetSymbol: string;
  expirationTime: bigint; // uint256
  priceAggregator: Address;
  priceThreshold: bigint; // uint256
}

// Define the expected return type for getMarketDetails based on ABI
// The contract returns: marketId, name, assetSymbol, exists, resolved, winningOutcome, totalStake0, totalStake1, expirationTime, priceAggregator, priceThreshold
type MarketDetailsTuple = readonly [bigint, string, string, boolean, boolean, number, bigint, bigint, bigint, Address, bigint];

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
    
    // Get market details from the contract
    const details = await publicClient.readContract({
      address: PREDICTION_MANAGER_ADDRESS,
      abi: predictionManagerAbi,
      functionName: 'getMarketDetails',
      args: [id]
    }) as MarketDetailsTuple;
    
    // The contract returns: marketId, name, assetSymbol, exists, resolved, winningOutcome, totalStake0, totalStake1, expirationTime, priceAggregator, priceThreshold
    console.log(`[marketService] Got market details for ID ${id}:`, details);
    
    // Extract values from the tuple
    const marketName = details[1];
    const assetSymbol = details[2];
    const exists = details[3];
    const resolved = details[4];
    const winningOutcome = details[5];
    const totalStake0 = details[6];
    const totalStake1 = details[7];
    const expirationTime = Number(details[8]);
    const priceAggregator = details[9] as Address;
    const priceThreshold = Number(details[10]) / 10**18;
    
    // Retrieve PoolKey associated with the market
    // Note: This requires adding a getter in PredictionManager.sol if you want to display it,
    // or you might already have this information if the UI constructed it.
    // For now, we'll log if it's available through an existing getter (marketToPoolKey is public)
    try {
      const poolKeyDetails = await publicClient.readContract({
        address: PREDICTION_MANAGER_ADDRESS,
        abi: predictionManagerAbi,
        functionName: 'marketToPoolKey',
        args: [id]
      }) as PoolKey; // Assuming return type matches PoolKey interface
      console.log(`[marketService] PoolKey for market ID ${id}:`, poolKeyDetails);
    } catch (e) {
      console.warn(`[marketService] Could not retrieve PoolKey for market ID ${id}:`, e);
    }
    
    // If the market doesn't exist, return early with default values
    if (!exists) {
      return {
        id: id.toString(),
        name: 'Unknown Market',
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
    
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = expirationTime - now;
    
    let expirationDisplay = 'Expired';
    let status: 'Open' | 'Expired' | 'Resolved' = 'Expired';
    
    if (resolved) { 
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
    
    // Calculate total stake
    const totalStake = (totalStake0 + totalStake1) / BigInt(10**18);
    
    return {
      id: id.toString(),
      name: marketName,
      status,
      assetPair: assetSymbol, // Use the asset symbol from the contract
      expirationTime,
      expirationDisplay,
      priceThreshold: priceThreshold.toFixed(2),
      totalStake: totalStake.toString(),
      exists, // Boolean from the contract
      resolved, // Boolean from the contract
      winningOutcome: resolved ? winningOutcome : undefined,
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
 * Creates a new prediction market in the PredictionManager contract.
 *
 * @param marketId - The unique identifier for the market.
 * @param marketParamsInput - The parameters for the market (name, assetSymbol, expiration, etc.).
 * @param poolKeyParams - The parameters to construct the PoolKey (token0Sym, token1Sym, feeTier).
 * @param account - The address of the account creating the market.
 * @returns Promise with the transaction hash of the market creation, or undefined on error.
 */
export async function createMarketInPredictionManager(
  marketId: bigint,
  marketParamsInput: {
    name: string;
    assetSymbol: string; // e.g., "ETH/USD"
    expirationTime: number; // Unix timestamp in seconds
    priceAggregator: Address;
    priceThreshold: number; // The threshold price, e.g., 3000 for ETH/USD > $3000.
    priceThresholdDecimals?: number; // Decimals of the price threshold (e.g., 18 for standard tokens, 8 for price feeds)
  },
  poolKeyParams: {
    token0Symbol: string; // e.g., "WETH" or "USDC"
    token1Symbol: string; // e.g., "USDC"
    feeTier: number; // e.g., 3000 for 0.3%
  },
  account: Address
): Promise<{ marketCreationTxHash: Address; poolInitTxHash: Address } | undefined> {
  try {
    if (!SWAPCAST_HOOK_ADDRESS || SWAPCAST_HOOK_ADDRESS === '0x0000000000000000000000000000000000000000') {
      throw new Error('SwapCast Hook address is not configured. Set VITE_SWAPCAST_HOOK_ADDRESS.');
    }

    let currency0Address = getTokenAddress(poolKeyParams.token0Symbol);
    let currency1Address = getTokenAddress(poolKeyParams.token1Symbol);

    // Ensure currency0 is less than currency1 for the PoolKey
    if (currency0Address.toLowerCase() > currency1Address.toLowerCase()) {
      [currency0Address, currency1Address] = [currency1Address, currency0Address];
    } else if (currency0Address.toLowerCase() === currency1Address.toLowerCase()) {
      throw new Error('Token0 and Token1 cannot be the same for the pool.');
    }
    
    const poolKey: PoolKey = {
      currency0: currency0Address,
      currency1: currency1Address,
      fee: poolKeyParams.feeTier,
      tickSpacing: getTickSpacingFromFeeTier(poolKeyParams.feeTier),
      hooks: SWAPCAST_HOOK_ADDRESS
    };

    // Determine the decimals for the price threshold. Default to 18 if not provided.
    // This might need to align with how your priceAggregator reports prices (e.g., Chainlink feeds often use 8 decimals).
    const thresholdDecimals = marketParamsInput.priceThresholdDecimals ?? 18;
    const priceThresholdBigInt = BigInt(Math.floor(marketParamsInput.priceThreshold * (10 ** thresholdDecimals)));

    const paramsForContract: MarketParams = {
      name: marketParamsInput.name,
      assetSymbol: marketParamsInput.assetSymbol,
      expirationTime: BigInt(marketParamsInput.expirationTime),
      priceAggregator: marketParamsInput.priceAggregator,
      priceThreshold: priceThresholdBigInt
    };

    console.log('[marketService] Creating market with ID:', marketId);
    console.log('[marketService] MarketParams:', paramsForContract);
    console.log('[marketService] PoolKey:', poolKey);
    
    // Step 1: Create the market in PredictionManager
    console.log('[marketService] Sending transaction to create market in PredictionManager...');
    const marketCreationTxHash = await adminClient.writeContract({
      address: PREDICTION_MANAGER_ADDRESS,
      abi: predictionManagerAbi,
      functionName: 'createMarket',
      args: [marketId, paramsForContract, poolKey],
      account: account, // Account performing the transaction
    });
    
    console.log(`[marketService] Market creation transaction sent. Hash: ${marketCreationTxHash}`);
    console.log('[marketService] Waiting for market creation transaction to be confirmed...');
    const marketCreationReceipt = await publicClient.waitForTransactionReceipt({ hash: marketCreationTxHash });
    console.log('[marketService] Market creation transaction confirmed:', marketCreationReceipt);

    if (marketCreationReceipt.status !== 'success') {
      throw new Error(`Market creation transaction failed. Status: ${marketCreationReceipt.status}`);
    }

    // Step 2: Initialize the pool in Uniswap V4 PoolManager
    console.log('[marketService] Sending transaction to initialize pool in PoolManager...');
    const poolInitTxHash = await adminClient.writeContract({
      address: POOL_MANAGER_ADDRESS,
      abi: iPoolManagerAbi,
      functionName: 'initialize',
      args: [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
      account: account,
    });
    
    console.log(`[marketService] Pool initialization transaction sent. Hash: ${poolInitTxHash}`);
    console.log('[marketService] Waiting for pool initialization transaction to be confirmed...');
    const poolInitReceipt = await publicClient.waitForTransactionReceipt({ hash: poolInitTxHash });
    console.log('[marketService] Pool initialization transaction confirmed:', poolInitReceipt);

    if (poolInitReceipt.status !== 'success') {
      throw new Error(`Pool initialization transaction failed. Status: ${poolInitReceipt.status}`);
    }

    return { marketCreationTxHash, poolInitTxHash };
  
  } catch (error) {
    console.error('Error in createMarketInPredictionManager:', error);
    // Propagate the error so the UI can handle it
    throw error; 
  }
}

/**
 * Create a new prediction market using the contract's createMarket function
 * @param name Market name/description
 * @param assetSymbol Symbol of the asset being predicted (e.g., 'ETH/USD')
 * @param expirationTime Unix timestamp when the market expires
 * @param priceAggregator Address of the Chainlink price feed
 * @param priceThreshold Target price threshold for the market
 * @param feeTier Fee tier for the market
 * @param tickSpacing Tick spacing for the market
 * @returns Object containing success status, market ID, and transaction hash
 */
// Keep track of the last nonce used to avoid nonce conflicts
let lastNonce = -1;

/**
 * Get the next available nonce for transactions
 * This helps prevent "nonce too low" errors when sending multiple transactions
 */
async function getNextNonce(): Promise<number> {
  try {
    // Get the current nonce from the blockchain
    const currentNonce = await publicClient.getTransactionCount({
      address: adminClient.account?.address as `0x${string}`
    });
    
    // Use the higher of the current blockchain nonce or our tracked lastNonce + 1
    const nextNonce = Math.max(currentNonce, lastNonce + 1);
    
    // Update our lastNonce tracker
    lastNonce = nextNonce;
    
    console.log(`[marketService] Using nonce: ${nextNonce}`);
    return nextNonce;
  } catch (error) {
    console.error('[marketService] Error getting next nonce:', error);
    // If we can't get the nonce, return a safe increment
    return lastNonce + 1;
  }
}

export async function createMarket(
  name: string,
  assetSymbol: string,
  expirationTime: bigint,
  priceAggregator: `0x${string}`,
  priceThreshold: bigint,
  feeTier: number,
  tickSpacing: number
): Promise<{ success: boolean, marketId: string, txHash?: `0x${string}`, error?: string }> {
  try {
    // Generate a unique market ID based on timestamp
    const marketId = BigInt(Date.now());
    
    console.log('[marketService] Creating market with parameters:', {
      marketId: marketId.toString(),
      name,
      assetSymbol,
      expirationTime: new Date(Number(expirationTime) * 1000).toISOString(),
      priceAggregator,
      priceThreshold: priceThreshold.toString(),
      feeTier,
      tickSpacing
    });
    
    // Get the next available nonce
    const nonce = await getNextNonce();
    
    // Send the transaction using the contract's createMarket function with the specific nonce
    const hash = await adminClient.writeContract({
      address: PREDICTION_MANAGER_ADDRESS,
      abi: predictionManagerAbi,
      functionName: 'createMarket',
      args: [marketId, name, assetSymbol, expirationTime, priceAggregator, priceThreshold, feeTier, tickSpacing],
      nonce
    });
    
    console.log(`Created market with ID: ${marketId.toString()}`);
    
    return {
      success: true,
      marketId: marketId.toString(),
      txHash: hash
    };
  } catch (error: any) {
    console.error('[marketService] Error creating market:', error);
    return {
      success: false,
      marketId: '0',
      error: error.message
    };
  }
}

/**
 * Create a new prediction market from the UI parameters
 * @param marketName Name of the market
 * @param priceFeedKey Key for the price feed (e.g., 'ETH/USD')
 * @param expirationTime Expiration time of the market
 * @param priceThreshold Target price threshold for the market
 * @param feeTier Fee tier for the market
 * @returns Object containing success status, market ID, and transaction hash
 */
export async function createMarketFromUI(
  marketName: string,
  priceFeedKey: string,
  expirationTime: Date,
  priceThreshold: string,
  feeTier: number
): Promise<{ success: boolean; message: string; marketId?: string }> {
  try {
    // Parse the price feed key to get base and quote tokens
    const [baseToken, quoteToken] = priceFeedKey.split('/');
    
    // Derive tickSpacing from feeTier
    const tickSpacing = getTickSpacingFromFeeTier(feeTier);

    // For price aggregator, we'll use the base token address
    let priceAggregator: Address;
    
    // Get the base token address using our helper function
    if (baseToken) {
      priceAggregator = getTokenAddress(baseToken);
      console.log(`[marketService] Creating market for ${priceFeedKey} with base token address: ${priceAggregator}`);
    } else {
      // Default to ETH if no base token is specified
      priceAggregator = Denominations.ETH;
      console.log(`[marketService] No base token specified, defaulting to ETH: ${priceAggregator}`);
    }
    
    // Create asset symbol from token addresses
    const assetSymbol = priceFeedKey;
    
    // Convert price threshold to wei (assuming 18 decimals)
    const priceThresholdInWei = BigInt(parseFloat(priceThreshold) * 10**18);
    
    // Format expiration time as Unix timestamp (seconds)
    const expirationTimeUnix = BigInt(Math.floor(expirationTime.getTime() / 1000));
    
    console.log(`[marketService] Creating market with parameters: ${JSON.stringify({
      name: marketName,
      assetSymbol,
      expirationTime: expirationTime.toISOString(),
      priceAggregator,
      priceThreshold: priceThresholdInWei.toString(),
      feeTier,
      tickSpacing
    })}`);
    
    // Call the createMarket function with the correct parameters
    const result = await createMarket(
      marketName,
      assetSymbol,
      expirationTimeUnix,
      priceAggregator,
      priceThresholdInWei,
      feeTier,
      tickSpacing
    );
    
    if (result.success) {
      return {
        success: true,
        message: `Market created successfully! Market ID: ${result.marketId}`,
        marketId: result.marketId
      };
    } else {
      return {
        success: false,
        message: `Error creating market: ${result.error || 'Unknown error'}`
      };
    }
  } catch (error: any) {
    console.error('[marketService] Error creating market from UI:', error);
    return {
      success: false,
      message: `Error creating market: ${error.message}`
    };
  }
}

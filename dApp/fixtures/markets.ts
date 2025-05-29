/**
 * Market Generation
 *
 * Creates markets and associated Uniswap v4 pools for testing
 */

import { type Address, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from './utils/wallets';
import { getTickSpacing } from './utils/helpers';
import { getCurrentPrice, calculateRealisticPriceThreshold } from './utils/currentPrice';
import { getPoolManager } from '../src/generated/types/PoolManager';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import chalk from 'chalk';

// Asset pairs for markets
const ASSET_PAIRS = [
  {
    name: 'ETH/USD',
    symbol: 'ETH',
    token0: TOKEN_ADDRESSES.WETH,
    token1: TOKEN_ADDRESSES.USDC,
    fee: 3000
  },
  {
    name: 'BTC/USD',
    symbol: 'BTC',
    token0: TOKEN_ADDRESSES.WBTC,
    token1: TOKEN_ADDRESSES.USDC,
    fee: 3000
  },
  {
    name: 'ETH/DAI',
    symbol: 'ETH',
    token0: TOKEN_ADDRESSES.WETH,
    token1: TOKEN_ADDRESSES.DAI,
    fee: 3000
  },
  {
    name: 'BTC/DAI',
    symbol: 'BTC',
    token0: TOKEN_ADDRESSES.WBTC,
    token1: TOKEN_ADDRESSES.DAI,
    fee: 3000
  }
];

// Market creation result type
export type MarketCreationResult = {
  id: string | bigint;
  name: string;
  assetSymbol: string;
  expirationTime: bigint;
  priceThreshold: bigint;
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
};

/**
 * Creates a Uniswap v4 pool for a market
 */
export async function createPool(
  adminAccount: any,
  token0: Address,
  token1: Address,
  fee: number
): Promise<any> {
  console.log(chalk.yellow(`Creating pool for ${token0}/${token1} with fee ${fee}...`));
  
  // Get the PoolManager contract
  const poolManager = getPoolManager({
    address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });

  // Calculate tick spacing based on fee
  const tickSpacing = getTickSpacing(fee);

  // Create the pool key
  const poolKey = {
    currency0: token0,
    currency1: token1,
    fee: fee,
    tickSpacing: tickSpacing,
    hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
  };

  try {
    // Initialize the pool
    console.log(chalk.yellow(`Attempting to initialize pool directly...`));
    const hash = await poolManager.write.initialize([poolKey, 0n], {
      account: adminAccount.address,
      chain: anvil
    });
    
    console.log(chalk.green(`Pool initialized successfully with hash: ${hash}`));
    return poolKey;
  } catch (error: any) {
    console.error(chalk.red(`Failed to initialize pool: ${error.message}`));
    throw error;
  }
}

/**
 * Creates a market with the PredictionManager contract
 */
export async function createMarket(
  adminAccount: any,
  name: string,
  assetSymbol: string,
  expirationTime: bigint,
  priceAggregator: Address,
  priceThreshold: bigint,
  poolKey: any
): Promise<MarketCreationResult> {
  // Get the PredictionManager contract
  const predictionManager = getPredictionManager({
    address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });

  try {
    // Create the market
    console.log(chalk.yellow(`Creating market "${name}" with expiration ${expirationTime}...`));
    
    // Send the transaction
    const hash = await predictionManager.write.createMarket(
      [name, assetSymbol, expirationTime, priceAggregator, priceThreshold, poolKey],
      {
        account: adminAccount.address,
        chain: anvil
      }
    );
    
    // Wait for transaction confirmation
    const publicClient = createPublicClient({
      chain: anvil,
      transport: http(anvil.rpcUrls.default.http[0])
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Get the market ID (latest market)
    const marketCount = await predictionManager.read.getMarketCount();
    const marketId = marketCount - 1n;
    
    console.log(chalk.green(`Market created successfully with ID: ${marketId}`));
    
    return {
      id: marketId,
      name,
      assetSymbol,
      expirationTime,
      priceThreshold,
      poolKey
    };
  } catch (error: any) {
    console.error(chalk.red(`Failed to create market: ${error.message}`));
    throw error;
  }
}

/**
 * Generates markets and pools for testing
 */
export async function generateMarkets(adminAccount: any, count: number = 5): Promise<MarketCreationResult[]> {
  console.log(chalk.yellow(`Generating ${count} markets...`));
  
  const markets: MarketCreationResult[] = [];
  const actualCount = Math.min(count, ASSET_PAIRS.length);
  
  for (let i = 0; i < actualCount; i++) {
    console.log(chalk.yellow(`Processing market ${i+1}/${actualCount}: ${ASSET_PAIRS[i].name}`));
    
    try {
      // Create pool for the market
      let poolCreated = false;
      let poolKey;
      let attempts = 0;
      
      while (!poolCreated && attempts < 3) {
        attempts++;
        console.log(chalk.yellow(`Attempt ${attempts}/3 to create pool for ${ASSET_PAIRS[i].name}`));
        
        try {
          poolKey = await createPool(
            adminAccount,
            ASSET_PAIRS[i].token0,
            ASSET_PAIRS[i].token1,
            ASSET_PAIRS[i].fee
          );
          poolCreated = true;
        } catch (poolError: any) {
          console.error(chalk.red(`Pool creation failed: ${poolError.message}`));
          if (attempts >= 3) throw poolError;
        }
      }
      
      if (!poolCreated || !poolKey) {
        throw new Error(`Failed to create pool after ${attempts} attempts`);
      }
      
      // Fetch current price for the asset
      console.log(chalk.yellow(`Fetching current price for ${ASSET_PAIRS[i].symbol}...`));
      const currentPrice = await getCurrentPrice(ASSET_PAIRS[i].symbol);
      console.log(chalk.blue(`Current price for ${ASSET_PAIRS[i].symbol}: $${currentPrice}`));
      
      // Calculate a realistic price threshold (percentage deviation from current price)
      const priceThreshold = calculateRealisticPriceThreshold(currentPrice);
      console.log(chalk.blue(`Using price threshold of ${priceThreshold}% for ${ASSET_PAIRS[i].symbol}`));
      
      // Create the market
      console.log(chalk.yellow(`Creating market for ${ASSET_PAIRS[i].name}...`));
      
      // Set expiration time to 30 days from now
      const expirationTime = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
      
      const market = await createMarket(
        adminAccount,
        `${ASSET_PAIRS[i].name} Market`,
        ASSET_PAIRS[i].symbol,
        expirationTime,
        CONTRACT_ADDRESSES.ORACLE_RESOLVER as Address,
        BigInt(Math.floor(priceThreshold * 100)), // Convert to basis points as integer
        poolKey
      );
      
      console.log(chalk.green(`Successfully created market for ${ASSET_PAIRS[i].name}`));
      markets.push(market);
    } catch (error: any) {
      console.error(chalk.red(`Failed to generate market ${i+1}: ${error.message}`));
    }
  }
  
  console.log(chalk.green(`Generated ${markets.length}/${actualCount} markets successfully`));
  return markets;
}

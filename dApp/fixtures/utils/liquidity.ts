/**
 * Uniswap V4 Liquidity Provision
 *
 * Provides functionality for creating pools and adding liquidity to Uniswap V4
 * using the Position Manager contract with proper action encoding and delta resolution.
 */

import { TickMath } from "@uniswap/v3-sdk";
import { Pool, PoolKey, Position, V4PositionPlanner } from "@uniswap/v4-sdk";
import { Address, decodeAbiParameters, erc20Abi, Hash, http, parseUnits } from 'viem';
import { anvil } from 'viem/chains';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { PriceService } from '../services/price';
import { getPublicClient, getWalletClient } from './client';
import { logInfo, logSuccess, logWarning } from './error';
import { calculateSqrtPriceX96FromUSDPrices, } from './math';
import { approveToken, dealLiquidity, getTokenFromAddress, NATIVE_ETH_ADDRESS } from './tokens';
import { ANVIL_ACCOUNTS, CONTRACT_ADDRESSES } from './wallets';
import { getIPositionManager } from '../../src/generated/types/IPositionManager';
import { getStateView } from '../../src/generated/types/StateView';

/**
 * Initializes a Uniswap V4 pool with the specified price
 * @param token0Address - Address of token0
 * @param token1Address - Address of token1
 * @returns Pool initialization data including sqrtPriceX96 and current tick
 */
const initializePool = async (
  token0Address: Address,
  token1Address: Address,
): Promise<Pool> => {
  try {
    const priceService = new PriceService();

    // Get token info
    const token0 = await getTokenFromAddress(token0Address);
    const token1 = await getTokenFromAddress(token1Address);

    // Get current prices
    const token0Price = await priceService.getPrice(token0.symbol!);
    const token1Price = await priceService.getPrice(token1.symbol!);
    if (!token0Price || !token1Price) {
      throw new Error(`Failed to fetch prices for tokens ${token0.symbol} and ${token1.symbol}`);
    }

    const sqrtPriceX96 = calculateSqrtPriceX96FromUSDPrices(token0Price, token1Price);
    const tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

    logInfo('PoolInitialization', `Initializing pool ${token0.symbol}/${token1.symbol} with sqrtPriceX96: ${sqrtPriceX96}`);

    const pool = new Pool(token0, token1, 3000, 60, CONTRACT_ADDRESSES.SWAPCAST_HOOK!, sqrtPriceX96.toString(), 0, tick);

    const poolManager = getPoolManager({
      address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
      chain: anvil
    });

    const tx = await poolManager.write.initialize(
      [{
        currency0: pool.poolKey.currency0 as `0x${string}`,
        currency1: pool.poolKey.currency1 as `0x${string}`,
        fee: pool.poolKey.fee,
        tickSpacing: pool.poolKey.tickSpacing,
        hooks: pool.poolKey.hooks as `0x${string}`
      }, BigInt(pool.sqrtRatioX96.toString())], // Convert JSBI to bigint
      {
        account: ANVIL_ACCOUNTS[0].address as `0x${string}`,
        chain: anvil
      }
    );

    const receipt = await getPublicClient().waitForTransactionReceipt({ hash: tx });

    if (receipt.status !== 'success') {
      throw new Error(`Pool initialization failed with status: ${receipt.status}`);
    }

    logSuccess('PoolInitialization', `Pool initialized successfully: ${JSON.stringify(pool)}`);
    return pool;
  } catch (error) {
    logWarning('PoolInitialization', `Pool initialization failed: ${error}`);
    throw error;
  }
};

/**
 * Get position parameters for a given pool
 * 
 * @param pool  The pool to get position parameters for 
 * @returns Position parameters
 */
function getPositionParams(pool: Pool): {
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
} {

  // Get current tick and round it to the nearest tick spacing
  const currentTick = pool.tickCurrent;
  const tickSpacing = pool.tickSpacing;

  const tickLower = Math.floor(currentTick / tickSpacing) * tickSpacing - (tickSpacing * 10);
  const tickUpper = Math.ceil(currentTick / tickSpacing) * tickSpacing + (tickSpacing * 10);


  const amount0Desired = parseUnits("1000", pool.token0.decimals); // e.g., 100 of token0
  const amount1Desired = parseUnits("1000", pool.token1.decimals); // e.g., 100 of token1

  const position = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: amount0Desired.toString(),
    amount1: amount1Desired.toString(),
    useFullPrecision: true // Use full precision for the calculation
  });

  const mintAmounts = position.mintAmounts;
  const liquidity = position.liquidity;

  return {
    tickLower,
    tickUpper,
    liquidity: liquidity.toString(),
    amount0: mintAmounts.amount0.toString(),
    amount1: mintAmounts.amount1.toString(),
  };
}

/**
 * Adds liquidity to a Uniswap V4 pool using the Position Manager
 * @param pool - The pool to add liquidity to
 * @returns Transaction hash of the liquidity addition
 */
const addLiquidity = async (pool: Pool): Promise<void> => {
  try {
    const positionParams = getPositionParams(pool);
    const token0Address = pool.token0.isToken ? pool.token0.address : NATIVE_ETH_ADDRESS;
    const token1Address = pool.token1.isToken ? pool.token1.address : NATIVE_ETH_ADDRESS;
    const amount0 = BigInt(positionParams.amount0)
    const amount1 = BigInt(positionParams.amount1)

    // Simplified native ETH detection
    const isToken0Native = token0Address === NATIVE_ETH_ADDRESS;
    const isToken1Native = token1Address === NATIVE_ETH_ADDRESS;

    const liquidityProvider = ANVIL_ACCOUNTS[1].address;
    await dealLiquidity(liquidityProvider, token0Address as Address, token1Address as Address, amount0, amount1);

    // Approve tokens - skip for native ETH
    if (!isToken0Native) {
      await approveToken(liquidityProvider, token0Address as Address, amount0);
    }
    if (!isToken1Native) {
      await approveToken(liquidityProvider, token1Address as Address, amount1);
    }

    const planner = new V4PositionPlanner();

    planner.addMint(
      pool,
      positionParams.tickLower,
      positionParams.tickUpper,
      positionParams.liquidity,
      positionParams.amount0,
      positionParams.amount1,
      liquidityProvider
    );

    planner.addSettlePair(pool.currency0, pool.currency1);

    if (isToken0Native || isToken1Native) {
      const nativeCurrency = isToken0Native ? pool.currency0 : pool.currency1;
      planner.addSweep(nativeCurrency, liquidityProvider);
    }

    const unlockData = planner.finalize() as `0x${string}`;
    const latestBlock = await getPublicClient().getBlock({ blockTag: 'latest' });
    const currentTimestamp = Number(latestBlock.timestamp);
    const deadline = BigInt(currentTimestamp + 300); // 5 minutes from block time

    const positionManager = getIPositionManager({
      address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      chain: anvil
    });

    // Calculate ETH value to send
    const ethValue = isToken0Native ? amount0 : (isToken1Native ? amount1 : 0n);

    const hash = await positionManager.write.modifyLiquidities([unlockData, deadline], {
      account: liquidityProvider,
      chain: anvil,
      value: ethValue,
      gas: 1000000n
    });

    const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`Liquidity addition failed with status: ${receipt.status}`);
    }
    logSuccess('LiquidityProvision', `Liquidity added successfully!`);
    await logPoolLiquidity(pool);
    await logPoolState(pool);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('LiquidityProvision', `Failed to add liquidity: ${errorMessage}`);
    throw new Error(`addLiquidity failed: ${errorMessage}`);
  }
};


/**
 * Logs the liquidity for a given pool
 * @param pool The pool to log liquidity for
 */
async function logPoolLiquidity(pool: Pool) {
  logInfo('LogPoolLiquidity', `Checking liquidity for pool ${pool.poolKey.currency0}/${pool.poolKey.currency1}`);
  const stateview = getStateView({
    address: CONTRACT_ADDRESSES.STATE_VIEW as Address,
    chain: anvil
  });

  const liquidity = await stateview.read.getLiquidity([pool.poolId as `0x${string}`]);

  // Format the number for readability
  const liquidityStr = liquidity.toString();
  const formatted = Number(liquidityStr).toLocaleString();

  logInfo('LogPoolLiquidity', `Liquidity: ${liquidityStr} (${formatted} units)`);
  logSuccess('LogPoolLiquidity', `✅ Pool has substantial liquidity!`);
}


/**
 * Logs the state for a given pool
 * @param pool The pool to log state for
 */
async function logPoolState(pool: Pool) {
  logInfo('LogPoolState', `Checking state for pool ${pool.poolKey.currency0}/${pool.poolKey.currency1}`);
  const stateview = getStateView({
    address: CONTRACT_ADDRESSES.STATE_VIEW as Address,
    chain: anvil
  });

  const state = await stateview.read.getSlot0([pool.poolId as `0x${string}`]);

  logInfo('LogPoolState', `State: ${state.map((value) => value.toString())}`);
  logSuccess('LogPoolState', `✅ Pool state checked!`);
}



/**
 * Creates a pool and adds initial liquidity
 * @param token0Address - Address of the first token
 * @param token1Address - Address of the second token
 * @returns The created pool
 */
const mintPool = async (
  token0Address: Address,
  token1Address: Address,
): Promise<Pool> => {
  try {
    const pool = await initializePool(token0Address, token1Address);
    await addLiquidity(pool);
    return pool;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('MintPool', `Failed to mint pool: ${errorMessage}`);
    throw new Error(`mintPool failed: ${errorMessage}`);
  }
};

export {
  mintPool
};



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
import { dealLiquidity, getTokenFromAddress, NATIVE_ETH_ADDRESS } from './tokens';
import { ANVIL_ACCOUNTS, CONTRACT_ADDRESSES } from './wallets';
import { getIPositionManager } from '../../src/generated/types/IPositionManager';

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

    const sqrtPriceX96 = calculateSqrtPriceX96FromUSDPrices(token0Price, token1Price, token0.decimals, token1.decimals);
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


async function approveToken(account: Address, tokenAddress: Address, amount: bigint) {
  const walletClient = getWalletClient(account);
  
  // First approve Permit2 contract (not position manager directly)
  const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Canonical Permit2
  
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [permit2Address, amount], // Approve Permit2, not position manager
    account: account,
    chain: anvil,
  });
  
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Approve token failed with status: ${receipt.status}`);
  }
  
  // Then approve position manager through Permit2 with longer deadline
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const expiration = BigInt(currentTimestamp + 86400); // 24 hours, not 5 minutes
  
  const hash2 = await walletClient.writeContract({
    address: permit2Address,
    abi: [
      {
        name: 'approve',
        type: 'function',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' }
        ],
        outputs: []
      }
    ],
    functionName: 'approve',
    args: [tokenAddress, CONTRACT_ADDRESSES.POSITION_MANAGER as Address, amount, expiration],
    account: account,
    chain: anvil,
  });
  
  const receipt2 = await getPublicClient().waitForTransactionReceipt({ hash: hash2 });
  if (receipt2.status !== 'success') {
    throw new Error(`Permit2 approve failed with status: ${receipt2.status}`);
  }
  
  logSuccess('ApproveToken', `Approved token ${tokenAddress} for position manager via Permit2`);
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
    const amount0 = parseUnits(positionParams.amount0, pool.token0.decimals);
    const amount1 = parseUnits(positionParams.amount1, pool.token1.decimals);

    const liquidityProvider = ANVIL_ACCOUNTS[1].address;
    await dealLiquidity(liquidityProvider, token0Address as Address, token1Address as Address, amount0, amount1);

    // Approve for POSITION MANAGER
    if (!pool.token0.isNative) {
      await approveToken(liquidityProvider, token0Address as Address, amount0);
    }
    if (!pool.token1.isNative) {
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
    
    if (pool.token0.isNative || pool.token1.isNative) {
      const nativeCurrency = pool.token0.isNative ? pool.currency0 : pool.currency1;
      planner.addSweep(nativeCurrency, liquidityProvider);
    }

    const unlockData = planner.finalize() as `0x${string}`;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadline = BigInt(currentTimestamp + 300);

    const positionManager = getIPositionManager({
      address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      chain: anvil
    });

    const hash = await positionManager.write.modifyLiquidities([unlockData, deadline], {
      account: liquidityProvider,
      chain: anvil,
      value: pool.token0.isNative ? amount0 : (pool.token1.isNative ? amount1 : 0n),
      gas: 1000000n
    });

    const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`Liquidity addition failed with status: ${receipt.status}`);
    }
    logSuccess('LiquidityProvision', `Liquidity added successfully!`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('LiquidityProvision', `Failed to add liquidity: ${errorMessage}`);
    throw new Error(`addLiquidity failed: ${errorMessage}`);
  }
};

/**
 * Creates a pool and adds initial liquidity
 * @param token0Address - Address of the first token
 * @param token1Address - Address of the second token
 * @returns Transaction hash of the liquidity addition
 */
const mintPool = async (
  token0Address: Address,
  token1Address: Address,
): Promise<PoolKey> => {
  try {
    const pool = await initializePool(token0Address, token1Address);
    await addLiquidity(pool);
    return pool.poolKey;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('MintPool', `Failed to mint pool: ${errorMessage}`);
    throw new Error(`mintPool failed: ${errorMessage}`);
  }
};

export {
  mintPool
};



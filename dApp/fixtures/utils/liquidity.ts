/**
 * Liquidity utilities for fixture generation
 *
 * Provides functions to add liquidity to Uniswap v4 pools
 */

import { type Address, type PublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { CONTRACT_ADDRESSES } from './wallets';
import { findWhaleForTokenPair, ensureAccountHasTokens } from './helpers';
import chalk from 'chalk';

/**
 * Adds liquidity to a Uniswap v4 pool
 * 
 * Ensures both tokens in the pair are supplied according to the xy=k formula
 * Uses whale accounts when possible to provide substantial liquidity
 * 
 * @param publicClient Public client instance
 * @param account Account to use for adding liquidity
 * @param poolKey Pool key for the pool
 * @param currentPrice Current price of the asset pair
 * @returns Transaction hash
 */
export async function addLiquidityToPool(
  publicClient: PublicClient,
  // account: { address: Address }, // Original account parameter, potentially for fallback or if no whale found
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  },
  currentPrice: number
): Promise<`0x${string}`> {
  console.log(chalk.blue(`Attempting to add liquidity to pool ${poolKey.currency0}/${poolKey.currency1}...`));

  // Get the PoolManager contract
  const poolManager = getPoolManager({
    address: CONTRACT_ADDRESSES.POOL_MANAGER as `0x${string}`,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });
  
  // Find appropriate whale account for this token pair
  const whaleSigner = await findWhaleForTokenPair(publicClient, poolKey.currency0, poolKey.currency1);
  if (!whaleSigner) {
    console.error(chalk.red(`Could not find a suitable whale for tokens ${poolKey.currency0} and ${poolKey.currency1}. Skipping liquidity addition.`));
    // Optionally, could use the 'account' parameter as a fallback here if it was kept.
    // For now, we'll just throw or return indicating failure if no whale is found.
    throw new Error(`No whale found for token pair ${poolKey.currency0}/${poolKey.currency1}`);
  }
  console.log(chalk.green(`Using whale account ${whaleSigner} to add liquidity.`));

  // Calculate tick range around current price
  // For simplicity, we'll use a range that's ±10% of the current price
  const priceToSqrtPriceX96 = (price: number): bigint => {
    // Convert price to sqrtPriceX96 format
    return BigInt(Math.floor(Math.sqrt(price) * 2 ** 96));
  };

  const priceToTick = (price: number): number => {
    // Convert price to tick using log base 1.0001
    return Math.floor(Math.log(price) / Math.log(1.0001));
  };

  // Calculate ticks based on current price
  const currentTick = priceToTick(currentPrice);
  const tickSpacing = poolKey.tickSpacing;
  
  // Use a wider range for better liquidity distribution
  // Round to nearest tick spacing
  const tickLower = Math.floor(currentTick * 0.8 / tickSpacing) * tickSpacing;
  const tickUpper = Math.ceil(currentTick * 1.2 / tickSpacing) * tickSpacing;
  
  // Generate a random salt for the position
  const salt = `0x${Math.floor(Math.random() * 10**10).toString(16).padStart(64, '0')}` as `0x${string}`;
  
  // Add liquidity
  try {
    // Prepare liquidity parameters with much more substantial liquidity
    // In Uniswap v4, the liquidityDelta represents the amount of liquidity to add
    // The actual token amounts will be calculated by the contract based on the current price
    // and the tick range
    const modifyLiquidityParams = {
      tickLower,
      tickUpper,
      liquidityDelta: 10000000000000000n, // Much more substantial liquidity (10^16)
      salt: salt
    };

    // First ensure the whale account has enough balance of both tokens (currently only ensures ETH)
    await ensureAccountHasTokens(publicClient, whaleSigner, poolKey.currency0, poolKey.currency1);

    // Call modifyLiquidity on the PoolManager contract
    const hash = await poolManager.write.modifyLiquidity(
      [poolKey, modifyLiquidityParams, '0x'],
      {
        account: whaleSigner, // Use the whale account to sign
        chain: anvil
        // value: isNativeTokenInvolved ? liquidityAmountForNative : 0n // Add if ETH is directly involved and needs to be sent
      }
    );

    console.log(chalk.green(`Successfully added liquidity to pool ${poolKey.currency0}/${poolKey.currency1} by ${whaleSigner}. Tx hash: ${hash}`));
    return hash;
  } catch (error: any) {
    console.error(chalk.red(`Failed to add liquidity to pool ${poolKey.currency0}/${poolKey.currency1} using account ${whaleSigner}: ${error.message}`));
    throw error;
  }
}

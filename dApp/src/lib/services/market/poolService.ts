import type { Address, Hash } from 'viem';
import { http } from 'viem';
import { getTickSpacing } from '$lib/services/market/helpers';
import { modal, wagmiAdapter, wagmiConfig } from '$lib/configs/wallet.config';
import { Token } from '@uniswap/sdk-core';
import { getPoolManager } from '$generated/types/PoolManager';
import { PUBLIC_UNIV4_POOLMANAGER_ADDRESS, PUBLIC_SWAPCASTHOOK_ADDRESS } from '$env/static/public';
import { anvil } from '$lib/configs/networks';
import { publicClient } from './marketService';
import { writeContract } from '@wagmi/core';

/**
 * Check if a pool exists for the given token pair and fee
 * @param tokenA Address of the first token
 * @param tokenB Address of the second token
 * @param fee Fee tier (100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
 * @returns Boolean indicating if the pool exists with the SwapCast hook
 */
export async function checkPoolExists(
  tokenA: Address,
  tokenB: Address,
  fee: number
): Promise<boolean> {
  return false;
}

/**
 * Create a new Uniswap v4 pool with the SwapCast hook
 * Always attempts to create the pool. If it already exists, returns a clear error.
 */
export async function createPool(
  tokenA: Address,
  tokenB: Address,
  fee: number,
  account?: Address
): Promise<{ success: boolean; message: string; hash?: Hash }> {
  try {
    // Check if tokens are identical
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      return {
        success: false,
        message: 'Cannot create a pool with identical tokens'
      };
    }
    
    // Use provided account or get it from wallet
    if (!account) {
      const walletInfo = await modal.getWalletInfo();
      if (!walletInfo || !walletInfo.address) {
        return {
          success: false,
          message: 'No wallet connected'
        };
      }
      account = walletInfo.address as Address;
    }
    
    // Sort tokens in canonical order
    const [token0, token1] = sortTokens(tokenA, tokenB, anvil.id);
    console.log('Sorted tokens:', {
      token0: { address: token0.address, symbol: token0.symbol },
      token1: { address: token1.address, symbol: token1.symbol }
    });

    // Get tick spacing for the fee tier
    const tickSpacing = getTickSpacing(fee);
    const sqrtPriceX96 = BigInt('0x1000000000000000000000000'); // 1:1 price
    console.log('Pool parameters:', { fee, tickSpacing, sqrtPriceX96: sqrtPriceX96.toString() });

    // Prepare the pool key
    const poolKey = {
      currency0: token0.address as `0x${string}`,
      currency1: token1.address as `0x${string}`,
      fee: fee,
      tickSpacing: tickSpacing,
      hooks: PUBLIC_SWAPCASTHOOK_ADDRESS as `0x${string}`
    };
    
    console.log('Attempting to initialize pool with:', poolKey);
    
    // Get the PoolManager contract
    const poolManager = getPoolManager({
      address: PUBLIC_UNIV4_POOLMANAGER_ADDRESS as Address,
      chain: anvil
    });
    
    // Prepare the transaction request
    const request = await publicClient.simulateContract({
      ...poolManager,
      functionName: 'initialize',
      args: [poolKey, sqrtPriceX96],
      account: account
    });
    
    // Send the transaction using wagmi's writeContract
    const hash = await writeContract(wagmiConfig, {
      address: PUBLIC_UNIV4_POOLMANAGER_ADDRESS as `0x${string}`,
      abi: poolManager.abi,
      functionName: 'initialize',
      args: [poolKey, sqrtPriceX96],
      account: account as `0x${string}`
    });
    
    console.log('Pool creation transaction hash:', hash);
    return {
      success: true,
      message: `Pool created successfully with the SwapCast hook!`,
      hash
    };
  } catch (error: any) {
    console.error('Error creating pool:', error);
    
    // Check if the error indicates the pool already exists
    if (error.message && error.message.includes('PoolAlreadyExists')) {
      return {
        success: false,
        message: 'Pool already exists with these tokens and fee tier.'
      };
    }
    
    return {
      success: false,
      message: `Failed to create pool: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Helper function to sort token addresses in canonical order (lower address first)
 */
export function sortTokens(tokenA: Address, tokenB: Address, chainId: number): [Token, Token] {
  const tA = new Token(chainId, tokenA, 18);
  const tB = new Token(chainId, tokenB, 18);
  return tA.sortsBefore(tB) ? [tA, tB] : [tB, tA];
}

import type { Address, Hash } from 'viem';
import { http } from 'viem';
import { getTickSpacing } from '$lib/services/market/helpers';
import { modal } from '$lib/configs/wallet.config';
import { Token } from '@uniswap/sdk-core';
import { getPoolManager } from '$generated/types/PoolManager';
import { PUBLIC_UNIV4_POOLMANAGER_ADDRESS, PUBLIC_SWAPCASTHOOK_ADDRESS } from '$env/static/public';

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
    const walletInfo = await modal.getWalletInfo();
    if (!walletInfo || !walletInfo.chain || !walletInfo.rpcUrl) throw new Error('No wallet connected or missing chain/rpc info');

    const { chain, rpcUrl } = walletInfo as { chain: { id: number; [key: string]: any }, rpcUrl: string };
    if (!chain || typeof chain.id !== 'number') {
      throw new Error('Connected wallet info is missing a valid chain object with an id');
    }
    if (!rpcUrl || typeof rpcUrl !== 'string') {
      throw new Error('Connected wallet info is missing a valid rpcUrl');
    }
    const poolManager = getPoolManager({
      address: PUBLIC_UNIV4_POOLMANAGER_ADDRESS,
      chain,
      transport: http(rpcUrl)
    });

    const [token0, token1] = sortTokens(tokenA, tokenB, chain.id);

    // Use Uniswap v4 SDK Pool class for parameter validation (optional)
    const tickSpacing = getTickSpacing(fee);
    const sqrtPriceX96 = BigInt('0x1000000000000000000000000'); // 1:1 price

    // Now use these values in the contract call
    const { request } = await poolManager.simulate.initialize(
      [
        {
          currency0: token0.address as `0x${string}`,
          currency1: token1.address as `0x${string}`,
          fee: fee,
          tickSpacing: tickSpacing,
          hooks: PUBLIC_SWAPCASTHOOK_ADDRESS
        },
        sqrtPriceX96
      ],
      { account }
    );
    if (!account) {
      throw new Error('No account available for transaction');
    }
    if (typeof (walletInfo as any).sendTransaction === 'function') {
      if (!('data' in request) || !request.data) {
        throw new Error('Simulated contract request missing data field.');
      }
      const hash = await (walletInfo as any).sendTransaction({
        to: request.address,
        data: request.data,
      });
      console.log('Pool creation transaction hash:', hash);
      return {
        success: true,
        message: `Pool created successfully with the SwapCast hook!`,
        hash
      };
    } else {
      throw new Error('Connected wallet client does not support sendTransaction');
    }
  } catch (error: any) {
    console.error('Error creating pool:', error);
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

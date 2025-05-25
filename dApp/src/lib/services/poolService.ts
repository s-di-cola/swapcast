import type { Address, Hash } from 'viem';
import { publicClient, adminClient } from '$lib/contract/contracts';
import { Token } from '@uniswap/sdk-core';
import { Pool } from '@uniswap/v4-sdk';
import { getTickSpacing } from '$lib/uniswap/constants';

// Constants
const POOL_MANAGER_ADDRESS: Address = import.meta.env.VITE_POOL_MANAGER_ADDRESS as Address;
const SWAPCAST_HOOK_ADDRESS: Address = import.meta.env.VITE_SWAPCAST_HOOK_ADDRESS as Address;


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
  try {
    // Ensure the tokens are in canonical order (lower address first)
    const [token0, token1] = sortTokens(tokenA, tokenB, publicClient.chain?.id ?? 1);
    // Get the poolKey using Token objects
    const poolKey = Pool.getPoolKey(token0, token1, fee, getTickSpacing(fee), SWAPCAST_HOOK_ADDRESS);
    // For contract calls, use poolKey directly
    // Check if the pool exists by querying its liquidity
    const liquidity = await publicClient.readContract({
      address: POOL_MANAGER_ADDRESS,
      abi: [{
        name: 'getLiquidity',
        inputs: [{ name: 'id', type: 'bytes32' }],
        outputs: [{ name: '', type: 'uint128' }],
        stateMutability: 'view',
        type: 'function'
      }],
      functionName: 'getLiquidity',
      args: [poolKey]
    });
    
    // If liquidity is greater than 0, the pool exists and has been initialized
    return BigInt(liquidity) > 0n;
  } catch (error) {
    console.error('Error checking if pool exists:', error);
    return false;
  }
}

/**
 * Create a new Uniswap v4 pool with the SwapCast hook
 * @param tokenA Address of the first token
 * @param tokenB Address of the second token
 * @param fee Fee tier (100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
 * @param account Optional account address to use (defaults to admin account)
 * @returns Object containing success status, message, and transaction hash
 */
export async function createPool(
  tokenA: Address,
  tokenB: Address,
  fee: number,
  account?: Address
): Promise<{ success: boolean; message: string; hash?: Hash }> {
  try {
    // Check if pool already exists
    const poolExists = await checkPoolExists(tokenA, tokenB, fee);
    if (poolExists) {
      return {
        success: true,
        message: 'Pool already exists with the SwapCast hook'
      };
    }
    
    // Ensure the tokens are in canonical order (lower address first)
    const [token0, token1] = sortTokens(tokenA, tokenB, publicClient.chain?.id ?? 1);
    const tickSpacing = getTickSpacing(fee);
    
    // Determine which account to use
    const userAccount = account || adminClient.account;
    if (!userAccount) {
      throw new Error('No account available for transaction');
    }
    
    // Use a default price of 1:1 (represented as sqrtPriceX96)
    // This is a common starting point for new pools
    const sqrtPriceX96 = BigInt('0x1000000000000000000000000');
    
    // Prepare the transaction request to initialize the pool
    // Use sdk4 to construct the poolKey
    const poolKey = Pool.getPoolKey(token0, token1, fee, tickSpacing, SWAPCAST_HOOK_ADDRESS);
    // Prepare the transaction request to initialize the pool
    const request = await publicClient.simulateContract({
      address: POOL_MANAGER_ADDRESS,
      abi: [{
        name: 'initialize',
        inputs: [
          { name: 'key', type: 'tuple', components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' }
          ]},
          { name: 'sqrtPriceX96', type: 'uint160' }
        ],
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      }],
      functionName: 'initialize',
      args: [
        {
          currency0: token0.address as `0x${string}`,
          currency1: token1.address as `0x${string}`,
          fee: fee,
          tickSpacing: tickSpacing,
          hooks: SWAPCAST_HOOK_ADDRESS
        },
        sqrtPriceX96
      ],
      account: userAccount
    });
    
    // Send the transaction
    // If account is provided, use publicClient with account; otherwise use adminClient
    // Only adminClient can send transactions in this context
    const hash = await adminClient.writeContract(request.request) as Hash;
    console.log('Pool creation transaction hash:', hash);
    
    return {
      success: true,
      message: `Pool created successfully with the SwapCast hook!`,
      hash
    };

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
 * @param tokenA First token address
 * @param tokenB Second token address
 * @returns Sorted token addresses [token0, token1]
 */
function sortTokens(tokenA: Address, tokenB: Address, chainId: number): [Token, Token] {
  // Use sdk4's canonical token sorting
  // We'll represent tokens as SDK Token objects for sorting
  // NOTE: 18 decimals is a placeholder; ideally fetch the actual decimals for each token.
  const tA = new Token(chainId, tokenA, 18);
  const tB = new Token(chainId, tokenB, 18);
  return tA.sortsBefore(tB) ? [tA, tB] : [tB, tA];
}

/**
 * Token management utilities for fixtures
 */

import { Token } from '@uniswap/sdk-core';
import {
  type Address,
  erc20Abi,
  formatUnits,
  parseUnits
} from 'viem';
import { anvil } from "viem/chains";
import { getPublicClient } from './client';
import { logInfo, logSuccess, logWarning, withErrorHandling } from './error';
import { getTokenSymbolFromAddress } from './math';

// Native ETH is represented as the zero address in Uniswap V4
export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Token information interface
 */
export interface TokenInfo {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
}

/**
 * Check if an address represents native ETH
 */
export function isNativeEth(address: Address): boolean {
    return address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
}

/**
 * Get token balance for an account
 */
export const getTokenBalance = withErrorHandling(
    async (tokenAddress: Address, account: Address): Promise<bigint> => {
        if (tokenAddress === NATIVE_ETH_ADDRESS) {
            const publicClient = getPublicClient();
            return await publicClient.getBalance({ address: account });
        } else {
            const publicClient = getPublicClient();
            return await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account]
            });
        }
    },
    'GetTokenBalance'
);


/**
 * Deals liquidity to an address
 * 
 * @param to - Address to deal liquidity to
 * @param token0Address - Address of token0
 * @param token1Address - Address of token1
 * @param amount0 - Amount of token0 to deal
 * @param amount1 - Amount of token1 to deal
 */
export async function dealLiquidity(
  to: Address,
  token0Address: Address,
  token1Address: Address,
  amount0: bigint,
  amount1: bigint
): Promise<void> {
  const publicClient = getPublicClient();

  // Helper to calculate storage slot for mapping
  const getMappingSlot = (mappingSlot: number, key: Address): string => {
    // For mappings, the storage slot is keccak256(abi.encodePacked(key, slot))
    const keyPadded = key.slice(2).padStart(64, '0');
    const slotPadded = mappingSlot.toString(16).padStart(64, '0');
    const concatenated = keyPadded + slotPadded;
    
    // You'll need to use keccak256 - import from viem
    const { keccak256 } = require('viem');
    return keccak256(`0x${concatenated}`);
  };

  // Helper to set token balance
  const setTokenBalance = async (token: Address, amount: bigint) => {
    if (token === NATIVE_ETH_ADDRESS || token === '0x0000000000000000000000000000000000000000') {
      // Set ETH balance
      await publicClient.request({
        method: 'anvil_setBalance' as any,
        params: [to, `0x${amount.toString(16)}`],
      });
      logInfo('DealLiquidity', `Set ETH balance: ${amount.toString()}`);
      return;
    }

    // For ERC20 tokens, try common balance mapping slots
    const commonSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // Extended list
    let success = false;

    for (const slot of commonSlots) {
      try {
        const storageSlot = getMappingSlot(slot, to);
        const amountHex = `0x${amount.toString(16).padStart(64, '0')}`;
        
        await publicClient.request({
          method: 'anvil_setStorageAt' as any,
          params: [token, storageSlot as `0x${string}`, amountHex as `0x${string}`],
        });

        // Verify the balance was set correctly by reading it back
        const balanceData = await publicClient.request({
          method: 'eth_call',
          params: [{
            to: token,
            data: `0x70a08231${to.slice(2).padStart(64, '0')}` // balanceOf(address)
          }, 'latest']
        });

        const actualBalance = BigInt(balanceData);
        
        if (actualBalance === amount) {
          logInfo('DealLiquidity', `Successfully set balance at slot ${slot} for token ${token}: ${amount.toString()}`);
          success = true;
          break;
        }
      } catch (e) {
        // Continue to next slot
        continue;
      }
    }

    if (!success) {
      throw new Error(`Could not set balance for token ${token} after trying slots 0-9`);
    }
  };

  try {
    logInfo('DealLiquidity', `Dealing liquidity to ${to}`);
    logInfo('DealLiquidity', `Token0: ${token0Address}, Amount: ${amount0.toString()}`);
    logInfo('DealLiquidity', `Token1: ${token1Address}, Amount: ${amount1.toString()}`);

    await setTokenBalance(token0Address, amount0);
    await setTokenBalance(token1Address, amount1);
    
    logSuccess('DealLiquidity', `Successfully dealt tokens to ${to}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('DealLiquidity', `Failed to deal liquidity: ${errorMessage}`);
    throw new Error(`dealLiquidity failed: ${errorMessage}`);
  }
}



/**
 * Get token decimals
 */
export const getTokenDecimals = withErrorHandling(
    async (tokenAddress: Address): Promise<number> => {
        if (tokenAddress === NATIVE_ETH_ADDRESS) {
            return 18; // ETH has 18 decimals
        } else {
            const publicClient = getPublicClient();
            return publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'decimals'
            });
        }
    },
    'GetTokenDecimals'
);

/**
 * Format token amount with proper decimals
 */
export const formatTokenAmount = withErrorHandling(
    async (tokenAddress: Address, amount: bigint): Promise<string> => {
        const decimals = await getTokenDecimals(tokenAddress);
        return formatUnits(amount, decimals);
    },
    'FormatTokenAmount'
);

/**
 * Parse token amount with proper decimals
 */
export const parseTokenAmount = withErrorHandling(
    async (tokenAddress: Address, amount: string): Promise<bigint> => {
        const decimals = await getTokenDecimals(tokenAddress);
        return parseUnits(amount, decimals);
    },
    'ParseTokenAmount'
);


export async function getTokenFromAddress(address: Address): Promise<Token> {
    const decimals = await getTokenDecimals(address);
    const symbol = await getTokenSymbolFromAddress(address);
    return new Token(anvil.id, address, decimals, symbol);
}

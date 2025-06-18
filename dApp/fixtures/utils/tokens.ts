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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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


export async function dealLiquidity(
  to: Address,
  token0Address: Address,
  token1Address: Address,
  amount0: bigint,
  amount1: bigint
): Promise<void> {

  const dealTokenWithCast = async (tokenAddress: Address, amount: bigint, tokenName: string) => {
    // Handle ETH
    if (tokenAddress === NATIVE_ETH_ADDRESS || tokenAddress === '0x0000000000000000000000000000000000000000') {
      const cmd = `cast rpc anvil_setBalance ${to} 0x${amount.toString(16)}`;
      await execAsync(cmd);
      logInfo('DealLiquidity', `Set ETH balance: ${amount.toString()}`);
      return;
    }

    // Known balance slots for major tokens
    const KNOWN_SLOTS: Record<string, number> = {
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 9,  // USDC (confirmed working)
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 2,  // USDT  
      '0x6b175474e89094c44da98b954eedeac495271d0f': 2,  // DAI
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 0,  // WBTC (confirmed working)
      '0x514910771af9ca656af840dff83e8264ecf986ca': 1,  // LINK
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 4,  // UNI
      '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 0,  // AAVE
    };

    const tokenLower = tokenAddress.toLowerCase();
    const knownSlot = KNOWN_SLOTS[tokenLower];

    logInfo('DealLiquidity', `Dealing ${tokenName}: ${tokenAddress}`);
    logInfo('DealLiquidity', `Amount: ${amount.toString()}`);
    logInfo('DealLiquidity', `Known slot: ${knownSlot ?? 'unknown'}`);

    // If we know the slot, try it first, then fallback to brute force
    const slotsToTry = knownSlot !== undefined
      ? [knownSlot, ...Array.from({ length: 15 }, (_, i) => i).filter(i => i !== knownSlot)]
      : Array.from({ length: 15 }, (_, i) => i);

    for (const slot of slotsToTry) {
      try {
        logInfo('DealLiquidity', `Trying slot ${slot}...`);

        // Calculate storage slot
        const slotCmd = `cast keccak $(cast concat-hex $(cast abi-encode "f(address,uint256)" ${to} ${slot}))`;
        const { stdout: storageSlot } = await execAsync(slotCmd);
        const cleanSlot = storageSlot.trim();

        // Set storage
        const amountHex = `0x${amount.toString(16).padStart(64, '0')}`;
        const setCmd = `cast rpc anvil_setStorageAt ${tokenAddress} ${cleanSlot} ${amountHex}`;
        await execAsync(setCmd);

        // Verify - parse the balance correctly
        const verifyCmd = `cast call ${tokenAddress} "balanceOf(address)(uint256)" ${to}`;
        const { stdout: balanceResult } = await execAsync(verifyCmd);

        // Parse the balance - handle both "1000000" and "1000000000000000 [1e15]" formats
        const balanceStr = balanceResult.trim();
        let balance: bigint;

        if (balanceStr.includes('[')) {
          // Format like "1000000000000000 [1e15]" - take the first number
          const firstNumber = balanceStr.split(' ')[0];
          balance = BigInt(firstNumber);
        } else if (balanceStr.startsWith('0x')) {
          // Hex format
          balance = BigInt(balanceStr);
        } else {
          // Plain decimal
          balance = BigInt(balanceStr);
        }

        logInfo('DealLiquidity', `Slot ${slot} result - Expected: ${amount}, Got: ${balance}`);

        if (balance === amount) {
          logSuccess('DealLiquidity', `✅ Set ${tokenName} balance at slot ${slot}: ${amount.toString()}`);
          return;
        }
      } catch (e) {
        logWarning('DealLiquidity', `Slot ${slot} failed: ${String(e).slice(0, 100)}...`);
        continue;
      }
    }

    throw new Error(`Could not set balance for ${tokenName} (${tokenAddress}) after trying slots 0-14`);
  };

  try {
    logInfo('DealLiquidity', `Dealing liquidity to ${to}`);
    logInfo('DealLiquidity', `Token0: ${token0Address}, Amount: ${amount0.toString()}`);
    logInfo('DealLiquidity', `Token1: ${token1Address}, Amount: ${amount1.toString()}`);

    await dealTokenWithCast(token0Address, amount0, 'token0');
    await dealTokenWithCast(token1Address, amount1, 'token1');

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

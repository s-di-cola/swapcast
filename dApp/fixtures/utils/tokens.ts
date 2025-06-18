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
import { getPublicClient, getWalletClient } from './client';
import { logInfo, logSuccess, logWarning, withErrorHandling } from './error';
import { getTokenSymbolFromAddress } from './math';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CONTRACT_ADDRESSES } from './wallets';

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


export async function approveToken(account: Address, tokenAddress: Address, amount: bigint) {
  // Skip approval for native ETH
  if (tokenAddress === NATIVE_ETH_ADDRESS || tokenAddress === '0x0000000000000000000000000000000000000000') {
    logInfo('ApproveToken', `Skipping approval for native ETH`);
    return;
  }
  
  const walletClient = getWalletClient(account);
  const permit2Address = CONTRACT_ADDRESSES.PERMIT2 as Address;
  const positionManagerAddress = CONTRACT_ADDRESSES.POSITION_MANAGER as Address;
  
  try {
    // Get current block timestamp from chain
    const latestBlock = await getPublicClient().getBlock({ blockTag: 'latest' });
    const currentTimestamp = Number(latestBlock.timestamp);
    const expiration = currentTimestamp + (365 * 24 * 60 * 60); // 1 year from current block time
    
    logInfo('ApproveToken', `Current block timestamp: ${currentTimestamp}`);
    logInfo('ApproveToken', `Setting Permit2 expiration to: ${expiration} (1 year from now)`);
    
    // Step 1: Check if token is already approved to Permit2
    const currentAllowanceToPermit2 = await getPublicClient().readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account, permit2Address],
    }) as bigint;
    
    logInfo('ApproveToken', `Current ERC20 allowance to Permit2: ${currentAllowanceToPermit2.toString()}`);
    
    if (currentAllowanceToPermit2 < amount) {
      // Handle USDT's reset requirement
      if (currentAllowanceToPermit2 > 0n && tokenAddress.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7") {
        logInfo('ApproveToken', `Resetting USDT allowance to Permit2 first...`);
        const resetHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [permit2Address, 0n],
          account: account,
          chain: anvil,
        });
        await getPublicClient().waitForTransactionReceipt({ hash: resetHash });
        logSuccess('ApproveToken', `Reset USDT allowance to Permit2`);
      }
      
      logInfo('ApproveToken', `Approving token to Permit2...`);
      const approveHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [permit2Address, 2n ** 256n - 1n], // Max approval
        account: account,
        chain: anvil,
      });
      
      const receipt = await getPublicClient().waitForTransactionReceipt({ hash: approveHash });
      if (receipt.status !== 'success') {
        throw new Error(`ERC20 approval to Permit2 failed`);
      }
      logSuccess('ApproveToken', `✅ Approved token to Permit2`);
    } else {
      logInfo('ApproveToken', `✅ Token already approved to Permit2`);
    }
    
    // Step 2: Set Permit2 allowance for Position Manager
    logInfo('ApproveToken', `Setting Permit2 allowance for Position Manager...`);
    
    const permit2Abi = [
      {
        "inputs": [
          {"internalType": "address", "name": "token", "type": "address"},
          {"internalType": "address", "name": "spender", "type": "address"},
          {"internalType": "uint160", "name": "amount", "type": "uint160"},
          {"internalType": "uint48", "name": "expiration", "type": "uint48"}
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];
    
    // Ensure amount fits in uint160 (max value is 2^160 - 1)
    const maxUint160 = (2n ** 160n) - 1n;
    const permit2Amount = amount > maxUint160 ? maxUint160 : amount;
    
    logInfo('ApproveToken', `Permit2 amount: ${permit2Amount.toString()}, expiration: ${expiration}`);
    
    const permit2Hash = await walletClient.writeContract({
      address: permit2Address,
      abi: permit2Abi,
      functionName: 'approve',
      args: [
        tokenAddress,
        positionManagerAddress,
        permit2Amount,
        expiration
      ],
      account: account,
      chain: anvil,
    });
    
    const permit2Receipt = await getPublicClient().waitForTransactionReceipt({ hash: permit2Hash });
    if (permit2Receipt.status !== 'success') {
      throw new Error(`Permit2 approval failed with status: ${permit2Receipt.status}`);
    }
    
    logSuccess('ApproveToken', `✅ Set Permit2 allowance for Position Manager`);
    
    // Step 3: Verify the Permit2 allowance was set correctly
    const permit2AllowanceAbi = [
      {
        "inputs": [
          {"internalType": "address", "name": "user", "type": "address"},
          {"internalType": "address", "name": "token", "type": "address"},
          {"internalType": "address", "name": "spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [
          {"internalType": "uint160", "name": "amount", "type": "uint160"},
          {"internalType": "uint48", "name": "expiration", "type": "uint48"},
          {"internalType": "uint48", "name": "nonce", "type": "uint48"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];
    
    const finalAllowance = await getPublicClient().readContract({
      address: permit2Address,
      abi: permit2AllowanceAbi,
      functionName: 'allowance',
      args: [account, tokenAddress, positionManagerAddress],
    }) as [bigint, number, number];
    
    logSuccess('ApproveToken', `✅ Verified Permit2 allowance: amount=${finalAllowance[0]}, expiration=${finalAllowance[1]}, nonce=${finalAllowance[2]}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('ApproveToken', `Failed to approve token: ${errorMessage}`);
    throw new Error(`approveToken failed: ${errorMessage}`);
  }
}


export async function dealLiquidity(
  to: Address,
  token0Address: Address,
  token1Address: Address,
  amount0: bigint,
  amount1: bigint
): Promise<void> {

  const getTokenBalance = async (tokenAddress: Address, account: Address): Promise<bigint> => {
    if (tokenAddress === NATIVE_ETH_ADDRESS || tokenAddress === '0x0000000000000000000000000000000000000000') {
      const cmd = `cast balance ${account}`;
      const { stdout } = await execAsync(cmd);
      return BigInt(stdout.trim());
    } else {
      const cmd = `cast call ${tokenAddress} "balanceOf(address)(uint256)" ${account}`;
      const { stdout } = await execAsync(cmd);
      const balanceStr = stdout.trim();

      if (balanceStr.includes('[')) {
        const firstNumber = balanceStr.split(' ')[0];
        return BigInt(firstNumber);
      } else if (balanceStr.startsWith('0x')) {
        return BigInt(balanceStr);
      } else {
        return BigInt(balanceStr);
      }
    }
  };

  const logBalances = async (stage: string) => {
    try {
      const balance0 = await getTokenBalance(token0Address, to);
      const balance1 = await getTokenBalance(token1Address, to);

      logInfo('DealLiquidity', `${stage} - Token0 balance: ${balance0.toString()}`);
      logInfo('DealLiquidity', `${stage} - Token1 balance: ${balance1.toString()}`);
    } catch (error) {
      logWarning('DealLiquidity', `Failed to get balances for ${stage}: ${error}`);
    }
  };

  const dealTokenWithCast = async (tokenAddress: Address, amount: bigint, tokenName: string) => {
    // Calculate the amount to actually deal (20% extra for ETH, 10% extra for tokens)
    let dealAmount: bigint;
    
    if (tokenAddress === NATIVE_ETH_ADDRESS || tokenAddress === '0x0000000000000000000000000000000000000000') {
      // For ETH, add 20% extra + 0.1 ETH buffer for gas costs
      dealAmount = amount + (amount * 20n) / 100n + BigInt('100000000000000000'); // 0.1 ETH buffer
      logInfo('DealLiquidity', `ETH: Requested ${amount.toString()}, dealing ${dealAmount.toString()} (20% + 0.1 ETH buffer)`);
      
      const cmd = `cast rpc anvil_setBalance ${to} 0x${dealAmount.toString(16)}`;
      await execAsync(cmd);
      logInfo('DealLiquidity', `Set ETH balance: ${dealAmount.toString()}`);
      return;
    } else {
      // For ERC20 tokens, add 10% extra just to be safe
      dealAmount = amount + (amount * 10n) / 100n;
      logInfo('DealLiquidity', `${tokenName}: Requested ${amount.toString()}, dealing ${dealAmount.toString()} (10% extra)`);
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

        // Set storage with the deal amount (which includes buffer)
        const amountHex = `0x${dealAmount.toString(16).padStart(64, '0')}`;
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

        logInfo('DealLiquidity', `Slot ${slot} result - Expected: ${dealAmount}, Got: ${balance}`);

        if (balance === dealAmount) {
          logSuccess('DealLiquidity', `✅ Set ${tokenName} balance at slot ${slot}: ${dealAmount.toString()}`);
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

    // Log balances before dealing
    await logBalances("BEFORE dealing");

    await dealTokenWithCast(token0Address, amount0, 'token0');
    await dealTokenWithCast(token1Address, amount1, 'token1');

    // Log balances after dealing
    await logBalances("AFTER dealing");

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

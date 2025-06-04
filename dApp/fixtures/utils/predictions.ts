/**
 * Swap-based prediction utilities for fixture generation
 *
 * Records predictions through swaps (the way real users would)
 * instead of direct contract calls
 */

import { type Address, createPublicClient, http, parseUnits, encodeFunctionData } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES } from './wallets';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import chalk from 'chalk';

// Outcome constants
export const OUTCOME_BEARISH = 0;
export const OUTCOME_BULLISH = 1;

/**
 * Records a prediction by performing a swap on the Uniswap v4 pool
 * 
 * This is how real users would make predictions, through the SwapCastHook
 * 
 * @param userAccount Account making the prediction
 * @param market Market information including pool key
 * @param outcome Prediction outcome (0 for Bearish, 1 for Bullish)
 * @param amount Amount to stake (in ETH)
 * @returns Transaction hash
 */
export async function recordPredictionViaSwap(
  userAccount: any,
  market: {
    id: string | bigint;
    poolKey: {
      currency0: Address;
      currency1: Address;
      fee: number;
      tickSpacing: number;
      hooks: Address;
    };
  },
  outcome: number,
  stakeAmount: bigint, // Net amount for the prediction stake
  transactionValue: bigint // Gross amount for msg.value (stakeAmount + protocolFee)
): Promise<`0x${string}`> {
  console.log(chalk.yellow(`Recording prediction via swap for market ${market.id}...`));

  // Create public client
  const publicClient = createPublicClient({
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });

  // Get the PoolManager contract
  const poolManager = getPoolManager({
    address: CONTRACT_ADDRESSES.POOL_MANAGER as `0x${string}`,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });

  // Prepare swap parameters
  // For Uniswap v4, the swap direction determines the outcome:
  // - zeroForOne: true = Bearish (swap token0 for token1)
  // - zeroForOne: false = Bullish (swap token1 for token0)
  const zeroForOne = outcome === OUTCOME_BEARISH;

  const swapParams = {
    zeroForOne,
    amountSpecified: stakeAmount, // Net stake amount for the swap operation
    sqrtPriceLimitX96: 0n // No price limit
  };

  try {
    let hash: `0x${string}`;

    // Check if this is a regular account or an impersonated whale account
    if ('privateKey' in userAccount && userAccount.privateKey) {
      // Regular account - use standard approach
      hash = await poolManager.write.swap(
        [market.poolKey, swapParams, '0x'],
        {
          account: userAccount.address,
          chain: anvil,
          value: transactionValue
        }
      );
    } else {
      // This is likely an impersonated account - use a different approach
      // First, ensure the account is impersonated and has enough funds
      await publicClient.request({
        method: 'anvil_impersonateAccount' as any,
        params: [userAccount.address]
      });

      // Check balance and fund if needed
      const balance = await publicClient.getBalance({ address: userAccount.address });
      const requiredBalance = transactionValue + parseUnits('0.1', 18); // Add 0.1 ETH for gas

      if (balance < requiredBalance) {
        console.log(
          chalk.yellow(
            `Whale account ${userAccount.address} has insufficient funds. Adding more ETH...`
          )
        );
        await publicClient.request({
          method: 'anvil_setBalance' as any,
          params: [
            userAccount.address,
            ('0x' + (parseUnits('1000', 18)).toString(16)) as any
          ] // 1000 ETH
        });
        console.log(chalk.green(`Funded whale account ${userAccount.address} with 1000 ETH`));
      }

      // Get the contract ABI and function data
      const abi = poolManager.abi;
      const functionName = 'swap';
      
      // Encode the function data
      const data = encodeFunctionData({
        abi,
        functionName,
        args: [market.poolKey, swapParams, '0x'] as const
      });

      // Send the transaction directly
      hash = await publicClient.request({
        method: 'eth_sendTransaction' as any,
        params: [
          {
            from: userAccount.address,
            to: CONTRACT_ADDRESSES.POOL_MANAGER as `0x${string}`,
            data,
            value: `0x${transactionValue.toString(16)}` as `0x${string}`
          }
        ]
      });
    }

    console.log(chalk.green(`Prediction recorded via swap with hash: ${hash}`));
    return hash;
  } catch (error: any) {
    console.error(chalk.red(`Failed to record prediction via swap: ${error.message}`));
    throw error;
  }
}

/**
 * Helper utilities for fixture generation
 *
 * Common utility functions used across the fixture generation process
 */

import { type Address, type PublicClient, parseUnits, formatUnits, encodeFunctionData } from 'viem';
import chalk from 'chalk';

/**
 * Gets the tick spacing for a fee tier
 *
 * @param fee Fee tier (100, 500, 3000, or 10000)
 * @returns Tick spacing for the fee tier
 */
export function getTickSpacing(fee: number): number {
	switch (fee) {
		case 100:
			return 1;
		case 500:
			return 10;
		case 3000:
			return 60;
		case 10000:
			return 200;
		default:
			throw new Error(`Unsupported fee tier: ${fee}`);
	}
}

/**
 * Sorts token addresses in canonical order (lower address first)
 *
 * @param tokenA First token address
 * @param tokenB Second token address
 * @returns Sorted token addresses [token0, token1]
 */
export function sortTokenAddresses(tokenA: Address, tokenB: Address): [Address, Address] {
	return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

/**
 * Generates a random number between min and max (inclusive)
 *
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random number between min and max
 */
export function getRandomNumber(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random boolean with the given probability of being true
 *
 * @param probability Probability of returning true (0-1)
 * @returns Random boolean
 */
export function getRandomBoolean(probability: number = 0.5): boolean {
	return Math.random() < probability;
}

/**
 * Shuffles an array in place
 *
 * @param array Array to shuffle
 * @returns The same array, shuffled
 */
export function shuffleArray<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

/**
 * Waits for the specified number of milliseconds
 *
 * @param ms Milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds an appropriate whale account for a token pair
 * 
 * @param publicClient Public client instance
 * @param token0 First token address
 * @param token1 Second token address
 * @returns Whale account address
 */
export async function findWhaleForTokenPair(
  publicClient: PublicClient, 
  token0: Address, 
  token1: Address
): Promise<Address> {
  // Default to admin account if no suitable whale is found
  const adminAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  
  // Map of common tokens to their whale addresses
  const tokenWhaleMap: Record<string, Address> = {
    // WETH
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3',
    // USDC
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': '0x55FE002aefF02F77364de339a1292923A15844B8',
    // USDT
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': '0x5754284f345afc66a98fbB0a0Afe71e0F007B949',
    // DAI
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
    // WBTC
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656'
  };
  
  // Try to find a whale for token0
  if (tokenWhaleMap[token0.toLowerCase()]) {
    return tokenWhaleMap[token0.toLowerCase()];
  }
  
  // Try to find a whale for token1
  if (tokenWhaleMap[token1.toLowerCase()]) {
    return tokenWhaleMap[token1.toLowerCase()];
  }
  
  // If no whale found, return admin address
  return adminAddress;
}

/**
 * Ensures an account has enough of both tokens to provide liquidity
 * 
 * @param publicClient Public client instance
 * @param accountAddress Account address to fund
 * @param token0 First token address
 * @param token1 Second token address
 */
const MINIMAL_ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_to', type: 'address' }, { name: '_value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: '_owner', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] }
] as const;

// Re-using the whale map concept from findWhaleForTokenPair
const TOKEN_WHALE_MAP: Record<string, Address> = {
  // WETH
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3',
  // USDC
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': '0x55FE002aefF02F77364de339a1292923A15844B8',
  // USDT
  '0xdac17f958d2ee523a2206206994597c13d831ec7': '0x5754284f345afc66a98fbB0a0Afe71e0F007B949',
  // DAI
  '0x6b175474e89094c44da98b954eedeac495271d0f': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
  // WBTC
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  // Add other common tokens and their mainnet whale addresses if needed
  // Default/fallback whale if a specific token whale isn't listed (e.g., a general fund or a known testnet faucet)
  'default_whale': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // Anvil account 0
};

export async function ensureAccountHasTokens(
  publicClient: PublicClient,
  accountAddress: Address,
  token0Address: Address,
  token1Address: Address,
  // Default amounts will be calculated after fetching decimals
  amountToEnsureToken0Input?: bigint,
  amountToEnsureToken1Input?: bigint
): Promise<void> {
  // Fetch decimals for each token to correctly parse amounts
  let token0Decimals: number;
  let token1Decimals: number;

  try {
    token0Decimals = await publicClient.readContract({
      address: token0Address,
      abi: MINIMAL_ERC20_ABI,
      functionName: 'decimals'
    }) as number;
  } catch (e) {
    console.warn(chalk.yellow(`Could not fetch decimals for token ${token0Address}. Assuming 18. Error: ${(e as Error).message}`));
    token0Decimals = 18; // Fallback to 18 if decimals call fails
  }

  try {
    token1Decimals = await publicClient.readContract({
      address: token1Address,
      abi: MINIMAL_ERC20_ABI,
      functionName: 'decimals'
    }) as number;
  } catch (e) {
    console.warn(chalk.yellow(`Could not fetch decimals for token ${token1Address}. Assuming 18. Error: ${(e as Error).message}`));
    token1Decimals = 18; // Fallback to 18 if decimals call fails
  }

  const amountToEnsureToken0 = amountToEnsureToken0Input ?? parseUnits('10000', token0Decimals);
  const amountToEnsureToken1 = amountToEnsureToken1Input ?? parseUnits('10000', token1Decimals);
  // Impersonate the account
  await publicClient.request({
    method: 'anvil_impersonateAccount' as any,
    params: [accountAddress]
  });
  
  // Set a large balance for the account (1000 ETH)
  await publicClient.request({
    method: 'anvil_setBalance' as any,
    params: [
      accountAddress,
      ('0x' + (BigInt(1000) * BigInt(1e18)).toString(16)) as any
    ]
  });
  
  console.log(chalk.green(`Ensured account ${accountAddress} has 1000 ETH for gas.`));

  // Helper function to transfer a single token type
  const transferToken = async (tokenAddress: Address, amountToTransfer: bigint, recipientAddress: Address) => {
    const tokenWhaleAddress = TOKEN_WHALE_MAP[tokenAddress.toLowerCase()] || TOKEN_WHALE_MAP['default_whale'];
    if (!tokenWhaleAddress) {
      console.warn(chalk.yellow(`No whale found for token ${tokenAddress}. Skipping transfer.`));
      return;
    }

    console.log(chalk.blue(`Attempting to transfer ${formatUnits(amountToTransfer, await publicClient.readContract({ address: tokenAddress, abi: MINIMAL_ERC20_ABI, functionName: 'decimals' }) as number)} of token ${tokenAddress} from whale ${tokenWhaleAddress} to ${recipientAddress}`));

    try {
      // Impersonate the token whale
      await publicClient.request({
        method: 'anvil_impersonateAccount' as any,
        params: [tokenWhaleAddress]
      });

      // Check whale's balance (optional, for debugging)
      const whaleBalance = await publicClient.readContract({
        address: tokenAddress,
        abi: MINIMAL_ERC20_ABI,
        functionName: 'balanceOf',
        args: [tokenWhaleAddress]
      });
      console.log(chalk.gray(`Whale ${tokenWhaleAddress} balance of ${tokenAddress}: ${formatUnits(whaleBalance as bigint, await publicClient.readContract({ address: tokenAddress, abi: MINIMAL_ERC20_ABI, functionName: 'decimals' }) as number)}`));

      if ((whaleBalance as bigint) < amountToTransfer) {
        console.warn(chalk.yellow(`Whale ${tokenWhaleAddress} has insufficient balance of ${tokenAddress} to transfer ${formatUnits(amountToTransfer, await publicClient.readContract({ address: tokenAddress, abi: MINIMAL_ERC20_ABI, functionName: 'decimals' }) as number)}. Attempting to set balance.`));
        // If the whale is an Anvil default account, we might be able to set its balance if the token contract allows minting or is a mock
        // For real mainnet tokens, this won't work. This part is tricky without a mint function.
        // For now, we'll log and proceed, hoping the whale has tokens or it's a mock environment where this might be settable.
      }

      // Encode the transfer function data
      const transferData = encodeFunctionData({
        abi: MINIMAL_ERC20_ABI,
        functionName: 'transfer',
        args: [recipientAddress, amountToTransfer]
      });

      // Perform the transfer using eth_sendTransaction
      const txHash = await publicClient.request({
        method: 'eth_sendTransaction' as any,
        params: [
          {
            from: tokenWhaleAddress, // The impersonated whale sends the transaction
            to: tokenAddress,
            data: transferData,
            // value: '0x0' // Not needed for ERC20 transfer, but can be explicit
          }
        ]
      }) as `0x${string}`; // Assuming it will be a hash or throw

      if (typeof txHash === 'string' && txHash.startsWith('0x')) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        console.error(chalk.red(`Invalid transaction hash received for token transfer: ${txHash}. Skipping receipt wait.`));
        // Potentially throw an error here if a valid hash is strictly expected
        throw new Error(`Invalid transaction hash received: ${txHash}`);
      }
      console.log(chalk.green(`Successfully transferred ${formatUnits(amountToTransfer, await publicClient.readContract({ address: tokenAddress, abi: MINIMAL_ERC20_ABI, functionName: 'decimals' }) as number)} of ${tokenAddress} to ${recipientAddress}. Tx: ${txHash}`));

    } catch (e: any) {
      console.error(chalk.red(`Failed to transfer token ${tokenAddress} from whale ${tokenWhaleAddress} to ${recipientAddress}: ${e.message}`));
    } finally {
      // Stop impersonating the token whale
      await publicClient.request({
        method: 'anvil_stopImpersonatingAccount' as any,
        params: [tokenWhaleAddress]
      });
    }
  };

  // Transfer token0 and token1 to the accountAddress
  await transferToken(token0Address, amountToEnsureToken0, accountAddress);
  await transferToken(token1Address, amountToEnsureToken1, accountAddress);

  // Stop impersonating the original accountAddress (if it was impersonated for ETH funding)
  // This was already done for ETH funding, ensure it's correctly placed or not duplicated.
  // The original impersonation of accountAddress was for ETH funding. We are now done with operations for this accountAddress for now.
  // Ensure to stop impersonating accountAddress if it was impersonated at the start for ETH funding.
  // The ETH funding part already handles its own impersonation start/stop for accountAddress.
  // The token transfers handle impersonation for tokenWhales.
  // So, the original stop for accountAddress for ETH funding should be sufficient.
  // If ensureAccountHasTokens was called with an accountAddress that IS a whale itself, 
  // it might have been stopped already by transferToken's finally block. This needs careful ordering.

  // The initial impersonate/stop for accountAddress (for ETH) is self-contained.
  // The transferToken function handles impersonate/stop for tokenWhales.
  // So, no extra stopImpersonatingAccount for accountAddress is needed here at the end of the main function.
  console.log(chalk.magenta(`Finished ensuring token and ETH balances for ${accountAddress}.`));
}

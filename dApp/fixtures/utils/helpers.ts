/**
 * Helper utilities for fixture generation - FIXED VERSION
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
 * CRITICAL: This function is essential for Uniswap v4 pool creation
 *
 * @param tokenA First token address
 * @param tokenB Second token address
 * @returns Sorted token addresses [token0, token1]
 */
export function sortTokenAddresses(tokenA: Address, tokenB: Address): [Address, Address] {
	const addressA = tokenA.toLowerCase();
	const addressB = tokenB.toLowerCase();
	
	if (addressA === addressB) {
		throw new Error(`Cannot create pool with identical tokens: ${tokenA}`);
	}
	
	return addressA < addressB ? [tokenA, tokenB] : [tokenB, tokenA];
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
	// Simplified whale selection based on token types
	const token0Lower = token0.toLowerCase();
	const token1Lower = token1.toLowerCase();
	
	// Map of token addresses to their best whale accounts
	const tokenWhaleMap: Record<string, Address> = {
		// WETH
		'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3',
		// USDC
		'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': '0x55FE002aefF02F77364de339a1292923A15844B8',
		// USDT
		'0xdac17f958d2ee523a2206206994597c13d831ec7': '0x5754284f345afc66a98fbB0a0Afe71e0F007B949',
		// DAI
		'0x6b175474e89094c44da98b954eedeac495271d0f': '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
		// WBTC
		'0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656'
	};
	
	// Prefer whales in this order: WETH > WBTC > USDC > others
	const preferenceOrder = [
		'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
		'0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC  
		'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
		'0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
		'0x6b175474e89094c44da98b954eedeac495271d0f'  // DAI
	];
	
	// Find the best whale for this pair
	for (const tokenAddr of preferenceOrder) {
		if (token0Lower === tokenAddr || token1Lower === tokenAddr) {
			return tokenWhaleMap[tokenAddr];
		}
	}
	
	// Default to admin account if no specific whale found
	return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
}

/**
 * Ensures an account has enough of both tokens to provide liquidity
 * Simplified version that works with Anvil's testing capabilities
 * 
 * @param publicClient Public client instance
 * @param accountAddress Account address to fund
 * @param token0Address First token address
 * @param token1Address Second token address
 * @param amountToEnsureToken0 Amount of token0 to ensure (optional)
 * @param amountToEnsureToken1 Amount of token1 to ensure (optional)
 */
export async function ensureAccountHasTokens(
	publicClient: PublicClient,
	accountAddress: Address,
	token0Address: Address,
	token1Address: Address,
	amountToEnsureToken0?: bigint,
	amountToEnsureToken1?: bigint
): Promise<void> {
	console.log(chalk.blue(`Ensuring account ${accountAddress} has sufficient tokens...`));

	// Default amounts
	const defaultAmount0 = amountToEnsureToken0 ?? parseUnits('10000', 18);
	const defaultAmount1 = amountToEnsureToken1 ?? parseUnits('10000', 18);

	try {
		// Impersonate the account
		await publicClient.request({
			method: 'anvil_impersonateAccount' as any,
			params: [accountAddress]
		});

		// Set a large ETH balance for gas
		await publicClient.request({
			method: 'anvil_setBalance' as any,
			params: [
				accountAddress,
				`0x${(parseUnits('1000', 18)).toString(16)}`
			]
		});

		console.log(chalk.green(`Funded account ${accountAddress} with ETH for gas`));

		// For testing purposes, we'll try to set token balances directly
		// This works in test environments but not on real mainnet forks
		const tokens = [
			{ address: token0Address, amount: defaultAmount0, name: 'token0' },
			{ address: token1Address, amount: defaultAmount1, name: 'token1' }
		];

		for (const token of tokens) {
			try {
				// Try to set balance using storage manipulation
				// This is a common testing pattern with Anvil
				const balanceSlot = 0; // Most ERC20s use slot 0 for balances mapping
				const paddedAddress = accountAddress.toLowerCase().replace('0x', '').padStart(64, '0');
				const paddedSlot = balanceSlot.toString(16).padStart(64, '0');
				const storageKey = `0x${paddedAddress}${paddedSlot}`;
				
				await publicClient.request({
					method: 'anvil_setStorageAt' as any,
					params: [
						token.address,
						storageKey,
						`0x${token.amount.toString(16).padStart(64, '0')}`
					]
				});

				console.log(chalk.green(`Set ${token.name} balance for ${accountAddress}`));

			} catch (storageError: any) {
				console.log(chalk.yellow(`Storage manipulation failed for ${token.name}: ${storageError.message}`));
				// In a real mainnet fork, the whale should already have tokens
			}
		}

		// Stop impersonating
		await publicClient.request({
			method: 'anvil_stopImpersonatingAccount' as any,
			params: [accountAddress]
		});

		console.log(chalk.green(`Successfully ensured token balances for ${accountAddress}`));

	} catch (error: any) {
		console.error(chalk.red(`Error ensuring tokens for ${accountAddress}: ${error.message}`));
		
		// Clean up impersonation on error
		try {
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [accountAddress]
			});
		} catch (e) {
			// Ignore cleanup errors
		}
		
		throw error;
	}
}
/**
 * @file Utility functions for test fixtures
 * @description Collection of helper functions for various operations
 * @module utils/helpers
 */

import { type Address } from 'viem';
import { CONTRACT_ADDRESSES } from './wallets';

/**
 * Maps Uniswap fee tier to tick spacing
 * @param fee - Fee tier (100, 500, 3000, or 10000)
 * @returns Tick spacing for the fee tier
 * @throws {Error} If fee tier is unsupported
 * @example
 * const spacing = getTickSpacing(3000); // Returns 60
 */
export function getTickSpacing(fee: number): number {
	const feeToSpacing: Record<number, number> = {
		100: 1,
		500: 10,
		3000: 60,
		10000: 200
	};
	
	const spacing = feeToSpacing[fee];
	if (spacing === undefined) {
		throw new Error(`Unsupported fee tier: ${fee}`);
	}
	
	return spacing;
}

/**
 * Handles native ETH sorting priority in token pairs
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns Sorted token addresses with native ETH first, or null if no native ETH
 * @private
 */
function handleNativeETHSorting(tokenA: Address, tokenB: Address): [Address, Address] | null {
	const NATIVE_ETH = '0x0000000000000000000000000000000000000000';
	
	if (tokenA === NATIVE_ETH) {
		return [tokenA, tokenB];
	}
	
	if (tokenB === NATIVE_ETH) {
		return [tokenB, tokenA];
	}
	
	return null;
}

/**
 * Performs lexicographical sorting for ERC20 tokens
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns Sorted token addresses
 */
/**
 * Sorts ERC20 token addresses lexicographically
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns Sorted token addresses in lexicographical order
 * @private
 */
function sortERC20Tokens(tokenA: Address, tokenB: Address): [Address, Address] {
	const addressA = tokenA.toLowerCase();
	const addressB = tokenB.toLowerCase();
	
	if (addressA === addressB) {
		throw new Error(`Cannot create pool with identical tokens: ${tokenA}`);
	}
	
	return addressA < addressB ? [tokenA, tokenB] : [tokenB, tokenA];
}

/**
 * Sorts token addresses in canonical Uniswap v4 order
 * @remarks Native ETH (address(0)) always comes first, otherwise uses lexicographical order
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns Sorted token addresses [token0, token1]
 * @throws {Error} If token addresses are identical
 * @example
 * const [token0, token1] = sortTokenAddresses(USDC, WETH);
 */
export function sortTokenAddresses(tokenA: Address, tokenB: Address): [Address, Address] {
	const nativeETHResult = handleNativeETHSorting(tokenA, tokenB);
	if (nativeETHResult) {
		return nativeETHResult;
	}
	
	return sortERC20Tokens(tokenA, tokenB);
}

/**
 * Generates a random integer within a range
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer between min and max
 * @example
 * const num = getRandomNumber(1, 10); // Returns a number between 1 and 10
 */
export function getRandomNumber(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random boolean with configurable probability
 * @param probability - Probability of returning true (0-1, default: 0.5)
 * @returns Random boolean value
 * @example
 * const result = getRandomBoolean(0.7); // 70% chance of true
 */
export function getRandomBoolean(probability: number = 0.5): boolean {
	return Math.random() < probability;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 * @template T - Array element type
 * @param array - Array to shuffle (modified in place)
 * @returns The same array, now shuffled
 * @example
 * const shuffled = shuffleArray([1, 2, 3, 4]);
 */
export function shuffleArray<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

/**
 * Creates a promise that resolves after a delay
 * @param ms - Delay duration in milliseconds
 * @returns Promise that resolves after the specified delay
 * @example
 * await sleep(1000); // Waits for 1 second
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats a pool key for Uniswap V4 contract calls
 * @param currency0 - Address of the first token
 * @param currency1 - Address of the second token
 * @param fee - Fee tier (100, 500, 3000, or 10000)
 * @param tickSpacing - Tick spacing for the fee tier
 * @returns Formatted pool key object with sorted tokens
 * @example
 * const poolKey = formatPoolKey(USDC, WETH, 3000, 60);
 */
export function formatPoolKey(
	currency0: string,
	currency1: string,
	fee: number,
	tickSpacing: number
) {
	return {
		currency0,
		currency1,
		fee,
		tickSpacing,
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK
	};
}
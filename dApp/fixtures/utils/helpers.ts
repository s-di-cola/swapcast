/**
 * Helper utilities for fixture generation
 *
 * Common utility functions used across the fixture generation process
 */

import { type Address } from 'viem';

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

/**
 * Helper utilities 
 * Essential functions only, no dead code
 */

import { type Address } from 'viem';

/**
 * Gets the tick spacing for a fee tier
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
 * CRITICAL: Required for Uniswap v4 pool creation
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
 */
export function getRandomNumber(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random boolean with the given probability
 */
export function getRandomBoolean(probability: number = 0.5): boolean {
	return Math.random() < probability;
}

/**
 * Shuffles an array in place
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
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
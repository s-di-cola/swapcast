import { type Address } from 'viem';

/**
 * Maps fee tier to tick spacing according to Uniswap standards
 * @param fee - Fee tier (100, 500, 3000, or 10000)
 * @returns Tick spacing for the fee tier
 * @throws Error if fee tier is unsupported
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
 * Handles native ETH (address(0)) sorting priority
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns True if native ETH is present and sorting is handled
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
function sortERC20Tokens(tokenA: Address, tokenB: Address): [Address, Address] {
	const addressA = tokenA.toLowerCase();
	const addressB = tokenB.toLowerCase();
	
	if (addressA === addressB) {
		throw new Error(`Cannot create pool with identical tokens: ${tokenA}`);
	}
	
	return addressA < addressB ? [tokenA, tokenB] : [tokenB, tokenA];
}

/**
 * Sorts token addresses in canonical order for Uniswap v4
 * Native ETH (address(0)) always comes first, otherwise lexicographical order
 * @param tokenA - First token address
 * @param tokenB - Second token address
 * @returns Sorted token addresses [token0, token1]
 * @throws Error if tokens are identical
 */
export function sortTokenAddresses(tokenA: Address, tokenB: Address): [Address, Address] {
	const nativeETHResult = handleNativeETHSorting(tokenA, tokenB);
	if (nativeETHResult) {
		return nativeETHResult;
	}
	
	return sortERC20Tokens(tokenA, tokenB);
}

/**
 * Generates random number between min and max (inclusive)
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer between min and max
 */
export function getRandomNumber(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates random boolean with given probability
 * @param probability - Probability of returning true (0-1, default: 0.5)
 * @returns Random boolean value
 */
export function getRandomBoolean(probability: number = 0.5): boolean {
	return Math.random() < probability;
}

/**
 * Shuffles array in place using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns The same array, shuffled in place
 */
export function shuffleArray<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

/**
 * Waits for specified number of milliseconds
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
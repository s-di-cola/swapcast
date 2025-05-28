/**
 * Uniswap v4 Fee Tiers and Tick Spacing Utilities
 * 
 * This module provides constants and utilities for working with Uniswap v4
 * fee tiers and their corresponding tick spacings.
 * 
 * @see https://docs.uniswap.org/sdk/v4/reference/constants
 * @see https://docs.uniswap.org/concepts/protocol/fees
 */

/**
 * Standard Uniswap v4 fee amounts (in hundredths of a basis point)
 * 
 * @example
 * - LOWEST (100) = 0.01%
 * - LOW (500) = 0.05%  
 * - MEDIUM (3000) = 0.30%
 * - HIGH (10000) = 1.00%
 */
export const FeeAmount = {
	/** 0.01% fee tier - for very stable pairs */
	LOWEST: 100,
	/** 0.05% fee tier - for stable pairs */
	LOW: 500,
	/** 0.30% fee tier - for most pairs (default) */
	MEDIUM: 3000,
	/** 1.00% fee tier - for exotic pairs */
	HIGH: 10000
} as const;

/**
 * Tick spacing values corresponding to each fee tier
 * 
 * Tick spacing determines the granularity of liquidity positions.
 * Smaller spacing allows for more precise price ranges.
 */
export const TickSpacing = {
	/** Tick spacing for 0.01% fee tier */
	LOWEST: 1,
	/** Tick spacing for 0.05% fee tier */
	LOW: 10,
	/** Tick spacing for 0.30% fee tier */
	MEDIUM: 60,
	/** Tick spacing for 1.00% fee tier */
	HIGH: 200
} as const;

/**
 * Type representing valid fee amounts
 */
export type FeeAmountType = typeof FeeAmount[keyof typeof FeeAmount];

/**
 * Type representing valid tick spacing values
 */
export type TickSpacingType = typeof TickSpacing[keyof typeof TickSpacing];

/**
 * Fee tier information with human-readable details
 */
export interface FeeTierInfo {
	/** Fee amount in hundredths of basis points */
	fee: FeeAmountType;
	/** Corresponding tick spacing */
	tickSpacing: TickSpacingType;
	/** Human-readable percentage (e.g., "0.30%") */
	percentage: string;
	/** Description of typical use case */
	description: string;
}

/**
 * Comprehensive fee tier information for all supported tiers
 */
export const FEE_TIER_INFO: Record<FeeAmountType, FeeTierInfo> = {
	[FeeAmount.LOWEST]: {
		fee: FeeAmount.LOWEST,
		tickSpacing: TickSpacing.LOWEST,
		percentage: '0.01%',
		description: 'Lowest fee tier for very stable pairs (e.g., stablecoin pairs)'
	},
	[FeeAmount.LOW]: {
		fee: FeeAmount.LOW,
		tickSpacing: TickSpacing.LOW,
		percentage: '0.05%',
		description: 'Low fee tier for stable pairs with low volatility'
	},
	[FeeAmount.MEDIUM]: {
		fee: FeeAmount.MEDIUM,
		tickSpacing: TickSpacing.MEDIUM,
		percentage: '0.30%',
		description: 'Standard fee tier for most token pairs (most common)'
	},
	[FeeAmount.HIGH]: {
		fee: FeeAmount.HIGH,
		tickSpacing: TickSpacing.HIGH,
		percentage: '1.00%',
		description: 'High fee tier for exotic or highly volatile pairs'
	}
} as const;

/**
 * Gets the tick spacing for a given fee amount
 * 
 * @param fee - The fee amount (in hundredths of basis points)
 * @returns The corresponding tick spacing
 * @throws {Error} If the fee amount is not supported
 * 
 * @example
 * ```typescript
 * const spacing = getTickSpacing(FeeAmount.MEDIUM); // Returns 60
 * const spacing2 = getTickSpacing(3000); // Returns 60
 * ```
 */
export function getTickSpacing(fee: number): TickSpacingType {
	switch (fee) {
		case FeeAmount.LOWEST:
			return TickSpacing.LOWEST;
		case FeeAmount.LOW:
			return TickSpacing.LOW;
		case FeeAmount.MEDIUM:
			return TickSpacing.MEDIUM;
		case FeeAmount.HIGH:
			return TickSpacing.HIGH;
		default:
			throw new Error(
				`Unsupported fee tier: ${fee}. Supported tiers: ${Object.values(FeeAmount).join(', ')}`
			);
	}
}

/**
 * Gets comprehensive information about a fee tier
 * 
 * @param fee - The fee amount
 * @returns Complete fee tier information
 * @throws {Error} If the fee amount is not supported
 * 
 * @example
 * ```typescript
 * const info = getFeeTierInfo(FeeAmount.MEDIUM);
 * console.log(info.percentage); // "0.30%"
 * console.log(info.description); // "Standard fee tier for most token pairs"
 * ```
 */
export function getFeeTierInfo(fee: FeeAmountType): FeeTierInfo {
	const info = FEE_TIER_INFO[fee];
	if (!info) {
		throw new Error(
			`Unsupported fee tier: ${fee}. Supported tiers: ${Object.values(FeeAmount).join(', ')}`
		);
	}
	return info;
}

/**
 * Checks if a fee amount is valid/supported
 * 
 * @param fee - The fee amount to validate
 * @returns True if the fee is supported, false otherwise
 * 
 * @example
 * ```typescript
 * console.log(isValidFeeAmount(3000)); // true
 * console.log(isValidFeeAmount(1234)); // false
 * ```
 */
export function isValidFeeAmount(fee: number): fee is FeeAmountType {
	return Object.values(FeeAmount).includes(fee as FeeAmountType);
}

/**
 * Converts fee amount to human-readable percentage string
 * 
 * @param fee - The fee amount
 * @returns Formatted percentage string
 * @throws {Error} If the fee amount is not supported
 * 
 * @example
 * ```typescript
 * console.log(formatFeePercentage(3000)); // "0.30%"
 * console.log(formatFeePercentage(FeeAmount.LOW)); // "0.05%"
 * ```
 */
export function formatFeePercentage(fee: FeeAmountType): string {
	return getFeeTierInfo(fee).percentage;
}

/**
 * Gets all available fee tiers with their information
 * 
 * @returns Array of all fee tier information
 * 
 * @example
 * ```typescript
 * const allTiers = getAllFeeTiers();
 * allTiers.forEach(tier => {
 *   console.log(`${tier.percentage}: ${tier.description}`);
 * });
 * ```
 */
export function getAllFeeTiers(): FeeTierInfo[] {
	return Object.values(FEE_TIER_INFO);
}

/**
 * Finds the most appropriate fee tier for a given use case
 * 
 * @param isStablePair - Whether the pair consists of stable assets
 * @param isExoticPair - Whether the pair includes exotic/volatile assets
 * @returns Recommended fee amount
 * 
 * @example
 * ```typescript
 * const stableFee = getRecommendedFeeTier(true, false); // FeeAmount.LOWEST
 * const exoticFee = getRecommendedFeeTier(false, true); // FeeAmount.HIGH
 * const standardFee = getRecommendedFeeTier(false, false); // FeeAmount.MEDIUM
 * ```
 */
export function getRecommendedFeeTier(isStablePair: boolean, isExoticPair: boolean): FeeAmountType {
	if (isStablePair) {
		return FeeAmount.LOWEST;
	}
	if (isExoticPair) {
		return FeeAmount.HIGH;
	}
	return FeeAmount.MEDIUM;
}
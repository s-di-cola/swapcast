/**
 * Validation utilities for swap and prediction forms
 */
import type { PredictionSide, Token } from '$lib/types';

/**
 * Validate swap and prediction form inputs
 * 
 * @param params - Object containing all validation parameters
 * @returns Array of validation error messages
 */
export function validateSwapForm({
    isConnected,
    marketData,
    disabled,
    payAmount,
    payToken,
    payTokenBalance,
    predictionSide,
    predictedTargetPrice,
    receiveAmount,
    receiveToken,
    exchangeRate
}: {
    isConnected: boolean;
    marketData: any | null;
    disabled: boolean;
    payAmount: number;
    payToken: Token | null;
    payTokenBalance: number;
    predictionSide: PredictionSide;
    predictedTargetPrice: number | undefined;
    receiveAmount: number;
    receiveToken: Token | null;
    exchangeRate: number;
}): string[] {
    const errors: string[] = [];

    if (!isConnected) {
        errors.push('Please connect your wallet');
    }

    if (!marketData) {
        errors.push('Market data not available');
    }

    if (disabled) {
        errors.push('Trading is currently disabled');
    }

    if (payAmount <= 0) {
        errors.push('Enter an amount to pay');
    } else {
        if (payToken?.symbol && isConnected) {
            if (payTokenBalance === 0) {
                errors.push(`No ${payToken.symbol} balance available`);
            } else if (payAmount > payTokenBalance) {
                const flooredBalance = Math.floor(payTokenBalance * 1000000) / 1000000;
                const flooredAmount = Math.floor(payAmount * 1000000) / 1000000;
                errors.push(`Insufficient ${payToken.symbol} balance (need ${flooredAmount.toFixed(6)}, have ${flooredBalance.toFixed(6)})`);
            }
        }
    }

    if (!predictionSide) {
        errors.push('Select a price prediction');
    }

    if (!predictedTargetPrice || predictedTargetPrice <= 0) {
        errors.push('Enter a target price');
    }

    if (payAmount > 0 && receiveAmount <= 0) {
        errors.push('Cannot calculate swap output. Pool may have insufficient liquidity.');
    }

    if (payAmount > 0 && receiveAmount > 0) {
        const expectedAmount = payAmount * exchangeRate;
        const ratio = receiveAmount / expectedAmount;
        
        if (ratio > 2 || ratio < 0.5) {
            errors.push(`Swap quote looks suspicious. Expected ~${expectedAmount.toFixed(6)} ${receiveToken?.symbol}, got ${receiveAmount.toFixed(6)}`);
        }
    }

    return errors;
}

/**
 * Check if the form is valid
 * 
 * @param errors - Array of validation errors
 * @returns Boolean indicating if the form is valid
 */
export function isFormValid(errors: string[]): boolean {
    return errors.length === 0;
}

/**
 * Get the primary error message
 * 
 * @param errors - Array of validation errors
 * @returns The first error message or empty string
 */
export function getPrimaryError(errors: string[]): string {
    return errors.length > 0 ? errors[0] : '';
}

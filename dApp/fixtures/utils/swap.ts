/**
 * @file Swap direction and validation utilities for predictions
 * @description Handles swap direction determination and validation for prediction markets
 * @module utils/swap
 */

import { logInfo, logWarning } from '../utils/error';
import { OUTCOME_BEARISH, OUTCOME_BULLISH } from '../predictions/prediction-swap';

/**
 * Determines the correct swap direction and required token for a prediction
 * @param outcome - The prediction outcome (BULLISH or BEARISH)
 * @param market - Market with token0 and token1 information
 * @returns Object containing:
 *   - zeroForOne: Boolean indicating swap direction
 *   - requiredTokenSymbol: Symbol of the token needed for the swap
 *   - swapDescription: Human-readable description of the swap
 */
export function getSwapRequirements(
    outcome: typeof OUTCOME_BULLISH | typeof OUTCOME_BEARISH,
    market: { token0: { symbol: string }, token1: { symbol: string } }
): {
    zeroForOne: boolean;
    requiredTokenSymbol: string;
    swapDescription: string;
} {
    const isBearish = outcome === OUTCOME_BEARISH;
    
    // For ETH/USDC markets:
    // - BEARISH prediction: Sell ETH for USDC (zeroForOne = true)
    // - BULLISH prediction: Sell USDC for ETH (zeroForOne = false)
    
    if (market.token0.symbol === 'ETH' && market.token1.symbol === 'USDC') {
        if (isBearish) {
            return {
                zeroForOne: true,
                requiredTokenSymbol: 'ETH',
                swapDescription: 'Selling ETH for USDC (bearish)'
            };
        } else {
            return {
                zeroForOne: false,
                requiredTokenSymbol: 'USDC',
                swapDescription: 'Selling USDC for ETH (bullish)'
            };
        }
    }
    
    // For other pairs, use the general logic
    if (isBearish) {
        return {
            zeroForOne: true,
            requiredTokenSymbol: market.token0.symbol,
            swapDescription: `Selling ${market.token0.symbol} for ${market.token1.symbol} (bearish)`
        };
    } else {
        return {
            zeroForOne: false,
            requiredTokenSymbol: market.token1.symbol,
            swapDescription: `Selling ${market.token1.symbol} for ${market.token0.symbol} (bullish)`
        };
    }
}

/**
 * Validates that a whale has the required token for their prediction
 * @param whale - The whale account to validate
 * @param outcome - The prediction outcome (BULLISH or BEARISH)
 * @param market - Market information containing token details
 * @param stakeAmount - Amount needed for the prediction in wei
 * @param validateBalance - Async function to validate whale's token balance
 * @returns Promise resolving to an object with:
 *   - valid: boolean indicating if requirements are met
 *   - error?: optional error message if validation fails
 */
export async function validatePredictionRequirements(
    whale: any,
    outcome: typeof OUTCOME_BULLISH | typeof OUTCOME_BEARISH,
    market: { token0: { symbol: string }, token1: { symbol: string } },
    stakeAmount: bigint,
    validateBalance: (whale: any, token: string, amount: bigint) => Promise<{ valid: boolean }>
): Promise<{ valid: boolean; error?: string }> {
    
    const { requiredTokenSymbol, swapDescription } = getSwapRequirements(outcome, market);
    
    logInfo('SwapValidation', `🔍 ${whale.name} wants to make ${swapDescription}`);
    logInfo('SwapValidation', `📋 Required token: ${requiredTokenSymbol}`);
    
    // Always check ETH for fees
    const ethCheck = await validateBalance(whale, 'ETH', stakeAmount);
    if (!ethCheck.valid) {
        return {
            valid: false,
            error: `Insufficient ETH for fees`
        };
    }
    
    // Check the specific token needed for this swap direction
    if (requiredTokenSymbol !== 'ETH') {
        const tokenCheck = await validateBalance(whale, requiredTokenSymbol, stakeAmount);
        if (!tokenCheck.valid) {
            return {
                valid: false,
                error: `Insufficient ${requiredTokenSymbol} for ${swapDescription}`
            };
        }
    }
    
    logInfo('SwapValidation', `✅ ${whale.name} has sufficient ${requiredTokenSymbol} for prediction`);
    return { valid: true };
}

/**
 * Selects a suitable whale for making a prediction based on token requirements
 * @param whales - Array of available whale accounts
 * @param marketId - ID of the target market
 * @param market - Market information including token pairs
 * @param stakeAmount - Required stake amount in wei
 * @param validateBalance - Async function to validate token balances
 * @returns Promise resolving to the selected whale or null if none suitable
 */
export async function selectWhaleForPrediction(
    whales: any[],
    marketId: string,
    market: { token0: { symbol: string }, token1: { symbol: string } },
    stakeAmount: bigint,
    validateBalance: (whale: any, token: string, amount: bigint) => Promise<{ valid: boolean }>
): Promise<any | null> {
    
    // Filter whales that haven't predicted on this market
    const availableWhales = whales.filter(whale => 
        !whale.predictedMarkets.has(marketId)
    );
    
    if (availableWhales.length === 0) {
        logWarning('WhaleSelection', `No whales available for market ${marketId}`);
        return null;
    }
    
    logInfo('WhaleSelection', `🎯 ${availableWhales.length} whales available for market ${marketId}`);
    
    // Try both outcomes to find a suitable whale
    const outcomes = [OUTCOME_BEARISH, OUTCOME_BULLISH];
    
    for (const outcome of outcomes) {
        logInfo('WhaleSelection', `🧪 Testing ${outcome === OUTCOME_BEARISH ? 'BEARISH' : 'BULLISH'} predictions...`);
        
        for (const whale of availableWhales) {
            const validation = await validatePredictionRequirements(
                whale, 
                outcome as 0 | 1, 
                market, 
                stakeAmount, 
                validateBalance
            );
            
            if (validation.valid) {
                logInfo('WhaleSelection', `✅ Selected ${whale.name} for ${outcome === OUTCOME_BEARISH ? 'BEARISH' : 'BULLISH'} prediction`);
                
                // Mark whale as used and return with the outcome
                whale.usedInMarkets.add(marketId);
                return { whale, outcome };
            } else {
                logInfo('WhaleSelection', `❌ ${whale.name} cannot make ${outcome === OUTCOME_BEARISH ? 'BEARISH' : 'BULLISH'} prediction: ${validation.error}`);
            }
        }
    }
    
    logWarning('WhaleSelection', `❌ No whales can make any predictions on market ${marketId}`);
    return null;
}
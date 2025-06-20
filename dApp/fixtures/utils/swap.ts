/**
 * @fileoverview Fix swap direction logic for predictions
 * @description Corrects the mismatch between prediction outcome and swap direction
 */

import { logInfo, logWarning } from '../utils/error';
import { OUTCOME_BEARISH, OUTCOME_BULLISH } from '../predictions/prediction-swap';

/**
 * Determine the correct swap direction and required token for a prediction
 * 
 * @param outcome - The prediction outcome (BULLISH or BEARISH)
 * @param market - Market with token0 and token1 information
 * @returns Object with swap direction and required token information
 */
export function getSwapRequirements(
    outcome: typeof OUTCOME_BULLISH | typeof OUTCOME_BEARISH,
    market: { token0: { symbol: string }, token1: { symbol: string } }
): {
    zeroForOne: boolean;
    requiredTokenSymbol: string;
    swapDescription: string;
} {
    // For ETH/USDC markets:
    // - BEARISH prediction: Sell ETH for USDC (zeroForOne = true)
    // - BULLISH prediction: Sell USDC for ETH (zeroForOne = false)
    
    const isBearish = outcome === OUTCOME_BEARISH;
    
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
 * Validate that a whale has the required token for their prediction
 * 
 * @param whale - The whale account
 * @param outcome - The prediction outcome
 * @param market - Market information
 * @param stakeAmount - Amount needed for the prediction
 * @param validateBalance - Function to validate whale balance
 * @returns Promise<boolean> - True if whale has sufficient balance
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
 * Enhanced whale selection that considers prediction requirements
 * 
 * @param whales - Array of available whales
 * @param marketId - Market ID
 * @param market - Market information
 * @param stakeAmount - Required stake amount
 * @param validateBalance - Balance validation function
 * @returns Promise<WhaleAccount | null> - Selected whale or null
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
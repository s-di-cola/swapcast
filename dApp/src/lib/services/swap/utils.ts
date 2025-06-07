/**
 * Swap utility functions for handling swap-related operations
 */
import { parseUnits, formatUnits, type Address } from 'viem';
import { getTokenDecimals, getTokenAddress } from '$lib/services/token/utils';
import { getPoolKey } from '$lib/services/market/operations';
import { getSwapQuote } from '$lib/services/swap';
import { toastStore } from '$lib/stores/toastStore';

/**
 * Verify that a market exists on-chain before allowing swap execution
 * 
 * @param marketIdToCheck - The market ID to verify
 * @returns Promise resolving to boolean indicating if market exists
 */
export async function verifyMarketExists(marketIdToCheck: string): Promise<boolean> {
    if (!marketIdToCheck) {
        console.error('No market ID provided for verification');
        return false;
    }
    
    try {
        const poolKey = await getPoolKey(marketIdToCheck);
        if (!poolKey) {
            console.error(`No pool key found for market ID ${marketIdToCheck}`);
            return false;
        }
        
        return true;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error verifying market existence: ${errorMessage}`);
        return false;
    }
}

/**
 * Calculate prediction stake amount (1% of pay amount, minimum 0.001 ETH)
 * 
 * @param payAmount - The amount being paid in the swap
 * @returns The calculated prediction stake amount
 */
export function calculatePredictionStakeAmount(payAmount: number): number {
    return Math.max(0.001, payAmount * 0.01);
}

/**
 * Update receive amount using real pool quotes with proper decimal handling
 * 
 * @param marketId - The market ID
 * @param marketData - The market data
 * @param payAmount - The amount being paid
 * @param payToken - The token being paid
 * @param poolPrices - The pool prices
 * @returns Promise resolving to the calculated receive amount
 */
export async function calculateReceiveAmount(
    marketId: string | null,
    marketData: any | null,
    payAmount: number,
    payToken: { symbol: string },
    poolPrices: any | null
): Promise<number> {
    if (payAmount <= 0 || !marketId || !payToken?.symbol) {
        return 0;
    }

    if (!poolPrices) {
        const rate = calculateExchangeRate(poolPrices, marketData?.assetPair, payToken, { symbol: '' });
        return payAmount * rate;
    }

    try {
        const actualPayTokenAddress = getTokenAddress(payToken.symbol);
        const payTokenDecimals = await getTokenDecimals(actualPayTokenAddress);
        const amountBigInt = parseUnits(payAmount.toString(), payTokenDecimals);

        if (!marketData) {
            console.error('Market data not available');
            return 0;
        }

        if (!marketId) {
            throw new Error('Market ID is required');
        }
        
        const poolKey = await getPoolKey(marketId);
        if (!poolKey) {
            throw new Error(`Failed to get pool key for market ID ${marketId}`);
        }

        const quoteResult = await getSwapQuote(marketId, actualPayTokenAddress, amountBigInt);

        if (quoteResult.success && quoteResult.quote) {
            const receiveTokenAddress = quoteResult.quote.tokenOut;
            const receiveTokenDecimals = await getTokenDecimals(receiveTokenAddress);
            const receiveAmount = Number(quoteResult.quote.amountOut) / (10 ** receiveTokenDecimals);
            
            console.log('Swap quote received:', {
                tokenIn: quoteResult.quote.tokenIn,
                tokenOut: quoteResult.quote.tokenOut,
                amountIn: quoteResult.quote.amountIn.toString(),
                amountOut: quoteResult.quote.amountOut.toString(),
                receiveTokenDecimals,
                calculatedReceiveAmount: receiveAmount
            });
            
            return receiveAmount;
        } else {
            console.error('Failed to get swap quote:', quoteResult.error);

            if (quoteResult.error === 'ZERO_LIQUIDITY_POOL') {
                toastStore.warning(quoteResult.details || 'This pool has no liquidity. Swap quotes may not be accurate.', {
                    duration: 6000,
                    position: 'top-center'
                });
            }

            const rate = calculateExchangeRate(poolPrices, marketData?.assetPair, payToken, { symbol: '' });
            return payAmount * rate;
        }
    } catch (error) {
        console.error('Error updating receive amount:', error);
        const rate = calculateExchangeRate(poolPrices, marketData?.assetPair, payToken, { symbol: '' });
        return payAmount * rate;
    }
}

/**
 * Calculate exchange rate between pay and receive tokens
 * 
 * @param poolPrices - The pool prices
 * @param assetPair - The asset pair
 * @param payToken - The token being paid
 * @param receiveToken - The token being received
 * @returns The calculated exchange rate
 */
export function calculateExchangeRate(
    poolPrices: any | null,
    assetPair: string | undefined,
    payToken: { symbol: string } | null,
    receiveToken: { symbol: string } | null
): number {
    if (!poolPrices || !assetPair || !payToken || !receiveToken) {
        return 0;
    }

    try {
        // Get pool key to determine token order
        const actualPayTokenAddress = getTokenAddress(payToken.symbol);
        const actualReceiveTokenAddress = getTokenAddress(receiveToken.symbol);
        
        // This should match your pool key creation logic
        const [sortedToken0, sortedToken1] = [actualPayTokenAddress, actualReceiveTokenAddress].sort();
        
        const isPayTokenCurrency0 = actualPayTokenAddress.toLowerCase() === sortedToken0.toLowerCase();
        
        console.log('Exchange rate calculation debug:', {
            payToken: payToken.symbol,
            receiveToken: receiveToken.symbol,
            actualPayTokenAddress,
            actualReceiveTokenAddress,
            sortedToken0,
            sortedToken1,
            isPayTokenCurrency0,
            token0Price: poolPrices.token0Price,
            token1Price: poolPrices.token1Price
        });

        // Use the same logic as getSwapQuote
        let rate;
        if (isPayTokenCurrency0) {
            // Paying with token0, receiving token1: use token0Price
            rate = poolPrices.token0Price;
            console.log(`Pay token is currency0, using token0Price: ${rate}`);
        } else {
            // Paying with token1, receiving token0: use token1Price  
            rate = poolPrices.token1Price;
            console.log(`Pay token is currency1, using token1Price: ${rate}`);
        }

        return rate || 0;
    } catch (error) {
        console.error('Error calculating exchange rate:', error);
        return 0;
    }
}

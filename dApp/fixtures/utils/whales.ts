import { type Address, formatEther, parseEther, getAddress } from 'viem';
import { getPublicClient } from './client';
import { getTokenBalance, isNativeEth, dealLiquidity } from './tokens';
import { logInfo, logSuccess, logWarning } from './error';
import { TOKEN_CONFIGS } from '../config/tokens';
import { OUTCOME_BEARISH, OUTCOME_BULLISH } from '../predictions/prediction-swap';
import { validatePredictionRequirements } from './swap';
 
export const WHALE_ACCOUNTS: Record<string, Address> = {
    BINANCE_7: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8',
    ROBINHOOD: '0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489',
    BINANCE_PEG: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
    BITFINEX_19: '0xE92d1A43df510F82C66382592a047d288f85226f',
    BINANCE_28: '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb',
    UNKNOWN_0A: '0x0a4c79cE84202b03e95B7a692E5D728d83C44c76',
    KRAKEN_1: '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',           
    JUMP_TRADING: '0xf977814e90da44bfa03b6295a0616a897441acec',
    WHALE_2: '0x564286362092D8e7936f0549571a803B203aAceD',             
    WHALE_3: '0x57757E3D981446D585Af0D9Ae4d7DF6D64647806',
    WHALE_4: '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b',             
    COINBASE_1: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
    COINBASE_2: '0x503828976d22510aad0201ac7ec88293211d23da',
};

/**
 * Enhanced whale account interface with balance tracking and prediction history
 * 
 * @interface WhaleAccount
 * @property {Address} address - The checksummed Ethereum address of the whale
 * @property {string} name - Human-readable name identifier for the whale
 * @property {Map<string, bigint>} balances - Token balances cache (symbol -> balance in native decimals)
 * @property {Set<string>} usedInMarkets - Markets where this whale has been used for operations
 * @property {Set<string>} predictedMarkets - Markets where this whale has already made predictions (prevents duplicates)
 * @property {bigint} totalETH - Total ETH balance in wei
 * @property {Set<string>} hasTokens - Set of token symbols this whale has meaningful balances for
 * @property {number} lastValidated - Timestamp of last balance validation
 * @property {'pending' | 'valid' | 'insufficient' | 'error'} validationStatus - Current validation status
 */
export interface WhaleAccount {
    address: Address;
    name: string;
    balances: Map<string, bigint>;
    usedInMarkets: Set<string>;
    predictedMarkets: Set<string>;
    totalETH: bigint;
    hasTokens: Set<string>;
    lastValidated: number;
    validationStatus: 'pending' | 'valid' | 'insufficient' | 'error';
}

/**
 * Ensures a whale has sufficient token balances by dealing tokens if necessary
 * 
 * @param {WhaleAccount} whale - The whale account to ensure has tokens
 * @param {string[]} requiredTokens - Array of token symbols required
 * @param {bigint} stakeAmount - The amount needed for staking (in wei for ETH, native decimals for tokens)
 * @returns {Promise<boolean>} True if whale has or was successfully dealt all required tokens
 */
export const ensureWhaleHasTokens = async (
    whale: WhaleAccount,
    requiredTokens: string[],
    stakeAmount: bigint
): Promise<boolean> => {
    for (const tokenSymbol of requiredTokens) {
        if (tokenSymbol === 'ETH') continue;

        const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
        if (!tokenConfig) continue;

        const balanceCheck = await validateWhaleBalanceForSwap(whale, tokenSymbol, stakeAmount);

        if (!balanceCheck.valid) {
            logInfo('TokenDealing', `Dealing ${tokenSymbol} to ${whale.name}`);

            const dealAmount = ['USDC', 'USDT'].includes(tokenSymbol)
                ? BigInt('100000000000') // 100k with 6 decimals
                : parseEther('1000');     // 1000 tokens with 18 decimals

            try {
                await dealLiquidity(
                    whale.address,
                    '0x0000000000000000000000000000000000000000' as Address,
                    tokenConfig.address as Address,
                    parseEther('10'),
                    dealAmount
                );
                logSuccess('TokenDealing', `✅ Dealt ${tokenSymbol} to ${whale.name}`);
            } catch (error) {
                logWarning('TokenDealing', `Failed to deal ${tokenSymbol}: ${error}`);
                return false;
            }
        }
    }
    return true;
};

/**
 * Utility function to ensure address has proper EIP-55 checksum
 * 
 * @param {string} address - Raw address string to validate and checksum
 * @returns {Address} Checksummed address
 * @throws {Error} If address format is invalid
 */
function ensureChecksumAddress(address: string): Address {
    try {
        return getAddress(address);
    } catch (error) {
        logWarning('AddressValidation', `Invalid address format: ${address}`);
        throw new Error(`Invalid address: ${address}`);
    }
}

/**
 * Initialize REAL whale accounts with comprehensive balance checking and validation
 * 
 * This function:
 * 1. Iterates through all predefined whale addresses
 * 2. Validates ETH balances (minimum 10 ETH to qualify as "whale")
 * 3. Checks token balances for major DeFi tokens
 * 4. Creates WhaleAccount objects with full balance tracking
 * 5. Sorts whales by ETH balance (richest first)
 * 
 * @returns {Promise<WhaleAccount[]>} Array of initialized and validated whale accounts
 */
export async function initializeWhaleAccounts(): Promise<WhaleAccount[]> {
    logInfo('WhaleInit', '🐋 Initializing REAL whale accounts (actually rich ones)...');

    const whaleAccounts: WhaleAccount[] = [];
    const publicClient = getPublicClient();
    const tokensToCheck = ['ETH', 'USDC', 'USDT', 'DAI', 'LINK', 'UNI', 'AAVE'];

    let validWhaleCount = 0;

    for (const [name, rawAddress] of Object.entries(WHALE_ACCOUNTS)) {
        try {
            const address = ensureChecksumAddress(rawAddress);

            const whale: WhaleAccount = {
                address,
                name,
                balances: new Map(),
                usedInMarkets: new Set(),
                predictedMarkets: new Set(),
                totalETH: 0n,
                hasTokens: new Set(),
                lastValidated: Date.now(),
                validationStatus: 'pending'
            };

            logInfo('WhaleCheck', `Checking ${name} (${address.slice(0, 10)}...):`);

            // Check ETH balance first (quick filter)
            try {
                const ethBalance = await publicClient.getBalance({ address });
                whale.totalETH = ethBalance;
                whale.balances.set('ETH', ethBalance);

                // Skip whales with less than 10 ETH (they're not real whales)
                if (ethBalance < parseEther('10')) {
                    logWarning('WhaleInit', `❌ ${name} has only ${formatEther(ethBalance)} ETH - not a real whale`);
                    continue;
                }

                whale.hasTokens.add('ETH');
                logInfo('WhaleBalance', `  ✅ ETH: ${formatEther(ethBalance)}`);

            } catch (error) {
                logWarning('WhaleInit', `❌ Error checking ETH for ${name}: ${String(error).slice(0, 50)}...`);
                continue;
            }

            // Check other token balances (but don't require them)
            for (const tokenSymbol of tokensToCheck) {
                if (tokenSymbol === 'ETH') continue; // Already checked

                const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
                if (!tokenConfig) continue;

                try {
                    const tokenAddress = ensureChecksumAddress(tokenConfig.address);
                    const balance = await getTokenBalance(tokenAddress, address);
                    whale.balances.set(tokenSymbol, balance);

                    // Lower thresholds - we just want to know what they have
                    let minThreshold: bigint;
                    if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') {
                        minThreshold = BigInt('100000000'); // 100 USDC/USDT (6 decimals)
                    } else {
                        minThreshold = parseEther('0.1'); // 0.1 token minimum
                    }

                    if (balance >= minThreshold) {
                        whale.hasTokens.add(tokenSymbol);

                        const formattedBalance = isNativeEth(tokenAddress)
                            ? formatEther(balance)
                            : (Number(balance) / (10 ** tokenConfig.decimals)).toLocaleString();

                        logInfo('WhaleBalance', `  ✅ ${tokenSymbol}: ${formattedBalance}`);
                    } else if (balance > 0n) {
                        const formattedBalance = isNativeEth(tokenAddress)
                            ? formatEther(balance)
                            : (Number(balance) / (10 ** tokenConfig.decimals)).toFixed(6);

                        logInfo('WhaleBalance', `  🔸 ${tokenSymbol}: ${formattedBalance} (small amount)`);
                    }

                } catch (error) {
                    // Don't log individual token errors - too spammy
                    whale.balances.set(tokenSymbol, 0n);
                }
            }

            // Add all whales with >10 ETH (they're real whales)
            whale.validationStatus = 'valid';
            whaleAccounts.push(whale);
            validWhaleCount++;

            logSuccess('WhaleInit',
                `✅ Added ${name} (${formatEther(whale.totalETH)} ETH, ${whale.hasTokens.size} tokens: ${Array.from(whale.hasTokens).join(', ')})`
            );

        } catch (error) {
            logWarning('WhaleInit', `❌ Error processing ${name}: ${String(error).slice(0, 100)}...`);
            continue;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Sort by ETH balance (richest first)
    whaleAccounts.sort((a, b) => b.totalETH > a.totalETH ? 1 : -1);

    logSuccess('WhaleInit', `🎯 Found ${validWhaleCount} REAL whales (all with >10 ETH)!`);

    // Log top 10 whales for verification
    if (whaleAccounts.length > 0) {
        logInfo('WhaleInit', '🏆 Top 10 REAL whales by ETH balance:');
        whaleAccounts.slice(0, 10).forEach((whale, index) => {
            logInfo('WhaleTop10',
                `  ${index + 1}. ${whale.name}: ${formatEther(whale.totalETH)} ETH (${whale.hasTokens.size} tokens)`
            );
        });
    }

    return whaleAccounts;
}

/**
 * Enhanced whale selection with harmonized balance checking and prediction tracking
 * 
 * This function implements a multi-tier selection strategy:
 * 1. Filters out whales that have already predicted on this market
 * 2. Checks ETH and token balance requirements
 * 3. Falls back to ETH-only whales if needed
 * 4. Allows whale reuse as last resort
 * 
 * @param {WhaleAccount[]} whaleAccounts - Array of available whale accounts
 * @param {string} marketId - The market ID to select a whale for
 * @param {string[]} requiredTokens - Array of token symbols required for this market
 * @param {bigint} requiredAmount - Required amount in 18-decimal normalized units
 * @returns {WhaleAccount | null} Selected whale account or null if none available
 */
export function selectWhaleForMarket(
    whaleAccounts: WhaleAccount[],
    marketId: string,
    requiredTokens: string[],
    requiredAmount: bigint
): WhaleAccount | null {

    logInfo('WhaleSelection', `🎯 Selecting whale for market ${marketId} (harmonized)`);
    logInfo('WhaleSelection', `Required tokens: ${requiredTokens.join(', ')}`);
    logInfo('WhaleSelection', `Required amount: ${formatEther(requiredAmount)} ETH-equivalent`);

    // STEP 1: Filter out whales that have already predicted on this market
    const availableWhales = whaleAccounts.filter(whale => 
        !whale.predictedMarkets.has(marketId)
    );

    if (availableWhales.length === 0) {
        logWarning('WhaleSelection', `❌ All whales have already predicted on market ${marketId}`);
        return null;
    }

    logInfo('WhaleSelection', `📊 Found ${availableWhales.length}/${whaleAccounts.length} whales available for market ${marketId}`);

    // STEP 2: Find whales with sufficient harmonized balances
    const suitableWhales = availableWhales.filter(whale => {
        const notUsed = !whale.usedInMarkets.has(marketId);

        // Check ETH requirement (already 18 decimals)
        const ethBalance = whale.balances.get('ETH') || 0n;
        const hasEnoughETH = ethBalance >= requiredAmount;

        // Check required tokens with reasonable thresholds
        const hasRequiredTokens = requiredTokens.every(token => {
            const tokenConfig = TOKEN_CONFIGS[token];
            if (!tokenConfig) return false;

            const rawBalance = whale.balances.get(token) || 0n;
            const normalizedBalance = normalizeToEther(rawBalance, tokenConfig.decimals);

            // Reasonable minimum thresholds in 18-decimal units
            let minThreshold: bigint;
            if (token === 'ETH') {
                minThreshold = requiredAmount;
            } else if (token === 'USDC' || token === 'USDT') {
                minThreshold = parseEther('50'); // $50 equivalent
            } else {
                minThreshold = parseEther('1'); // 1 token equivalent
            }

            return normalizedBalance >= minThreshold;
        });

        logInfo('WhaleCheck',
            `${whale.name}: unused=${notUsed}, ETH=${hasEnoughETH} (${formatEther(ethBalance)}), ` +
            `tokens=${hasRequiredTokens}`
        );

        return notUsed && hasEnoughETH && hasRequiredTokens;
    });

    if (suitableWhales.length > 0) {
        const selectedWhale = suitableWhales[0];
        selectedWhale.usedInMarkets.add(marketId);
        logSuccess('WhaleSelection', `🎯 Selected ${selectedWhale.name} (harmonized validation)`);
        return selectedWhale;
    }

    // STEP 3: Fallback to ETH-only whales
    const ethOnlyWhales = availableWhales.filter(whale => {
        const notUsed = !whale.usedInMarkets.has(marketId);
        const ethBalance = whale.balances.get('ETH') || 0n;
        const hasEnoughETH = ethBalance >= requiredAmount * 2n;
        return notUsed && hasEnoughETH;
    });

    if (ethOnlyWhales.length > 0) {
        const selectedWhale = ethOnlyWhales[0];
        selectedWhale.usedInMarkets.add(marketId);
        logInfo('WhaleSelection', `⚠️ Selected ${selectedWhale.name} (ETH only - harmonized)`);
        return selectedWhale;
    }

    logWarning('WhaleSelection', `❌ No suitable whales found for market ${marketId}`);
    return null;
}

/**
 * Check if a whale can make a prediction on a specific market
 * 
 * @param {WhaleAccount} whale - The whale account to check
 * @param {string} marketId - The market ID to check
 * @returns {boolean} True if whale hasn't predicted on this market yet
 */
export function canWhalePredict(whale: WhaleAccount, marketId: string): boolean {
    return !whale.predictedMarkets.has(marketId);
}

/**
 * Mark a whale as having made a prediction on a specific market
 * 
 * This prevents the whale from being selected again for the same market,
 * avoiding the AlreadyPredictedL error from the smart contract.
 * 
 * @param {WhaleAccount} whale - The whale account that made the prediction
 * @param {string} marketId - The market ID where the prediction was made
 */
export function markWhalePredicted(whale: WhaleAccount, marketId: string): void {
    whale.predictedMarkets.add(marketId);
    logInfo('WhaleTracker', `📝 ${whale.name} marked as predicted on market ${marketId}`);
}

/**
 * Normalize any token balance to 18 decimals for consistent comparison
 * 
 * @param {bigint} balance - The raw token balance in native decimals
 * @param {number} decimals - The number of decimals the token uses
 * @returns {bigint} Balance normalized to 18 decimals
 */
function normalizeToEther(balance: bigint, decimals: number): bigint {
    if (decimals === 18) {
        return balance;
    } else if (decimals < 18) {
        const scaleFactor = 10n ** BigInt(18 - decimals);
        return balance * scaleFactor;
    } else {
        const scaleFactor = 10n ** BigInt(decimals - 18);
        return balance / scaleFactor;
    }
}

/**
 * HARMONIZED: Validate whale balance with everything normalized to 18 decimals
 * 
 * @param {WhaleAccount} whale - The whale account to validate
 * @param {string} tokenSymbol - The token symbol to check (e.g., 'ETH', 'USDC')
 * @param {bigint} requiredAmount - Required amount in 18-decimal normalized units
 * @returns {Promise<{valid: boolean, actualBalance: bigint, formatted: string}>} Validation result
 */
export async function validateWhaleBalanceForSwap(
    whale: WhaleAccount,
    tokenSymbol: string,
    requiredAmount: bigint
): Promise<{ valid: boolean; actualBalance: bigint; formatted: string }> {

    const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
    if (!tokenConfig) {
        return { valid: false, actualBalance: 0n, formatted: '0' };
    }

    try {
        const tokenAddress = ensureChecksumAddress(tokenConfig.address);

        // Get raw balance in token's native decimals
        const rawBalance = await getTokenBalance(tokenAddress, whale.address);

        // HARMONIZE: Convert to 18 decimals for comparison
        const normalizedBalance = normalizeToEther(rawBalance, tokenConfig.decimals);

        // Compare like-for-like (both in 18 decimals)
        const valid = normalizedBalance >= requiredAmount;

        // Format for display (use native decimals)
        const formatted = isNativeEth(tokenAddress)
            ? formatEther(rawBalance)
            : (Number(rawBalance) / (10 ** tokenConfig.decimals)).toFixed(6);

        if (!valid) {
            logWarning('BalanceValidation',
                `❌ ${whale.name} insufficient ${tokenSymbol}: need ${formatEther(requiredAmount)} ETH-equiv, has ${formatted} ${tokenSymbol}`
            );
        } else {
            logInfo('BalanceValidation',
                `✅ ${whale.name} has sufficient ${tokenSymbol}: ${formatted} ${tokenSymbol} (${formatEther(normalizedBalance)} ETH-equiv)`
            );
        }

        whale.balances.set(tokenSymbol, rawBalance);
        whale.lastValidated = Date.now();

        return { valid, actualBalance: rawBalance, formatted };

    } catch (error) {
        logWarning('BalanceValidation',
            `Error checking ${whale.name} balance for ${tokenSymbol}: ${error}`
        );
        return { valid: false, actualBalance: 0n, formatted: 'error' };
    }
}

/**
 * Get required tokens for a market based on its base and quote currencies
 * 
 * @param {Object} market - Market object with base and quote properties
 * @param {string} market.base - Base currency symbol
 * @param {string} market.quote - Quote currency symbol
 * @returns {string[]} Array of required token symbols
 */
export function getMarketTokens(market: { base: string; quote: string }): string[] {
    return [market.base, market.quote];
}

/**
 * Reset whale usage tracking for all whales
 * 
 * This clears the usedInMarkets set for all whales and resets their validation status,
 * allowing them to be used in new market operations.
 * 
 * @param {WhaleAccount[]} whaleAccounts - Array of whale accounts to reset
 */
export function resetWhaleUsage(whaleAccounts: WhaleAccount[]): void {
    whaleAccounts.forEach(whale => {
        whale.usedInMarkets.clear();
        whale.validationStatus = 'pending';
    });
    logInfo('WhaleReset', 'Reset whale usage tracking');
}

/**
 * Get comprehensive statistics about whale usage and distribution
 * 
 * @param {WhaleAccount[]} whaleAccounts - Array of whale accounts to analyze
 * @returns {Object} Statistics object with usage metrics
 */
export function getWhaleStats(whaleAccounts: WhaleAccount[]): {
    totalWhales: number;
    averageMarketsPerWhale: number;
    mostUsedWhale: string;
    unusedWhales: number;
    totalETHAcrossWhales: string;
    tokenCoverage: Record<string, number>;
    validationStatus: Record<string, number>;
    predictionStats: {
        totalPredictions: number;
        averagePredictionsPerWhale: number;
        whalesWithPredictions: number;
    };
} {
    const totalMarkets = whaleAccounts.reduce((sum, whale) => sum + whale.usedInMarkets.size, 0);
    const averageMarketsPerWhale = whaleAccounts.length > 0 ? totalMarkets / whaleAccounts.length : 0;

    const mostUsed = whaleAccounts.reduce((prev, current) =>
        current.usedInMarkets.size > prev.usedInMarkets.size ? current : prev,
        whaleAccounts[0] || { name: 'none', usedInMarkets: new Set() }
    );

    const unusedWhales = whaleAccounts.filter(whale => whale.usedInMarkets.size === 0).length;
    const totalETH = whaleAccounts.reduce((sum, whale) => sum + whale.totalETH, 0n);

    const tokenCoverage: Record<string, number> = {};
    const allTokens = ['ETH', 'USDC', 'USDT', 'DAI', 'LINK', 'UNI', 'AAVE'];

    for (const token of allTokens) {
        tokenCoverage[token] = whaleAccounts.filter(whale => whale.hasTokens.has(token)).length;
    }

    const validationStatus: Record<string, number> = {};
    whaleAccounts.forEach(whale => {
        validationStatus[whale.validationStatus] = (validationStatus[whale.validationStatus] || 0) + 1;
    });

    // Prediction statistics
    const totalPredictions = whaleAccounts.reduce((sum, whale) => sum + whale.predictedMarkets.size, 0);
    const whalesWithPredictions = whaleAccounts.filter(whale => whale.predictedMarkets.size > 0).length;
    const averagePredictionsPerWhale = whalesWithPredictions > 0 ? totalPredictions / whalesWithPredictions : 0;

    return {
        totalWhales: whaleAccounts.length,
        averageMarketsPerWhale,
        mostUsedWhale: mostUsed.name,
        unusedWhales,
        totalETHAcrossWhales: formatEther(totalETH),
        tokenCoverage,
        validationStatus,
        predictionStats: {
            totalPredictions,
            averagePredictionsPerWhale,
            whalesWithPredictions
        }
    };
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
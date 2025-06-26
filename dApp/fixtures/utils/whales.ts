/**
 * @fileoverview Enhanced whale account management with balance preservation
 * @module utils/whales
 */

import {type Address, formatEther, getAddress, parseEther} from 'viem';
import {getPublicClient} from './client';
import {getTokenBalance, isNativeEth} from './tokens';
import {logInfo, logSuccess, logWarning} from './error';
import {TOKEN_CONFIGS} from '../config/tokens';
import {OUTCOME_BEARISH, OUTCOME_BULLISH} from '../predictions/prediction-swap';
import {validatePredictionRequirements} from './swap';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

/**
 * Known whale account addresses
 */
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
 * Enhanced whale account interface with balance tracking
 * @interface WhaleAccount
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
 * Deals only a specific ERC20 token without touching ETH balance
 * @param {Address} to - Recipient address
 * @param {Address} tokenAddress - Token contract address
 * @param {bigint} amount - Amount to deal
 */
async function dealSingleToken(to: Address, tokenAddress: Address, amount: bigint): Promise<void> {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        logInfo('TokenDealing', 'Skipping ETH dealing to preserve whale balance');
        return;
    }

    const dealAmount = amount + (amount * 10n) / 100n;
    logInfo('TokenDealing', `Dealing ${dealAmount.toString()} of token ${tokenAddress} to ${to}`);

    const KNOWN_SLOTS: Record<string, number> = {
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 9,  // USDC
        '0xdac17f958d2ee523a2206206994597c13d831ec7': 2,  // USDT
        '0x6b175474e89094c44da98b954eedeac495271d0f': 2,  // DAI
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 0,  // WBTC
        '0x514910771af9ca656af840dff83e8264ecf986ca': 1,  // LINK
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 4,  // UNI
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 0,  // AAVE
    };

    const tokenLower = tokenAddress.toLowerCase();
    const knownSlot = KNOWN_SLOTS[tokenLower];

    if (knownSlot !== undefined) {
        try {
            logInfo('TokenDealing', `Using known slot ${knownSlot} for token ${tokenAddress}`);

            const slotCmd = `cast keccak $(cast concat-hex $(cast abi-encode "f(address,uint256)" ${to} ${knownSlot}))`;
            const { stdout: storageSlot } = await execAsync(slotCmd);
            const cleanSlot = storageSlot.trim();

            const amountHex = `0x${dealAmount.toString(16).padStart(64, '0')}`;
            const setCmd = `cast rpc anvil_setStorageAt ${tokenAddress} ${cleanSlot} ${amountHex}`;
            await execAsync(setCmd);

            const verifyCmd = `cast call ${tokenAddress} "balanceOf(address)(uint256)" ${to}`;
            const { stdout: balanceResult } = await execAsync(verifyCmd);

            logSuccess('TokenDealing', `✅ Set token balance without touching ETH: ${balanceResult.trim()}`);
        } catch (error) {
            logWarning('TokenDealing', `Failed to deal token ${tokenAddress}: ${error}`);
            throw error;
        }
    } else {
        throw new Error(`Unknown token address: ${tokenAddress}`);
    }
}

/**
 * FIXED: Ensures whale has tokens while preserving ETH balance
 * @param {WhaleAccount} whale - Whale account
 * @param {string[]} requiredTokens - Required token symbols
 * @param {bigint} stakeAmount - Required stake amount
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
            logInfo('TokenDealing', `Dealing ${tokenSymbol} to ${whale.name} (PRESERVING ETH BALANCE)`);

            const dealAmount = ['USDC', 'USDT'].includes(tokenSymbol)
                ? BigInt('100000000000') // 100k tokens with 6 decimals
                : parseEther('1000');     // 1000 tokens with 18 decimals

            try {
                await dealSingleToken(whale.address, tokenConfig.address as Address, dealAmount);
                logSuccess('TokenDealing', `✅ Dealt ${tokenSymbol} to ${whale.name} WITHOUT touching ETH balance`);
            } catch (error) {
                logWarning('TokenDealing', `Failed to deal ${tokenSymbol}: ${error}`);
                return false;
            }
        }
    }
    return true;
};

/**
 * Ensures address has proper EIP-55 checksum
 * @param {string} address - Address to checksum
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
 * Initialize REAL whale accounts with balance checking
 * @returns {Promise<WhaleAccount[]>} Array of whale accounts
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

            try {
                const ethBalance = await publicClient.getBalance({ address });
                whale.totalETH = ethBalance;
                whale.balances.set('ETH', ethBalance);

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

            for (const tokenSymbol of tokensToCheck) {
                if (tokenSymbol === 'ETH') continue;

                const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
                if (!tokenConfig) continue;

                try {
                    const tokenAddress = ensureChecksumAddress(tokenConfig.address);
                    const balance = await getTokenBalance(tokenAddress, address);
                    whale.balances.set(tokenSymbol, balance);

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
                    whale.balances.set(tokenSymbol, 0n);
                }
            }

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

        await new Promise(resolve => setTimeout(resolve, 50));
    }

    whaleAccounts.sort((a, b) => b.totalETH > a.totalETH ? 1 : -1);
    logSuccess('WhaleInit', `🎯 Found ${validWhaleCount} REAL whales (all with >10 ETH)!`);

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
 * Enhanced whale selection with prediction tracking
 */
export function selectWhaleForMarket(
    whaleAccounts: WhaleAccount[],
    marketId: string,
    requiredTokens: string[],
    requiredAmount: bigint
): WhaleAccount | null {

    logInfo('WhaleSelection', `🎯 Selecting whale for market ${marketId}`);

    const availableWhales = whaleAccounts.filter(whale =>
        !whale.predictedMarkets.has(marketId)
    );

    if (availableWhales.length === 0) {
        logWarning('WhaleSelection', `❌ All whales have already predicted on market ${marketId}`);
        return null;
    }

    const suitableWhales = availableWhales.filter(whale => {
        const notUsed = !whale.usedInMarkets.has(marketId);
        const ethBalance = whale.balances.get('ETH') || 0n;
        const hasEnoughETH = ethBalance >= requiredAmount;

        const hasRequiredTokens = requiredTokens.every(token => {
            const tokenConfig = TOKEN_CONFIGS[token];
            if (!tokenConfig) return false;

            const rawBalance = whale.balances.get(token) || 0n;
            const normalizedBalance = normalizeToEther(rawBalance, tokenConfig.decimals);

            let minThreshold: bigint;
            if (token === 'ETH') {
                minThreshold = requiredAmount;
            } else if (token === 'USDC' || token === 'USDT') {
                minThreshold = parseEther('50');
            } else {
                minThreshold = parseEther('1');
            }

            return normalizedBalance >= minThreshold;
        });

        return notUsed && hasEnoughETH && hasRequiredTokens;
    });

    if (suitableWhales.length > 0) {
        const selectedWhale = suitableWhales[0];
        selectedWhale.usedInMarkets.add(marketId);
        logSuccess('WhaleSelection', `🎯 Selected ${selectedWhale.name}`);
        return selectedWhale;
    }

    return null;
}

/**
 * Check if whale can make prediction
 */
export function canWhalePredict(whale: WhaleAccount, marketId: string): boolean {
    return !whale.predictedMarkets.has(marketId);
}

/**
 * Mark whale as having predicted on market
 */
export function markWhalePredicted(whale: WhaleAccount, marketId: string): void {
    whale.predictedMarkets.add(marketId);
    logInfo('WhaleTracker', `📝 ${whale.name} marked as predicted on market ${marketId}`);
}

/**
 * Normalize token balance to 18 decimals
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
 * Validate whale balance with 18-decimal normalization
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
        const rawBalance = await getTokenBalance(tokenAddress, whale.address);
        const normalizedBalance = normalizeToEther(rawBalance, tokenConfig.decimals);
        const valid = normalizedBalance >= requiredAmount;

        const formatted = isNativeEth(tokenAddress)
            ? formatEther(rawBalance)
            : (Number(rawBalance) / (10 ** tokenConfig.decimals)).toFixed(6);

        if (!valid) {
            logWarning('BalanceValidation',
                `❌ ${whale.name} insufficient ${tokenSymbol}: need ${formatEther(requiredAmount)} ETH-equiv, has ${formatted} ${tokenSymbol}`
            );
        } else {
            logInfo('BalanceValidation',
                `✅ ${whale.name} has sufficient ${tokenSymbol}: ${formatted} ${tokenSymbol}`
            );
        }

        whale.balances.set(tokenSymbol, rawBalance);
        whale.lastValidated = Date.now();

        return { valid, actualBalance: rawBalance, formatted };

    } catch (error) {
        logWarning('BalanceValidation', `Error checking ${whale.name} balance for ${tokenSymbol}: ${error}`);
        return { valid: false, actualBalance: 0n, formatted: 'error' };
    }
}

/**
 * Get required tokens for market
 */
export function getMarketTokens(market: { base: string; quote: string }): string[] {
    return [market.base, market.quote];
}

/**
 * Reset whale usage tracking
 */
export function resetWhaleUsage(whaleAccounts: WhaleAccount[]): void {
    whaleAccounts.forEach(whale => {
        whale.usedInMarkets.clear();
        whale.validationStatus = 'pending';
    });
    logInfo('WhaleReset', 'Reset whale usage tracking');
}

/**
 * Get whale statistics
 */
export function getWhaleStats(whaleAccounts: WhaleAccount[]) {
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
 * Enhanced whale selection for predictions
 */
export async function selectWhaleForPrediction(
    whales: any[],
    marketId: string,
    market: { token0: { symbol: string }, token1: { symbol: string } },
    stakeAmount: bigint,
    validateBalance: (whale: any, token: string, amount: bigint) => Promise<{ valid: boolean }>
): Promise<any | null> {

    const availableWhales = whales.filter(whale =>
        !whale.predictedMarkets.has(marketId)
    );

    if (availableWhales.length === 0) {
        logWarning('WhaleSelection', `No whales available for market ${marketId}`);
        return null;
    }

    logInfo('WhaleSelection', `🎯 ${availableWhales.length} whales available for market ${marketId}`);

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
                whale.usedInMarkets.add(marketId);
                return { whale, outcome };
            }
        }
    }

    logWarning('WhaleSelection', `❌ No whales can make any predictions on market ${marketId}`);
    return null;
}

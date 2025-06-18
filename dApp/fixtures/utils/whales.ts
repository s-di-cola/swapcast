import { type Address, formatEther, parseEther } from 'viem';
import { getPublicClient } from './client';
import { getTokenBalance, isNativeEth } from './tokens';
import { logInfo, logSuccess, logWarning } from './error';
import { TOKEN_CONFIGS } from '../config/tokens';

/**
 * VERIFIED multi-token whale accounts from etherscan research
 * These addresses have been confirmed to hold multiple tokens
 */
export const WHALE_ACCOUNTS: Record<string, Address> = {
    // Binance: Hot Wallet - confirmed multi-token whale
    BINANCE_MAIN: '0x28C6c06298d514db089934071355e5743bf21d60',
    
    // Binance: Another major wallet
    BINANCE_COLD: '0xdfd5293d8e347dfe59e90efd55b2956a1343963d',
    
    // Coinbase: Multiple confirmed whales  
    COINBASE_1: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
    COINBASE_2: '0x503828976d22510aad0201ac7ec88293211d23da',
    
    // Kraken wallets
    KRAKEN_1: '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
    KRAKEN_2: '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13',
    
    // Multi-asset DeFi whales
    JUMPTRADING: '0xf977814e90da44bfa03b6295a0616a897441acec', // Jump Trading (confirmed multi-token)
    ALAMEDA: '0x477573f212a7bdd5f7c12889bd1ad0aa44fb82aa',     // Alameda Research
    
    // Ethereum Foundation
    ETHEREUM_FOUNDATION: '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae',
    
    // Cumberland DRW (market maker)
    CUMBERLAND: '0x176f3dab24a159341c0509bb36b833e7fdd0a132'
};

/**
 * Enhanced whale account interface
 */
export interface WhaleAccount {
    address: Address;
    name: string;
    balances: Map<string, bigint>;
    usedInMarkets: Set<string>;
    totalETH: bigint;
    hasTokens: Set<string>; // Track which tokens this whale actually has
}

/**
 * Initialize whale accounts with COMPREHENSIVE balance checking
 */
export async function initializeWhaleAccounts(): Promise<WhaleAccount[]> {
    logInfo('WhaleInit', 'Checking VERIFIED multi-token whale accounts...');

    const whaleAccounts: WhaleAccount[] = [];
    const publicClient = getPublicClient();

    // All tokens we care about
    const tokensToCheck = ['ETH', 'USDC', 'USDT', 'DAI', 'LINK', 'UNI', 'AAVE'];

    for (const [name, address] of Object.entries(WHALE_ACCOUNTS)) {
        const whale: WhaleAccount = {
            address,
            name,
            balances: new Map(),
            usedInMarkets: new Set(),
            totalETH: 0n,
            hasTokens: new Set()
        };

        logInfo('WhaleCheck', `Checking ${name} (${address.slice(0, 10)}...):`);

        // Check ALL tokens for this whale
        for (const tokenSymbol of tokensToCheck) {
            const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
            if (!tokenConfig) continue;

            try {
                const balance = await getTokenBalance(tokenConfig.address as Address, address);
                whale.balances.set(tokenSymbol, balance);

                if (tokenSymbol === 'ETH') {
                    whale.totalETH = balance;
                }

                // Consider whale "has" this token if balance > minimum threshold
                const minThreshold = tokenSymbol === 'ETH' 
                    ? parseEther('1')           // 1 ETH minimum
                    : parseEther('100');        // 100 token minimum (roughly)

                if (balance >= minThreshold) {
                    whale.hasTokens.add(tokenSymbol);
                    
                    const formattedBalance = isNativeEth(tokenConfig.address as Address) 
                        ? formatEther(balance)
                        : (Number(balance) / (10 ** tokenConfig.decimals)).toLocaleString();
                    
                    logInfo('WhaleBalance', `  ✅ ${tokenSymbol}: ${formattedBalance}`);
                } else {
                    logInfo('WhaleBalance', `  ❌ ${tokenSymbol}: insufficient balance`);
                }
                
            } catch (error) {
                logWarning('WhaleBalance', `  ⚠️ ${tokenSymbol}: Error checking balance - ${error}`);
                whale.balances.set(tokenSymbol, 0n);
            }
        }

        // Only add whales that have ETH + at least 2 other tokens
        if (whale.hasTokens.has('ETH') && whale.hasTokens.size >= 3) {
            whaleAccounts.push(whale);
            logSuccess('WhaleInit', `✅ Added ${name} (has ${whale.hasTokens.size} tokens: ${Array.from(whale.hasTokens).join(', ')})`);
        } else {
            logWarning('WhaleInit', `❌ Rejected ${name} (only has ${whale.hasTokens.size} tokens: ${Array.from(whale.hasTokens).join(', ')})`);
        }
    }

    // Sort by ETH balance
    whaleAccounts.sort((a, b) => b.totalETH > a.totalETH ? 1 : -1);

    logSuccess('WhaleInit', `🐋 Found ${whaleAccounts.length} viable multi-token whales!`);
    
    return whaleAccounts;
}

/**
 * PROPER whale selection - check for ACTUAL token holdings
 */
export function selectWhaleForMarket(
    whaleAccounts: WhaleAccount[],
    marketId: string,
    requiredTokens: string[],
    requiredAmount: bigint
): WhaleAccount | null {

    logInfo('WhaleSelection', `Selecting whale for market ${marketId}`);
    logInfo('WhaleSelection', `Required tokens: ${requiredTokens.join(', ')}`);
    logInfo('WhaleSelection', `Required amount: ${formatEther(requiredAmount)} ETH`);

    // Find whales that have ALL required tokens AND haven't been used in this market
    const availableWhales = whaleAccounts.filter(whale => {
        // Check if unused in this market
        const notUsed = !whale.usedInMarkets.has(marketId);
        
        // Check if has ETH for transaction fees
        const hasEnoughETH = whale.totalETH >= requiredAmount;
        
        // Check if has ALL required tokens
        const hasAllTokens = requiredTokens.every(token => whale.hasTokens.has(token));
        
        logInfo('WhaleCheck', `${whale.name}: unused=${notUsed}, ETH=${hasEnoughETH}, tokens=${hasAllTokens} (has: ${Array.from(whale.hasTokens).join(', ')})`);
        
        return notUsed && hasEnoughETH && hasAllTokens;
    });

    if (availableWhales.length === 0) {
        logWarning('WhaleSelection', `No unused whales with required tokens. Trying reuse...`);
        
        // Allow reuse - find any whale with required tokens and ETH
        const reusableWhales = whaleAccounts.filter(whale => {
            const hasEnoughETH = whale.totalETH >= requiredAmount;
            const hasAllTokens = requiredTokens.every(token => whale.hasTokens.has(token));
            return hasEnoughETH && hasAllTokens;
        });
        
        if (reusableWhales.length === 0) {
            logWarning('WhaleSelection', `❌ NO WHALES have the required tokens: ${requiredTokens.join(', ')}`);
            
            // Debug: show what tokens each whale has
            whaleAccounts.forEach(whale => {
                logWarning('WhaleDebug', `${whale.name}: has ${Array.from(whale.hasTokens).join(', ')}`);
            });
            
            return null;
        }
        
        // Use the whale with the most tokens
        const bestWhale = reusableWhales.sort((a, b) => b.hasTokens.size - a.hasTokens.size)[0];
        bestWhale.usedInMarkets.delete(marketId);
        bestWhale.usedInMarkets.add(marketId);
        
        logInfo('WhaleSelection', `♻️ Reusing ${bestWhale.name} (has ${bestWhale.hasTokens.size} tokens)`);
        return bestWhale;
    }

    // Pick the whale with the most tokens (most diversified)
    const selectedWhale = availableWhales.sort((a, b) => b.hasTokens.size - a.hasTokens.size)[0];
    selectedWhale.usedInMarkets.add(marketId);
    
    logSuccess('WhaleSelection', `🎯 Selected ${selectedWhale.name} (${formatEther(selectedWhale.totalETH)} ETH, ${selectedWhale.hasTokens.size} tokens)`);
    return selectedWhale;
}

/**
 * Get tokens required for a market - BOTH tokens needed for swaps
 */
export function getMarketTokens(market: { base: string; quote: string }): string[] {
    // For swaps, we need BOTH tokens in the pair
    // ETH/USDC market needs ETH AND USDC
    // LINK/ETH market needs LINK AND ETH
    return [market.base, market.quote];
}

/**
 * Reset whale usage for new prediction round
 */
export function resetWhaleUsage(whaleAccounts: WhaleAccount[]): void {
    whaleAccounts.forEach(whale => whale.usedInMarkets.clear());
    logInfo('WhaleReset', 'Reset whale usage tracking');
}

/**
 * Get whale usage statistics
 */
export function getWhaleStats(whaleAccounts: WhaleAccount[]): {
    totalWhales: number;
    averageMarketsPerWhale: number;
    mostUsedWhale: string;
    unusedWhales: number;
    totalETHAcrossWhales: string;
    tokenCoverage: Record<string, number>;
} {
    const totalMarkets = whaleAccounts.reduce((sum, whale) => sum + whale.usedInMarkets.size, 0);
    const averageMarketsPerWhale = whaleAccounts.length > 0 ? totalMarkets / whaleAccounts.length : 0;
    
    const mostUsed = whaleAccounts.reduce((prev, current) => 
        current.usedInMarkets.size > prev.usedInMarkets.size ? current : prev
    );
    
    const unusedWhales = whaleAccounts.filter(whale => whale.usedInMarkets.size === 0).length;
    const totalETH = whaleAccounts.reduce((sum, whale) => sum + whale.totalETH, 0n);

    // Calculate token coverage
    const tokenCoverage: Record<string, number> = {};
    const allTokens = ['ETH', 'USDC', 'USDT', 'DAI', 'LINK', 'UNI', 'AAVE'];
    
    for (const token of allTokens) {
        tokenCoverage[token] = whaleAccounts.filter(whale => whale.hasTokens.has(token)).length;
    }

    return {
        totalWhales: whaleAccounts.length,
        averageMarketsPerWhale,
        mostUsedWhale: mostUsed.name,
        unusedWhales,
        totalETHAcrossWhales: formatEther(totalETH),
        tokenCoverage
    };
}
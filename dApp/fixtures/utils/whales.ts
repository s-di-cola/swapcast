import { type Address, formatEther, parseEther, getAddress } from 'viem';
import { getPublicClient } from './client';
import { getTokenBalance, isNativeEth } from './tokens';
import { logInfo, logSuccess, logWarning } from './error';
import { TOKEN_CONFIGS } from '../config/tokens';

/**
 * VERIFIED multi-token whale accounts - KEEP ALL OF THEM
 */
export const WHALE_ACCOUNTS: Record<string, Address> = {
    // The GOOD whale that has everything
    BINANCE_MAIN: getAddress('0x28C6c06298d514db089934071355e5743bf21d60'),
    
    // Other whales
    BINANCE_COLD: getAddress('0xdfd5293d8e347dfe59e90efd55b2956a1343963d'),
    JUMPTRADING: getAddress('0xf977814e90da44bfa03b6295a0616a897441acec'),
    COINBASE_1: getAddress('0x71660c4005ba85c37ccec55d0c4493e66fe775d3'),
    COINBASE_2: getAddress('0x503828976d22510aad0201ac7ec88293211d23da'),
    KRAKEN_1: getAddress('0x2910543af39aba0cd09dbb2d50200b3e800a63d2'),
    KRAKEN_2: getAddress('0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13'),
    CUMBERLAND: getAddress('0x176f3dab24a159341c0509bb36b833e7fdd0a132'),
    ETHEREUM_FOUNDATION: getAddress('0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae'),
    ALAMEDA: getAddress('0x477573f212a7bdd5f7c12889bd1ad0aa44fb82aa')
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
    hasTokens: Set<string>;
}

/**
 * Initialize whale accounts - STOP BEING SO FUCKING PICKY
 */
export async function initializeWhaleAccounts(): Promise<WhaleAccount[]> {
    logInfo('WhaleInit', 'Checking whale accounts - ACCEPTING ALL WITH ETH');

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

        logInfo('WhaleCheck', `Checking ${name}:`);

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

                // MUCH LOWER thresholds - don't be so fucking picky
                let minThreshold: bigint;
                if (tokenSymbol === 'ETH') {
                    minThreshold = parseEther('0.1');  // Just 0.1 ETH minimum
                } else if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') {
                    minThreshold = BigInt('1000000'); // Just 1 USDC/USDT (6 decimals)
                } else {
                    minThreshold = parseEther('0.1');  // Just 0.1 token minimum
                }

                if (balance >= minThreshold) {
                    whale.hasTokens.add(tokenSymbol);
                    
                    const formattedBalance = isNativeEth(tokenConfig.address as Address) 
                        ? formatEther(balance)
                        : (Number(balance) / (10 ** tokenConfig.decimals)).toLocaleString();
                    
                    logInfo('WhaleBalance', `  ✅ ${tokenSymbol}: ${formattedBalance}`);
                } else {
                    logInfo('WhaleBalance', `  ❌ ${tokenSymbol}: ${formatEther(balance)} (below threshold)`);
                }
                
            } catch (error) {
                logWarning('WhaleBalance', `  ⚠️ ${tokenSymbol}: Error - ${error}`);
                whale.balances.set(tokenSymbol, 0n);
            }
        }

        // ONLY require ETH - stop filtering out good whales
        if (whale.hasTokens.has('ETH')) {
            whaleAccounts.push(whale);
            logSuccess('WhaleInit', `✅ Added ${name} (has ${whale.hasTokens.size} tokens: ${Array.from(whale.hasTokens).join(', ')})`);
        } else {
            logWarning('WhaleInit', `❌ Rejected ${name} (no ETH)`);
        }
    }

    // Sort by ETH balance
    whaleAccounts.sort((a, b) => b.totalETH > a.totalETH ? 1 : -1);

    logSuccess('WhaleInit', `🐋 Found ${whaleAccounts.length} whales with ETH!`);
    
    return whaleAccounts;
}

/**
 * PROPER whale selection - but be flexible about token requirements
 */
export function selectWhaleForMarket(
    whaleAccounts: WhaleAccount[],
    marketId: string,
    requiredTokens: string[],
    requiredAmount: bigint
): WhaleAccount | null {

    logInfo('WhaleSelection', `Selecting whale for market ${marketId}`);
    logInfo('WhaleSelection', `Required tokens: ${requiredTokens.join(', ')}`);

    // First try: Find whales with ALL required tokens
    let availableWhales = whaleAccounts.filter(whale => {
        const notUsed = !whale.usedInMarkets.has(marketId);
        const hasEnoughETH = whale.totalETH >= requiredAmount;
        const hasAllTokens = requiredTokens.every(token => whale.hasTokens.has(token));
        
        logInfo('WhaleCheck', `${whale.name}: unused=${notUsed}, ETH=${hasEnoughETH}, tokens=${hasAllTokens} (has: ${Array.from(whale.hasTokens).join(', ')})`);
        
        return notUsed && hasEnoughETH && hasAllTokens;
    });

    if (availableWhales.length > 0) {
        const selectedWhale = availableWhales[0];
        selectedWhale.usedInMarkets.add(marketId);
        logSuccess('WhaleSelection', `🎯 Selected ${selectedWhale.name} (perfect match)`);
        return selectedWhale;
    }

    // Second try: Find whales with just ETH (fuck the other tokens, we'll make it work)
    logWarning('WhaleSelection', `No whales with all tokens, trying ETH-only whales...`);
    
    const ethOnlyWhales = whaleAccounts.filter(whale => {
        const notUsed = !whale.usedInMarkets.has(marketId);
        const hasEnoughETH = whale.totalETH >= requiredAmount;
        
        return notUsed && hasEnoughETH;
    });

    if (ethOnlyWhales.length > 0) {
        const selectedWhale = ethOnlyWhales[0];
        selectedWhale.usedInMarkets.add(marketId);
        logInfo('WhaleSelection', `⚠️ Selected ${selectedWhale.name} (ETH only - may need token dealing)`);
        return selectedWhale;
    }

    // Third try: Allow reuse
    logWarning('WhaleSelection', `No unused whales, trying reuse...`);
    
    const reusableWhales = whaleAccounts.filter(whale => {
        const hasEnoughETH = whale.totalETH >= requiredAmount;
        const hasAllTokens = requiredTokens.every(token => whale.hasTokens.has(token));
        return hasEnoughETH && hasAllTokens;
    });
    
    if (reusableWhales.length > 0) {
        const selectedWhale = reusableWhales[0];
        selectedWhale.usedInMarkets.delete(marketId);
        selectedWhale.usedInMarkets.add(marketId);
        logInfo('WhaleSelection', `♻️ Reusing ${selectedWhale.name}`);
        return selectedWhale;
    }

    // Final try: Any whale with ETH (desperate mode)
    const desperateWhales = whaleAccounts.filter(whale => whale.totalETH >= requiredAmount);
    if (desperateWhales.length > 0) {
        const selectedWhale = desperateWhales[0];
        selectedWhale.usedInMarkets.delete(marketId);
        selectedWhale.usedInMarkets.add(marketId);
        logWarning('WhaleSelection', `💀 DESPERATE: Using ${selectedWhale.name} (ETH only)`);
        return selectedWhale;
    }

    logWarning('WhaleSelection', `❌ NO WHALES AVAILABLE AT ALL`);
    return null;
}

/**
 * Get tokens required for a market
 */
export function getMarketTokens(market: { base: string; quote: string }): string[] {
    return [market.base, market.quote];
}

/**
 * Reset whale usage
 */
export function resetWhaleUsage(whaleAccounts: WhaleAccount[]): void {
    whaleAccounts.forEach(whale => whale.usedInMarkets.clear());
    logInfo('WhaleReset', 'Reset whale usage tracking');
}

/**
 * Get whale statistics
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
import { type Address, formatEther } from 'viem';
import { getPublicClient } from './client';
import { getTokenBalance, isNativeEth } from './tokens';
import { logInfo, logSuccess, logWarning } from './error';
import { TOKEN_CONFIGS } from '../config/tokens';

/**
 * Whale accounts with massive token holdings across different assets
 */
export const WHALE_ACCOUNTS: Record<string, Address> = {
    // Major ETH whales
    ETHEREUM_FOUNDATION: '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae',
    BINANCE_HOT_WALLET: '0x28c6c06298d514db089934071355e5743bf21d60',
    COINBASE_VAULT: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',

    // USDC whales
    USDC_TREASURY: '0x55fe002aeff02f77364de339a1292923a15844b8',
    CENTRE_CONSORTIUM: '0xa191e578a6736167326d05c119ce0c90849e84b7',
    CIRCLE_WALLET: '0x5041ed759dd4afc3a72b8192c143f72f4724081a',

    // USDT whales
    TETHER_TREASURY: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
    BINANCE_USDT: '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',

    // Multi-asset whales
    ALAMEDA_RESEARCH: '0x477573f212a7bdd5f7c12889bd1ad0aa44fb82aa',
    THREE_ARROWS_CAPITAL: '0x2e675eeae4747c248bfddbafaa3a8a2fddfe2b79'
};

/**
 * Enhanced whale account interface with balance tracking
 */
export interface WhaleAccount {
    address: Address;
    name: string;
    balances: Map<string, bigint>;
    usedInMarkets: Set<string>; // Track which markets this whale has predicted in
}

/**
 * Token configurations that whales should have
 */
const WHALE_TOKEN_REQUIREMENTS = {
    ETH: { minBalance: '1000', symbol: 'ETH' },
    USDC: { minBalance: '10000000', symbol: 'USDC' }, // 10M USDC
    USDT: { minBalance: '10000000', symbol: 'USDT' }, // 10M USDT
    DAI: { minBalance: '5000000', symbol: 'DAI' },   // 5M DAI
    WBTC: { minBalance: '100', symbol: 'WBTC' },     // 100 WBTC
    LINK: { minBalance: '100000', symbol: 'LINK' },  // 100k LINK
    UNI: { minBalance: '500000', symbol: 'UNI' },    // 500k UNI
    AAVE: { minBalance: '50000', symbol: 'AAVE' }    // 50k AAVE
};

/**
 * Initialize whale accounts with balance checking
 */
export async function initializeWhaleAccounts(): Promise<WhaleAccount[]> {
    logInfo('WhaleInit', 'Initializing whale accounts with balance verification');

    const whaleAccounts: WhaleAccount[] = [];
    const publicClient = getPublicClient();

    for (const [name, address] of Object.entries(WHALE_ACCOUNTS)) {
        const whale: WhaleAccount = {
            address,
            name,
            balances: new Map(),
            usedInMarkets: new Set()
        };

        // Check balances for all required tokens
        for (const [tokenSymbol, requirement] of Object.entries(WHALE_TOKEN_REQUIREMENTS)) {
            const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
            if (!tokenConfig) continue;

            try {
                const balance = await getTokenBalance(tokenConfig.address as Address, address);
                whale.balances.set(tokenSymbol, balance);

                const formattedBalance = isNativeEth(tokenConfig.address as Address)
                    ? formatEther(balance)
                    : (Number(balance) / (10 ** tokenConfig.decimals)).toLocaleString();

                logInfo('WhaleBalance', `${name} ${tokenSymbol}: ${formattedBalance}`);
            } catch (error) {
                logWarning('WhaleBalance', `Failed to get ${tokenSymbol} balance for ${name}: ${error}`);
                whale.balances.set(tokenSymbol, 0n);
            }
        }

        whaleAccounts.push(whale);
    }

    // Sort whales by total portfolio value (ETH + USDC as proxy)
    whaleAccounts.sort((a, b) => {
        const aValue = (a.balances.get('ETH') || 0n) + (a.balances.get('USDC') || 0n);
        const bValue = (b.balances.get('ETH') || 0n) + (b.balances.get('USDC') || 0n);
        return bValue > aValue ? 1 : -1;
    });

    logSuccess('WhaleInit', `Initialized ${whaleAccounts.length} whale accounts`);
    return whaleAccounts;
}

/**
 * Select best whale for a market based on token requirements and availability
 */
export function selectWhaleForMarket(
    whaleAccounts: WhaleAccount[],
    marketId: string,
    requiredTokens: string[],
    requiredAmount: bigint
): WhaleAccount | null {

    // Filter whales that haven't been used in this market
    const availableWhales = whaleAccounts.filter(whale =>
        !whale.usedInMarkets.has(marketId)
    );

    if (availableWhales.length === 0) {
        logWarning('WhaleSelection', `No available whales for market ${marketId} - all have been used`);
        return null;
    }

    // Find whale with sufficient balance for all required tokens
    for (const whale of availableWhales) {
        let hasAllTokens = true;

        for (const tokenSymbol of requiredTokens) {
            const balance = whale.balances.get(tokenSymbol) || 0n;
            if (balance < requiredAmount) {
                hasAllTokens = false;
                break;
            }
        }

        if (hasAllTokens) {
            // Mark this whale as used for this market
            whale.usedInMarkets.add(marketId);
            logInfo('WhaleSelection', `Selected whale ${whale.name} for market ${marketId}`);
            return whale;
        }
    }

    logWarning('WhaleSelection', `No whale has sufficient balance for market ${marketId}`);
    return null;
}

/**
 * Get tokens required for a market
 */
export function getMarketTokens(market: { base: string; quote: string }): string[] {
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
} {
    const totalMarkets = whaleAccounts.reduce((sum, whale) => sum + whale.usedInMarkets.size, 0);
    const averageMarketsPerWhale = totalMarkets / whaleAccounts.length;

    const mostUsed = whaleAccounts.reduce((prev, current) =>
        current.usedInMarkets.size > prev.usedInMarkets.size ? current : prev
    );

    const unusedWhales = whaleAccounts.filter(whale => whale.usedInMarkets.size === 0).length;

    return {
        totalWhales: whaleAccounts.length,
        averageMarketsPerWhale,
        mostUsedWhale: mostUsed.name,
        unusedWhales
    };
}

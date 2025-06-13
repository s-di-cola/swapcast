/**
 * Token management utilities for fixtures
 */

import {
    type Address,
    type Hash,
    parseUnits,
    formatUnits,
    erc20Abi
} from 'viem';
import { getPublicClient, impersonateAccount, stopImpersonatingAccount, getWalletClient, getContract } from './client';
import { withErrorHandling, logSuccess, logInfo, logWarning } from './error';
import { WHALE_ADDRESSES, TOKEN_ADDRESSES } from './wallets';
import {anvil} from "viem/chains";
import { Token } from '@uniswap/sdk-core';
import { getTokenSymbolFromAddress } from './math';

// Native ETH is represented as the zero address in Uniswap V4
export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Token information interface
 */
export interface TokenInfo {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
}

/**
 * Check if an address represents native ETH
 */
export function isNativeEth(address: Address): boolean {
    return address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
}

/**
 * Get token balance for an account
 */
export const getTokenBalance = withErrorHandling(
    async (tokenAddress: Address, account: Address): Promise<bigint> => {
        if (tokenAddress === NATIVE_ETH_ADDRESS) {
            const publicClient = getPublicClient();
            return await publicClient.getBalance({ address: account });
        } else {
            const publicClient = getPublicClient();
            return await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account]
            });
        }
    },
    'GetTokenBalance'
);

/**
 * Get token decimals
 */
export const getTokenDecimals = withErrorHandling(
    async (tokenAddress: Address): Promise<number> => {
        if (tokenAddress === NATIVE_ETH_ADDRESS) {
            return 18; // ETH has 18 decimals
        } else {
            const publicClient = getPublicClient();
            return publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'decimals'
            });
        }
    },
    'GetTokenDecimals'
);

/**
 * Format token amount with proper decimals
 */
export const formatTokenAmount = withErrorHandling(
    async (tokenAddress: Address, amount: bigint): Promise<string> => {
        const decimals = await getTokenDecimals(tokenAddress);
        return formatUnits(amount, decimals);
    },
    'FormatTokenAmount'
);

/**
 * Parse token amount with proper decimals
 */
export const parseTokenAmount = withErrorHandling(
    async (tokenAddress: Address, amount: string): Promise<bigint> => {
        const decimals = await getTokenDecimals(tokenAddress);
        return parseUnits(amount, decimals);
    },
    'ParseTokenAmount'
);

/**
 * Find a whale with sufficient token balance
 */
export const findWhaleWithBalance = withErrorHandling(
    async (tokenAddress: Address, minAmount: bigint = 0n): Promise<Address> => {
        // Check if we have a known whale for this token
        const knownTokenWhale = Object.entries(TOKEN_ADDRESSES)
            .find(([_, address]) => address.toLowerCase() === tokenAddress.toLowerCase());

        if (knownTokenWhale) {
            const tokenSymbol = knownTokenWhale[0];
            const whaleAddress = WHALE_ADDRESSES[tokenSymbol];
            if (whaleAddress) {
                logInfo('WhaleSelection', `Using known whale ${whaleAddress} for ${tokenSymbol}`);
                return whaleAddress as Address;
            }
        }

        // Otherwise find a whale with balance
        const whales = Object.values(WHALE_ADDRESSES) as Address[];
        for (const whale of whales) {
            try {
                // Use getTokenBalance which handles ETH and ERC20 tokens correctly
                const balance = await getTokenBalance(tokenAddress, whale);
                
                if (balance > minAmount) {
                    logInfo('WhaleSelection', `Found whale ${whale} with balance ${balance}`);
                    return whale;
                }
            } catch (e) {
                // Continue to next whale
                logWarning('WhaleSelection', `Error checking balance for whale ${whale}: ${e}`);
            }
        }

        throw new Error(`No whale found with balance for token ${tokenAddress}`);
    },
    'FindWhaleWithBalance'
);

/**
 * Get the best whale account for a token
 */
export const getBestWhaleForToken = withErrorHandling(
    async (tokenAddress: Address): Promise<Address | null> => {
        // Check if we have a known whale for this token
        const knownTokenWhale = Object.entries(TOKEN_ADDRESSES)
            .find(([_, address]) => address.toLowerCase() === tokenAddress.toLowerCase());

        if (knownTokenWhale) {
            const tokenSymbol = knownTokenWhale[0];
            const whaleAddress = WHALE_ADDRESSES[tokenSymbol];
            if (whaleAddress) {
                logInfo('WhaleSelection', `Using known whale ${whaleAddress} for ${tokenSymbol}`);
                return whaleAddress as Address;
            }
        }

        // Otherwise find a whale with balance
        return await findWhaleWithBalance(tokenAddress);
    },
    'GetBestWhaleForToken'
);

/**
 * Fund an account with tokens
 */
export const fundAccountWithToken = withErrorHandling(
    async (tokenAddress: Address, recipient: Address, amount: bigint): Promise<Hash> => {
        // Get token decimals to format amount for logging
        const decimals = await getTokenDecimals(tokenAddress);
        const formattedAmount = formatUnits(amount, decimals);

        logInfo('TokenFunding', `Funding ${recipient} with ${formattedAmount} of token ${tokenAddress}`);

        // Transfer tokens from whale
        return await transferTokensFromWhale(tokenAddress, recipient, amount);
    },
    'FundAccountWithToken'
);

/**
 * Approve tokens for spending
 */
export const approveTokens = withErrorHandling(
    async (tokenAddress: Address, owner: Address, spender: Address, amount: bigint): Promise<Hash> => {
        if (tokenAddress === NATIVE_ETH_ADDRESS) {
            throw new Error('Cannot approve native ETH');
        }

        const publicClient = getPublicClient();

        // Impersonate the owner
        await impersonateAccount(owner);
        const ownerClient = getWalletClient(owner);

        try {
            // Check current allowance
            const currentAllowance = await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [owner, spender]
            });

            // If allowance is already sufficient, skip approval
            if (currentAllowance >= amount) {
                logInfo('TokenApproval', `Allowance already sufficient: ${currentAllowance} >= ${amount}`);
                return '0x0000000000000000000000000000000000000000000000000000000000000000' as Hash;
            }

            // Approve tokens
            const txHash = await ownerClient.writeContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [spender, amount],
                account: owner,
                chain: anvil
            });

            await publicClient.waitForTransactionReceipt({ hash: txHash });
            logSuccess('TokenApproval', `Approved ${amount} of token ${tokenAddress} from ${owner} to ${spender}`);

            return txHash;
        } finally {
            // Always stop impersonating
            await stopImpersonatingAccount(owner);
        }
    },
    'ApproveTokens'
);

/**
 * Get information about a token pair
 */
export const getTokenPairInfo = withErrorHandling(
    async (token0Address: Address, token1Address: Address): Promise<[TokenInfo, TokenInfo]> => {
        const publicClient = getPublicClient();

        // Get token0 info
        let token0Decimals: number;
        let token0Symbol: string;

        if (token0Address === NATIVE_ETH_ADDRESS) {
            token0Decimals = 18;
            token0Symbol = 'ETH';
        } else {
            token0Decimals = await publicClient.readContract({
                address: token0Address,
                abi: erc20Abi,
                functionName: 'decimals'
            });

            token0Symbol = await publicClient.readContract({
                address: token0Address,
                abi: erc20Abi,
                functionName: 'symbol'
            });
        }

        // Get token1 info
        let token1Decimals: number;
        let token1Symbol: string;

        if (token1Address === NATIVE_ETH_ADDRESS) {
            token1Decimals = 18;
            token1Symbol = 'ETH';
        } else {
            token1Decimals = await publicClient.readContract({
                address: token1Address,
                abi: erc20Abi,
                functionName: 'decimals'
            });

            token1Symbol = await publicClient.readContract({
                address: token1Address,
                abi: erc20Abi,
                functionName: 'symbol'
            });
        }

        return [
            { address: token0Address, symbol: token0Symbol, decimals: token0Decimals, name: token0Symbol },
            { address: token1Address, symbol: token1Symbol, decimals: token1Decimals, name: token1Symbol }
        ];
    },
    'TokenPairInfo'
);

/**
 * Transfer tokens from a whale to a recipient
 */
export const transferTokensFromWhale = withErrorHandling(
    async (tokenAddress: Address, recipient: Address, amount: bigint): Promise<Hash> => {
        const publicClient = getPublicClient();

        // Find a whale with sufficient balance
        const whale = await getBestWhaleForToken(tokenAddress);
        if (!whale) {
            throw new Error(`No whale found for token ${tokenAddress}`);
        }

        // Impersonate the whale
        await impersonateAccount(whale);
        const whaleClient = getWalletClient(whale);

        let txHash: Hash;

        try {
            if (tokenAddress === NATIVE_ETH_ADDRESS) {
                // Transfer ETH
                txHash = await whaleClient.sendTransaction({
                    to: recipient,
                    value: amount,
                    account: whale,
                    chain: anvil
                });
            } else {
                // Transfer ERC20
                txHash = await whaleClient.writeContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [recipient, amount],
                    account: whale,
                    chain: anvil
                });
            }

            await publicClient.waitForTransactionReceipt({ hash: txHash });
            logSuccess('TokenTransfer', `Transferred ${amount} of token ${tokenAddress} from whale ${whale} to ${recipient}`);

            return txHash;
        } finally {
            // Always stop impersonating
            await stopImpersonatingAccount(whale);
        }
    },
    'TransferTokensFromWhale'
);

export async function getTokenFromAddress(address: Address): Promise<Token> {
    const decimals = await getTokenDecimals(address);
    const symbol = await getTokenSymbolFromAddress(address);
    return new Token(anvil.id, address, decimals, symbol);
}

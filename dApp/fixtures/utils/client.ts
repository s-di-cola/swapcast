/**
 * @file Shared client utilities for test fixtures
 * @description Provides client management and Anvil interaction utilities
 * @module utils/client
 */

import {type Address, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient} from 'viem';
import {anvil} from 'viem/chains';

/** @private */
let cachedPublicClient: PublicClient | null = null;

/**
 * Gets or creates a singleton public client instance
 * @returns Configured Viem PublicClient instance
 */
export function getPublicClient(): PublicClient {
    if (!cachedPublicClient) {
        cachedPublicClient = createPublicClient({
            chain: anvil,
            transport: http()
        });
    }
    return cachedPublicClient;
}

/**
 * Creates a wallet client for a specific account
 * @param account - The account address to use with the wallet client
 * @returns Configured Viem WalletClient instance
 */
export function getWalletClient(account: Address): WalletClient {
    return createWalletClient({
        account,
        chain: anvil,
        transport: http(anvil.rpcUrls.default.http[0])
    });
}

/**
 * Creates a type-safe contract instance
 * @template T - The contract type to create
 * @param contractGetter - Factory function that creates the contract instance
 * @param address - The contract address
 * @returns Typed contract instance
 */
export function getContract<T>(
    contractGetter: (params: { address: Address, chain: typeof anvil, transport: ReturnType<typeof http> }) => T,
    address: Address
): T {
    return contractGetter({
        address,
        chain: anvil,
        transport: http()
    });
}

/**
 * Execute an Anvil-specific RPC method
 */
export async function executeAnvilMethod<T = unknown>(
    method: string,
    params: any[]
): Promise<T> {
    const client = getPublicClient();
    return client.request({
        method: method as any,
        params: params as any
    });
}

/**
 * Set account balance on Anvil
 */
export async function setAccountBalance(
    address: Address,
    amount: bigint
): Promise<void> {
    await executeAnvilMethod('anvil_setBalance', [
        address,
        `0x${amount.toString(16)}`
    ]);
}

/**
 * Impersonate an account on Anvil
 */
export async function impersonateAccount(address: Address): Promise<void> {
    await executeAnvilMethod('anvil_impersonateAccount', [address]);
}

/**
 * Stop impersonating an account on Anvil
 */
export async function stopImpersonatingAccount(address: Address): Promise<void> {
    await executeAnvilMethod('anvil_stopImpersonatingAccount', [address]);
}

/**
 * Set storage slot for a contract (useful for token balance manipulation)
 */
export async function setStorageAt(
    contractAddress: Address,
    slot: string | number,
    value: string
): Promise<void> {
    const slotHex = typeof slot === 'number'
        ? `0x${slot.toString(16)}`
        : slot;

    await executeAnvilMethod('anvil_setStorageAt', [
        contractAddress,
        slotHex,
        value
    ]);
}

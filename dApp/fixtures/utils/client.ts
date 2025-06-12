/**
 * Shared client utilities for fixtures
 */

import { 
    type Address, 
    type PublicClient, 
    type WalletClient, 
    createPublicClient, 
    createWalletClient,
    http 
} from 'viem';
import { anvil } from 'viem/chains';

// Cache for clients to avoid redundant creation
let cachedPublicClient: PublicClient | null = null;

/**
 * Get a shared public client instance
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
 * Create a wallet client for a specific account
 */
export function getWalletClient(account: Address): WalletClient {
    return createWalletClient({
        account,
        chain: anvil,
        transport: http(anvil.rpcUrls.default.http[0])
    });
}

/**
 * Get contract instances with proper typing
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

import {appKit} from "$lib/configs/wallet.config";
import type {Chain} from "viem";

/**
 * Gets the current RPC URL and chain ID from the modal or falls back to anvil
 * @returns An object containing the current RPC URL and chain configuration
 */
export function getCurrentNetworkConfig() {
    const network = appKit.getCaipNetwork();
    const rpcUrl = network?.rpcUrls?.default?.http?.[0];
    const chainId = network?.id;
    console.log(`RPC: ${rpcUrl}, Chain: ${chainId}, Network: ${network?.name}`)
    return {
        rpcUrl,
        chain: { id: chainId } as Chain
    };
}

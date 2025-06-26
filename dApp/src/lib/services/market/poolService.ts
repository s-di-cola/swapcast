import { type Address, type Hash, http } from 'viem';
import { getTickSpacing } from '$lib/services/market/helpers';
import { Token } from '@uniswap/sdk-core';
import { getPoolManager } from '$generated/types/PoolManager';
import { PUBLIC_SWAPCASTHOOK_ADDRESS, PUBLIC_UNIV4_POOLMANAGER_ADDRESS } from '$env/static/public';
import { appKit } from '$lib/configs/wallet.config';
import { getCurrentNetworkConfig } from '$lib/utils/network';

/**
 * Create a new Uniswap v4 pool with the SwapCast hook
 * Always attempts to create the pool. If it already exists, returns a clear error.
 */
export async function createPool(
	tokenA: Address,
	tokenB: Address,
	fee: number
): Promise<{ success: boolean; message: string; hash?: Hash }> {
	try {
		// Check if tokens are identical
		if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
			return {
				success: false,
				message: 'Cannot create a pool with identical tokens'
			};
		}

		// Sort tokens in canonical order
		const [token0, token1] = sortTokens(tokenA, tokenB, Number(appKit.getChainId()));

		// Get tick spacing for the fee tier
		const tickSpacing = getTickSpacing(fee);
		const sqrtPriceX96 = BigInt('0x1000000000000000000000000'); // 1:1 price

		// Prepare the pool key
		const poolKey = {
			currency0: token0.address as `0x${string}`,
			currency1: token1.address as `0x${string}`,
			fee: fee,
			tickSpacing: tickSpacing,
			hooks: PUBLIC_SWAPCASTHOOK_ADDRESS as `0x${string}`
		};

		const currentNetworkConfig = getCurrentNetworkConfig();
		const poolManager = getPoolManager({
			address: PUBLIC_UNIV4_POOLMANAGER_ADDRESS,
			chain: currentNetworkConfig.chain,
			transport: http(currentNetworkConfig.rpcUrl)
		});
		await poolManager.simulate.initialize([poolKey, sqrtPriceX96], {
			chain: currentNetworkConfig.chain,
			account: appKit.getAccount()?.address as Address
		});

		const hash = await poolManager.write.initialize([poolKey, sqrtPriceX96], {
			chain: currentNetworkConfig.chain,
			account: appKit.getAccount()?.address as Address
		});

		return {
			success: true,
			message: 'Pool created successfully',
			hash: hash
		};
	} catch (error: any) {
		// Check if the error indicates the pool already exists
		if (error.message && error.message.includes('PoolAlreadyExists')) {
			return {
				success: false,
				message: 'Pool already exists with these tokens and fee tier.'
			};
		}

		return {
			success: false,
			message: `Failed to create pool: ${error.message || 'Unknown error'}`
		};
	}
}

/**
 * Helper function to sort token addresses in canonical order (lower address first)
 */
export function sortTokens(tokenA: Address, tokenB: Address, chainId: number): [Token, Token] {
	const tA = new Token(chainId, tokenA, 18);
	const tB = new Token(chainId, tokenB, 18);
	return tA.sortsBefore(tB) ? [tA, tB] : [tB, tA];
}

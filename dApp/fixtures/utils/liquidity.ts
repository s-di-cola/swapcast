/**
 * Liquidity utilities  
 * For mainnet fork with real whale balances
 */

import { 
	type Address, 
	type PublicClient, 
	type WalletClient, 
	http, 
	parseUnits, 
	maxUint256, 
	erc20Abi,
	createWalletClient
} from 'viem';
import { anvil } from 'viem/chains';
import chalk from 'chalk';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES, TOKEN_ADDRESSES } from './wallets';

/**
 * Gets the best whale for a token pair
 */
function getBestWhaleForTokenPair(token0: Address, token1: Address): Address {
	const token0Lower = token0.toLowerCase();
	const token1Lower = token1.toLowerCase();
	
	// Prefer WETH whale for any ETH pairs
	if (token0Lower === TOKEN_ADDRESSES.WETH.toLowerCase() || 
		token1Lower === TOKEN_ADDRESSES.WETH.toLowerCase()) {
		return WHALE_ADDRESSES.WETH_WHALE;
	}
	
	// Prefer WBTC whale for BTC pairs
	if (token0Lower === TOKEN_ADDRESSES.WBTC.toLowerCase() || 
		token1Lower === TOKEN_ADDRESSES.WBTC.toLowerCase()) {
		return WHALE_ADDRESSES.WBTC_WHALE;
	}
	
	// Otherwise use USDC whale (most liquid)
	return WHALE_ADDRESSES.USDC_WHALE;
}

/**
 * Adds liquidity to a Uniswap v4 pool using whale accounts
 */
export async function addLiquidityToPool(
	publicClient: PublicClient,
	adminAccount: WalletClient,
	poolKey: {
		currency0: Address;
		currency1: Address;
		fee: number;
		tickSpacing: number;
		hooks: Address;
	},
	currentPrice: number
): Promise<`0x${string}`> {
	console.log(chalk.blue(`Adding liquidity to pool ${poolKey.currency0}/${poolKey.currency1}...`));

	// Get the best whale for this token pair
	const whaleAddress = getBestWhaleForTokenPair(poolKey.currency0, poolKey.currency1);
	console.log(chalk.green(`Using whale account: ${whaleAddress}`));

	const poolManager = getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	try {
		// Impersonate the whale account (they already have tokens on mainnet fork)
		await publicClient.request({
			method: 'anvil_impersonateAccount' as any,
			params: [whaleAddress]
		});

		// Fund whale with ETH for gas
		await publicClient.request({
			method: 'anvil_setBalance' as any,
			params: [whaleAddress, `0x${(parseUnits('100', 18)).toString(16)}`]
		});

		// Create wallet client for the whale
		const whaleClient = createWalletClient({
			account: whaleAddress,
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		// Approve both tokens for PoolManager
		console.log(chalk.gray(`Approving tokens for PoolManager...`));
		
		const approve0Hash = await whaleClient.writeContract({
			address: poolKey.currency0,
			abi: erc20Abi,
			functionName: 'approve',
			args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address, maxUint256]
		});
		await publicClient.waitForTransactionReceipt({ hash: approve0Hash });

		const approve1Hash = await whaleClient.writeContract({
			address: poolKey.currency1,
			abi: erc20Abi,
			functionName: 'approve',
			args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address, maxUint256]
		});
		await publicClient.waitForTransactionReceipt({ hash: approve1Hash });

		console.log(chalk.green(`Approvals completed`));

		// Calculate tick range around current price (±20%)
		const priceToTick = (price: number): number => {
			return Math.floor(Math.log(price) / Math.log(1.0001));
		};

		const currentTick = priceToTick(currentPrice);
		const tickSpacing = poolKey.tickSpacing;
		
		const tickLower = Math.floor(currentTick * 0.8 / tickSpacing) * tickSpacing;
		const tickUpper = Math.ceil(currentTick * 1.2 / tickSpacing) * tickSpacing;

		// Generate random salt for position
		const salt = `0x${Math.floor(Math.random() * 10**10).toString(16).padStart(64, '0')}` as `0x${string}`;

		const modifyLiquidityParams = {
			tickLower,
			tickUpper,
			liquidityDelta: parseUnits('1000', 18), // Substantial liquidity
			salt
		};

		console.log(chalk.blue(`Adding liquidity with ticks: ${tickLower} to ${tickUpper}`));

		// Add liquidity using whale account
		const hash = await poolManager.write.modifyLiquidity(
			[poolKey, modifyLiquidityParams, '0x'],
			{
				account: whaleAddress,
				chain: anvil
			}
		);

		console.log(chalk.green(`Successfully added liquidity! Tx hash: ${hash}`));

		// Stop impersonating
		await publicClient.request({
			method: 'anvil_stopImpersonatingAccount' as any,
			params: [whaleAddress]
		});

		return hash;

	} catch (error: any) {
		console.error(chalk.red(`Failed to add liquidity: ${error.message}`));
		
		// Cleanup on error
		try {
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});
		} catch (e) {
			// Ignore cleanup errors
		}

		// Return dummy hash to continue with market creation
		console.log(chalk.yellow(`Continuing without liquidity...`));
		return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
	}
}
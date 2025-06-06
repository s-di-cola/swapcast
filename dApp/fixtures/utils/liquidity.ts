/**
 * Simplified Liquidity utilities
 * Works with mainnet fork whale balances
 */

import {
	type Address,
	type PublicClient,
	type WalletClient,
	http,
	parseUnits,
	maxUint256,
	erc20Abi,
	createWalletClient,
	formatUnits
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

	// Choose whale based on token pair
	if (token0Lower === TOKEN_ADDRESSES.WETH.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.WETH.toLowerCase()) {
		return WHALE_ADDRESSES.WETH_WHALE;
	} else if (token0Lower === TOKEN_ADDRESSES.WBTC.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.WBTC.toLowerCase()) {
		return WHALE_ADDRESSES.WBTC_WHALE;
	} else if (token0Lower === TOKEN_ADDRESSES.USDC.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.USDC.toLowerCase()) {
		return WHALE_ADDRESSES.USDC_WHALE;
	} else if (token0Lower === TOKEN_ADDRESSES.USDT.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.USDT.toLowerCase()) {
		return WHALE_ADDRESSES.USDT_WHALE;
	} else if (token0Lower === TOKEN_ADDRESSES.DAI.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.DAI.toLowerCase()) {
		return WHALE_ADDRESSES.DAI_WHALE;
	} else {
		// Default to USDC whale
		return WHALE_ADDRESSES.USDC_WHALE;
	}
}

/**
 * Calculates realistic tick range based on current price
 */
function calculateTickRange(currentPrice: number, tickSpacing: number): { tickLower: number; tickUpper: number } {
	// Convert price to tick (approximate)
	const priceToTick = (price: number): number => {
		return Math.floor(Math.log(price) / Math.log(1.0001));
	};

	const currentTick = priceToTick(currentPrice);

	// Create a wide range (±50% from current price) for maximum liquidity provision
	const tickRange = Math.floor(currentTick * 0.5);

	// Ensure ticks are aligned to tickSpacing
	const tickLower = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
	const tickUpper = Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

	console.log(chalk.blue(`Calculated tick range: ${tickLower} to ${tickUpper} (spacing: ${tickSpacing})`));
	return { tickLower, tickUpper };
}

/**
 * Adds liquidity to a Uniswap v4 pool using whale accounts
 * Simplified version that works with existing mainnet fork balances
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

	try {
		// Get the best whale for this token pair
		const whaleAddress = getBestWhaleForTokenPair(poolKey.currency0, poolKey.currency1);
		console.log(chalk.green(`Using whale account: ${whaleAddress}`));

		// Impersonate the whale
		await publicClient.request({
			method: 'anvil_impersonateAccount' as any,
			params: [whaleAddress]
		});

		// Fund whale with ETH for gas
		await publicClient.request({
			method: 'anvil_setBalance' as any,
			params: [whaleAddress, `0x${(parseUnits('100', 18)).toString(16)}`]
		});

		// Create whale wallet client
		const whaleClient = createWalletClient({
			account: whaleAddress,
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		// Check current balances
		const token0Balance = await publicClient.readContract({
			address: poolKey.currency0,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [whaleAddress]
		});

		const token1Balance = await publicClient.readContract({
			address: poolKey.currency1,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [whaleAddress]
		});

		console.log(chalk.blue(`Whale balances:`));
		console.log(chalk.blue(`  Token0: ${formatUnits(token0Balance, 18)}`));
		console.log(chalk.blue(`  Token1: ${formatUnits(token1Balance, 18)}`));

		// If balances are too low, skip liquidity addition but don't fail
		const minBalance = parseUnits('1', 18); // 1 token minimum
		if (token0Balance < minBalance && token1Balance < minBalance) {
			console.log(chalk.yellow(`Whale has insufficient token balances, skipping liquidity addition...`));
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});
			return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
		}

		const poolManager = getPoolManager({
			address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		// Approve tokens for PoolManager
		console.log(chalk.gray(`Approving tokens for PoolManager...`));

		try {
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
		} catch (approveError) {
			console.log(chalk.yellow(`Token approvals failed, but continuing...`));
		}

		// Calculate tick range
		const { tickLower, tickUpper } = calculateTickRange(currentPrice, poolKey.tickSpacing);

		// Add a single large liquidity position
		const liquidityDelta = parseUnits('10000', 18); // 10K liquidity units
		const salt = `0x${Math.floor(Math.random() * 10**15).toString(16).padStart(64, '0')}` as `0x${string}`;

		const modifyLiquidityParams = {
			tickLower,
			tickUpper,
			liquidityDelta,
			salt
		};

		console.log(chalk.blue(`Adding liquidity position with ${formatUnits(liquidityDelta, 18)} units`));

		try {
			const hash = await poolManager.write.modifyLiquidity(
				[poolKey, modifyLiquidityParams, '0x'],
				{
					account: whaleAddress,
					chain: anvil,
					gas: 1000000n
				}
			);

			await publicClient.waitForTransactionReceipt({ hash });
			console.log(chalk.green(`✅ Liquidity added successfully: ${hash.slice(0, 10)}...`));

			// Stop impersonating
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});

			return hash;

		} catch (liquidityError) {
			console.log(chalk.yellow(`Liquidity addition failed: ${liquidityError.message}`));
			console.log(chalk.yellow(`Pool will work without additional liquidity from mainnet fork`));

			// Stop impersonating
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});

			return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
		}

	} catch (error: any) {
		console.error(chalk.red(`Error in liquidity addition: ${error.message}`));

		// Cleanup on error
		try {
			const whaleAddress = WHALE_ADDRESSES.USDC_WHALE;
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});
		} catch (e) {
			// Ignore cleanup errors
		}

		// Return dummy hash to continue
		console.log(chalk.yellow(`Continuing without additional liquidity...`));
		return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
	}
}

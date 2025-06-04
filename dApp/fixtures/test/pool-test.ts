/**
 * Pool Test 
 * Simple validation for mainnet fork setup
 */

import { createPublicClient, http, type Address, formatUnits, erc20Abi } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from '../utils/wallets';
import { sortTokenAddresses } from '../utils/helpers';
import chalk from 'chalk';

/**
 * Quick test to verify a pool has liquidity
 */
export async function quickPoolTest(
	tokenA: Address,
	tokenB: Address,
	poolName: string = 'Test Pool'
): Promise<boolean> {
	console.log(chalk.blue(`\n🧪 Testing pool: ${poolName}`));

	try {
		const publicClient = createPublicClient({
			chain: anvil,
			transport: http('http://localhost:8545')
		});

		// Sort tokens correctly
		const [token0, token1] = sortTokenAddresses(tokenA, tokenB);

		// Check PoolManager token balances
		const token0Balance = await publicClient.readContract({
			address: token0,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address]
		});

		const token1Balance = await publicClient.readContract({
			address: token1,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address]
		});

		const token0Formatted = formatUnits(token0Balance, 18);
		const token1Formatted = formatUnits(token1Balance, 18);

		console.log(chalk.cyan(`   Token0 balance: ${token0Formatted}`));
		console.log(chalk.cyan(`   Token1 balance: ${token1Formatted}`));

		const hasLiquidity = token0Balance > 0n || token1Balance > 0n;

		if (hasLiquidity) {
			console.log(chalk.green(`   ✅ Pool has liquidity!`));
			return true;
		} else {
			console.log(chalk.yellow(`   ⚠️  No liquidity detected`));
			return false;
		}

	} catch (error: any) {
		console.log(chalk.red(`   ❌ Error: ${error.message}`));
		return false;
	}
}

/**
 * Test all standard pools
 */
export async function testAllPools(): Promise<void> {
	console.log(chalk.blue('\n🔍 Testing all pools...'));

	const pools = [
		{ name: 'ETH/USDC', tokenA: TOKEN_ADDRESSES.WETH, tokenB: TOKEN_ADDRESSES.USDC },
		{ name: 'BTC/USDC', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.USDC },
		{ name: 'ETH/DAI', tokenA: TOKEN_ADDRESSES.WETH, tokenB: TOKEN_ADDRESSES.DAI },
		{ name: 'BTC/DAI', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.DAI },
		{ name: 'ETH/USDT', tokenA: TOKEN_ADDRESSES.WETH, tokenB: TOKEN_ADDRESSES.USDT },
		{ name: 'BTC/USDT', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.USDT }
	];

	let successCount = 0;
	
	for (const pool of pools) {
		const success = await quickPoolTest(pool.tokenA, pool.tokenB, pool.name);
		if (success) successCount++;
	}

	console.log(chalk.blue('\n📊 SUMMARY'));
	console.log(chalk.cyan(`Pools with liquidity: ${successCount}/${pools.length}`));

	if (successCount === pools.length) {
		console.log(chalk.green('🎉 All pools have liquidity!'));
	} else if (successCount > 0) {
		console.log(chalk.yellow(`⚠️  ${pools.length - successCount} pools need liquidity`));
	} else {
		console.log(chalk.red('❌ No pools found with liquidity'));
	}
}

export async function validatePools(): Promise<void> {
	console.log(chalk.blue('\n🧪 VALIDATING POOLS'));
	await testAllPools();
	console.log(chalk.green('✅ Pool validation completed!\n'));
}
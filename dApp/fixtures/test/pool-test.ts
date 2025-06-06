/**
 * Pool Test
 * Simple validation for mainnet fork setup with native ETH support
 */

import { createPublicClient, http, type Address, formatUnits, erc20Abi } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, TOKEN_ADDRESSES } from '../utils/wallets';
import { sortTokenAddresses } from '../utils/helpers';
import chalk from 'chalk';

// Native ETH address
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';

/**
 * FIXED: Gets token balance (handles both native ETH and ERC20)
 */
async function getTokenBalance(
	publicClient: any,
	tokenAddress: Address,
	holderAddress: Address
): Promise<bigint> {
	if (tokenAddress === NATIVE_ETH) {
		// Native ETH balance
		return await publicClient.getBalance({ address: holderAddress });
	} else {
		// ERC20 token balance
		return await publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [holderAddress]
		});
	}
}

/**
 * FIXED: Gets token name for display
 */
function getTokenName(tokenAddress: Address): string {
	if (tokenAddress === NATIVE_ETH) return 'ETH';
	if (tokenAddress === TOKEN_ADDRESSES.USDC) return 'USDC';
	if (tokenAddress === TOKEN_ADDRESSES.USDT) return 'USDT';
	if (tokenAddress === TOKEN_ADDRESSES.DAI) return 'DAI';
	if (tokenAddress === TOKEN_ADDRESSES.WBTC) return 'WBTC';
	return 'UNKNOWN';
}

/**
 * FIXED: Gets token decimals
 */
function getTokenDecimals(tokenAddress: Address): number {
	if (tokenAddress === NATIVE_ETH) return 18; // ETH
	if (tokenAddress === TOKEN_ADDRESSES.USDC) return 6; // USDC has 6 decimals
	return 18; // Default for most tokens
}

/**
 * Quick test to verify a pool has liquidity (FIXED for native ETH)
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

		// FIXED: Check PoolManager token balances (handles native ETH)
		const token0Balance = await getTokenBalance(publicClient, token0, CONTRACT_ADDRESSES.POOL_MANAGER as Address);
		const token1Balance = await getTokenBalance(publicClient, token1, CONTRACT_ADDRESSES.POOL_MANAGER as Address);

		const token0Decimals = getTokenDecimals(token0);
		const token1Decimals = getTokenDecimals(token1);
		const token0Name = getTokenName(token0);
		const token1Name = getTokenName(token1);

		const token0Formatted = formatUnits(token0Balance, token0Decimals);
		const token1Formatted = formatUnits(token1Balance, token1Decimals);

		console.log(chalk.cyan(`   ${token0Name} (${token0}): ${token0Formatted}`));
		console.log(chalk.cyan(`   ${token1Name} (${token1}): ${token1Formatted}`));

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
 * FIXED: Test all standard pools with native ETH
 */
export async function testAllPools(): Promise<void> {
	console.log(chalk.blue('\n🔍 Testing all pools...'));

	const pools = [
		{ name: 'ETH/USDC', tokenA: TOKEN_ADDRESSES.ETH, tokenB: TOKEN_ADDRESSES.USDC },
		{ name: 'ETH/USDT', tokenA: TOKEN_ADDRESSES.ETH, tokenB: TOKEN_ADDRESSES.USDT },
		{ name: 'ETH/DAI', tokenA: TOKEN_ADDRESSES.ETH, tokenB: TOKEN_ADDRESSES.DAI },
		{ name: 'BTC/USDC', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.USDC },
		{ name: 'BTC/USDT', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.USDT },
		{ name: 'BTC/DAI', tokenA: TOKEN_ADDRESSES.WBTC, tokenB: TOKEN_ADDRESSES.DAI }
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

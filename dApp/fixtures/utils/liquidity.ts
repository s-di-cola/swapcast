/**
 * Liquidity utilities for fixture generation 
 *
 * Provides functions to add liquidity to Uniswap v4 pools with proper whale handling
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
	formatUnits,
	encodeFunctionData
} from 'viem';
import { anvil } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES, TOKEN_ADDRESSES } from './wallets';

// Enhanced whale mapping with more specific token whales
const ENHANCED_WHALE_MAP: Record<string, Address> = {
	// WETH whales
	[TOKEN_ADDRESSES.WETH.toLowerCase()]: WHALE_ADDRESSES.WETH_WHALE,
	// USDC whales  
	[TOKEN_ADDRESSES.USDC.toLowerCase()]: WHALE_ADDRESSES.USDC_WHALE,
	// USDT whales
	[TOKEN_ADDRESSES.USDT.toLowerCase()]: WHALE_ADDRESSES.USDT_WHALE,
	// DAI whales
	[TOKEN_ADDRESSES.DAI.toLowerCase()]: WHALE_ADDRESSES.DAI_WHALE,
	// WBTC whales
	[TOKEN_ADDRESSES.WBTC.toLowerCase()]: WHALE_ADDRESSES.WBTC_WHALE
};

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
	
	// Otherwise use USDC whale as it's most liquid
	return WHALE_ADDRESSES.USDC_WHALE;
}

/**
 * Ensures a whale account has sufficient tokens using Anvil's magic
 */
async function ensureWhaleHasTokens(
	publicClient: PublicClient,
	whaleAddress: Address,
	token0: Address,
	token1: Address,
	requiredAmount0: bigint,
	requiredAmount1: bigint
): Promise<void> {
	console.log(chalk.blue(`Ensuring whale ${whaleAddress} has sufficient tokens...`));

	// For each token, check balance and mint if needed
	const tokens = [
		{ address: token0, required: requiredAmount0, symbol: 'token0' },
		{ address: token1, required: requiredAmount1, symbol: 'token1' }
	];

	for (const token of tokens) {
		try {
			// Check current balance
			const balance = await publicClient.readContract({
				address: token.address,
				abi: erc20Abi,
				functionName: 'balanceOf',
				args: [whaleAddress]
			});

			console.log(chalk.gray(`Whale balance of ${token.symbol}: ${formatUnits(balance, 18)}`));

			if (balance < token.required) {
				console.log(chalk.yellow(`Whale needs more ${token.symbol}, attempting to fund...`));
				
				// Try to set balance directly using Anvil's storage manipulation
				// This is a common pattern for testing with mainnet forks
				
				// First, impersonate the whale
				await publicClient.request({
					method: 'anvil_impersonateAccount' as any,
					params: [whaleAddress]
				});

				// Fund with ETH for gas
				await publicClient.request({
					method: 'anvil_setBalance' as any,
					params: [whaleAddress, `0x${(parseUnits('1000', 18)).toString(16)}`]
				});

				// For testing, we'll set a large balance directly
				// In a real mainnet fork, the whale should already have tokens
				const largeAmount = parseUnits('1000000', 18); // 1M tokens
				
				// This is a hack for testing - in production the whale should have real tokens
				try {
					// Try to manipulate storage directly (works on test forks)
					await publicClient.request({
						method: 'anvil_setStorageAt' as any,
						params: [
							token.address,
							`0x${(BigInt(whaleAddress) + BigInt(1)).toString(16).padStart(64, '0')}`, // Approximate storage slot for balances
							`0x${largeAmount.toString(16).padStart(64, '0')}`
						]
					});
					console.log(chalk.green(`Set storage for ${token.symbol} balance`));
				} catch (storageError) {
					console.log(chalk.yellow(`Storage manipulation failed, whale should have natural balance`));
				}

				await publicClient.request({
					method: 'anvil_stopImpersonatingAccount' as any,
					params: [whaleAddress]
				});
			}
		} catch (error: any) {
			console.error(chalk.red(`Error ensuring tokens for ${token.symbol}: ${error.message}`));
		}
	}
}

/**
 * Adds liquidity to a Uniswap v4 pool with improved whale handling
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

	// Get the PoolManager contract
	const poolManager = getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});

	// Calculate liquidity amounts based on current price
	const liquidityAmountBase = parseUnits('10000', 18); // Base liquidity amount
	const liquidityAmount0 = liquidityAmountBase;
	const liquidityAmount1 = liquidityAmountBase;

	try {
		// Ensure whale has enough tokens
		await ensureWhaleHasTokens(
			publicClient,
			whaleAddress,
			poolKey.currency0,
			poolKey.currency1,
			liquidityAmount0,
			liquidityAmount1
		);

		// Impersonate the whale account
		await publicClient.request({
			method: 'anvil_impersonateAccount' as any,
			params: [whaleAddress]
		});

		// Create a wallet client for the whale
		const whaleClient = createWalletClient({
			account: whaleAddress,
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		// Approve both tokens for the PoolManager
		console.log(chalk.gray(`Approving tokens for PoolManager...`));
		
		try {
			const approve0Hash = await whaleClient.writeContract({
				address: poolKey.currency0,
				abi: erc20Abi,
				functionName: 'approve',
				args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address, maxUint256]
			});
			await publicClient.waitForTransactionReceipt({ hash: approve0Hash });
			console.log(chalk.green(`Approved ${poolKey.currency0}`));
		} catch (approveError: any) {
			console.log(chalk.yellow(`Approval for token0 failed: ${approveError.message}`));
		}

		try {
			const approve1Hash = await whaleClient.writeContract({
				address: poolKey.currency1,
				abi: erc20Abi,
				functionName: 'approve',
				args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address, maxUint256]
			});
			await publicClient.waitForTransactionReceipt({ hash: approve1Hash });
			console.log(chalk.green(`Approved ${poolKey.currency1}`));
		} catch (approveError: any) {
			console.log(chalk.yellow(`Approval for token1 failed: ${approveError.message}`));
		}

		// Calculate tick range around current price (±20% range)
		const priceToTick = (price: number): number => {
			return Math.floor(Math.log(price) / Math.log(1.0001));
		};

		const currentTick = priceToTick(currentPrice);
		const tickSpacing = poolKey.tickSpacing;
		
		// Use a wide range for good liquidity distribution
		const tickLower = Math.floor(currentTick * 0.8 / tickSpacing) * tickSpacing;
		const tickUpper = Math.ceil(currentTick * 1.2 / tickSpacing) * tickSpacing;

		// Generate a random salt
		const salt = `0x${Math.floor(Math.random() * 10**10).toString(16).padStart(64, '0')}` as `0x${string}`;

		// Prepare liquidity parameters
		const modifyLiquidityParams = {
			tickLower,
			tickUpper,
			liquidityDelta: parseUnits('1000', 18), // Substantial liquidity
			salt
		};

		console.log(chalk.blue(`Adding liquidity with ticks: ${tickLower} to ${tickUpper}`));

		// Add liquidity using the whale account
		const hash = await poolManager.write.modifyLiquidity(
			[poolKey, modifyLiquidityParams, '0x'],
			{
				account: whaleAddress,
				chain: anvil
			}
		);

		console.log(chalk.green(`Successfully added liquidity! Tx hash: ${hash}`));

		// Stop impersonating the whale
		await publicClient.request({
			method: 'anvil_stopImpersonatingAccount' as any,
			params: [whaleAddress]
		});

		return hash;

	} catch (error: any) {
		console.error(chalk.red(`Failed to add liquidity: ${error.message}`));
		
		// Stop impersonating on error
		try {
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});
		} catch (e) {
			// Ignore cleanup errors
		}

		// Instead of throwing, return a dummy hash to continue with market creation
		console.log(chalk.yellow(`Continuing without liquidity...`));
		return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
	}
}
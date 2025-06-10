/**
 * Fixed Liquidity utilities
 * Works with mainnet fork whale balances AND native ETH
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
	createPublicClient
} from 'viem';
import { anvil } from 'viem/chains';
import chalk from 'chalk';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES, TOKEN_ADDRESSES } from './wallets';

// Native ETH address
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';

/**
 * Gets the best whale for a token pair (handles native ETH)
 */
function getBestWhaleForTokenPair(token0: Address, token1: Address): Address {
	const token0Lower = token0.toLowerCase();
	const token1Lower = token1.toLowerCase();

	// Handle native ETH
	if (token0Lower === NATIVE_ETH || token1Lower === NATIVE_ETH) {
		return WHALE_ADDRESSES.WETH_WHALE as Address;
	} else if (token0Lower === TOKEN_ADDRESSES.WBTC.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.WBTC.toLowerCase()) {
		return WHALE_ADDRESSES.WBTC_WHALE as Address;
	} else if (token0Lower === TOKEN_ADDRESSES.USDC.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.USDC.toLowerCase()) {
		return WHALE_ADDRESSES.USDC_WHALE as Address;
	} else if (token0Lower === TOKEN_ADDRESSES.USDT.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.USDT.toLowerCase()) {
		return WHALE_ADDRESSES.USDT_WHALE as Address;
	} else if (token0Lower === TOKEN_ADDRESSES.DAI.toLowerCase() ||
		token1Lower === TOKEN_ADDRESSES.DAI.toLowerCase()) {
		return WHALE_ADDRESSES.DAI_WHALE as Address;
	} else {
		return WHALE_ADDRESSES.USDC_WHALE as Address;
	}
}

/**
 * Calculates realistic tick range based on current price
 */
function calculateTickRange(currentPrice: number, tickSpacing: number): { tickLower: number; tickUpper: number } {
	const priceToTick = (price: number): number => {
		return Math.floor(Math.log(price) / Math.log(1.0001));
	};

	const currentTick = priceToTick(currentPrice);
	const tickRange = Math.floor(currentTick * 0.5);

	const tickLower = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
	const tickUpper = Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

	console.log(chalk.blue(`Calculated tick range: ${tickLower} to ${tickUpper} (spacing: ${tickSpacing})`));
	return { tickLower, tickUpper };
}

/**
 * FIXED: Gets token balance (handles both native ETH and ERC20)
 */
async function getTokenBalance(
	publicClient: PublicClient,
	tokenAddress: Address,
	holderAddress: Address
): Promise<bigint> {
	if (tokenAddress === NATIVE_ETH) {
		return await publicClient.getBalance({ address: holderAddress });
	} else {
		return await publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [holderAddress]
		}) as bigint;
	}
}

/**
 * Helper function to fund token balances on Anvil
 */
async function fundTokenBalance(
	publicClient: PublicClient,
	tokenAddress: Address,
	recipient: Address,
	amount: bigint
): Promise<void> {
	try {
		// On Anvil, we can directly modify storage slots
		const slots = [0, 1, 2]; // Most ERC20s use slot 0, some use 1 or 2

		for (const slot of slots) {
			try {
				// Calculate storage slot for balance mapping
				const paddedAddress = recipient.slice(2).padStart(64, '0');
				const paddedSlot = slot.toString(16).padStart(64, '0');
				const key = `0x${paddedAddress}${paddedSlot}` as `0x${string}`;

				// Set the balance
				await publicClient.request({
					method: 'anvil_setStorageAt' as any,
					params: [
						tokenAddress,
						key,
						`0x${amount.toString(16).padStart(64, '0')}`
					]
				});

				console.log(chalk.green(`Funded ${recipient} with tokens at slot ${slot}`));
				break;
			} catch (e) {
				continue;
			}
		}
	} catch (error) {
		console.warn(chalk.yellow(`Failed to fund token balance: ${error}`));
	}
}

/**
 * FIXED: Adds liquidity to a Uniswap v4 pool using whale accounts
 */
export async function addLiquidityToPool(
	publicClientTransport: any, // This is the transport, not the client
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
		// FIXED: Create publicClient properly
		const publicClient = createPublicClient({
			chain: anvil,
			transport: http('http://localhost:8545')
		});

		// Get the best whale for this token pair
		const whaleAddress = getBestWhaleForTokenPair(poolKey.currency0, poolKey.currency1);
		console.log(chalk.green(`Using whale account: ${whaleAddress}`));

		// Impersonate the whale
		await publicClient.request({
			method: 'anvil_impersonateAccount' as any,
			params: [whaleAddress]
		});

		// Fund whale with ETH for gas and native ETH liquidity
		const ethAmount = parseUnits('1000', 18);
		await publicClient.request({
			method: 'anvil_setBalance' as any,
			params: [whaleAddress, `0x${ethAmount.toString(16)}`]
		});

		// Create whale wallet client
		const whaleClient = createWalletClient({
			account: whaleAddress,
			chain: anvil,
			transport: http('http://localhost:8545')
		});

		// FIXED: Check current balances
		const token0Balance = await getTokenBalance(publicClient, poolKey.currency0, whaleAddress);
		const token1Balance = await getTokenBalance(publicClient, poolKey.currency1, whaleAddress);

		console.log(chalk.blue(`Whale balances:`));
		console.log(chalk.blue(`  Token0 (${poolKey.currency0 === NATIVE_ETH ? 'ETH' : 'ERC20'}): ${formatUnits(token0Balance, 18)}`));
		console.log(chalk.blue(`  Token1 (${poolKey.currency1 === NATIVE_ETH ? 'ETH' : 'ERC20'}): ${formatUnits(token1Balance, poolKey.currency1 === TOKEN_ADDRESSES.USDC ? 6 : 18)}`));

		// Fund tokens if needed
		const minBalance = parseUnits('100', 18);

		if (poolKey.currency0 !== NATIVE_ETH && token0Balance < minBalance) {
			console.log(chalk.yellow(`Funding whale with token0...`));
			await fundTokenBalance(publicClient, poolKey.currency0, whaleAddress, parseUnits('1000000', 18));
		}

		if (poolKey.currency1 !== NATIVE_ETH && token1Balance < minBalance) {
			console.log(chalk.yellow(`Funding whale with token1...`));
			const decimals = poolKey.currency1 === TOKEN_ADDRESSES.USDC ? 6 : 18;
			await fundTokenBalance(publicClient, poolKey.currency1, whaleAddress, parseUnits('1000000', decimals));
		}

		const poolManager = getPoolManager({
			address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
			chain: anvil,
			transport: http('http://localhost:8545')
		});

		// FIXED: Approve tokens for PoolManager
		console.log(chalk.gray(`Approving tokens for PoolManager...`));

		try {
			if (poolKey.currency0 !== NATIVE_ETH) {
				const approve0Hash = await whaleClient.writeContract({
					address: poolKey.currency0,
					abi: erc20Abi,
					functionName: 'approve',
					args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address, maxUint256]
				});
				await publicClient.waitForTransactionReceipt({ hash: approve0Hash });
				console.log(chalk.green(`Token0 approved`));
			}

			if (poolKey.currency1 !== NATIVE_ETH) {
				const approve1Hash = await whaleClient.writeContract({
					address: poolKey.currency1,
					abi: erc20Abi,
					functionName: 'approve',
					args: [CONTRACT_ADDRESSES.POOL_MANAGER as Address, maxUint256]
				});
				await publicClient.waitForTransactionReceipt({ hash: approve1Hash });
				console.log(chalk.green(`Token1 approved`));
			}

			console.log(chalk.green(`All approvals completed`));
		} catch (approveError) {
			console.log(chalk.yellow(`Token approvals failed: ${approveError}`));
			throw approveError;
		}

		// Calculate tick range
		const { tickLower, tickUpper } = calculateTickRange(currentPrice, poolKey.tickSpacing);

		// Add liquidity position with more reasonable amount
		const liquidityDelta = parseUnits('100', 18); // 100 liquidity units
		const salt = `0x${Math.floor(Math.random() * 10**15).toString(16).padStart(64, '0')}` as `0x${string}`;

		const modifyLiquidityParams = {
			tickLower,
			tickUpper,
			liquidityDelta,
			salt
		};

		console.log(chalk.blue(`Adding liquidity position with ${formatUnits(liquidityDelta, 18)} units`));

		// Determine ETH value to send
		const hasNativeETH = poolKey.currency0 === NATIVE_ETH || poolKey.currency1 === NATIVE_ETH;
		const ethValue = hasNativeETH ? parseUnits('1', 18) : 0n; // Send 1 ETH if pool has native ETH

		// Call modifyLiquidity with proper options based on whether ETH is involved
		const hash = hasNativeETH 
			? await poolManager.write.modifyLiquidity(
				[poolKey, modifyLiquidityParams, '0x'],
				{
					account: whaleAddress,
					chain: anvil,
					gas: 2000000n,
					value: ethValue
				}
			)
			: await poolManager.write.modifyLiquidity(
				[poolKey, modifyLiquidityParams, '0x'],
				{
					account: whaleAddress,
					chain: anvil,
					gas: 2000000n
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

	} catch (error: any) {
		console.error(chalk.red(`Error in liquidity addition: ${error.message}`));

		// Cleanup on error
		try {
			const publicClient = createPublicClient({
				chain: anvil,
				transport: http('http://localhost:8545')
			});
			const whaleAddress = WHALE_ADDRESSES.USDC_WHALE as Address;
			await publicClient.request({
				method: 'anvil_stopImpersonatingAccount' as any,
				params: [whaleAddress]
			});
		} catch (e) {
			// Ignore cleanup errors
		}

		throw error; // Re-throw the error instead of returning dummy hash
	}
}
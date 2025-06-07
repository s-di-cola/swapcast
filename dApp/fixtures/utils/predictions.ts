import { type Address, createPublicClient, http, parseUnits, encodeFunctionData } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES } from './wallets';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import chalk from 'chalk';

export const OUTCOME_BEARISH = 0;
export const OUTCOME_BULLISH = 1;

interface Market {
	id: string | bigint;
	poolKey: {
		currency0: Address;
		currency1: Address;
		fee: number;
		tickSpacing: number;
		hooks: Address;
	};
}

interface UserAccount {
	address: Address;
	privateKey?: string;
}

/**
 * Creates swap parameters for prediction recording
 * @param outcome - Prediction outcome (0 for Bearish, 1 for Bullish)
 * @param stakeAmount - Net stake amount
 * @returns Swap parameters object
 */
function createSwapParams(outcome: number, stakeAmount: bigint) {
	return {
		zeroForOne: outcome === OUTCOME_BEARISH,
		amountSpecified: stakeAmount,
		sqrtPriceLimitX96: 0n
	};
}

/**
 * Creates public client for blockchain interaction
 * @returns Public client instance
 */
function createAnvilPublicClient() {
	return createPublicClient({
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Gets PoolManager contract instance
 * @returns PoolManager contract
 */
function getPoolManagerContract() {
	return getPoolManager({
		address: CONTRACT_ADDRESSES.POOL_MANAGER as `0x${string}`,
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Ensures account has sufficient funds for transaction
 * @param publicClient - Public client instance
 * @param userAccount - User account to fund
 * @param requiredAmount - Amount required for transaction
 */
async function ensureSufficientFunds(
	publicClient: any,
	userAccount: UserAccount,
	requiredAmount: bigint
): Promise<void> {
	await publicClient.request({
		method: 'anvil_impersonateAccount' as any,
		params: [userAccount.address]
	});

	const balance = await publicClient.getBalance({ address: userAccount.address });
	const requiredBalance = requiredAmount + parseUnits('0.1', 18);

	if (balance < requiredBalance) {
		console.log(chalk.yellow(`Funding account ${userAccount.address} with ETH...`));
		
		await publicClient.request({
			method: 'anvil_setBalance' as any,
			params: [
				userAccount.address,
				('0x' + (parseUnits('1000', 18)).toString(16)) as any
			]
		});
		
		console.log(chalk.green(`Funded account ${userAccount.address} with 1000 ETH`));
	}
}

/**
 * Executes swap transaction for regular account
 * @param poolManager - PoolManager contract instance
 * @param market - Market information
 * @param swapParams - Swap parameters
 * @param userAccount - User account
 * @param transactionValue - Total transaction value
 * @returns Transaction hash
 */
async function executeRegularAccountSwap(
	poolManager: any,
	market: Market,
	swapParams: any,
	userAccount: UserAccount,
	transactionValue: bigint
): Promise<`0x${string}`> {
	return await poolManager.write.swap(
		[market.poolKey, swapParams, '0x'],
		{
			account: userAccount.address,
			chain: anvil,
			value: transactionValue
		}
	);
}

/**
 * Executes swap transaction for impersonated account
 * @param publicClient - Public client instance
 * @param poolManager - PoolManager contract instance
 * @param market - Market information
 * @param swapParams - Swap parameters
 * @param userAccount - User account
 * @param transactionValue - Total transaction value
 * @returns Transaction hash
 */
async function executeImpersonatedAccountSwap(
	publicClient: any,
	poolManager: any,
	market: Market,
	swapParams: any,
	userAccount: UserAccount,
	transactionValue: bigint
): Promise<`0x${string}`> {
	await ensureSufficientFunds(publicClient, userAccount, transactionValue);

	const data = encodeFunctionData({
		abi: poolManager.abi,
		functionName: 'swap',
		args: [market.poolKey, swapParams, '0x'] as const
	});

	return await publicClient.request({
		method: 'eth_sendTransaction' as any,
		params: [
			{
				from: userAccount.address,
				to: CONTRACT_ADDRESSES.POOL_MANAGER as `0x${string}`,
				data,
				value: `0x${transactionValue.toString(16)}` as `0x${string}`
			}
		]
	});
}

/**
 * Determines if account is a regular account with private key
 * @param userAccount - User account to check
 * @returns True if account has private key
 */
function isRegularAccount(userAccount: UserAccount): boolean {
	return 'privateKey' in userAccount && !!userAccount.privateKey;
}

/**
 * Records a prediction by performing a swap on the Uniswap v4 pool
 * @param userAccount - Account making the prediction
 * @param market - Market information including pool key
 * @param outcome - Prediction outcome (0 for Bearish, 1 for Bullish)
 * @param stakeAmount - Net amount for the prediction stake
 * @param transactionValue - Gross amount for msg.value (stakeAmount + protocolFee)
 * @returns Transaction hash
 */
export async function recordPredictionViaSwap(
	userAccount: UserAccount,
	market: Market,
	outcome: number,
	stakeAmount: bigint,
	transactionValue: bigint
): Promise<`0x${string}`> {
	console.log(chalk.yellow(`Recording prediction via swap for market ${market.id}...`));

	const publicClient = createAnvilPublicClient();
	const poolManager = getPoolManagerContract();
	const swapParams = createSwapParams(outcome, stakeAmount);

	try {
		let hash: `0x${string}`;

		if (isRegularAccount(userAccount)) {
			hash = await executeRegularAccountSwap(
				poolManager,
				market,
				swapParams,
				userAccount,
				transactionValue
			);
		} else {
			hash = await executeImpersonatedAccountSwap(
				publicClient,
				poolManager,
				market,
				swapParams,
				userAccount,
				transactionValue
			);
		}

		console.log(chalk.green(`Prediction recorded via swap with hash: ${hash}`));
		return hash;
	} catch (error: any) {
		console.error(chalk.red(`Failed to record prediction via swap: ${error.message}`));
		throw error;
	}
}
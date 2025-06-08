import { type Address, createPublicClient, http, parseUnits, encodePacked } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES } from './wallets';
import { getSimpleSwapRouter } from '../../src/generated/types/SimpleSwapRouter';
import chalk from 'chalk';
import { encodeFunctionData } from 'viem';
export const OUTCOME_BEARISH = 0;
export const OUTCOME_BULLISH = 1;

const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970341n;

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
 * Creates properly encoded hookData for prediction recording
 */
function createPredictionHookData(
	userAddress: Address,
	marketId: string | bigint,
	outcome: number,
	stakeAmount: bigint
): `0x${string}` {
	const stakeAsUint128 = BigInt(stakeAmount) & ((1n << 128n) - 1n);
	const marketIdBigInt = BigInt(marketId);
	
	console.log(chalk.gray(`   Creating hookData:`));
	console.log(chalk.gray(`     User: ${userAddress}`));
	console.log(chalk.gray(`     MarketId: ${marketIdBigInt}`));
	console.log(chalk.gray(`     Outcome: ${outcome}`));
	console.log(chalk.gray(`     Stake: ${stakeAsUint128}`));

	const hookData = encodePacked(
		['address', 'uint256', 'uint8', 'uint128'],
		[userAddress, marketIdBigInt, outcome, stakeAsUint128]
	);

	console.log(chalk.gray(`     HookData length: ${hookData.length} characters (${(hookData.length - 2) / 2} bytes)`));
	console.log(chalk.gray(`     HookData: ${hookData.slice(0, 20)}...${hookData.slice(-10)}`));

	return hookData;
}

/**
 * Creates swap parameters for prediction recording
 */
function createSwapParams(outcome: number, stakeAmount: bigint) {
	return {
		zeroForOne: outcome === OUTCOME_BEARISH,
		amountSpecified: stakeAmount,
		sqrtPriceLimitX96: outcome === OUTCOME_BEARISH 
			? MIN_SQRT_PRICE + 1n 
			: MAX_SQRT_PRICE - 1n
	};
}

/**
 * Creates public client for blockchain interaction
 */
function createAnvilPublicClient() {
	return createPublicClient({
		chain: anvil,
		transport: http(anvil.rpcUrls.default.http[0])
	});
}

/**
 * Ensures account has sufficient funds for transaction (gas only, no ETH needed for swap)
 */
async function ensureSufficientFunds(
	publicClient: any,
	userAccount: UserAccount,
	requiredAmount: bigint
): Promise<void> {
	// For impersonated accounts, ensure they have sufficient funds
	if (!('privateKey' in userAccount) || !userAccount.privateKey) {
		await publicClient.request({
			method: 'anvil_impersonateAccount' as any,
			params: [userAccount.address]
		});
	}

	const balance = await publicClient.getBalance({ address: userAccount.address });
	const requiredBalance = requiredAmount + parseUnits('0.1', 18); // Extra for gas

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
 * UPDATED: Executes swap via SimpleSwapRouter (handles unlock/lock automatically)
 */
async function executeSwap(
	publicClient: any,
	market: Market,
	swapParams: any,
	hookData: `0x${string}`,
	userAccount: UserAccount,
	transactionValue: bigint
): Promise<`0x${string}`> {
	// Ensure account has sufficient funds for gas only
	await ensureSufficientFunds(publicClient, userAccount, parseUnits('0.1', 18));

	console.log(chalk.blue(`   🔄 Executing V4 swap via SimpleSwapRouter`));
	console.log(chalk.yellow(`   🏦 Hook will use its pre-funded balance (${Number(transactionValue) / 1e18} ETH needed)`));

	console.log(chalk.gray(`   📦 HookData length: ${(hookData.length - 2) / 2} bytes`));
	console.log(chalk.gray(`   🔄 Using SimpleSwapRouter: ${CONTRACT_ADDRESSES.SIMPLE_SWAP_ROUTER}`));

	// FIXED: Use publicClient.request for impersonated accounts
	if (!isRegularAccount(userAccount)) {
		// For impersonated accounts, use eth_sendTransaction
		// First encode the function call data
		const calldata = encodeFunctionData({
			abi: [
				{
					name: 'swap',
					type: 'function',
					inputs: [
						{
							name: 'poolKey',
							type: 'tuple',
							components: [
								{ name: 'currency0', type: 'address' },
								{ name: 'currency1', type: 'address' },
								{ name: 'fee', type: 'uint24' },
								{ name: 'tickSpacing', type: 'int24' },
								{ name: 'hooks', type: 'address' }
							]
						},
						{
							name: 'params',
							type: 'tuple',
							components: [
								{ name: 'zeroForOne', type: 'bool' },
								{ name: 'amountSpecified', type: 'int256' },
								{ name: 'sqrtPriceLimitX96', type: 'uint160' }
							]
						},
						{ name: 'hookData', type: 'bytes' }
					],
					outputs: [],
					stateMutability: 'payable'
				}
			],
			functionName: 'swap',
			args: [market.poolKey, swapParams, hookData]
		});

		return await publicClient.request({
			method: 'eth_sendTransaction',
			params: [{
				from: userAccount.address,
				to: CONTRACT_ADDRESSES.SIMPLE_SWAP_ROUTER,
				data: calldata,
				value: '0x0', // No ETH sent - hook uses pre-funded balance
				gas: '0x1E8480' // 2000000 in hex
			}]
		});
	} else {
		// For regular accounts with private keys
		const simpleSwapRouter = getSimpleSwapRouter({
			address: CONTRACT_ADDRESSES.SIMPLE_SWAP_ROUTER as Address,
			chain: anvil,
			transport: http(anvil.rpcUrls.default.http[0])
		});

		return await simpleSwapRouter.write.swap([
			market.poolKey,
			swapParams,
			hookData
		], {
			account: userAccount.address,
			value: 0n,
			gas: 2000000n,
			chain: anvil
		});
	}
}

/**
 * Determines if account is a regular account with private key
 */
function isRegularAccount(userAccount: UserAccount): boolean {
	return 'privateKey' in userAccount && !!userAccount.privateKey;
}

/**
 * UPDATED: Records a prediction via SimpleSwapRouter V4 swap
 */
export async function recordPredictionViaSwap(
	userAccount: UserAccount,
	market: Market,
	outcome: number,
	stakeAmount: bigint,
	transactionValue: bigint
): Promise<`0x${string}`> {
	console.log(chalk.yellow(`📝 Recording prediction via SimpleSwapRouter V4 swap for market ${market.id}...`));

	const publicClient = createAnvilPublicClient();
	const swapParams = createSwapParams(outcome, stakeAmount);

	// Create proper hookData for prediction (standard 69-byte format)
	const hookData = createPredictionHookData(
		userAccount.address,
		market.id,
		outcome,
		stakeAmount
	);

	try {
		const hash = await executeSwap(
			publicClient,
			market,
			swapParams,
			hookData,
			userAccount,
			transactionValue
		);

		console.log(chalk.green(`✅ Prediction recorded via SimpleSwapRouter: ${hash}`));
		return hash;
	} catch (error: any) {
		console.error(chalk.red(`❌ Failed to record prediction via SimpleSwapRouter: ${error.message}`));
		
		// Enhanced error logging
		if (error.message.includes('revert')) {
			console.error(chalk.red(`   🔍 Check hook contract logic and unlock pattern`));
			console.error(chalk.red(`   📦 HookData: ${hookData}`));
		}
		
		throw error;
	}
}
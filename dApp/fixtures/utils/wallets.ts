/**
 * @file Wallet and Account Management
 * @description Handles test wallet creation, account management, and blockchain client setup
 * @module utils/wallets
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
	type Address,
	createPublicClient,
	createWalletClient,
	http,
	type PrivateKeyAccount,
	type PublicClient,
	type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Predefined test accounts from Anvil (first 10 accounts with private keys)
 * @constant
 * @type {Array<{address: Address, privateKey: string}>}
 */
export const ANVIL_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  },
  {
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  },
  {
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  },
  {
    address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  },
  {
    address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
    privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
	},
	{
		address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
		privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6'
	}
] as const;

export const CONTRACT_ADDRESSES = {
	SWAPCAST_NFT: process.env.PUBLIC_SWAPCASTNFT_ADDRESS,
	TREASURY: process.env.PUBLIC_TREASURY_ADDRESS,
	PREDICTION_MANAGER: process.env.PUBLIC_PREDICTIONMANAGER_ADDRESS,
	ORACLE_RESOLVER: process.env.PUBLIC_ORACLERESOLVER_ADDRESS,
	REWARD_DISTRIBUTOR: process.env.PUBLIC_REWARDDISTRIBUTOR_ADDRESS,
	SWAPCAST_HOOK: process.env.PUBLIC_SWAPCASTHOOK_ADDRESS,
	POOL_MANAGER: process.env.PUBLIC_UNIV4_POOLMANAGER_ADDRESS,
	UNIVERSAL_ROUTER: process.env.PUBLIC_UNIVERSAL_ROUTER_ADDRESS,
	POSITION_MANAGER: process.env.PUBLIC_UNIV4_POSITIONMANAGER_ADDRESS,
	STATE_VIEW: process.env.PUBLIC_STATEVIEW_ADDRESS,
	PERMIT2: process.env.PUBLIC_PERMIT2_ADDRESS
} as const;

export const TOKEN_ADDRESSES = {
	ETH: '0x0000000000000000000000000000000000000000',
	USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
	USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
	DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
	WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
} as const;

export const WHALE_ADDRESSES = {
	WETH_WHALE: '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3',
	USDC_WHALE: '0x55FE002aefF02F77364de339a1292923A15844B8',
	USDT_WHALE: '0x5754284f345afc66a98fbB0a0Afe71e0F007B949',
	DAI_WHALE: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
	WBTC_WHALE: '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656'
} as const;

const RPC_URL = process.env.PUBLIC_RPC_URL || 'http://localhost:8545';

/**
 * Validates the format of an Ethereum token address
 * @param {string} symbol - Token symbol for error messages
 * @param {string} address - Address to validate
 * @throws {Error} If address is not a valid Ethereum address
 * @example
 * validateTokenAddress('WETH', '0x...'); // Throws if invalid
 */
function validateTokenAddress(symbol: string, address: string): void {
	if (!address.startsWith('0x') || address.length !== 42) {
		throw new Error(`Invalid address for ${symbol}: ${address}`);
	}
}

/**
 * Checks for duplicate addresses in an array
 * @param {string[]} addresses - Array of Ethereum addresses to check
 * @throws {Error} If any duplicate addresses are found
 * @example
 * checkForDuplicateAddresses(['0x1', '0x2']); // Throws if duplicates
 */
function checkForDuplicateAddresses(addresses: string[]): void {
	const uniqueAddresses = new Set(addresses);
	if (addresses.length !== uniqueAddresses.size) {
		throw new Error('Duplicate token addresses detected!');
	}
}

/**
 * Validates all token addresses in the configuration
 * @throws {Error} If any address is invalid or duplicates exist
 * @example
 * validateTokenAddresses(); // Throws if any validation fails
 */
function validateTokenAddresses(): void {
	console.log('Validating token addresses...');

	Object.entries(TOKEN_ADDRESSES).forEach(([symbol, address]) => {
		validateTokenAddress(symbol, address);
	});

	const addresses = Object.values(TOKEN_ADDRESSES);
	checkForDuplicateAddresses(addresses);

	console.log('Token addresses validated:', TOKEN_ADDRESSES);
}

/**
 * Creates an admin account using the first Anvil test account
 * @returns {PrivateKeyAccount} Viem account instance for the admin
 * @example
 * const admin = createAdminAccount();
 */
function createAdminAccount() {
	return privateKeyToAccount(ANVIL_ACCOUNTS[0].privateKey as `0x${string}`);
}

/**
 * Creates user accounts from remaining Anvil test accounts
 * @returns {PrivateKeyAccount[]} Array of Viem account instances
 * @example
 * const users = createUserAccounts();
 */
function createUserAccounts() {
	return ANVIL_ACCOUNTS.slice(1).map((account) =>
		privateKeyToAccount(account.privateKey as `0x${string}`)
	);
}

/**
 * Creates an HTTP transport for Viem clients
 * @returns {ReturnType<typeof http>} Configured HTTP transport
 * @example
 * const transport = createTransport();
 */
function createTransport() {
	return http(RPC_URL);
}

/**
 * Creates a public client for read-only blockchain operations
 * @param {ReturnType<typeof http>} transport - HTTP transport instance
 * @returns {PublicClient} Configured public client
 * @example
 * const publicClient = createAnvilPublicClient(transport);
 */
function createAnvilPublicClient(transport: any) {
	return createPublicClient({
		chain: anvil,
		transport
	});
}

/**
 * Creates a wallet client for admin operations
 * @param {PrivateKeyAccount} adminAccount - Admin account from createAdminAccount
 * @param {ReturnType<typeof http>} transport - HTTP transport
 * @returns {WalletClient} Configured wallet client for admin
 * @example
 * const adminWallet = createAdminWalletClient(adminAccount, transport);
 */
function createAdminWalletClient(adminAccount: any, transport: any) {
	return createWalletClient({
		account: adminAccount,
		chain: anvil,
		transport
	});
}

/**
 * Creates wallet clients for multiple user accounts
 * @param {PrivateKeyAccount[]} userAccounts - Array of user accounts
 * @param {ReturnType<typeof http>} transport - HTTP transport
 * @returns {WalletClient[]} Array of configured wallet clients
 * @example
 * const userWallets = createUserWalletClients(userAccounts, transport);
 */
function createUserWalletClients(userAccounts: any[], transport: any) {
	return userAccounts.map((account) =>
		createWalletClient({
			account,
			chain: anvil,
			transport
		})
	);
}

/**
 * Sets up all necessary clients and accounts for testing
 * @returns {Object} Object containing:
 *   - admin: Admin account and wallet client
 *   - users: Array of user accounts and wallet clients
 *   - publicClient: Public client for read operations
 * @example
 * const { admin, users, publicClient } = setupWallets();
 */
export async function setupWallets() {
	validateTokenAddresses();

	const transport = createTransport();
	const publicClient = createAnvilPublicClient(transport);
	const adminAccount = createAdminAccount();
	const adminClient = createAdminWalletClient(adminAccount, transport);
	const userAccounts = createUserAccounts();
	const userClients = createUserWalletClients(userAccounts, transport);

	return {
		publicClient,
		adminClient,
		adminAccount,
		userAccounts,
		userClients
	};
}

/**
 * Impersonates an account for testing purposes (Anvil only)
 * @param {PublicClient} publicClient - Public client instance
 * @param {Address} address - Address to impersonate
 * @returns {Promise<void>}
 * @example
 * await impersonateAccount(publicClient, '0x...');
 */
export async function impersonateAccount(publicClient: PublicClient, address: Address): Promise<void> {
	await publicClient.request({
		method: 'anvil_impersonateAccount' as any,
		params: [address]
	});
}

/**
 * Stops impersonating an account (Anvil only)
 * @param {PublicClient} publicClient - Public client instance
 * @param {Address} address - Address to stop impersonating
 * @returns {Promise<void>}
 * @example
 * await stopImpersonatingAccount(publicClient, '0x...');
 */
export async function stopImpersonatingAccount(publicClient: PublicClient, address: Address): Promise<void> {
	await publicClient.request({
		method: 'anvil_stopImpersonatingAccount' as any,
		params: [address]
	});
}

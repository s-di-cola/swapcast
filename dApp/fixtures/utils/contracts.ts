/**
 * Contract interaction utilities for fixture generation
 *
 * Provides helper functions to interact with SwapCast contracts
 */

import { config } from 'dotenv';
import path from 'path';
// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

// Contract addresses from environment
const CONTRACT_ADDRESSES = {
	PREDICTION_MANAGER: process.env.PUBLIC_PREDICTIONMANAGER_ADDRESS as string,
	SWAPCAST_HOOK: process.env.PUBLIC_SWAPCASTHOOK_ADDRESS as string,
	POOL_MANAGER: process.env.PUBLIC_UNIV4_POOLMANAGER_ADDRESS as string,
	NFT: process.env.PUBLIC_SWAPCASTNFT_ADDRESS as string,
	TREASURY: process.env.PUBLIC_TREASURY_ADDRESS as string,
	ORACLE_RESOLVER: process.env.PUBLIC_ORACLERESOLVER_ADDRESS as string,
	REWARD_DISTRIBUTOR: process.env.PUBLIC_REWARDDISTRIBUTOR_ADDRESS as string
};

// Chainlink price feed addresses
export const PRICE_FEEDS = {
	'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
	'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
	'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
	'UNI/USD': '0x553303d460EE0afB37EdFf9bE42922D8FF63220e',
	'AAVE/USD': '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9',
	'SNX/USD': '0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699',
	'MKR/USD': '0xec1D1B3b0443256cc3860e24a46F108e699484Aa',
	'COMP/USD': '0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5'
};

// ABI for PredictionManager (minimal for createMarket)
const PREDICTION_MANAGER_ABI = [
	'function createMarket(string memory _name, string memory _assetSymbol, uint256 _expirationTime, address _priceAggregator, uint256 _priceThreshold, tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) calldata _poolKey) external returns (uint256 marketId)',
	'function recordPrediction(address _user, uint256 _marketId, uint8 _outcome, uint128 _convictionStakeDeclared) external payable',
	'function getMarketDetails(uint256 _marketId) external view returns (tuple(uint256 marketId, string name, string assetSymbol, bool exists, bool resolved, uint8 winningOutcome, uint256 totalConvictionStakeOutcome0, uint256 totalConvictionStakeOutcome1, uint256 expirationTime, address priceAggregator, uint256 priceThreshold))',
	'event MarketCreated(uint256 indexed marketId, string name, string assetSymbol, uint256 expirationTime, address priceAggregator, uint256 priceThreshold)'
];

// ABI for PoolManager (minimal for initialize)
const POOL_MANAGER_ABI = [
	'function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) memory key, uint160 sqrtPriceX96) external returns (int24 tick)'
];

// ABI for SwapCastHook (minimal for afterSwap)
const SWAPCAST_HOOK_ABI = [
	'function afterSwap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) calldata key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) calldata params, bytes calldata data) external returns (bytes4, int128)'
];

/**
 * Gets contract ABIs for fixture generation
 *
 * @returns Object containing contract ABIs
 */
export function getContractABIs() {
	return {
		predictionManagerABI: PREDICTION_MANAGER_ABI,
		poolManagerABI: POOL_MANAGER_ABI,
		swapCastHookABI: SWAPCAST_HOOK_ABI
	};
}

/**
 * Formats a pool key object for contract calls
 *
 * @param currency0 Address of the first token (lower address)
 * @param currency1 Address of the second token (higher address)
 * @param fee Fee tier (100, 500, 3000, or 10000)
 * @param tickSpacing Tick spacing for the fee tier
 * @returns Formatted pool key object
 */
export function formatPoolKey(
	currency0: string,
	currency1: string,
	fee: number,
	tickSpacing: number
) {
	return {
		currency0,
		currency1,
		fee,
		tickSpacing,
		hooks: CONTRACT_ADDRESSES.SWAPCAST_HOOK
	};
}

/**
 * Gets the tick spacing for a fee tier
 *
 * @param fee Fee tier (100, 500, 3000, or 10000)
 * @returns Tick spacing for the fee tier
 */
export function getTickSpacing(fee: number): number {
	switch (fee) {
		case 100:
			return 1;
		case 500:
			return 10;
		case 3000:
			return 60;
		case 10000:
			return 200;
		default:
			throw new Error(`Unsupported fee tier: ${fee}`);
	}
}

/**
 * Sorts token addresses in canonical order (lower address first)
 *
 * @param tokenA First token address
 * @param tokenB Second token address
 * @returns Sorted token addresses [token0, token1]
 */
export function sortTokenAddresses(tokenA: string, tokenB: string): [string, string] {
	return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

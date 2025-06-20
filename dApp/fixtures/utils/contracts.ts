/**
 * @file Contract interaction utilities for test fixtures
 * @description Provides contract ABIs and addresses for test environment
 * @module utils/contracts
 */

import { config } from 'dotenv';
import path from 'path';
import { PredictionManagerAbi } from '../../src/generated/types/PredictionManager';
import { PoolManagerAbi } from '../../src/generated/types/PoolManager';
import { SwapCastHookAbi } from '../../src/generated/types/SwapCastHook';
// Initialize environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Contract addresses loaded from environment variables
 * @property PREDICTION_MANAGER - Address of the PredictionManager contract
 * @property SWAPCAST_HOOK - Address of the SwapCastHook contract
 * @property POOL_MANAGER - Address of the Uniswap V4 PoolManager contract
 * @property NFT - Address of the SwapCastNFT contract
 * @property TREASURY - Address of the Treasury contract
 * @property ORACLE_RESOLVER - Address of the OracleResolver contract
 * @property REWARD_DISTRIBUTOR - Address of the RewardDistributor contract
 */
const CONTRACT_ADDRESSES = {
	PREDICTION_MANAGER: process.env.PUBLIC_PREDICTIONMANAGER_ADDRESS as string,
	SWAPCAST_HOOK: process.env.PUBLIC_SWAPCASTHOOK_ADDRESS as string,
	POOL_MANAGER: process.env.PUBLIC_UNIV4_POOLMANAGER_ADDRESS as string,
	NFT: process.env.PUBLIC_SWAPCASTNFT_ADDRESS as string,
	TREASURY: process.env.PUBLIC_TREASURY_ADDRESS as string,
	ORACLE_RESOLVER: process.env.PUBLIC_ORACLERESOLVER_ADDRESS as string,
	REWARD_DISTRIBUTOR: process.env.PUBLIC_REWARDDISTRIBUTOR_ADDRESS as string
};

/**
 * Chainlink price feed addresses for various asset pairs
 * @property 'ETH/USD' - ETH/USD price feed
 * @property 'BTC/USD' - BTC/USD price feed
 * @property 'LINK/USD' - LINK/USD price feed
 * @property 'UNI/USD' - UNI/USD price feed
 * @property 'AAVE/USD' - AAVE/USD price feed
 * @property 'SNX/USD' - SNX/USD price feed
 * @property 'MKR/USD' - MKR/USD price feed
 * @property 'COMP/USD' - COMP/USD price feed
 */
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


/**
 * Retrieves contract ABIs for test fixtures
 * @returns Object containing ABIs for core contracts:
 *   - predictionManagerABI: ABI for PredictionManager
 *   - poolManagerABI: ABI for Uniswap V4 PoolManager
 *   - swapCastHookABI: ABI for SwapCastHook
 */
export function getContractABIs() {
	return {
		predictionManagerABI: PredictionManagerAbi,
		poolManagerABI: PoolManagerAbi,
		swapCastHookABI: SwapCastHookAbi
	};
}



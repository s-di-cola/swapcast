/**
 * Liquidity utilities for Uniswap v4 pools
 */

import {
  type Address,
  type Hash,
  type WalletClient,
  encodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  parseUnits
} from 'viem';
import { anvil } from 'viem/chains';
import { getPositionManager } from '../../src/generated/types/PositionManager';
import { getContract, getWalletClient, impersonateAccount, stopImpersonatingAccount } from './client';
import { logSuccess, logWarning, withErrorHandling } from './error';
import { calculateSqrtPriceX96, getTokenSymbolFromAddress } from './math';
import { approveTokens, findWhaleWithBalance } from './tokens';
import { CONTRACT_ADDRESSES } from './wallets';
import {Actions} from '@uniswap/v4-sdk'
/**
 * Setup a whale account for liquidity operations
 */
const setupWhaleForLiquidity = async (
  token0Address: Address,
  token1Address: Address,
  amount0Desired: bigint,
  amount1Desired: bigint
): Promise<{ whaleAddress: Address; whaleClient: WalletClient }> => {
  // Get whale with sufficient tokens for token0
  const whaleAddress = await findWhaleWithBalance(token0Address);

  // Impersonate whale for transaction
  await impersonateAccount(whaleAddress);
  const whaleClient = await getWalletClient(whaleAddress);

  const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

  // Only approve token0 if it's not native ETH
  if (token0Address !== NATIVE_ETH_ADDRESS) {
    await approveTokens(
      token0Address,
      whaleAddress,
      CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      amount0Desired
    );
  }

  // Only approve token1 if it's not native ETH
  if (token1Address !== NATIVE_ETH_ADDRESS) {
    await approveTokens(
      token1Address,
      whaleAddress,
      CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      amount1Desired
    );
  }

  return { whaleAddress, whaleClient };
};

/**
 * Calculates tick range based on current price and range percentage
 */
const calculateTickRangeFromPrice = (currentPrice: number, rangePercentage = 10): { tickLower: number; tickUpper: number } => {
  // Calculate price range
  const lowerPrice = currentPrice * (1 - rangePercentage / 100);
  const upperPrice = currentPrice * (1 + rangePercentage / 100);

  // Calculate ticks using logarithmic formula
  // tick = log(price) / log(1.0001)
  const tickLower = Math.floor(Math.log(lowerPrice) / Math.log(1.0001));
  const tickUpper = Math.floor(Math.log(upperPrice) / Math.log(1.0001));

  return { tickLower, tickUpper };
};

/**
 * Calculate tick from price
 * @param price - The price to convert to tick
 * @returns The nearest tick for the given price
 */
const calculateTickRange = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

/**
 * Wrapper for tick range calculation with error handling
 * Converts the synchronous function to async to be compatible with withErrorHandling
 */
const getTickRange = withErrorHandling(
  async (currentPrice: number, rangePercentage = 10): Promise<{ tickLower: number; tickUpper: number }> => {
    return calculateTickRangeFromPrice(currentPrice, rangePercentage);
  },
  'GetTickRange'
);

/**
 * Creates a pool key object for Uniswap V4
 */
const createPoolKey = withErrorHandling(
  async (
    token0Address: Address,
    token1Address: Address,
    fee: number = 3000,
    tickSpacing: number = 60,
    hooksAddress: Address = CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address
  ): Promise<{
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  }> => {
    return {
      currency0: token0Address,
      currency1: token1Address,
      fee,
      tickSpacing,
      hooks: hooksAddress
    };
  },
  'CreatePoolKey'
);

/**
 * Calculate ETH value and determine if native ETH is involved
 */
const calculateETHValue = (
  poolKey: { currency0: Address; currency1: Address },
  amount0Desired: bigint,
  amount1Desired: bigint
): { value: bigint; hasNativeETH: boolean } => {
  const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
  let value = 0n;
  let hasNativeETH = false;

  if (poolKey.currency0 === NATIVE_ETH_ADDRESS) {
    value = amount0Desired;
    hasNativeETH = true;
  } else if (poolKey.currency1 === NATIVE_ETH_ADDRESS) {
    value = amount1Desired;
    hasNativeETH = true;
  }

  return { value, hasNativeETH };
};

/**
 * Encode initializePool parameters for multicall using encodeFunctionData
 */
const encodeInitializePoolParams = (
  poolKey: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address },
  sqrtPriceX96: bigint
): `0x${string}` => {
  return encodeFunctionData({
    abi: [{
      name: 'initializePool',
      type: 'function',
      inputs: [
        {
          name: 'key',
          type: 'tuple',
          components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' }
          ]
        },
        { name: 'sqrtPriceX96', type: 'uint160' }
      ],
      outputs: [],
      stateMutability: 'nonpayable'
    }],
    functionName: 'initializePool',
    args: [poolKey, sqrtPriceX96]
  });
};

/**
 * Encode mint parameters for liquidity provision
 */
const encodeMintParams = (
  poolKey: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address },
  tickLower: number,
  tickUpper: number,
  amount0Desired: bigint,
  amount1Desired: bigint,
  whaleAddress: Address
): `0x${string}`[] => {
  const mintParams: `0x${string}`[] = [];

  // MINT_POSITION parameters
  mintParams[0] = encodeAbiParameters(
    [
      {
        name: 'pool',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]
      },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0Max', type: 'uint256' },
      { name: 'amount1Max', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'hookData', type: 'bytes' }
    ],
    [
      poolKey,
      tickLower,
      tickUpper,
      1000000n,
      amount0Desired,
      amount1Desired,
      whaleAddress,
      '0x'
    ]
  );

  // SETTLE_PAIR parameters
  mintParams[1] = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }],
    [poolKey.currency0, poolKey.currency1]
  );

  return mintParams;
};

/**
 * Encode modifyLiquidities parameters for multicall
 */
const encodeModifyLiquiditiesParams = (
  hasNativeETH: boolean,
  mintParams: `0x${string}`[]
): `0x${string}` => {
  // Create actions based on whether we have native ETH
  const actions = hasNativeETH 
    ? encodePacked(['uint8', 'uint8', 'uint8'], [Actions.MINT_POSITION, Actions.SETTLE_PAIR, Actions.SWEEP]) // MINT_POSITION, SETTLE_PAIR, SWEEP
    : encodePacked(['uint8', 'uint8'], [Actions.MINT_POSITION, Actions.SETTLE_PAIR]); // MINT_POSITION, SETTLE_PAIR

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);
  const modifyLiquiditiesSelector = '0xdd46508f';

  return `${modifyLiquiditiesSelector}${encodeAbiParameters(
    [
      { name: 'unlockData', type: 'bytes' },
      { name: 'deadline', type: 'uint256' }
    ],
    [
      encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, mintParams]
      ),
      deadline
    ]
  ).slice(2)}` as `0x${string}`;
};

/**
 * Initialize pool and mint liquidity in one atomic transaction using multicall
 * Following the official Uniswap V4 guide
 */
const mintPool = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number,
  amount0: string = '10',
  amount1: string = '10'
): Promise<Hash> => {
  const whaleAddress = await findWhaleWithBalance(token0Address);
  await impersonateAccount(whaleAddress);
  
  try {
    // Setup basic parameters
    const token0Symbol = getTokenSymbolFromAddress(token0Address);
    const token1Symbol = getTokenSymbolFromAddress(token1Address);
    const poolKey = await createPoolKey(token0Address, token1Address);
    const sqrtPriceX96 = calculateSqrtPriceX96(token0Symbol, token1Symbol, basePrice);
    const { tickLower, tickUpper } = calculateTickRangeFromPrice(basePrice);
    const amount0Desired = parseUnits(amount0, 18);
    const amount1Desired = parseUnits(amount1, 18);

    // Setup whale and approvals
    const { whaleAddress } = await setupWhaleForLiquidity(token0Address, token1Address, amount0Desired, amount1Desired);

    // Calculate ETH value
    const { value, hasNativeETH } = calculateETHValue(poolKey, amount0Desired, amount1Desired);

    // Encode multicall parameters using encodeFunctionData
    const initializeParams = encodeInitializePoolParams(poolKey, sqrtPriceX96);
    const mintParams = encodeMintParams(poolKey, tickLower, tickUpper, amount0Desired, amount1Desired, whaleAddress);
    const modifyLiquiditiesParams = encodeModifyLiquiditiesParams(hasNativeETH, mintParams);

    const params = [initializeParams, modifyLiquiditiesParams];

    console.log('Multicall params:', params);

    // Execute multicall with account specified
    const positionManager = await getPositionManager({
      address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      chain: anvil
    });

    const hash = await positionManager.write.multicall(
      [params],
      {
        account: whaleAddress,
        ...(hasNativeETH && { value }),
        chain: anvil
      }
    );

    logSuccess('PoolInitialization', `Pool initialized and liquidity minted with hash: ${hash}`);
    return hash;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('PoolInitialization', `Failed to initialize pool and mint liquidity: ${errorMessage}`);
    if (error.cause) {
      logWarning('PoolInitialization', `Error cause: ${JSON.stringify(error.cause)}`);
    }
    throw new Error(`mintPool failed: ${errorMessage}`);
  } finally {
    await stopImpersonatingAccount(whaleAddress);
  }
};

export { 
  calculateTickRange, 
  calculateTickRangeFromPrice, 
  createPoolKey, 
  getTickRange, 
  mintPool,
  setupWhaleForLiquidity,
  calculateETHValue,
  encodeInitializePoolParams,
  encodeMintParams,
  encodeModifyLiquiditiesParams
};
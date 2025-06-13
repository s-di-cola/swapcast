/**
 * Liquidity utilities for Uniswap v4 pools
 */

import { Actions } from '@uniswap/v4-sdk';
import {
  Address,
  Hash,
  http,
  parseUnits,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getContract,
  createWalletClient
} from 'viem';
import { anvil } from 'viem/chains';
import { getPublicClient, impersonateAccount, stopImpersonatingAccount } from './client';
import { logSuccess, logWarning, withErrorHandling } from './error';
import { calculateSqrtPriceX96, getTokenSymbolFromAddress } from './math';
import { approveTokens, findWhaleWithBalance } from './tokens';
import { CONTRACT_ADDRESSES } from './wallets';
import { getIPositionManager } from '../../src/generated/types/IPositionManager';
import { IPoolInitializer_v4Abi } from '../../src/generated/types/IPoolInitializer_v4';

/**
 * Get the default anvil account for transactions
 * @returns The default anvil account address
 */
const getAnvilAccount = (): Address => {
  // Return the default anvil account (first account)
  return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
};

/**
 * Execute a transaction using anvil_impersonateAccount
 * @param to Contract address to call
 * @param data Encoded function data
 * @param value Optional ETH value to send
 * @returns Transaction hash
 */
const executeAnvilTransaction = async (
  to: Address,
  data: `0x${string}`,
  value: bigint = 0n
): Promise<Hash> => {
  try {
    // Get the default account
    const from = getAnvilAccount();
    
    // Get public client
    const publicClient = getPublicClient();
    
    // Impersonate the account
    await impersonateAccount(from);
    
    // Send the transaction
    const txHash = await publicClient.request({
      method: 'eth_sendTransaction' as any,
      params: [{
        from,
        to,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0'
      }]
    }) as Hash;
    
    // Stop impersonating
    await stopImpersonatingAccount(from);
    
    return txHash;
  } catch (error) {
    console.error('Failed to execute Anvil transaction:', error);
    throw error;
  }
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
 * Encode initializePool parameters for multicall.
 * Uses viem's `encodeFunctionData`, which automatically
 * prepends the 4-byte selector and ABI-encodes the arguments.
 * This is equivalent to Solidity's
 * `abi.encodeWithSelector(IPoolInitializer_v4.initializePool.selector, poolKey, sqrtPriceX96)`.
 *
 * @param poolKey      Uniswap V4 PoolKey
 * @param sqrtPriceX96 Initial price (Q96.64)
 * @returns Calldata hex string ready to be pushed into `multicall`
 */
const encodeInitializePoolParams = (
  poolKey: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address },
  sqrtPriceX96: bigint
): `0x${string}` =>
  encodeFunctionData({
    abi: IPoolInitializer_v4Abi,
    functionName: 'initializePool',
    args: [poolKey, sqrtPriceX96]
  });

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
 * Initialize a new pool
 * This function should be called once per pool
 */
const initializePool = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number
): Promise<void> => {
  try {
    // Setup basic parameters
    const token0Symbol = getTokenSymbolFromAddress(token0Address);
    const token1Symbol = getTokenSymbolFromAddress(token1Address);
    const poolKey = await createPoolKey(token0Address, token1Address);
    const sqrtPriceX96 = calculateSqrtPriceX96(token0Symbol, token1Symbol, basePrice);

    // Use direct contract call without impersonation
    const positionManager = getIPositionManager({
      address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      chain: anvil
    });

    // Initialize pool directly using the contract
    try {
      // Encode function data
      const data = encodeFunctionData({
        abi: positionManager.abi,
        functionName: 'initializePool',
        args: [poolKey, sqrtPriceX96]
      });
      
      // Execute the transaction
      await executeAnvilTransaction(
        CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
        data
      );
      
      logSuccess('PoolInitialization', 'Pool initialized successfully');
    } catch (e) {
      if (String(e).includes('pool already initialized')) {
        logWarning('PoolInitialization', 'Pool already initialized');
        return; // Early return if pool already exists
      }
      throw e;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('PoolInitialization', `Failed to initialize pool: ${errorMessage}`);
    if (error.cause) {
      logWarning('PoolInitialization', `Error cause: ${JSON.stringify(error.cause)}`);
    }
    throw new Error(`initializePool failed: ${errorMessage}`);
  }
};

/**
 * Add liquidity to an existing pool
 * This function assumes the pool has already been initialized
 */
const addLiquidity = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number,
  amount0: string = '10',
  amount1: string = '10'
): Promise<Hash> => {
  try {
    // Setup basic parameters
    const poolKey = await createPoolKey(token0Address, token1Address);
    const { tickLower, tickUpper } = calculateTickRangeFromPrice(basePrice);
    const amount0Desired = parseUnits(amount0, 18);
    const amount1Desired = parseUnits(amount1, 18);

    // Calculate ETH value
    const { value, hasNativeETH } = calculateETHValue(poolKey, amount0Desired, amount1Desired);

    // Get position manager contract
    const positionManager = getIPositionManager({
      address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      chain: anvil
    });

    // Get the default account
    const account = getAnvilAccount();

    // Setup approvals for the sender account
    if (token0Address !== '0x0000000000000000000000000000000000000000') {
      await approveTokens(
        token0Address,
        account,
        CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
        amount0Desired
      );
    }

    if (token1Address !== '0x0000000000000000000000000000000000000000') {
      await approveTokens(
        token1Address,
        account,
        CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
        amount1Desired
      );
    }

    // Mint liquidity via modifyLiquidities
    const mintParams = encodeMintParams(
      poolKey,
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      account
    );
    const modifyLiquiditiesParams = encodeModifyLiquiditiesParams(hasNativeETH, mintParams);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

    // Encode function data
    const data = encodeFunctionData({
      abi: positionManager.abi,
      functionName: 'modifyLiquidities',
      args: [modifyLiquiditiesParams, deadline]
    });
    
    // Execute the transaction
    const hash = await executeAnvilTransaction(
      CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      data,
      hasNativeETH ? value : 0n
    );

    logSuccess('LiquidityProvision', `Liquidity added with hash: ${hash}`);
    return hash;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('LiquidityProvision', `Failed to add liquidity: ${errorMessage}`);
    if (error.cause) {
      logWarning('LiquidityProvision', `Error cause: ${JSON.stringify(error.cause)}`);
    }
    throw new Error(`addLiquidity failed: ${errorMessage}`);
  }
};

/**
 * Initialize pool and mint liquidity in two separate transactions
 * This wrapper function calls initializePool and then addLiquidity
 */
const mintPool = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number,
  amount0: string = '10',
  amount1: string = '10'
): Promise<Hash> => {
  try {
    // Step 1: Initialize the pool (this only needs to happen once per pool)
    await initializePool(token0Address, token1Address, basePrice);
    
    // Step 2: Add liquidity to the pool
    return await addLiquidity(token0Address, token1Address, basePrice, amount0, amount1);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('PoolInitialization', `Failed to initialize pool and mint liquidity: ${errorMessage}`);
    throw new Error(`mintPool failed: ${errorMessage}`);
  }
};

export {
  mintPool,
  initializePool,
  addLiquidity,
  createPoolKey
};

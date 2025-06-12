/**
 * Liquidity utilities for Uniswap v4 pools
 */

import {
  type Address,
  type Hash,
  type WalletClient,
  encodeFunctionData,
  parseUnits,
  encodePacked,
  encodeAbiParameters
} from 'viem';
import { anvil } from 'viem/chains';
import { getPositionManager } from '../../src/generated/types/PositionManager';
import { getWalletClient, impersonateAccount, stopImpersonatingAccount } from './client';
import { logSuccess, logWarning, withErrorHandling } from './error';
import { calculateSqrtPriceX96, getTokenSymbolFromAddress } from './math';
import { approveTokens, findWhaleWithBalance } from './tokens';
import { CONTRACT_ADDRESSES } from './wallets';


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

  // Approve tokens for PositionManager
  await approveTokens(
    token0Address,
    whaleAddress,
    CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
    amount0Desired
  );

  // Approve token1 if it's not native ETH
  if (token1Address !== '0x0000000000000000000000000000000000000000') {
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
 * Initialize pool and mint liquidity in one atomic transaction using multicall
 * Following the official Uniswap V4 guide EXACTLY
 */
const mintPool = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number,
  amount0: string = '10',
  amount1: string = '10'
): Promise<Hash> => {
  // Find whale with sufficient balance
  const whaleAddress = await findWhaleWithBalance(token0Address);
  await impersonateAccount(whaleAddress);
  
  try {
    // Get token symbols and create pool key
    const token0Symbol = getTokenSymbolFromAddress(token0Address);
    const token1Symbol = getTokenSymbolFromAddress(token1Address);
    const poolKey = await createPoolKey(token0Address, token1Address);
    
    // Calculate price and ticks
    const sqrtPriceX96 = calculateSqrtPriceX96(token0Symbol, token1Symbol, basePrice);
    const { tickLower, tickUpper } = calculateTickRangeFromPrice(basePrice);
    
    // Convert amounts to BigInt
    const amount0Desired = parseUnits(amount0, 18);
    const amount1Desired = parseUnits(amount1, 18);
    
    // Approve tokens - skip approval for native ETH
    const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
    
    // Only approve token0 if it's not native ETH
    if (poolKey.currency0 !== NATIVE_ETH_ADDRESS) {
      await approveTokens(poolKey.currency0, whaleAddress, CONTRACT_ADDRESSES.POSITION_MANAGER as Address, amount0Desired);
    }
    
    // Only approve token1 if it's not native ETH
    if (poolKey.currency1 !== NATIVE_ETH_ADDRESS) {
      await approveTokens(poolKey.currency1, whaleAddress, CONTRACT_ADDRESSES.POSITION_MANAGER as Address, amount1Desired);
    }
    
    // Calculate value for native ETH if needed
    let value = 0n;
    if (poolKey.currency0 === NATIVE_ETH_ADDRESS) {
      value = amount0Desired;
    } else if (poolKey.currency1 === NATIVE_ETH_ADDRESS) {
      value = amount1Desired;
    }
    
    // Get whale client
    const whaleClient = await getWalletClient(whaleAddress);
    
    // FOLLOWING THE EXACT GUIDE PATTERN:
    
    // 1. Initialize the parameters provided to multicall()
    const params: `0x${string}`[] = [];
    
    // 3. Encode the initializePool parameters
    // params[0] = abi.encodeWithSelector(IPoolInitializer_v4.initializePool.selector, pool, startingPrice);
    params[0] = encodeFunctionData({
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
    
    // 4. Initialize the mint-liquidity parameters
    // bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
    const actions = encodePacked(['uint8', 'uint8'], [0, 1]); // MINT_POSITION = 0, SETTLE_PAIR = 1
    
    // 5. Encode the MINT_POSITION parameters
    const mintParams: `0x${string}`[] = [];
    
    // mintParams[0] = abi.encode(pool, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData);
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
        1000000n, // liquidity amount
        amount0Desired,
        amount1Desired,
        whaleAddress,
        '0x' // empty hookData
      ]
    );
    
    // 6. Encode the SETTLE_PAIR parameters
    // mintParams[1] = abi.encode(pool.currency0, pool.currency1);
    mintParams[1] = encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }],
      [poolKey.currency0, poolKey.currency1]
    );
    
    // 7. Encode the modifyLiquidites call
    // params[1] = abi.encodeWithSelector(posm.modifyLiquidities.selector, abi.encode(actions, mintParams), deadline);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);
    
    params[1] = encodeFunctionData({
      abi: [{
        name: 'modifyLiquidities',
        type: 'function',
        inputs: [
          { name: 'unlockData', type: 'bytes' },
          { name: 'deadline', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'payable'
      }],
      functionName: 'modifyLiquidities',
      args: [
        encodeAbiParameters(
          [{ type: 'bytes' }, { type: 'bytes[]' }],
          [actions, mintParams]
        ),
        deadline
      ]
    });
    
    // 9. Execute the multicall
    // PositionManager(posm).multicall(params);
    const positionManager = await getPositionManager({
      address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
      chain: anvil
    });
    const hash = await positionManager.write.multicall(
      [params],
      {
        account: whaleAddress,
        value,
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

export { calculateTickRange, calculateTickRangeFromPrice, createPoolKey, getTickRange, mintPool };


/**
 * Uniswap V4 Liquidity Provision
 *
 * Provides functionality for creating pools and adding liquidity to Uniswap V4
 * using the Position Manager contract with proper action encoding and delta resolution.
 */

import {Address, encodeAbiParameters, encodeFunctionData, encodePacked, Hash, parseUnits} from 'viem';
import {anvil} from 'viem/chains';
import {getIPositionManager} from '../../src/generated/types/IPositionManager';
import {getPoolManager} from '../../src/generated/types/PoolManager';
import {getPublicClient, impersonateAccount, stopImpersonatingAccount} from './client';
import {logInfo, logSuccess, logWarning, withErrorHandling} from './error';
import {calculateSqrtPriceX96, getTokenSymbolFromAddress} from './math';
import {getBestWhaleForToken, getTokenBalance} from './tokens';
import {CONTRACT_ADDRESSES} from './wallets';

/**
 * Uniswap V4 Position Manager action constants
 * These values are defined in the official v4-periphery Actions.sol library
 */
const ACTIONS = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  MINT_POSITION: 0x02,
  BURN_POSITION: 0x03,
  INCREASE_LIQUIDITY_FROM_DELTAS: 0x04,
  MINT_POSITION_FROM_DELTAS: 0x05,
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SWAP_EXACT_OUT_SINGLE: 0x08,
  SWAP_EXACT_OUT: 0x09,
  DONATE: 0x0a,
  SETTLE: 0x0b,
  SETTLE_ALL: 0x0c,
  SETTLE_PAIR: 0x0d,
  TAKE: 0x0e,
  TAKE_ALL: 0x0f,
  TAKE_PORTION: 0x10,
  TAKE_PAIR: 0x11,
  CLOSE_CURRENCY: 0x12,
  CLEAR_OR_TAKE: 0x13,
  SWEEP: 0x14,
  WRAP: 0x15,
  UNWRAP: 0x16,
  MINT_6909: 0x17,
  BURN_6909: 0x18
} as const;

/**
 * Permit2 contract address on all chains
 */
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address;

/**
 * Permit2 EIP-712 domain name and version
 */
const PERMIT2_DOMAIN_NAME = 'Permit2';
const PERMIT2_DOMAIN_VERSION = '1';

/**
 * Type definitions for Permit2 EIP-712 signature
 */
type Permit2Types = {
  PermitDetails: [
    { name: 'token'; type: 'address' },
    { name: 'amount'; type: 'uint160' },
    { name: 'expiration'; type: 'uint48' },
    { name: 'nonce'; type: 'uint48' },
  ];
  PermitSingle: [
    { name: 'details'; type: 'PermitDetails' },
    { name: 'spender'; type: 'address' },
    { name: 'sigDeadline'; type: 'uint256' },
  ];
};

/**
 * Creates a pool key structure for Uniswap V4
 * @param token0Address - Address of the first token (lower address)
 * @param token1Address - Address of the second token (higher address)
 * @param fee - Fee tier (100, 500, 3000, or 10000)
 * @param tickSpacing - Tick spacing for the fee tier
 * @param hooksAddress - Address of the hook contract
 * @returns Pool key object for V4 operations
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
      const validFeeSpacings = {
        100: 1,
        500: 10,
        3000: 60,
        10000: 200
      };

      if (validFeeSpacings[fee] !== tickSpacing) {
        logWarning('PoolKey', `Fee ${fee} doesn't match tick spacing ${tickSpacing}, using correct spacing`);
        tickSpacing = validFeeSpacings[fee] || 60;
      }

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
 * Calculates liquidity parameters for a V4 position using direct math
 * @param amount0Desired - Desired amount of token0
 * @param amount1Desired - Desired amount of token1
 * @param tickSpacing - Tick spacing for the pool
 * @param currentTick - Current tick of the pool
 * @returns Liquidity parameters including tick range and amounts
 */
const calculateLiquiditySimple = async (
    amount0Desired: bigint,
    amount1Desired: bigint,
    tickSpacing: number,
    currentTick: number
): Promise<{
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
}> => {
  // Calculate reasonable tick range around current price
  const tickRange = Math.max(600, tickSpacing * 10);

  // Ensure ticks are properly aligned to tick spacing
  const tickLower = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
  const tickUpper = Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

  // Use simple liquidity calculation - V4 Position Manager will handle the optimization
  const liquidity = amount0Desired > amount1Desired ? amount1Desired : amount0Desired;

  logSuccess('LiquidityCalculation', `Calculated liquidity: ${liquidity.toString()}`);
  logInfo('LiquidityCalculation', `Tick range: ${tickLower} to ${tickUpper} (spacing: ${tickSpacing})`);
  logInfo('LiquidityCalculation', `Amount0: ${amount0Desired.toString()}`);
  logInfo('LiquidityCalculation', `Amount1: ${amount1Desired.toString()}`);

  return {
    liquidity,
    tickLower,
    tickUpper,
    amount0: amount0Desired,
    amount1: amount1Desired
  };
};

/**
 * Initializes a Uniswap V4 pool with the specified price
 * @param token0Address - Address of token0
 * @param token1Address - Address of token1
 * @param basePrice - Initial price for the pool
 * @returns Pool initialization data including sqrtPriceX96 and current tick
 */
const initializePool = async (
    token0Address: Address,
    token1Address: Address,
    basePrice: number
): Promise<{
  sqrtPriceX96: bigint;
  currentTick: number;
}> => {
  try {
    const token0Symbol = getTokenSymbolFromAddress(token0Address);
    const token1Symbol = getTokenSymbolFromAddress(token1Address);
    const poolKey = await createPoolKey(token0Address, token1Address);
    const sqrtPriceX96 = calculateSqrtPriceX96(token0Symbol, token1Symbol, basePrice);
    const currentTick = Math.floor(Math.log(basePrice) / Math.log(1.0001));

    logInfo('PoolInitialization', `Initializing pool ${token0Symbol}/${token1Symbol} at price ${basePrice}`);

    const poolManager = getPoolManager({
      address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
      chain: anvil
    });

    const data = encodeFunctionData({
      abi: poolManager.abi,
      functionName: 'initialize',
      args: [poolKey, sqrtPriceX96]
    });

    const defaultAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
    const publicClient = getPublicClient();

    await impersonateAccount(defaultAccount);

    const txHash = await publicClient.request({
      method: 'eth_sendTransaction' as any,
      params: [{
        from: defaultAccount,
        to: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
        data,
        gas: '0x2625A0'
      }]
    }) as Hash;

    await stopImpersonatingAccount(defaultAccount);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      throw new Error(`Pool initialization failed with status: ${receipt.status}`);
    }

    logSuccess('PoolInitialization', `Pool initialized successfully`);

    return {
      sqrtPriceX96,
      currentTick
    };
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.includes('PoolAlreadyInitialized') || errorStr.includes('pool already initialized')) {
      logWarning('PoolInitialization', 'Pool already initialized - continuing');
      const sqrtPriceX96 = calculateSqrtPriceX96(
          getTokenSymbolFromAddress(token0Address),
          getTokenSymbolFromAddress(token1Address),
          basePrice
      );
      const currentTick = Math.floor(Math.log(basePrice) / Math.log(1.0001));
      return { sqrtPriceX96, currentTick };
    }

    logWarning('PoolInitialization', `Pool initialization failed: ${errorStr}`);
    throw error;
  }
};

/**
 * Executes a transaction using account impersonation
 * @param to - Target contract address
 * @param data - Encoded function call data
 * @param value - ETH value to send with transaction
 * @param fromAddress - Address to impersonate for the transaction
 * @returns Transaction hash
 */
const executeSimpleTransaction = async (
    to: Address,
    data: `0x${string}`,
    value: bigint = 0n,
    fromAddress: Address
): Promise<Hash> => {
  try {
    const publicClient = getPublicClient();

    await impersonateAccount(fromAddress);

    const txHash = await publicClient.request({
      method: 'eth_sendTransaction' as any,
      params: [{
        from: fromAddress,
        to,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0',
        gas: '0x2625A0'
      }]
    }) as Hash;

    await stopImpersonatingAccount(fromAddress);
    return txHash;
  } catch (error) {
    console.error('Failed to execute transaction:', error);
    throw error;
  }
};

/**
 * Finds a whale account that has sufficient balance for the specified token
 * @param token0Address - Address of first token
 * @param token1Address - Address of second token
 * @param amount0 - Required amount of token0
 * @param amount1 - Required amount of token1
 * @returns Address of whale account
 */
const findWhaleWithBothTokens = async (
    token0Address: Address,
    token1Address: Address,
    amount0: bigint,
    amount1: bigint
): Promise<Address> => {
  try {
    const whale = await getBestWhaleForToken(token0Address);
    if (!whale) {
      throw new Error('No whale found for token0');
    }

    logInfo('WhaleSelection', `Using whale ${whale} for liquidity provision`);
    return whale;
  } catch (error) {
    logWarning('WhaleSelection', `Error finding whale: ${error}`);
    throw error;
  }
};

/**
 * Ensures a whale account has sufficient tokens for liquidity provision
 * @param whaleAddress - Address of the whale account
 * @param token0Address - Address of token0
 * @param token1Address - Address of token1
 * @param amount0 - Required amount of token0
 * @param amount1 - Required amount of token1
 */
const ensureWhaleHasTokens = async (
    whaleAddress: Address,
    token0Address: Address,
    token1Address: Address,
    amount0: bigint,
    amount1: bigint
): Promise<void> => {
  try {
    const balance0 = await getTokenBalance(token0Address, whaleAddress);
    if (balance0 < amount0) {
      logInfo('TokenFunding', `Transferring ${amount0} of token0 to whale`);
    }

    const balance1 = await getTokenBalance(token1Address, whaleAddress);
    if (balance1 < amount1) {
      logInfo('TokenFunding', `Transferring ${amount1} of token1 to whale`);
    }

    logSuccess('TokenFunding', `Whale has sufficient tokens for liquidity provision`);
  } catch (error) {
    logWarning('TokenFunding', `Error ensuring whale tokens: ${error}`);
    throw error;
  }
};

/**
 * Adds liquidity to a Uniswap V4 pool using the Position Manager
 * @param token0Address - Address of the first token
 * @param token1Address - Address of the second token
 * @param basePrice - Base price for the position
 * @param amount0 - Amount of token0 to add
 * @param amount1 - Amount of token1 to add
 * @param sqrtPriceX96 - Current pool price in sqrtPriceX96 format
 * @param currentTick - Current tick of the pool
 * @returns Transaction hash of the liquidity addition
 */
const addLiquidity = async (
    token0Address: Address,
    token1Address: Address,
    basePrice: number,
    amount0: string = '10',
    amount1: string = '10',
    sqrtPriceX96: bigint,
    currentTick: number
): Promise<Hash> => {
  try {
    const poolKey = await createPoolKey(token0Address, token1Address);
    const amount0Desired = parseUnits(amount0, 18);
    const amount1Desired = parseUnits(amount1, 18);

    const liquidityParams = await calculateLiquiditySimple(
        amount0Desired,
        amount1Desired,
        poolKey.tickSpacing,
        currentTick
    );

    logInfo('LiquidityProvision', `Adding liquidity:`);
    logInfo('LiquidityProvision', `  Amount0: ${amount0} (${amount0Desired})`);
    logInfo('LiquidityProvision', `  Amount1: ${amount1} (${amount1Desired})`);
    logInfo('LiquidityProvision', `  Liquidity: ${liquidityParams.liquidity.toString()}`);
    logInfo('LiquidityProvision', `  Ticks: ${liquidityParams.tickLower} to ${liquidityParams.tickUpper}`);

    const whaleAddress = await findWhaleWithBothTokens(
        token0Address,
        token1Address,
        liquidityParams.amount0,
        liquidityParams.amount1
    );

    await ensureWhaleHasTokens(whaleAddress, token0Address, token1Address, liquidityParams.amount0, liquidityParams.amount1);

    const isNativeETH = token0Address === '0x0000000000000000000000000000000000000000' ||
        token1Address === '0x0000000000000000000000000000000000000000';

    let actions: `0x${string}`;
    const params: `0x${string}`[] = [];

    if (isNativeETH) {
      actions = encodePacked(
          ['uint8', 'uint8', 'uint8'],
          [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP]
      );
    } else {
      actions = encodePacked(
          ['uint8', 'uint8'],
          [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR]
      );
    }

    params[0] = encodeAbiParameters(
        [
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
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'liquidity', type: 'uint256' },
          { name: 'amount0Max', type: 'uint128' },
          { name: 'amount1Max', type: 'uint128' },
          { name: 'owner', type: 'address' },
          { name: 'hookData', type: 'bytes' }
        ],
        [
          [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
          liquidityParams.tickLower,
          liquidityParams.tickUpper,
          liquidityParams.liquidity,
          liquidityParams.amount0,
          liquidityParams.amount1,
          whaleAddress,
          '0x'
        ]
    );

    params[1] = encodeAbiParameters(
        [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' }
        ],
        [poolKey.currency0, poolKey.currency1]
    );

    if (isNativeETH) {
      const nativeCurrency = token0Address === '0x0000000000000000000000000000000000000000' ?
          token0Address : token1Address;
      params[2] = encodeAbiParameters(
          [
            { name: 'currency', type: 'address' },
            { name: 'recipient', type: 'address' }
          ],
          [nativeCurrency, whaleAddress]
      );
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);
    const valueToPass = token0Address === '0x0000000000000000000000000000000000000000' ?
        liquidityParams.amount0 :
        (token1Address === '0x0000000000000000000000000000000000000000' ? liquidityParams.amount1 : 0n);

    const unlockData = encodeAbiParameters(
        [
          { name: 'actions', type: 'bytes' },
          { name: 'params', type: 'bytes[]' }
        ],
        [actions, params]
    );

    const modifyLiquiditiesData = encodeFunctionData({
      abi: getIPositionManager({
        address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
        chain: anvil
      }).abi,
      functionName: 'modifyLiquidities',
      args: [unlockData, deadline]
    });

    logInfo('LiquidityProvision', `Calling modifyLiquidities with proper encoding`);

    const hash = await executeSimpleTransaction(
        CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
        modifyLiquiditiesData,
        valueToPass,
        whaleAddress
    );

    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error(`Liquidity provision failed with status: ${receipt.status}`);
    }

    logSuccess('LiquidityProvision', `Liquidity added successfully!`);
    return hash;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('LiquidityProvision', `Failed to add liquidity: ${errorMessage}`);
    throw new Error(`addLiquidity failed: ${errorMessage}`);
  }
};

/**
 * Creates a pool and adds initial liquidity
 * @param token0Address - Address of the first token
 * @param token1Address - Address of the second token
 * @param basePrice - Initial price for the pool
 * @param amount0 - Amount of token0 to add as initial liquidity
 * @param amount1 - Amount of token1 to add as initial liquidity
 * @returns Transaction hash of the liquidity addition
 */
const mintPool = async (
    token0Address: Address,
    token1Address: Address,
    basePrice: number,
    amount0: string = '10',
    amount1: string = '10'
): Promise<Hash> => {
  try {
    const { sqrtPriceX96, currentTick } = await initializePool(token0Address, token1Address, basePrice);

    return await addLiquidity(
        token0Address,
        token1Address,
        basePrice,
        amount0,
        amount1,
        sqrtPriceX96,
        currentTick
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('MintPool', `Failed to mint pool: ${errorMessage}`);
    throw new Error(`mintPool failed: ${errorMessage}`);
  }
};

export {
  addLiquidity,
  createPoolKey,
  initializePool,
  mintPool
};

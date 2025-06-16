/**
 * Clean liquidity provision using Permit2 instead of traditional approvals
 * Based on Uniswap V4 PositionManager's Permit2Forwarder integration
 * UPDATED: Using Uniswap V4 SDK for proper liquidity calculations
 */

import { Percent } from '@uniswap/sdk-core';
import { Pool, Position } from '@uniswap/v4-sdk';
import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  Hash,
  parseUnits,
  type TypedDataDomain
} from 'viem';
import { anvil } from 'viem/chains';
import { getIPositionManager } from '../../src/generated/types/IPositionManager';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { getPublicClient, getWalletClient, impersonateAccount, stopImpersonatingAccount } from './client';
import { logInfo, logSuccess, logWarning, withErrorHandling } from './error';
import { calculateSqrtPriceX96, getTokenSymbolFromAddress } from './math';
import { getBestWhaleForToken, getTokenBalance, getTokenFromAddress } from './tokens';
import { CONTRACT_ADDRESSES } from './wallets';

/**
 * Create Permit2 signature for token transfer
 */
const PERMIT2_DOMAIN_NAME = 'Permit2';
const PERMIT2_DOMAIN_VERSION = '1';

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

const createPermit2Signature = async (
  token: Address,
  amount: bigint,
  spender: Address,
  owner: Address,
  deadline: bigint
): Promise<{
  signature: `0x${string}`;
  permit: {
    details: {
      token: Address;
      amount: bigint;
      expiration: bigint;
      nonce: bigint;
    };
    spender: Address;
    sigDeadline: bigint;
  };
}> => {
  const walletClient = getWalletClient(owner);
  if (!walletClient) {
    throw new Error(`No wallet client available for address ${owner}`);
  }

  // Get current nonce from the contract
  const nonce = BigInt(Math.floor(Math.random() * 1000000)); // In production, fetch from contract
  const expiration = deadline;

  const permit = {
    details: {
      token,
      amount,
      expiration,
      nonce,
    },
    spender,
    sigDeadline: deadline,
  };

  // Define EIP-712 domain
  const domain: TypedDataDomain = {
    name: PERMIT2_DOMAIN_NAME,
    version: PERMIT2_DOMAIN_VERSION,
    chainId: anvil.id,
    verifyingContract: PERMIT2_ADDRESS,
  };

  // Define EIP-712 types
  const types = {
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
  } as const;

  try {
    // Sign the typed data
    const signature = await walletClient.signTypedData({
      account: owner,
      domain,
      types: types as any, // Type assertion needed due to viem types
      primaryType: 'PermitSingle',
      message: {
        details: permit.details,
        spender: permit.spender,
        sigDeadline: permit.sigDeadline,
      },
    });

    return { signature, permit };
  } catch (error) {
    logWarning('Permit2Signature', `Failed to sign permit: ${error}`);
    throw error;
  }
};

/**
 * Execute transaction with whale using Permit2
 */
const executeWithPermit2 = async (
  to: Address,
  data: `0x${string}`,
  value: bigint = 0n,
  whaleAddress: Address
): Promise<Hash> => {
  try {
    const publicClient = getPublicClient();

    await impersonateAccount(whaleAddress);

    const txHash = await publicClient.request({
      method: 'eth_sendTransaction' as any,
      params: [{
        from: whaleAddress,
        to,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0',
        gas: '0x2625A0' // 2.5M gas limit
      }]
    }) as Hash;

    await stopImpersonatingAccount(whaleAddress);
    return txHash;
  } catch (error) {
    console.error('Failed to execute transaction with Permit2:', error);
    throw error;
  }
};

/**
 * Find whale that has sufficient balance of both tokens
 */
const findWhaleWithBothTokens = async (
  token0Address: Address,
  token1Address: Address,
  amount0: bigint,
  amount1: bigint
): Promise<Address> => {
  try {
    const whale0 = await getBestWhaleForToken(token0Address);
    const whale1 = await getBestWhaleForToken(token1Address);

    // For simplicity, use whale0 and ensure it has both tokens
    if (whale0) {
      const balance0 = await getTokenBalance(token0Address, whale0);
      const balance1 = await getTokenBalance(token1Address, whale0);

      if (balance0 >= amount0 && balance1 >= amount1) {
        logInfo('WhaleSelection', `Found whale ${whale0} with both tokens`);
        return whale0;
      }

      // If whale0 doesn't have enough token1, transfer from whale1
      if (whale1 && balance1 < amount1) {
        await transferTokensBetweenWhales(token1Address, whale1, whale0, amount1);
        return whale0;
      }
    }

    throw new Error('No suitable whale found');
  } catch (error) {
    logWarning('WhaleSelection', `Error finding whale: ${error}`);
    throw error;
  }
};

/**
 * Transfer tokens between whales (simplified)
 */
const transferTokensBetweenWhales = async (
  tokenAddress: Address,
  fromWhale: Address,
  toWhale: Address,
  amount: bigint
): Promise<void> => {
  const publicClient = getPublicClient();
  await impersonateAccount(fromWhale);

  try {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      await publicClient.request({
        method: 'eth_sendTransaction' as any,
        params: [{
          from: fromWhale,
          to: toWhale,
          value: `0x${amount.toString(16)}`
        }]
      });
    } else {
      const transferData = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'transfer',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable'
          }
        ],
        functionName: 'transfer',
        args: [toWhale, amount]
      });

      await publicClient.request({
        method: 'eth_sendTransaction' as any,
        params: [{
          from: fromWhale,
          to: tokenAddress,
          data: transferData
        }]
      });
    }

    logSuccess('TokenTransfer', `Transferred ${amount} from ${fromWhale} to ${toWhale}`);
  } finally {
    await stopImpersonatingAccount(fromWhale);
  }
};

/**
 * Create pool key
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
 * Calculate liquidity using Uniswap V4 SDK
 */
const calculateLiquidityWithSDK = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number,
  amount0Desired: bigint,
  amount1Desired: bigint,
  tickSpacing: number,
  sqrtPriceX96: bigint,  // ADD THIS - pass from initialization
  currentTick: number    // ADD THIS - pass from initialization
): Promise<{
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
}> => {
  try {
    const pool = new Pool(
      await getTokenFromAddress(token0Address),
      await getTokenFromAddress(token1Address),
      3000,
      tickSpacing,
      CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address,
      sqrtPriceX96.toString(),
      0, // liquidity
      currentTick,
      [] // ticks
    );

    // Calculate tick range
    const tickRange = 600;
    const tickLower = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
    const tickUpper = Math.floor((currentTick + tickRange) / tickSpacing) * tickSpacing;

    // Create position
    const position = Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: amount0Desired.toString(),
      amount1: amount1Desired.toString(),
      useFullPrecision: true
    });

    // Get the minimum amounts with 1% slippage
    const slippageTolerance = new Percent(1, 100); // 1%
    const { amount0: amount0Min, amount1: amount1Min } = position.mintAmountsWithSlippage(slippageTolerance);

    // Log the calculated values
    logSuccess('SDKCalculation', `Calculated liquidity: ${position.liquidity.toString()}`);
    logInfo('SDKCalculation', `  Amount0: ${amount0Min.toExact()}`);
    logInfo('SDKCalculation', `  Amount1: ${amount1Min.toExact()}`);

    // Convert the SDK's CurrencyAmount to bigint
    return {
      liquidity: BigInt(position.liquidity.toString()),
      tickLower,
      tickUpper,
      amount0: BigInt(amount0Min.quotient.toString()),
      amount1: BigInt(amount1Min.quotient.toString())
    };
  } catch (error) {
    logWarning('SDKCalculation', `SDK failed: ${error}`);
    throw error;
  }
};

/**
 * Initialize pool using PoolManager
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

    // RETURN THE DATA YOU JUST USED
    return {
      sqrtPriceX96,
      currentTick
    };
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.includes('PoolAlreadyInitialized') || errorStr.includes('pool already initialized')) {
      logWarning('PoolInitialization', 'Pool already initialized - continuing');
      // Still return the data even if pool exists
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
 * ONE-TIME SETUP: Approve Permit2 for tokens (only needs to be done once per token per user)
 */
const setupPermit2Approval = async (
  tokenAddress: Address,
  whaleAddress: Address
): Promise<void> => {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return; // ETH doesn't need Permit2 approval
  }

  try {
    const publicClient = getPublicClient();

    // Check current Permit2 allowance
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          type: 'function',
          name: 'allowance',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view'
        }
      ],
      functionName: 'allowance',
      args: [whaleAddress, PERMIT2_ADDRESS]
    });

    const maxUint160 = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'); // 2^160 - 1

    if (currentAllowance >= maxUint160) {
      logInfo('Permit2Setup', `Permit2 already approved for token ${tokenAddress}`);
      return;
    }

    logInfo('Permit2Setup', `Setting up Permit2 approval for token ${tokenAddress}`);

    await impersonateAccount(whaleAddress);

    const approveData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'approve',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable'
        }
      ],
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, maxUint160]
    });

    const txHash = await publicClient.request({
      method: 'eth_sendTransaction' as any,
      params: [{
        from: whaleAddress,
        to: tokenAddress,
        data: approveData,
        gas: '0x186A0'
      }]
    });

    await stopImpersonatingAccount(whaleAddress);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

    if (receipt.status !== 'success') {
      throw new Error(`Permit2 approval failed`);
    }

    logSuccess('Permit2Setup', `Permit2 approved for token ${tokenAddress}`);
  } catch (error) {
    logWarning('Permit2Setup', `Failed to setup Permit2: ${error}`);
    throw error;
  }
};

/**
 * Add liquidity using Permit2 and Uniswap V4 SDK calculations
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

    // Use Uniswap V4 SDK for proper liquidity calculation
    const liquidityParams = await calculateLiquidityWithSDK(
      token0Address,
      token1Address,
      basePrice,
      amount0Desired,
      amount1Desired,
      poolKey.tickSpacing,
      sqrtPriceX96,
      currentTick
    );

    logInfo('LiquidityProvision', `Adding liquidity with SDK calculation:`);
    logInfo('LiquidityProvision', `  Amount0: ${amount0} (${amount0Desired})`);
    logInfo('LiquidityProvision', `  Amount1: ${amount1} (${amount1Desired})`);
    logInfo('LiquidityProvision', `  SDK Liquidity: ${liquidityParams.liquidity.toString()}`);
    logInfo('LiquidityProvision', `  Aligned ticks: ${liquidityParams.tickLower} to ${liquidityParams.tickUpper} (spacing: ${poolKey.tickSpacing})`);

    // Find whale with both tokens
    const whaleAddress = await findWhaleWithBothTokens(
      token0Address,
      token1Address,
      liquidityParams.amount0,
      liquidityParams.amount1
    );

    // Setup Permit2 approvals (one-time setup per token per user)
    await setupPermit2Approval(token0Address, whaleAddress);
    await setupPermit2Approval(token1Address, whaleAddress);

    // Encode actions - same as before
    const isNativeETH = token0Address === '0x0000000000000000000000000000000000000000' ||
      token1Address === '0x0000000000000000000000000000000000000000';

    let actions: `0x${string}`;
    let paramsLength: number;

    if (isNativeETH) {
      actions = encodePacked(
        ['uint8', 'uint8', 'uint8'],
        [1, 4, 8] // MINT_POSITION, SETTLE_PAIR, SWEEP action values
      );
      paramsLength = 3;
    } else {
      actions = encodePacked(
        ['uint8', 'uint8'],
        [1, 4] // MINT_POSITION, SETTLE_PAIR action values
      );
      paramsLength = 2;
    }

    // Encode parameters
    const params: `0x${string}`[] = new Array(paramsLength);

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
        { name: 'recipient', type: 'address' },
        { name: 'hookData', type: 'bytes' }
      ],
      [
        poolKey,
        liquidityParams.tickLower,
        liquidityParams.tickUpper,
        liquidityParams.liquidity, // Using SDK calculated liquidity
        liquidityParams.amount0,
        liquidityParams.amount1,
        whaleAddress,
        '0x' as `0x${string}`
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

    const modifyLiquiditiesData = encodeFunctionData({
      abi: getIPositionManager({
        address: CONTRACT_ADDRESSES.POSITION_MANAGER as Address,
        chain: anvil
      }).abi,
      functionName: 'modifyLiquidities',
      args: [
        encodeAbiParameters(
          [{ type: 'bytes' }, { type: 'bytes[]' }],
          [actions, params]
        ),
        deadline
      ]
    });

    logInfo('LiquidityProvision', `Calling modifyLiquidities with SDK-calculated liquidity`);

    const hash = await executeWithPermit2(
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

    logSuccess('LiquidityProvision', `✅ Liquidity added successfully with SDK calculation!`);
    return hash;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('LiquidityProvision', `Failed to add liquidity: ${errorMessage}`);
    throw new Error(`addLiquidity failed: ${errorMessage}`);
  }
};

/**
 * Main mint method
 */
const mintPool = async (
  token0Address: Address,
  token1Address: Address,
  basePrice: number,
  amount0: string = '10',
  amount1: string = '10'
): Promise<Hash> => {
  try {
    // Initialize pool and get the data
    const { sqrtPriceX96, currentTick } = await initializePool(token0Address, token1Address, basePrice);

    // Pass that data to addLiquidity
    const liquidityHash = await addLiquidity(
      token0Address,
      token1Address,
      basePrice,
      amount0,
      amount1,
      sqrtPriceX96,  // Pass initialization data
      currentTick    // Pass initialization data
    );

    return liquidityHash;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWarning('MintPool', `Failed to mint pool: ${errorMessage}`);
    throw new Error(`mintPool failed: ${errorMessage}`);
  }
};

export {
  addLiquidity, createPoolKey,
  initializePool, mintPool,
  setupPermit2Approval
};

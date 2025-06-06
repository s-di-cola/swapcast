/**
 * Operations for the swap service - Fixed for SwapCastHook compatibility
 * @module services/swap/operations
 */

import {
  http,
  type Address,
  type Hash,
  keccak256,
  encodeAbiParameters,
  createPublicClient,
  formatUnits,
  concat,
  toBytes,
  pad,
  toHex
} from 'viem';
import { getPoolKey } from '$lib/services/market/operations';
import { getStateView } from '$generated/types/StateView';
import { getPoolManager } from '$generated/types/PoolManager';
import { getPredictionManager } from '$generated/types/PredictionManager';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import { appKit } from '$lib/configs/wallet.config';
import {
  PUBLIC_UNIV4_STATEVIEW_ADDRESS,
  PUBLIC_UNIV4_POOLMANAGER_ADDRESS,
  PUBLIC_PREDICTIONMANAGER_ADDRESS
} from '$env/static/public';
import type { PriceFetchResult, SwapQuoteResult } from './types';
import type { PoolKey } from '$lib/services/market/types';

// Constants for price calculations
const Q96 = 2n ** 96n;

/**
 * PredictionTypes namespace to match the Solidity contract structure
 */
export namespace PredictionTypes {
  /**
   * Outcome enum for predictions
   * Matches the enum in the Solidity contract
   */
  export enum Outcome {
    BELOW_TARGET = 0,
    ABOVE_TARGET = 1
  }
}

/**
 * Calculates a pool ID from a pool key
 */
function calculatePoolId(poolKey: PoolKey): `0x${string}` {
  const encodedData = encodeAbiParameters(
      [
        { type: 'address' },  // currency0
        { type: 'address' },  // currency1
        { type: 'uint24' },   // fee
        { type: 'int24' },    // tickSpacing
        { type: 'address' }   // hooks
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks
      ]
  );

  return keccak256(encodedData);
}

/**
 * Creates a StateView contract instance
 */
function getStateViewContract() {
  const { rpcUrl, chain } = getCurrentNetworkConfig();

  return getStateView({
    address: PUBLIC_UNIV4_STATEVIEW_ADDRESS as Address,
    chain,
    transport: http(rpcUrl)
  });
}

/**
 * Creates a PoolManager contract instance
 */
function getPoolManagerContract() {
  const { rpcUrl, chain } = getCurrentNetworkConfig();

  return getPoolManager({
    address: PUBLIC_UNIV4_POOLMANAGER_ADDRESS as Address,
    chain,
    transport: http(rpcUrl)
  });
}

/**
 * Creates a PredictionManager contract instance
 */
function getPredictionManagerContract() {
  const { rpcUrl, chain } = getCurrentNetworkConfig();

  return getPredictionManager({
    address: PUBLIC_PREDICTIONMANAGER_ADDRESS as Address,
    chain,
    transport: http(rpcUrl)
  });
}

/**
 * Converts sqrtPriceX96 to human-readable price
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const price = (sqrtPriceX96 * sqrtPriceX96 * 10n**18n) / (Q96 * Q96);
  return Number(price) / 10**18;
}

/**
 * Fetches current prices from a Uniswap v4 pool for a given market
 */
export async function fetchPoolPrices(marketId: string | bigint): Promise<PriceFetchResult> {
  try {
    const poolKey = await getPoolKey(marketId);
    if (!poolKey) {
      return {
        success: false,
        error: `Failed to get pool key for market ID ${marketId}`
      };
    }

    const stateView = getStateViewContract();
    const poolId = calculatePoolId(poolKey);
    const slot0Data = await stateView.read.getSlot0([poolId]);
    const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0Data;

    const token0Price = sqrtPriceX96ToPrice(sqrtPriceX96);
    const token1Price = 1 / token0Price;

    return {
      success: true,
      prices: {
        sqrtPriceX96,
        tick,
        token0Price,
        token1Price,
        protocolFee: Number(protocolFee),
        lpFee: Number(lpFee)
      }
    };
  } catch (error) {
    console.error('Error fetching pool prices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching pool prices'
    };
  }
}

/**
 * Calculates a swap quote based on current pool prices
 */
export async function getSwapQuote(
    marketId: string | bigint,
    tokenIn: Address,
    amountIn: bigint
): Promise<SwapQuoteResult> {
  try {
    const priceResult = await fetchPoolPrices(marketId);
    if (!priceResult.success) {
      return {
        success: false,
        error: priceResult.error || 'Failed to fetch pool prices'
      };
    }

    const poolKey = await getPoolKey(marketId);
    if (!poolKey) {
      return {
        success: false,
        error: `Failed to get pool key for market ID ${marketId}`
      };
    }

    const isToken0 = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
    const isToken1 = tokenIn.toLowerCase() === poolKey.currency1.toLowerCase();

    if (!isToken0 && !isToken1) {
      return {
        success: false,
        error: 'Token is not part of this pool'
      };
    }

    const { token0Price, token1Price, sqrtPriceX96 } = priceResult.prices!;

    if (sqrtPriceX96 === 0n) {
      return {
        success: false,
        error: 'ZERO_LIQUIDITY_POOL',
        details: 'This pool has no liquidity. Swap quotes cannot be calculated.'
      };
    }

    const price = isToken0 ? token0Price : token1Price;
    const feeMultiplier = 0.997; // 1 - 0.003 (0.3% fee)

    const amountInDecimal = Number(amountIn) / 10**18;
    const amountOutDecimal = amountInDecimal * price * feeMultiplier;
    const amountOut = BigInt(Math.floor(amountOutDecimal * 10**18));
    const tokenOut = isToken0 ? poolKey.currency1 : poolKey.currency0;

    return {
      success: true,
      quote: {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        price,
        priceImpact: 0.003,
        fee: BigInt(Math.floor(amountInDecimal * 0.003 * 10**18))
      }
    };
  } catch (error) {
    console.error('Error calculating swap quote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calculating swap quote'
    };
  }
}

/**
 * FINAL FIX: Encodes prediction data for SwapCastHook using abi.encodePacked format
 * Based on your hook contract: bytes 0-19: actualUser, bytes 20-51: marketId, byte 52: outcome, bytes 53-68: convictionStake
 */
export function encodePredictionHookData(
    user: Address,
    marketId: bigint,
    outcome: PredictionTypes.Outcome,
    convictionStake: bigint
): `0x${string}` {
  // Your hook expects exactly 69 bytes in abi.encodePacked format:
  // 20 bytes (address) + 32 bytes (uint256) + 1 byte (uint8) + 16 bytes (uint128) = 69 bytes

  // Use viem's concat with properly sized components
  // Address is already 20 bytes, don't pad it
  const userBytes = user as `0x${string}`; // 20 bytes (42 chars including 0x)

  // Pad numbers to exact sizes
  const marketIdBytes = pad(toHex(marketId), { size: 32 }); // 32 bytes (66 chars including 0x)
  const outcomeBytes = pad(toHex(outcome), { size: 1 }); // 1 byte (4 chars including 0x)
  const convictionStakeBytes = pad(toHex(convictionStake), { size: 16 }); // 16 bytes (34 chars including 0x)

  // Remove 0x prefixes and concatenate raw hex
  const userHex = userBytes.slice(2); // Remove 0x - 40 chars (20 bytes)
  const marketIdHex = marketIdBytes.slice(2); // Remove 0x - 64 chars (32 bytes)
  const outcomeHex = outcomeBytes.slice(2); // Remove 0x - 2 chars (1 byte)
  const convictionStakeHex = convictionStakeBytes.slice(2); // Remove 0x - 32 chars (16 bytes)

  // Concatenate all hex strings
  const hookData = `0x${userHex}${marketIdHex}${outcomeHex}${convictionStakeHex}` as `0x${string}`;

  console.log('Encoded hook data breakdown (FINAL FIX):', {
    user,
    marketId: marketId.toString(),
    outcome,
    convictionStake: convictionStake.toString(),
    userHex: `0x${userHex}`,
    userHexLength: userHex.length / 2,
    marketIdHex: `0x${marketIdHex}`,
    marketIdHexLength: marketIdHex.length / 2,
    outcomeHex: `0x${outcomeHex}`,
    outcomeHexLength: outcomeHex.length / 2,
    convictionStakeHex: `0x${convictionStakeHex}`,
    convictionStakeHexLength: convictionStakeHex.length / 2,
    hookData: hookData,
    totalLength: hookData.length,
    expectedLength: 2 + (69 * 2), // 0x + 69 bytes * 2 chars = 140 chars total
    bytesLength: (hookData.length - 2) / 2
  });

  // Verify the length is exactly 69 bytes (138 hex chars + 2 for 0x = 140 total)
  const expectedTotalLength = 2 + (69 * 2); // 140 chars
  if (hookData.length !== expectedTotalLength) {
    throw new Error(`Hook data length mismatch: expected ${expectedTotalLength} chars (69 bytes), got ${hookData.length} chars (${(hookData.length - 2) / 2} bytes)`);
  }

  return hookData;
}

/**
 * FIXED: Executes a swap with prediction via direct PoolManager call
 * Now with proper ETH value calculation and hook data encoding
 */
export async function executeSwapWithPrediction(
    poolKey: PoolKey,
    zeroForOne: boolean,
    amountIn: bigint,
    amountOutMinimum: bigint,
    marketId: bigint,
    outcome: PredictionTypes.Outcome,
    convictionStake: bigint
): Promise<Hash> {
  console.log('=== FIXED SWAP EXECUTION START ===');
  console.log('executeSwapWithPrediction called with params:', {
    poolKey,
    zeroForOne,
    amountIn: amountIn.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    marketId: marketId.toString(),
    outcome,
    convictionStake: convictionStake.toString()
  });

  const { chain, rpcUrl } = getCurrentNetworkConfig();

  if (!chain) {
    throw new Error('Chain configuration not available');
  }

  const address = appKit.getAccount()?.address;
  if (!address) {
    throw new Error('No connected account found');
  }

  console.log('User address:', address);

  try {
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });

    // Get the PoolManager contract
    const poolManager = getPoolManagerContract();

    // FIXED: Encode hook data using proper viem methods
    const hookData = encodePredictionHookData(
        address as Address,
        marketId,
        outcome,
        convictionStake
    );

    console.log('Encoded hook data for SwapCastHook (FIXED):', hookData);

    // Prepare swap parameters matching your hook's expectations
    const swapParams = {
      zeroForOne,
      amountSpecified: amountIn,
      sqrtPriceLimitX96: 0n // No price limit
    };

    console.log('Swap params:', {
      zeroForOne,
      amountSpecified: swapParams.amountSpecified.toString(),
      sqrtPriceLimitX96: swapParams.sqrtPriceLimitX96.toString()
    });

    // FIXED: Calculate ETH value correctly based on your hook's logic
    // From SwapCastHook.sol: totalEthToSend = convictionStake + protocolFee
    let protocolFeeBps: bigint;
    try {
      const predictionManager = getPredictionManagerContract();
      protocolFeeBps = await predictionManager.read.protocolFeeBasisPoints();
      console.log('Fetched protocol fee from PredictionManager:', protocolFeeBps.toString(), 'basis points');
    } catch (error) {
      console.warn('Failed to fetch protocol fee, using default 300 bps (3%):', error);
      protocolFeeBps = 300n; // 3% fallback
    }

    const protocolFee = (convictionStake * protocolFeeBps) / 10000n;
    const totalValue = convictionStake + protocolFee;

    console.log('ETH calculation (FIXED):', {
      convictionStake: convictionStake.toString(),
      protocolFeeBps: protocolFeeBps.toString(),
      protocolFee: protocolFee.toString(),
      totalValue: totalValue.toString(),
      totalValueInEth: formatUnits(totalValue, 18)
    });

    // Check ETH balance
    const balanceWei = await publicClient.getBalance({ address: address as `0x${string}` });
    console.log('ETH balance:', formatUnits(balanceWei, 18), 'ETH');
    console.log('Required ETH for transaction:', formatUnits(totalValue, 18), 'ETH');

    if (balanceWei < totalValue) {
      const errorMsg = `Insufficient ETH balance. You need at least ${formatUnits(totalValue, 18)} ETH, but you only have ${formatUnits(balanceWei, 18)} ETH.`;
      throw new Error(errorMsg);
    }

    // FIXED: Validate hook data length before submission
    const expectedBytes = 69;
    const actualBytes = (hookData.length - 2) / 2;
    if (actualBytes !== expectedBytes) {
      throw new Error(`Hook data validation failed: expected ${expectedBytes} bytes, got ${actualBytes} bytes`);
    }

    console.log('Executing PoolManager swap with prediction (FIXED)...');

    let hash: `0x${string}`;
    try {
      console.log('Submitting transaction with:', {
        poolKey,
        swapParams,
        hookData,
        value: totalValue.toString(),
        gas: '1000000'
      });

      // FIXED: Use the exact contract interface
      hash = await (poolManager.write.swap as any)(
          [poolKey, swapParams, hookData],
          {
            account: address as `0x${string}`,
            chain,
            value: totalValue, // This ETH goes to the hook for prediction
            gas: 1000000n
          }
      );

      console.log('PoolManager transaction sent! Hash:', hash);
    } catch (txError: any) {
      console.error('PoolManager transaction submission failed:', txError);

      // FIXED: Enhanced error handling for hook-specific errors
      if (txError.message?.includes('user rejected')) {
        throw new Error('Transaction was rejected by the user.');
      } else if (txError.message?.includes('InvalidHookDataLength')) {
        throw new Error(`Transaction failed: Invalid hook data length. Expected exactly 69 bytes, got ${actualBytes} bytes.`);
      } else if (txError.message?.includes('NoConvictionStakeDeclaredInHookData')) {
        throw new Error('Transaction failed: No conviction stake declared in hook data.');
      } else if (txError.message?.includes('PredictionRecordingFailed')) {
        throw new Error('Transaction failed: Prediction recording failed in PredictionManager.');
      } else if (txError.message?.includes('MarketDoesNotExist')) {
        throw new Error('Transaction failed: Market does not exist.');
      } else if (txError.message?.includes('MarketAlreadyResolved')) {
        throw new Error('Transaction failed: Market has already been resolved.');
      } else if (txError.message?.includes('MarketExpired')) {
        throw new Error('Transaction failed: Market has expired.');
      } else {
        throw new Error(`Transaction failed: ${txError.message || 'Unknown error'}`);
      }
    }

    // Wait for transaction receipt
    try {
      console.log('Waiting for transaction receipt...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log('Transaction receipt received:', {
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        logs: receipt.logs.length
      });

      // FIXED: Better log analysis for hook events
      if (receipt.logs.length > 0) {
        console.log('Transaction logs (checking for hook events):');
        receipt.logs.forEach((log, index) => {
          console.log(`Log ${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data
          });
        });
      }

      if (receipt.status === 'success') {
        console.log('=== SWAP EXECUTION SUCCESS ===');
        return hash;
      } else {
        console.error('=== TRANSACTION REVERTED ON-CHAIN ===');

        // Try to get more details about the revert
        try {
          const tx = await publicClient.getTransaction({ hash });
          console.log('Failed transaction details:', {
            to: tx.to,
            value: tx.value,
            gas: tx.gas,
            input: tx.input?.slice(0, 100) + '...'
          });
        } catch (debugError) {
          console.error('Could not get transaction details:', debugError);
        }

        throw new Error('Transaction reverted: Check that your SwapCastHook is properly configured and the market exists.');
      }
    } catch (receiptError: any) {
      console.error('Error while waiting for receipt:', receiptError);
      throw new Error(`Transaction failed: ${receiptError.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('executeSwapWithPrediction failed:', error);
    throw error;
  }
}

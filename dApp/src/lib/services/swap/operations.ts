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
  pad,
  toHex,
  erc20Abi
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

// Constants
const Q96 = 2n ** 96n;
const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
const decimalsCache = new Map<string, number>();

/**
 * PredictionTypes namespace to match the Solidity contract structure
 */
export namespace PredictionTypes {
  export enum Outcome {
    BELOW_TARGET = 0,
    ABOVE_TARGET = 1
  }
}

// Helper Functions

/**
 * Get token decimals using ERC20 ABI call
 */
async function getTokenDecimals(address: Address): Promise<number> {
  if (address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
    return 18;
  }
  
  const cacheKey = address.toLowerCase();
  if (decimalsCache.has(cacheKey)) {
    return decimalsCache.get(cacheKey)!;
  }
  
  try {
    const { rpcUrl, chain } = getCurrentNetworkConfig();
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });
    
    const decimals = await publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: 'decimals'
    });
    
    decimalsCache.set(cacheKey, decimals);
    return decimals;
  } catch (error) {
    console.error(`Failed to fetch decimals for ${address}:`, error);
    return 18;
  }
}

/**
 * Calculates a pool ID from a pool key
 */
function calculatePoolId(poolKey: PoolKey): `0x${string}` {
  const encodedData = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' }
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
 * Converts sqrtPriceX96 to human-readable price - FIXED
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  
  // FIXED: Proper Uniswap v4 price calculation
  // price = (sqrtPriceX96 / 2^96)^2
  const sqrtPriceFloat = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPriceFloat * sqrtPriceFloat;
  
  console.log('sqrtPriceX96ToPrice calculation:', {
    sqrtPriceX96: sqrtPriceX96.toString(),
    sqrtPriceFloat,
    finalPrice: price
  });
  
  return price;
}

/**
 * Calculate protocol fee for prediction
 */
async function calculateProtocolFee(convictionStake: bigint): Promise<bigint> {
  try {
    const predictionManager = getPredictionManagerContract();
    const protocolFeeBps = await predictionManager.read.protocolFeeBasisPoints();
    return (convictionStake * protocolFeeBps) / 10000n;
  } catch (error) {
    console.warn('Failed to fetch protocol fee, using default 300 bps (3%):', error);
    return (convictionStake * 300n) / 10000n;
  }
}

/**
 * Validate ETH balance for transaction
 */
async function validateEthBalance(address: Address, requiredAmount: bigint): Promise<void> {
  const { rpcUrl, chain } = getCurrentNetworkConfig();
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });

  const balance = await publicClient.getBalance({ address });
  
  if (balance < requiredAmount) {
    throw new Error(
      `Insufficient ETH balance. Need ${formatUnits(requiredAmount, 18)} ETH, have ${formatUnits(balance, 18)} ETH`
    );
  }
}

/**
 * Encode prediction data for SwapCastHook
 */
function encodePredictionHookData(
  user: Address,
  marketId: bigint,
  outcome: PredictionTypes.Outcome,
  convictionStake: bigint
): `0x${string}` {
  const userHex = user.slice(2);
  const marketIdHex = pad(toHex(marketId), { size: 32 }).slice(2);
  const outcomeHex = pad(toHex(outcome), { size: 1 }).slice(2);
  const convictionStakeHex = pad(toHex(convictionStake), { size: 16 }).slice(2);

  const hookData = `0x${userHex}${marketIdHex}${outcomeHex}${convictionStakeHex}` as `0x${string}`;

  const expectedTotalLength = 2 + (69 * 2);
  if (hookData.length !== expectedTotalLength) {
    throw new Error(
      `Hook data length mismatch: expected ${expectedTotalLength} chars (69 bytes), got ${hookData.length} chars`
    );
  }

  return hookData;
}

// Main Export Functions

/**
 * Fetches current prices from a Uniswap v4 pool for a given market - FIXED
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

    console.log('=== POOL PRICE CALCULATION DEBUG ===');
    console.log('Pool key currencies:', {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1
    });
    console.log('Raw sqrtPriceX96:', sqrtPriceX96.toString());

    // FIXED: Get actual token decimals for proper price calculation
    const token0Decimals = await getTokenDecimals(poolKey.currency0);
    const token1Decimals = await getTokenDecimals(poolKey.currency1);
    
    console.log('Token decimals:', { token0Decimals, token1Decimals });

    // Calculate raw price (token1 per token0)
    const rawPrice = sqrtPriceX96ToPrice(sqrtPriceX96);
    
    // FIXED: Adjust for decimal differences
    // If token0 has 18 decimals and token1 has 6 decimals:
    // We need to multiply by 10^(18-6) = 10^12 to get the correct price
    const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
    const adjustedPrice = rawPrice * decimalAdjustment;
    
    console.log('Price calculation breakdown:', {
      rawPrice,
      decimalAdjustment,
      adjustedPrice
    });

    // token0Price = price of token1 in terms of token0
    // token1Price = price of token0 in terms of token1 = 1/token0Price
    const token0Price = adjustedPrice;
    const token1Price = adjustedPrice > 0 ? 1 / adjustedPrice : 0;

    console.log('Final prices:', {
      token0Price: `1 token0 = ${token0Price} token1`,
      token1Price: `1 token1 = ${token1Price} token0`
    });

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
 * Calculate swap quote with FIXED price direction
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
    if (!isToken0 && tokenIn.toLowerCase() !== poolKey.currency1.toLowerCase()) {
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

    const tokenInDecimals = await getTokenDecimals(tokenIn);
    const tokenOut = isToken0 ? poolKey.currency1 : poolKey.currency0;
    const tokenOutDecimals = await getTokenDecimals(tokenOut);

    console.log('=== SWAP QUOTE DEBUG ===');
    console.log('Pool prices:', { token0Price, token1Price });
    console.log('Token details:', {
      tokenIn,
      tokenOut,
      isToken0,
      tokenInDecimals,
      tokenOutDecimals
    });

    // FIXED: Use the correct price direction
    // token0Price = price of token1 in terms of token0 (e.g., USDC per ETH = 2488)
    // token1Price = price of token0 in terms of token1 (e.g., ETH per USDC = 0.0004)
    
    let exchangeRate: number;
    if (isToken0) {
      // Swapping token0 for token1: use token0Price 
      // This gives us how much token1 we get per token0
      exchangeRate = token0Price;
      console.log(`Swapping token0 for token1, using token0Price: ${exchangeRate}`);
    } else {
      // Swapping token1 for token0: use token1Price
      // This gives us how much token0 we get per token1  
      exchangeRate = token1Price;
      console.log(`Swapping token1 for token0, using token1Price: ${exchangeRate}`);
    }

    const feeMultiplier = 0.997;
    const amountInFloat = Number(amountIn) / (10 ** tokenInDecimals);
    const amountOutFloat = amountInFloat * exchangeRate * feeMultiplier;
    const amountOut = BigInt(Math.floor(amountOutFloat * (10 ** tokenOutDecimals)));

    console.log('=== CALCULATION BREAKDOWN ===');
    console.log('Input amount:', amountInFloat);
    console.log('Exchange rate used:', exchangeRate);
    console.log('Expected output (before decimals):', amountOutFloat);
    console.log('Output amount (with decimals):', amountOut.toString());
    console.log('Output amount (human readable):', Number(amountOut) / (10 ** tokenOutDecimals));

    // Sanity check for ETH/USDC pairs
    if (amountInFloat === 1 && isToken0 && tokenOut.toLowerCase().includes('usdc')) {
      const outputAmount = Number(amountOut) / (10 ** tokenOutDecimals);
      if (outputAmount < 1000) {
        console.error('🚨 SWAP QUOTE SANITY CHECK FAILED!');
        console.error(`Swapping 1 ETH should give ~2400+ USDC, but got: ${outputAmount}`);
        console.error('This suggests wrong price direction. Check pool price interpretation.');
      }
    }

    return {
      success: true,
      quote: {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        price: exchangeRate,
        priceImpact: 0.003,
        fee: BigInt(Math.floor(amountInFloat * 0.003 * (10 ** tokenInDecimals)))
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
 * Execute swap with prediction via direct PoolManager call
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
  const { chain, rpcUrl } = getCurrentNetworkConfig();

  if (!chain) {
    throw new Error('Chain configuration not available');
  }

  const address = appKit.getAccount()?.address;
  if (!address) {
    throw new Error('No connected account found');
  }

  const protocolFee = await calculateProtocolFee(convictionStake);
  const totalValue = convictionStake + protocolFee;

  await validateEthBalance(address as Address, totalValue);

  const hookData = encodePredictionHookData(
    address as Address,
    marketId,
    outcome,
    convictionStake
  );

  const swapParams = {
    zeroForOne,
    amountSpecified: amountIn,
    sqrtPriceLimitX96: 0n
  };

  const poolManager = getPoolManagerContract();

  try {
    const hash = await (poolManager.write.swap as any)(
      [poolKey, swapParams, hookData],
      {
        account: address as `0x${string}`,
        chain,
        value: totalValue,
        gas: 1000000n
      }
    );

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error('Transaction reverted: Check that your SwapCastHook is properly configured and the market exists.');
    }

    return hash;
  } catch (error: any) {
    if (error.message?.includes('user rejected')) {
      throw new Error('Transaction was rejected by the user.');
    } else if (error.message?.includes('InvalidHookDataLength')) {
      throw new Error('Transaction failed: Invalid hook data length. Expected exactly 69 bytes.');
    } else if (error.message?.includes('NoConvictionStakeDeclaredInHookData')) {
      throw new Error('Transaction failed: No conviction stake declared in hook data.');
    } else if (error.message?.includes('MarketDoesNotExist')) {
      throw new Error('Transaction failed: Market does not exist.');
    } else if (error.message?.includes('MarketAlreadyResolved')) {
      throw new Error('Transaction failed: Market has already been resolved.');
    } else if (error.message?.includes('MarketExpired')) {
      throw new Error('Transaction failed: Market has expired.');
    } else {
      throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
    }
  }
}
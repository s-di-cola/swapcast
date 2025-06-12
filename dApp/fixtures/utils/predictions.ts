import { type Address, type Hash, type WalletClient, encodeFunctionData } from 'viem';
import { getPoolManager } from '../../src/generated/types/PoolManager';
import { getSwapCastHook } from '../../src/generated/types/SwapCastHook';
import { CONTRACT_ADDRESSES } from './wallets';
import { withErrorHandling, logInfo, logWarning } from './error';
import { getContract } from './client';

// Outcome constants
export const OUTCOME_BULLISH = 1;
export const OUTCOME_BEARISH = 0;

// Price limit constants
const MIN_SQRT_PRICE = BigInt('4295128740');
const MAX_SQRT_PRICE = BigInt('1461446703485210103287273052203988822378723970341');

/**
 * Records a prediction via a swap transaction
 * This function creates a swap that triggers the SwapCastHook to record a prediction
 */
export const recordPredictionViaSwap = withErrorHandling(
  async (
    walletClient: WalletClient,
    userAddress: Address,
    poolKey: {
      currency0: Address;
      currency1: Address;
      fee: number;
      tickSpacing: number;
      hooks: Address;
    },
    marketId: bigint,
    outcome: number,
    stakeAmount: bigint
  ): Promise<Hash> => {
    // Get contract instances
    const poolManager = getContract(getPoolManager, CONTRACT_ADDRESSES.POOL_MANAGER as Address);
    const swapCastHook = getContract(getSwapCastHook, CONTRACT_ADDRESSES.SWAPCAST_HOOK as Address);
    
    // Prepare swap parameters
    const zeroForOne = outcome === OUTCOME_BEARISH; // Direction of swap based on outcome
    
    // Get hook data from SwapCastHook
    const hookData = await swapCastHook.read.getHookData([
      marketId,
      BigInt(outcome),
      stakeAmount
    ]);
    
    logInfo(
      'PredictionSwap', 
      `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction for market ${marketId.toString()} with ${stakeAmount.toString()} wei`
    );
    
    // Execute the swap transaction
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESSES.POOL_MANAGER as Address,
      abi: [{
        name: 'swap',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'poolKey', type: 'tuple', components: [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' }
              ]},
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountSpecified', type: 'int256' },
              { name: 'sqrtPriceLimitX96', type: 'uint160' },
              { name: 'hookData', type: 'bytes' }
            ]
          }
        ],
        outputs: [
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOut', type: 'uint256' }
        ],
        stateMutability: 'payable',
        type: 'function'
      }],
      functionName: 'swap',
      args: [{
        poolKey: {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: BigInt(poolKey.fee),
          tickSpacing: BigInt(poolKey.tickSpacing),
          hooks: poolKey.hooks
        },
        zeroForOne,
        amountSpecified: BigInt(0), // Minimal swap amount
        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE, // Price limits
        hookData
      }],
      value: stakeAmount,
      account: userAddress
    });
    
    return hash;
  },
  'RecordPredictionViaSwap'
);
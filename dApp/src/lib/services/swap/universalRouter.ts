/**
 * Universal Router integration for Uniswap v4 swaps with SwapCastHook
 * @module services/swap/universalRouter
 */

import { type Address, type Hash, encodeAbiParameters, http } from 'viem';
import { getCurrentNetworkConfig } from '$lib/utils/network';
import type { PoolKey } from '$lib/services/market/types';
import { getIUniversalRouter } from '$generated/types/IUniversalRouter';
import { appKit } from '$lib/configs/wallet.config';
import { PUBLIC_UNIVERSAL_ROUTER_ADDRESS } from '$env/static/public';

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
 

// Uniswap v4 Router Actions enum
enum Actions {
  SWAP_EXACT_IN_SINGLE = 0,
  SWAP_EXACT_OUT_SINGLE = 1,
  SETTLE_ALL = 2,
  TAKE_ALL = 3
}

// Commands enum for Universal Router
enum Commands {
  V4_SWAP = 10 // 0x0a in decimal
}

/**
 * Encodes prediction data for the SwapCastHook
 * @param user - User address making the prediction
 * @param marketId - Market ID for the prediction
 * @param outcome - Prediction outcome (0 for Bearish, 1 for Bullish)
 * @param convictionStake - Amount of conviction stake declared
 * @returns Encoded hookData bytes
 */
export function encodePredictionHookData(
  user: Address,
  marketId: bigint,
  outcome: PredictionTypes.Outcome,
  convictionStake: bigint
): `0x${string}` {
  // Convert user address to bytes20
  const userBytes = user.toLowerCase().substring(2).padStart(40, '0');
  
  // Convert marketId to bytes32
  const marketIdBytes = marketId.toString(16).padStart(64, '0');
  
  // Convert outcome to bytes1
  const outcomeBytes = outcome.toString(16).padStart(2, '0');
  
  // Convert convictionStake to bytes16
  const convictionStakeBytes = convictionStake.toString(16).padStart(32, '0');
  
  // Concatenate all bytes
  return `0x${userBytes}${marketIdBytes}${outcomeBytes}${convictionStakeBytes}`;
}

/**
 * Executes a swap with prediction via the Universal Router
 * @param poolKey - The Uniswap v4 pool key
 * @param zeroForOne - Direction of the swap (true if swapping token0 for token1)
 * @param amountIn - Amount of input tokens to swap
 * @param amountOutMinimum - Minimum amount of output tokens expected
 * @param marketId - Market ID for the prediction
 * @param outcome - Prediction outcome (0 for Bearish, 1 for Bullish)
 * @param convictionStake - Amount of conviction stake declared
 * @returns Transaction hash
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
  const universalRouter = getIUniversalRouter({
    address: PUBLIC_UNIVERSAL_ROUTER_ADDRESS,
    chain,
    transport: http(rpcUrl)
  });

  // Get wallet client for sending transactions
  const walletInfo = appKit.getWalletInfo();
  if (!walletInfo) {
    throw new Error('Wallet client not available');
  }
  
  // Get the user's address
  const address = appKit.getAccount()?.address;
  if (!address) {
    throw new Error('No connected account found');
  }
  
  // Encode hook data for the prediction
  const hookData = encodePredictionHookData(
    address as Address, // Cast to Address type since we've verified it exists
    marketId,
    outcome,
    convictionStake
  );
  
  // Encode V4Router actions
  const actions = encodeAbiParameters(
    [{ type: 'uint8[]' }],
    [[Actions.SWAP_EXACT_IN_SINGLE, Actions.SETTLE_ALL, Actions.TAKE_ALL]]
  );
  
  // Encode swap parameters
  const params = [
    // First parameter: swap configuration
    encodeAbiParameters(
      [
        { 
          type: 'tuple', 
          components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' }
          ] 
        },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'bytes' }
      ],
      [
        {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks
        },
        zeroForOne,
        amountIn,
        amountOutMinimum,
        hookData
      ]
    ),
    // Second parameter: specify input tokens for the swap
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [zeroForOne ? poolKey.currency0 : poolKey.currency1, amountIn]
    ),
    // Third parameter: specify output tokens from the swap
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [zeroForOne ? poolKey.currency1 : poolKey.currency0, amountOutMinimum]
    )
  ];
  
  // Set deadline (20 seconds from now)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20);
  
  // Calculate protocol fee (assuming 0.1% fee)
  const protocolFee = convictionStake * BigInt(10) / BigInt(10000); // 0.1% fee
  
  // Calculate the total value to send (amountIn + convictionStake + fee)
  // If the input token is ETH (address(0)), we need to send the value with the transaction
  const isEthInput = poolKey.currency0.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || 
                     poolKey.currency1.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const totalValue = isEthInput ? amountIn + convictionStake + protocolFee : convictionStake + protocolFee;
  
  // Execute the transaction using the typed contract
  // Convert commands to hex string for the Universal Router (0x0a is V4_SWAP)
  const commandsHex = `0x${Commands.V4_SWAP.toString(16).padStart(2, '0')}` as `0x${string}`;
  
  // For Universal Router, we need to prepare the inputs as a single hex string
  // that combines our actions and parameters
  const singleInput = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actions, params]
  );
  
  const hash = await universalRouter.write.execute(
    [
      commandsHex, 
      [singleInput], // This needs to be an array of hex strings
      deadline
    ],
    {
      chain,
      value: totalValue,
      account: address as `0x${string}` // Cast to the expected type for viem
    }
  );
  
  return hash;
}

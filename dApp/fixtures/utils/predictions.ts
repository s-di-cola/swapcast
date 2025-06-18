import { type Address, type Hash, type WalletClient, encodePacked, encodeAbiParameters } from 'viem';
import { anvil } from 'viem/chains';
import { getIUniversalRouter } from '../../src/generated/types/IUniversalRouter';
import { getContract, impersonateAccount, stopImpersonatingAccount } from './client';
import { logInfo, logWarning, withErrorHandling } from './error';
import { CONTRACT_ADDRESSES } from './wallets';
import { getPublicClient } from './client';
import { approveToken } from './tokens';

// Outcome constants
export const OUTCOME_BULLISH = 1;
export const OUTCOME_BEARISH = 0;

// Universal Router command constants
const V4_SWAP_COMMAND = 0x0B;

// V4Router action constants (from Uniswap V4 SDK)
const SWAP_EXACT_IN_SINGLE = 0;
const SETTLE_ALL = 1;
const TAKE_ALL = 2;

/**
 * Creates properly formatted hookData for the SwapCastHook
 * According to the hook contract, it expects:
 * - bytes 0-19: actualUser (address) - 20 bytes
 * - bytes 20-51: marketId (uint256) - 32 bytes  
 * - bytes 52: outcome (uint8) - 1 byte
 * - bytes 53-68: convictionStake (uint128) - 16 bytes
 * Total: 69 bytes (PREDICTION_HOOK_DATA_LENGTH)
 */
function createPredictionHookData(
  userAddress: Address,
  marketId: bigint,
  outcome: number,
  stakeAmount: bigint
): `0x${string}` {
  // Ensure stake amount fits in uint128 (16 bytes)
  const maxUint128 = (2n ** 128n) - 1n;
  if (stakeAmount > maxUint128) {
    throw new Error(`Stake amount ${stakeAmount} exceeds uint128 maximum`);
  }

  // Encode using encodePacked for exact byte layout expected by the hook
  const hookData = encodePacked(
    ['address', 'uint256', 'uint8', 'uint128'],
    [userAddress, marketId, outcome, stakeAmount]
  );

  logInfo('HookData', `Created hookData: ${hookData} (length: ${(hookData.length - 2) / 2} bytes)`);
  logInfo('HookData', `  User: ${userAddress}`);
  logInfo('HookData', `  MarketId: ${marketId}`);
  logInfo('HookData', `  Outcome: ${outcome}`);
  logInfo('HookData', `  Stake: ${stakeAmount}`);

  return hookData;
}

/**
 * Calculate the total ETH amount needed for prediction
 * This must match exactly what PredictionManager.recordPrediction expects
 */
function calculateTotalETHNeeded(stakeAmount: bigint, feeBasisPoints: bigint): bigint {
  const MAX_BASIS_POINTS = 10000n;
  const fee = (stakeAmount * feeBasisPoints) / MAX_BASIS_POINTS;
  const total = stakeAmount + fee;
  
  logInfo('ETHCalculation', `Stake: ${stakeAmount}, Fee: ${fee}, Total: ${total}`);
  return total;
}

/**
 * Records a prediction via a swap transaction using the Universal Router
 * This function creates a minimal swap that triggers the SwapCastHook to record a prediction
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

    const universalRouter = getContract(getIUniversalRouter, CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address);
    
    // Get the protocol fee basis points from the contract
    // We'll use the deployed value: 200 basis points (2%)
    const PROTOCOL_FEE_BASIS_POINTS = 200n;
    
    // Calculate the total ETH needed (stake + fee) - this is what PredictionManager expects
    const totalETHNeeded = calculateTotalETHNeeded(stakeAmount, PROTOCOL_FEE_BASIS_POINTS);
    
    // Prepare swap parameters
    const zeroForOne = outcome === OUTCOME_BEARISH; // Direction of swap based on outcome

    // Create properly formatted hookData for the SwapCastHook
    const hookData = createPredictionHookData(userAddress, marketId, outcome, stakeAmount);

    logInfo(
      'PredictionSwap',
      `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction for market ${marketId.toString()}`
    );
    logInfo('PredictionSwap', `Stake amount: ${stakeAmount} wei`);
    logInfo('PredictionSwap', `Total ETH needed (stake + fee): ${totalETHNeeded} wei`);

    // Define the Universal Router commands
    // V4_SWAP command (0x0B) as per Universal Router documentation
    const commands = encodePacked(['uint8'], [V4_SWAP_COMMAND]);

    // For the actual swap, we use a minimal amount since this is just to trigger the hook
    // The hook will receive the full totalETHNeeded as msg.value
    const minimalSwapAmount = 1n; // 1 wei for the actual swap

    // Encode V4Router actions according to the official documentation format
    const actions = encodePacked(
      ['uint8', 'uint8', 'uint8'],
      [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
    );

    // Prepare parameters for each action according to the official Uniswap documentation
    // Each parameter should be ABI-encoded separately
    const params = [
      // First parameter: ExactInputSingleParams struct
      encodeAbiParameters(
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
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'hookData', type: 'bytes' }
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
          minimalSwapAmount,
          BigInt(0), // amountOutMinimum
          hookData
        ]
      ),

      // Second parameter: SETTLE_ALL - currency and amount
      encodeAbiParameters(
        [
          { name: 'currency', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        [
          zeroForOne ? poolKey.currency0 : poolKey.currency1,
          minimalSwapAmount
        ]
      ),

      // Third parameter: TAKE_ALL - currency and amount
      encodeAbiParameters(
        [
          { name: 'currency', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        [
          zeroForOne ? poolKey.currency1 : poolKey.currency0,
          BigInt(0)
        ]
      )
    ];

    // According to the documentation, inputs should be: 
    // inputs[0] = abi.encode(actions, params)
    const inputs = [
      encodeAbiParameters(
        [
          { name: 'actions', type: 'bytes' },
          { name: 'params', type: 'bytes[]' }
        ],
        [actions, params]
      )
    ];

    // Set deadline (60 seconds from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

    // Check if we're dealing with ETH (native token) or an ERC20
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const inputTokenAddress = zeroForOne ? poolKey.currency0 : poolKey.currency1;
    const isNativeToken = inputTokenAddress.toLowerCase() === ZERO_ADDRESS;
    
    logInfo('PredictionSwap', `Input token: ${inputTokenAddress} (${isNativeToken ? 'native ETH' : 'ERC20'})`);
    logInfo('PredictionSwap', `Minimal swap amount: ${minimalSwapAmount} wei`);

    try {
      // Impersonate the user account for the transaction
      await impersonateAccount(userAddress);

      // Check user balance
      const balance = await getPublicClient().getBalance({ address: userAddress });
      logInfo('PredictionSwap', `User balance: ${balance} wei`);
      
      // Verify user has enough ETH for the total amount needed
      if (balance < totalETHNeeded) {
        throw new Error(`Insufficient balance. Need: ${totalETHNeeded}, Have: ${balance}`);
      }

      // For ERC20 tokens, we need to approve the UniversalRouter to spend tokens
      // But we only need to approve for the minimal swap amount, not the stake
      if (!isNativeToken) {
        logInfo('PredictionSwap', `Approving UniversalRouter to spend ${minimalSwapAmount} wei of token ${inputTokenAddress}`);
        
        await approveToken(
          userAddress,
          inputTokenAddress,
          minimalSwapAmount,
          CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address,
        );
        
        logInfo('PredictionSwap', `Approval complete`);
      }

      // The key: Send the exact amount that PredictionManager expects
      // This is totalETHNeeded (stake + fee), not just the stake amount
      const msgValue = totalETHNeeded;

      logInfo('PredictionSwap', `Executing Universal Router with msg.value: ${msgValue} wei`);
      logInfo('PredictionSwap', `Commands: ${commands}`);
      logInfo('PredictionSwap', `Inputs length: ${inputs.length}`);
      logInfo('PredictionSwap', `Actions encoded length: ${actions.length}`);
      logInfo('PredictionSwap', `Params array length: ${params.length}`);

      const hash = await universalRouter.write.execute([commands, inputs, deadline], {
        account: userAddress,
        chain: anvil,
        value: msgValue, // This must match what PredictionManager expects exactly
        gas: 1000000n, // Increase gas limit for complex operations
      });

      logInfo('PredictionSwap', `Transaction submitted: ${hash}`);
      
      // Wait for transaction to be confirmed
      const tx = await getPublicClient().waitForTransactionReceipt({ hash });
      
      // Check if the transaction was successful
      if (tx.status !== 'success') {
        throw new Error(`Transaction failed with status ${tx.status}`);
      }
      
      logInfo('PredictionSwap', `Transaction confirmed successfully!`);
      return hash;
    } catch (error) {
      logWarning('PredictionSwap', `Failed to execute swap via UniversalRouter: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      // Always stop impersonating, even if there was an error
      await stopImpersonatingAccount(userAddress);
    }
  },
  'RecordPredictionViaSwap'
);
import {type Address, encodeAbiParameters, encodePacked, type Hash} from 'viem';
import {anvil} from 'viem/chains';
import {getIUniversalRouter} from '../../src/generated/types/IUniversalRouter';
import {getContract, getPublicClient, impersonateAccount, stopImpersonatingAccount} from './client';
import {logInfo, logWarning, withErrorHandling} from './error';
import {CONTRACT_ADDRESSES} from './wallets';
import {approveToken, NATIVE_ETH_ADDRESS} from './tokens';

// Outcome constants
export const OUTCOME_BULLISH = 1;
export const OUTCOME_BEARISH = 0;

// Universal Router command constants (from Uniswap documentation)
const V4_SWAP_COMMAND = 0x10; // Commands.V4_SWAP

// V4Router action constants (from Uniswap V4 documentation)
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;


/**
 * Creates properly formatted hookData for the SwapCastHook
 */
function createPredictionHookData(
  userAddress: Address,
  marketId: bigint,
  outcome: number,
  stakeAmount: bigint
): `0x${string}` {
  const maxUint128 = (2n ** 128n) - 1n;
  if (stakeAmount > maxUint128) {
    throw new Error(`Stake amount ${stakeAmount} exceeds uint128 maximum`);
  }

  const hookData = encodePacked(
    ['address', 'uint256', 'uint8', 'uint128'],
    [userAddress, marketId, outcome, stakeAmount]
  );

  logInfo('HookData', `Created hookData: ${hookData}`);
  return hookData;
}

/**
 * Calculate the total ETH amount needed for prediction
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
 *
 */
export const recordPredictionViaSwap = withErrorHandling(
  async (
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

    const PROTOCOL_FEE_BASIS_POINTS = 200n;
    const totalETHNeeded = calculateTotalETHNeeded(stakeAmount, PROTOCOL_FEE_BASIS_POINTS);

    // Determine swap direction based on outcome
    const zeroForOne = outcome === OUTCOME_BEARISH;

    // Create hookData for the SwapCastHook
    const hookData = createPredictionHookData(userAddress, marketId, outcome, stakeAmount);

    logInfo('PredictionSwap', `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction`);


    try {
      await impersonateAccount(userAddress);

      // Check balance
      const balance = await getPublicClient().getBalance({ address: userAddress });
      if (balance < totalETHNeeded) {
        throw new Error(`Insufficient balance. Need: ${totalETHNeeded}, Have: ${balance}`);
      }

      // Handle token approvals if needed (for non-ETH tokens)
      const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1;
      if (inputCurrency.toLowerCase() !== NATIVE_ETH_ADDRESS) {
        await approveToken(
          userAddress,
          inputCurrency,
          stakeAmount,
          CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address,
        );
      }

      // Step 1: Encode the Universal Router command (V4_SWAP)
      const commands = encodePacked(['uint8'], [V4_SWAP_COMMAND]);

      // Step 2: Encode V4Router actions according to documentation
      const actions = encodePacked(
        ['uint8', 'uint8', 'uint8'],
        [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
      );

      // Step 3: Prepare parameters for each action
      const params = new Array(3);

      // First parameter: ExactInputSingleParams for SWAP_EXACT_IN_SINGLE
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
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountIn', type: 'uint128' },
          { name: 'amountOutMinimum', type: 'uint128' },
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
          stakeAmount,
          BigInt(0), // amountOutMinimum - accept any amount out
          hookData
        ]
      );

      // Second parameter: SETTLE_ALL - specify input currency and amount
      params[1] = encodeAbiParameters(
        [
          { name: 'currency', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        [
          zeroForOne ? poolKey.currency0 : poolKey.currency1, // Input currency
          stakeAmount // Input amount
        ]
      );

      // Third parameter: TAKE_ALL - specify output currency (amount is 0 for take all)
      params[2] = encodeAbiParameters(
        [
          { name: 'currency', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        [
          zeroForOne ? poolKey.currency1 : poolKey.currency0, // Output currency
          BigInt(0) // Amount 0 means take all available
        ]
      );

      // Step 4: Combine actions and params into inputs
      const inputs = [
        encodeAbiParameters(
          [
            { name: 'actions', type: 'bytes' },
            { name: 'params', type: 'bytes[]' }
          ],
          [actions, params]
        )
      ];

      // Step 5: Set deadline
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

      logInfo('PredictionSwap', `Executing Universal Router with msg.value: ${totalETHNeeded}`);
      logInfo('PredictionSwap', `Swap amount: ${stakeAmount}, Hook data length: ${hookData.length}`);

      // Step 6: Execute the swap
      const hash = await universalRouter.write.execute([commands, inputs, deadline], {
        account: userAddress,
        chain: anvil,
        value: totalETHNeeded,
        gas: 30000000n,
      });

      // Wait for confirmation
      const tx = await getPublicClient().waitForTransactionReceipt({ hash });

      if (tx.status !== 'success') {
        throw new Error(`Transaction failed with status ${tx.status}`);
      }

      logInfo('PredictionSwap', `Transaction confirmed successfully: ${hash}`);
      return hash;

    } catch (error) {
      logWarning('PredictionSwap', `Swap execution failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      await stopImpersonatingAccount(userAddress);
    }
  },
  'RecordPredictionViaSwap'
);

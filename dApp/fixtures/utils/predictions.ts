import { type Address, type Hash, type WalletClient, encodePacked, encodeAbiParameters } from 'viem';
import { anvil } from 'viem/chains';
import { getIUniversalRouter } from '../../src/generated/types/IUniversalRouter';
import { getContract, impersonateAccount, stopImpersonatingAccount } from './client';
import { logInfo, logWarning, withErrorHandling } from './error';
import { CONTRACT_ADDRESSES } from './wallets';
import { Actions } from '@uniswap/v4-sdk'
import { getPublicClient } from './client';
import { approveToken } from './tokens';

// Outcome constants
export const OUTCOME_BULLISH = 1;
export const OUTCOME_BEARISH = 0;


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

    const universalRouter = getContract(getIUniversalRouter, CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address);
    // Prepare swap parameters
    const zeroForOne = outcome === OUTCOME_BEARISH; // Direction of swap based on outcome

    // Encode hook data manually since getHookData is not in the ABI
    // Format: marketId (uint256) + outcome (uint8) + stakeAmount (uint256)
    const hookData = encodePacked(
      ['uint256', 'uint8', 'uint256'],
      [marketId, Number(outcome), stakeAmount]
    );

    logInfo(
      'PredictionSwap',
      `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction for market ${marketId.toString()} with ${stakeAmount.toString()} wei`
    );

    // Define the Universal Router commands and actions
    // V4_SWAP command (0x0B) as per Universal Router documentation
    const commands = encodePacked(['uint8'], [0x0B]); // V4_SWAP command byte

    // Define V4Router actions
    const actions = encodePacked(
      ['uint8', 'uint8', 'uint8'],
      [Actions.SWAP_EXACT_IN_SINGLE, Actions.SETTLE_ALL, Actions.TAKE_ALL]
    );

    // Prepare parameters for each action following the Uniswap V4 documentation
    const params = [
      // First parameter: swap configuration (ExactInputSingleParams)
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
          BigInt(0), // amountIn (minimal)
          BigInt(0), // amountOutMinimum (no minimum)
          hookData // Important: This contains the prediction data
        ]
      ),

      // Second parameter: SETTLE_ALL - specify input tokens
      encodeAbiParameters(
        [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        [
          zeroForOne ? poolKey.currency0 : poolKey.currency1,
          BigInt(0)
        ]
      ),

      // Third parameter: TAKE_ALL - specify output tokens
      encodeAbiParameters(
        [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        [
          zeroForOne ? poolKey.currency1 : poolKey.currency0,
          BigInt(0)
        ]
      )
    ];

    // Combine actions and params into inputs as per the documentation
    const inputs = [encodePacked(['bytes', 'bytes[]'], [actions, params])];

    // Set deadline (20 seconds from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20);

    // Check if we're dealing with ETH (native token) or an ERC20
    // For ERC20, we should NOT send any value with the transaction
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const isNativeToken = zeroForOne ?
      poolKey.currency0.toLowerCase() === ZERO_ADDRESS :
      poolKey.currency1.toLowerCase() === ZERO_ADDRESS;
    
    // IMPORTANT: For SwapCastHook, we ALWAYS need to send the stakeAmount as value
    // This is because the hook needs ETH to record the prediction
    logInfo('PredictionSwap', `Token is ${isNativeToken ? 'native ETH' : 'ERC20'}, but ALWAYS sending stakeAmount as value for the hook`);

    logInfo('PredictionSwap', `Executing swap via UniversalRouter with userAddress: ${userAddress}`);
    logInfo('PredictionSwap', `Stake amount: ${stakeAmount}`);



    try {
      // Impersonate the user account for the transaction
      await impersonateAccount(userAddress);

      // ETH balance of userAddress
      const balance = await getPublicClient().getBalance({ address: userAddress });
      logInfo('PredictionSwap', `User balance: ${balance}`);
      
      // For ERC20 tokens, we need to approve the UniversalRouter to spend tokens
      if (!isNativeToken) {
        const tokenAddress = zeroForOne ? poolKey.currency0 as Address : poolKey.currency1 as Address;
        logInfo('PredictionSwap', `Approving UniversalRouter to spend ${stakeAmount} of token ${tokenAddress}`);
        
        await approveToken(
          userAddress,
          tokenAddress,
          stakeAmount,
          CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address,
        );
        
        logInfo('PredictionSwap', `Approval complete`);
      }

      const hash = await universalRouter.write.execute([commands, inputs, deadline], {
        account: userAddress,
        chain: anvil,
        // Always send the stakeAmount as value for the SwapCastHook
        value: stakeAmount,
      });
      logInfo('PredictionSwap', `Transaction hash: ${hash}`);
      // Wait for transaction to be confirmed
      const tx = await getPublicClient().waitForTransactionReceipt({ hash });
      // check if the transaction was successful
      if (tx.status !== 'success') {
        throw new Error(`Transaction failed with status ${tx.status}`);
      }
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
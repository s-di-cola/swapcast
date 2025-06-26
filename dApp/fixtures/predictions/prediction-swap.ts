import {type Address, encodeAbiParameters, encodePacked, erc20Abi, formatUnits, type Hash} from 'viem';
import {anvil} from 'viem/chains';
import {getIUniversalRouter} from '../../src/generated/types/IUniversalRouter';
import {getContract, getPublicClient, impersonateAccount, stopImpersonatingAccount} from '../utils/client';
import {logInfo, logWarning, withErrorHandling} from '../utils/error';
import {CONTRACT_ADDRESSES} from '../utils/wallets';
import {approveToken, NATIVE_ETH_ADDRESS} from '../utils/tokens';
import {logPoolLiquidity, logPoolState} from '../utils/liquidity';
import {Pool} from "@uniswap/v4-sdk";
import {Token} from "@uniswap/sdk-core";
import {getProtocolConfig} from './prediction-core';

/** Bullish market outcome */
export const OUTCOME_BULLISH = 1;

/** Bearish market outcome */
export const OUTCOME_BEARISH = 0;

/** Universal Router command for V4 swaps */
const V4_SWAP_COMMAND = 0x10;

/** V4Router action for exact input single swaps */
const SWAP_EXACT_IN_SINGLE = 0x06;

/** V4Router action to settle all open positions */
const SETTLE_ALL = 0x0c;

/** V4Router action to take all available assets */
const TAKE_ALL = 0x0f;

/**
 * Token information extracted from Uniswap V4 pool currencies.
 * @interface TokenInfo
 */
interface TokenInfo {
  /** Token contract address */
  address: Address;
  /** Token symbol (e.g., 'ETH', 'USDC') */
  symbol: string;
  /** Number of decimal places for the token */
  decimals: number;
  /** Whether this represents native ETH */
  isNative: boolean;
}

/**
 * Result of token balance validation.
 * @interface BalanceValidationResult
 */
interface BalanceValidationResult {
  /** Whether the balance is sufficient for the required amount */
  valid: boolean;
  /** Raw balance in token's smallest unit */
  balance: bigint;
  /** Human-readable formatted balance */
  formatted: string;
}

/**
 * Creates properly formatted hookData for the SwapCastHook with Delta Feature.
 *
 * The hookData is packed as: [userAddress, marketId, outcome]
 * The hook automatically calculates the stake as 1% of the swap output amount.
 *
 * @param userAddress - The address of the user making the prediction
 * @param marketId - The ID of the prediction market
 * @param outcome - The predicted outcome (0 for bearish, 1 for bullish)
 * @returns Formatted hook data as a hex string
 */
function createPredictionHookData(
    userAddress: Address,
    marketId: bigint,
    outcome: number
): `0x${string}` {
  const hookData = encodePacked(
      ['address', 'uint256', 'uint8'],
      [userAddress, marketId, outcome]
  );

  logInfo('HookData', `Created hookData (Delta): ${hookData}`);
  return hookData;
}

/**
 * Calculates the estimated stake amount from swap output (1% of swap).
 * This is for informational purposes only - the actual calculation happens in the hook.
 *
 * @param swapOutputAmount - The expected output amount from the swap
 * @returns Estimated stake amount (1% of swap output)
 */
function calculateEstimatedStakeFromSwap(swapOutputAmount: bigint): bigint {
  const estimatedStake = swapOutputAmount / 100n; // 1% of swap output
  
  logInfo('DeltaCalculation', `Swap Output: ${swapOutputAmount}, Estimated Stake: ${estimatedStake}`);
  return estimatedStake;
}

/**
 * Extracts token information from a Uniswap V4 pool currency.
 * Handles both native ETH and ERC20 tokens.
 *
 * @param currency - The currency object from a Uniswap V4 pool
 * @returns Token information including address, symbol, decimals, and native status
 */
function getTokenFromCurrency(currency: any): TokenInfo {
  if (!currency.isToken) {
    return {
      address: NATIVE_ETH_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      isNative: true
    };
  }

  const token = currency as Token;
  return {
    address: token.address as Address,
    symbol: token.symbol,
    decimals: token.decimals,
    isNative: false
  };
}

/**
 * Validates that a user has sufficient token balance for a transaction.
 *
 * For ETH: Uses getBalance to check native ETH balance
 * For ERC20 tokens: Uses balanceOf contract call
 *
 * @param userAddress - The user's wallet address
 * @param tokenInfo - Token information from getTokenFromCurrency
 * @param requiredAmount - Minimum required amount in token's native decimals
 * @returns Promise resolving to validation result with balance info
 */
async function validateTokenBalance(
    userAddress: Address,
    tokenInfo: TokenInfo,
    requiredAmount: bigint
): Promise<BalanceValidationResult> {
  let balance: bigint;

  if (tokenInfo.symbol === 'ETH') {
    balance = await getPublicClient().getBalance({ address: userAddress });
  } else {
    const publicClient = await getPublicClient();
    balance = await publicClient.readContract({
      address: tokenInfo.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress]
    });
  }

  const formatted = formatUnits(balance, tokenInfo.decimals);
  const valid = balance >= requiredAmount;

  logInfo('BalanceCheck', `${tokenInfo.symbol}: ${formatted} (need: ${formatUnits(requiredAmount, tokenInfo.decimals)})`);

  return { valid, balance, formatted };
}

/**
 * Generates realistic swap amounts for whale accounts based on their available balance.
 *
 * The function attempts to create swap amounts that are 10x-100x the stake amount,
 * but caps the amount at 80% of the whale's available balance to ensure executability.
 *
 * @param userAddress - The whale's wallet address
 * @param inputToken - Token information for the input token
 * @param stakeAmount - The prediction stake amount in ETH (18 decimals)
 * @returns Promise resolving to the swap amount in the token's native decimals
 */
async function generateWhaleSwapAmount(
    userAddress: Address,
    inputToken: TokenInfo,
    stakeAmount: bigint
): Promise<bigint> {
  // Get the actual available balance
  const balanceCheck = await validateTokenBalance(userAddress, inputToken, 0n);
  const availableBalance = balanceCheck.balance;

  // Generate swap amounts between 10x to 100x the stake amount
  const multiplier = BigInt(10 + Math.floor(Math.random() * 90)); // 10x to 100x
  let baseSwapAmount = stakeAmount * multiplier;

  // Convert to appropriate token units
  if (inputToken.decimals !== 18) {
    const scaleFactor = BigInt(10 ** (18 - inputToken.decimals));
    baseSwapAmount = baseSwapAmount / scaleFactor;
  }

  // Ensure swap amount doesn't exceed available balance
  // Use 80% of available balance to leave some buffer
  const maxSwapAmount = (availableBalance * 80n) / 100n;

  if (baseSwapAmount > maxSwapAmount) {
    baseSwapAmount = maxSwapAmount;
  }

  // Ensure minimum meaningful amount
  const minAmount = BigInt(10 ** Math.max(0, inputToken.decimals - 2));

  if (baseSwapAmount < minAmount) {
    return minAmount;
  }

  return baseSwapAmount;
}

/**
 * Records a prediction by executing a swap transaction through the Universal Router.
 *
 * This function performs a Uniswap V4 swap while simultaneously recording a prediction
 * through the SwapCastHook. The swap and prediction are atomic - both succeed or both fail.
 *
 * Flow:
 * 1. Validates user balances (ETH for fees, tokens for swap)
 * 2. Handles token approvals if needed
 * 3. Constructs Universal Router transaction with hook data
 * 4. Executes swap with prediction recording
 * 5. Waits for confirmation and logs results
 *
 * @param userAddress - The address of the user making the prediction
 * @param pool - The Uniswap V4 pool to trade in
 * @param marketId - The ID of the prediction market
 * @param outcome - The predicted outcome (OUTCOME_BULLISH or OUTCOME_BEARISH)
 * @param swapAmount - The amount of input tokens to swap (in token's native decimals)
 * @returns Promise resolving to the transaction hash
 * @throws {Error} If insufficient balance, zero swap amount, or transaction fails
 * @note With Delta feature: stake is automatically calculated as 1% of swap output
 */
export const recordPredictionViaSwap = withErrorHandling(
    async (
        userAddress: Address,
        pool: Pool,
        marketId: bigint,
        outcome: number,
        swapAmount: bigint      // Actual amount to swap (in token's native decimals)
    ): Promise<Hash> => {

      const universalRouter = getContract(getIUniversalRouter, CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address);

      const token0 = getTokenFromCurrency(pool.currency0);
      const token1 = getTokenFromCurrency(pool.currency1);

      logInfo('PredictionSwap', `Token0: ${token0.symbol} (${token0.decimals} decimals)`);
      logInfo('PredictionSwap', `Token1: ${token1.symbol} (${token1.decimals} decimals)`);

      // Determine swap direction based on outcome
      const zeroForOne = outcome === OUTCOME_BEARISH;
      const inputToken = zeroForOne ? token0 : token1;
      const outputToken = zeroForOne ? token1 : token0;

      // Use the provided swap amount directly (no conversion needed)
      const inputAmount = swapAmount;

      // Create hookData without stake amount (Delta feature)
      const hookData = createPredictionHookData(userAddress, marketId, outcome);
      
      // Calculate estimated stake for logging purposes (1% of swap output)
      const estimatedStake = calculateEstimatedStakeFromSwap(inputAmount);

      logInfo('PredictionSwap', `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction (Delta Mode)`);
      logInfo('PredictionSwap', `Swap: ${formatUnits(inputAmount, inputToken.decimals)} ${inputToken.symbol} → ${outputToken.symbol}`);
      logInfo('PredictionSwap', `Estimated stake (1% of output): ~${formatUnits(estimatedStake, 18)} ETH`);

      // Validate that swap amount is not zero
      if (inputAmount === 0n) {
        throw new Error('Swap amount cannot be zero');
      }

      try {
        await impersonateAccount(userAddress);

        // With Delta feature: only need ETH for the actual swap (if swapping ETH)
        // No separate ETH needed for staking - hook takes 1% from swap output
        let totalETHNeeded: bigint;
        if (inputToken.symbol === 'ETH') {
          // ETH swap: only need the swap amount (hook takes 1% automatically)
          totalETHNeeded = inputAmount;
          logInfo('PredictionSwap', `ETH swap (Delta) - Swap: ${formatUnits(inputAmount, 18)} ETH (hook will take 1%)`);
        } else {
          // Token swap: no ETH needed (hook handles staking from swap output)
          totalETHNeeded = 0n;
          logInfo('PredictionSwap', `Token swap (Delta) - No ETH needed (hook handles staking from output)`);
        }

        logInfo('PredictionSwap', `Total ETH needed for swap: ${formatUnits(totalETHNeeded, 18)} ETH`);

        // Check ETH balance only if we need ETH for the swap
        if (totalETHNeeded > 0n) {
          const ethBalance = await getPublicClient().getBalance({ address: userAddress });
          if (ethBalance < totalETHNeeded) {
            throw new Error(`Insufficient ETH balance. Need: ${formatUnits(totalETHNeeded, 18)} ETH, Have: ${formatUnits(ethBalance, 18)} ETH`);
          }
        }

        // Validate token balance for non-ETH swaps
        if (inputToken.symbol !== 'ETH') {
          const balanceCheck = await validateTokenBalance(userAddress, inputToken, inputAmount);
          if (!balanceCheck.valid) {
            throw new Error(`Insufficient ${inputToken.symbol}: ${balanceCheck.formatted} (need: ${formatUnits(inputAmount, inputToken.decimals)})`);
          }

          // Handle token approvals
          await approveToken(
              userAddress,
              inputToken.address,
              inputAmount,
              CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address,
          );
        }

        const poolKeyStruct = {
          currency0: pool.poolKey.currency0 as Address,
          currency1: pool.poolKey.currency1 as Address,
          fee: pool.poolKey.fee,
          tickSpacing: pool.poolKey.tickSpacing,
          hooks: pool.poolKey.hooks as Address
        };

        const commands = encodePacked(['uint8'], [V4_SWAP_COMMAND]);
        const actions = encodePacked(['uint8', 'uint8', 'uint8'], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);

        const swapParams = encodeAbiParameters([{
          name: 'swapParams',
          type: 'tuple',
          components: [
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
          ]
        }], [{
          poolKey: poolKeyStruct,
          zeroForOne: zeroForOne,
          amountIn: inputAmount,
          amountOutMinimum: BigInt(0),
          hookData: hookData
        }]);

        const settleParams = encodeAbiParameters(
            [{ name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' }],
            [inputToken.address, inputAmount]
        );

        const takeParams = encodeAbiParameters(
            [{ name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' }],
            [outputToken.address, BigInt(0)]
        );

        const inputs = [encodeAbiParameters(
            [{ name: 'actions', type: 'bytes' }, { name: 'params', type: 'bytes[]' }],
            [actions, [swapParams, settleParams, takeParams]]
        )];

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

        logInfo('PredictionSwap', `Executing Delta swap with ETH value: ${formatUnits(totalETHNeeded, 18)} ETH`);
        logInfo('PredictionSwap', `Hook will automatically take 1% of output as stake`);

        const hash = await universalRouter.write.execute([commands, inputs, deadline], {
          account: userAddress,
          chain: anvil,
          value: totalETHNeeded,
          gas: 30000000n,
        });

        const tx = await getPublicClient().waitForTransactionReceipt({ hash });

        await logPoolState(pool);
        await logPoolLiquidity(pool);

        if (tx.status !== 'success') {
          throw new Error(`Transaction failed with status ${tx.status}`);
        }

        logInfo('PredictionSwap', `Transaction confirmed successfully: ${hash}`);
        return hash;

      } catch (error) {
        logWarning('PredictionSwap', `Swap execution failed: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.message.includes('revert')) {
          logWarning('PredictionSwap', `Revert reason: ${JSON.stringify(error)}`);
        }
        throw error;
      } finally {
        await stopImpersonatingAccount(userAddress);
      }
    },
    'RecordPredictionViaSwap'
);

/**
 * Convenience wrapper that generates realistic swap amounts for fixture testing.
 *
 * This function is designed for use in test fixtures and demonstrations where
 * you want to simulate realistic whale trading behavior. It automatically:
 * - Determines the input token based on the prediction outcome
 * - Generates a swap amount that's 10x-100x the stake amount
 * - Ensures the swap amount doesn't exceed the whale's available balance
 * - Executes the swap with prediction recording
 *
 * @param userAddress - The whale's wallet address
 * @param pool - The Uniswap V4 pool to trade in
 * @param marketId - The ID of the prediction market
 * @param outcome - The predicted outcome (OUTCOME_BULLISH or OUTCOME_BEARISH)
 * @param estimatedStakeAmount - Estimated stake for realistic swap calculation (ETH/18 decimals)
 * @returns Promise resolving to the transaction hash
 * @throws {Error} If balance validation fails or transaction execution fails
 * @note With Delta feature: actual stake is 1% of swap output, not the estimated amount
 */
export const recordPredictionViaSwapWithRealisticAmount = withErrorHandling(
    async (
        userAddress: Address,
        pool: Pool,
        marketId: bigint,
        outcome: number,
        estimatedStakeAmount: bigint
    ): Promise<Hash> => {

      // Determine input token based on outcome
      const zeroForOne = outcome === OUTCOME_BEARISH;
      const token0 = getTokenFromCurrency(pool.currency0);
      const token1 = getTokenFromCurrency(pool.currency1);
      const inputToken = zeroForOne ? token0 : token1;

      // Generate realistic swap amount considering available balance
      const swapAmount = await generateWhaleSwapAmount(userAddress, inputToken, estimatedStakeAmount);

      logInfo('RealisticSwap', `Generated swap (Delta): ${formatUnits(swapAmount, inputToken.decimals)} ${inputToken.symbol}`);
      logInfo('RealisticSwap', `Estimated stake reference: ${formatUnits(estimatedStakeAmount, 18)} ETH`);
      logInfo('RealisticSwap', `Actual stake will be 1% of swap output`);

      return recordPredictionViaSwap(userAddress, pool, marketId, outcome, swapAmount);
    },
    'RecordPredictionViaSwapWithRealisticAmount'
);

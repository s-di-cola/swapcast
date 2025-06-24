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
 * Creates properly formatted hookData for the SwapCastHook.
 *
 * The hookData is packed as: [userAddress, marketId, outcome, stakeAmount]
 * This data is passed to the hook during swap execution to record the prediction.
 *
 * @param userAddress - The address of the user making the prediction
 * @param marketId - The ID of the prediction market
 * @param outcome - The predicted outcome (0 for bearish, 1 for bullish)
 * @param stakeAmount - The amount being staked in wei (must fit in uint128)
 * @returns Formatted hook data as a hex string
 * @throws {Error} If stake amount exceeds uint128 maximum
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
 * Calculates the total ETH amount needed for a prediction including protocol fees.
 *
 * @param stakeAmount - The base stake amount in wei
 * @param feeBasisPoints - Protocol fee in basis points (e.g., 200 = 2%)
 * @returns Total ETH needed (stake + fees) in wei
 */
function calculateTotalETHNeeded(stakeAmount: bigint, feeBasisPoints: bigint): bigint {
  const MAX_BASIS_POINTS = 10000n;
  const fee = (stakeAmount * feeBasisPoints) / MAX_BASIS_POINTS;
  const total = stakeAmount + fee;

  logInfo('ETHCalculation', `Stake: ${stakeAmount}, Fee: ${fee}, Total: ${total}`);
  return total;
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
 * @param stakeAmount - The prediction stake amount (always in ETH/18 decimals)
 * @returns Promise resolving to the transaction hash
 * @throws {Error} If insufficient balance, zero swap amount, or transaction fails
 */
export const recordPredictionViaSwap = withErrorHandling(
    async (
        userAddress: Address,
        pool: Pool,
        marketId: bigint,
        outcome: number,
        swapAmount: bigint,      // Actual amount to swap (in token's native decimals)
        stakeAmount: bigint      // Prediction stake amount (always in ETH/18 decimals)
    ): Promise<Hash> => {

      const universalRouter = getContract(getIUniversalRouter, CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address);

      const { protocolFeeBasisPoints } = await getProtocolConfig();
      const predictionETHNeeded = calculateTotalETHNeeded(stakeAmount, protocolFeeBasisPoints);

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

      const hookData = createPredictionHookData(userAddress, marketId, outcome, stakeAmount);

      logInfo('PredictionSwap', `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction`);
      logInfo('PredictionSwap', `Swap: ${formatUnits(inputAmount, inputToken.decimals)} ${inputToken.symbol} → ${outputToken.symbol}`);
      logInfo('PredictionSwap', `Prediction stake: ${formatUnits(stakeAmount, 18)} ETH`);

      // Validate that swap amount is not zero
      if (inputAmount === 0n) {
        throw new Error('Swap amount cannot be zero');
      }

      try {
        await impersonateAccount(userAddress);

        // Use symbol check instead of isNative for ETH detection
        let totalETHNeeded: bigint;
        if (inputToken.symbol === 'ETH') {
          // ETH swap: need swap amount + prediction ETH
          totalETHNeeded = inputAmount + predictionETHNeeded;
          logInfo('PredictionSwap', `ETH swap - Swap: ${formatUnits(inputAmount, 18)} ETH + Prediction: ${formatUnits(predictionETHNeeded, 18)} ETH`);
        } else {
          // Token swap: only need prediction ETH (tokens via approval)
          totalETHNeeded = predictionETHNeeded;
          logInfo('PredictionSwap', `Token swap - Only prediction: ${formatUnits(predictionETHNeeded, 18)} ETH`);
        }

        logInfo('PredictionSwap', `Total ETH needed: ${formatUnits(totalETHNeeded, 18)} ETH`);

        // Check ETH balance
        const ethBalance = await getPublicClient().getBalance({ address: userAddress });
        if (ethBalance < totalETHNeeded) {
          throw new Error(`Insufficient ETH balance. Need: ${formatUnits(totalETHNeeded, 18)} ETH, Have: ${formatUnits(ethBalance, 18)} ETH`);
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

        logInfo('PredictionSwap', `Executing with ETH value: ${formatUnits(totalETHNeeded, 18)} ETH`);

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
 * @param stakeAmount - The prediction stake amount (always in ETH/18 decimals)
 * @returns Promise resolving to the transaction hash
 * @throws {Error} If balance validation fails or transaction execution fails
 */
export const recordPredictionViaSwapWithRealisticAmount = withErrorHandling(
    async (
        userAddress: Address,
        pool: Pool,
        marketId: bigint,
        outcome: number,
        stakeAmount: bigint
    ): Promise<Hash> => {

      // Determine input token based on outcome
      const zeroForOne = outcome === OUTCOME_BEARISH;
      const token0 = getTokenFromCurrency(pool.currency0);
      const token1 = getTokenFromCurrency(pool.currency1);
      const inputToken = zeroForOne ? token0 : token1;

      // Generate realistic swap amount considering available balance
      const swapAmount = await generateWhaleSwapAmount(userAddress, inputToken, stakeAmount);

      logInfo('RealisticSwap', `Generated swap: ${formatUnits(swapAmount, inputToken.decimals)} ${inputToken.symbol} vs ${formatUnits(stakeAmount, 18)} ETH stake`);
      logInfo('RealisticSwap', `Available balance considered for realistic amount`);

      return recordPredictionViaSwap(userAddress, pool, marketId, outcome, swapAmount, stakeAmount);
    },
    'RecordPredictionViaSwapWithRealisticAmount'
);

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
 * Creates properly formatted hookData for the SwapCastHook
 *
 * @param userAddress - The address of the user making the prediction
 * @param marketId - The ID of the prediction market
 * @param outcome - The predicted outcome (0 for bearish, 1 for bullish)
 * @param stakeAmount - The amount being staked in wei
 * @returns Formatted hook data as a hex string
 * @throws If stake amount exceeds uint128 maximum
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
 * Get token info from pool currency (handles both native ETH and ERC20)
 */
function getTokenFromCurrency(currency: any) {
  if (!currency.isToken) {
    // Native ETH
    return {
      address: NATIVE_ETH_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      isNative: true
    };
  }

  // ERC20 token - Pool already has all the info!
  const token = currency as Token;
  return {
    address: token.address as Address,
    symbol: token.symbol,
    decimals: token.decimals,
    isNative: false
  };
}

/**
 * Convert amount from 18-decimal ETH equivalent to token's native decimals
 */
function convertToTokenDecimals(ethEquivalentAmount: bigint, tokenDecimals: number): bigint {
  if (tokenDecimals === 18) {
    return ethEquivalentAmount; // No conversion needed
  }

  // Scale amount to token's native decimals
  const scaleFactor = BigInt(10 ** (18 - tokenDecimals));
  return ethEquivalentAmount / scaleFactor;
}

/**
 * Validates that a whale has the required token for their prediction
 * @param userAddress - The whale account to validate
 * @param tokenInfo - Token information containing symbol, decimals, and address
 * @param requiredAmount - Amount needed for the prediction in wei
 * @returns Promise resolving to an object with:
 *   - valid: boolean indicating if requirements are met
 *   - error?: optional error message if validation fails
 */
async function validateTokenBalance(
  userAddress: Address,
  tokenInfo: ReturnType<typeof getTokenFromCurrency>,
  requiredAmount: bigint
): Promise<{ valid: boolean; balance: bigint; formatted: string }> {
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
 * Records a prediction by executing a swap transaction through the Universal Router
 * @param userAddress - The address of the user making the prediction
 * @param pool - The Uniswap V4 pool to trade in
 * @param marketId - The ID of the prediction market
 * @param tokenIn - The input token for the swap
 * @param tokenOut - The output token for the swap
 * @param amountIn - The amount of input tokens to swap
 * @param minAmountOut - The minimum amount of output tokens to receive
 * @param stakeAmount - The amount to stake in the prediction
 * @param isBullish - Whether the prediction is bullish (true) or bearish (false)
 * @returns The transaction hash of the prediction
 * @throws If the transaction fails or if the user has insufficient balance
 */
export const recordPredictionViaSwap = withErrorHandling(
  async (
    userAddress: Address,
    pool: Pool,
    marketId: bigint,
    outcome: number,
    stakeAmount: bigint
  ): Promise<Hash> => {

    const universalRouter = getContract(getIUniversalRouter, CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address);

    const { protocolFeeBasisPoints } = await getProtocolConfig();
    const totalETHNeeded = calculateTotalETHNeeded(stakeAmount, protocolFeeBasisPoints);

    // Extract token info directly from Pool object
    const token0 = getTokenFromCurrency(pool.currency0);
    const token1 = getTokenFromCurrency(pool.currency1);

    logInfo('PredictionSwap', `Token0: ${token0.symbol} (${token0.decimals} decimals)`);
    logInfo('PredictionSwap', `Token1: ${token1.symbol} (${token1.decimals} decimals)`);

    // Determine swap direction based on outcome
    const zeroForOne = outcome === OUTCOME_BEARISH;
    const inputToken = zeroForOne ? token0 : token1;
    const outputToken = zeroForOne ? token1 : token0;

    // Convert stake amount to input token's native decimals
    const inputAmount = convertToTokenDecimals(stakeAmount, inputToken.decimals);

    // Create hookData for the SwapCastHook
    const hookData = createPredictionHookData(userAddress, marketId, outcome, stakeAmount);

    logInfo('PredictionSwap', `Recording ${outcome === OUTCOME_BULLISH ? 'BULLISH' : 'BEARISH'} prediction`);
    logInfo('PredictionSwap', `Swap: ${formatUnits(inputAmount, inputToken.decimals)} ${inputToken.symbol} → ${outputToken.symbol}`);

    try {
      await impersonateAccount(userAddress);

      // Check balance
      const balance = await getPublicClient().getBalance({ address: userAddress });
      if (balance < totalETHNeeded) {
        throw new Error(`Insufficient balance. Need: ${totalETHNeeded}, Have: ${balance}`);
      }

      // Validate token balance
      const balanceCheck = await validateTokenBalance(userAddress, inputToken, inputAmount);
      if (!balanceCheck.valid) {
        throw new Error(`Insufficient ${inputToken.symbol}: ${balanceCheck.formatted}`);
      }

      // Handle token approvals if needed (for non-ETH tokens)
      if (!inputToken.isNative) {
        await approveToken(
          userAddress,
          inputToken.address,
          inputAmount,
          CONTRACT_ADDRESSES.UNIVERSAL_ROUTER as Address,
        );
      }

      // Step 1: Build PoolKey
      const poolKeyStruct = {
        currency0: pool.poolKey.currency0 as Address,
        currency1: pool.poolKey.currency1 as Address,
        fee: pool.poolKey.fee,
        tickSpacing: pool.poolKey.tickSpacing,
        hooks: pool.poolKey.hooks as Address
      };

      // Step 2: Single command
      const commands = encodePacked(['uint8'], [V4_SWAP_COMMAND]);

      // Step 3: Single action sequence
      const actions = encodePacked(
        ['uint8', 'uint8', 'uint8'],
        [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
      );

      // Step 4: Build parameters - but encode the ENTIRE ExactInputSingleParams as ONE struct
      const swapParams = encodeAbiParameters(
        [{
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
        }],
        [{
          poolKey: poolKeyStruct,
          zeroForOne: zeroForOne,
          amountIn: inputAmount,
          amountOutMinimum: BigInt(0),
          hookData: hookData
        }]
      );

      const settleParams = encodeAbiParameters(
        [{ name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' }],
        [inputToken.address, inputAmount]
      );

      const takeParams = encodeAbiParameters(
        [{ name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' }],
        [outputToken.address, BigInt(0)]
      );

      // Step 5: Combine everything
      const inputs = [
        encodeAbiParameters(
          [
            { name: 'actions', type: 'bytes' },
            { name: 'params', type: 'bytes[]' }
          ],
          [actions, [swapParams, settleParams, takeParams]]
        )
      ];
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);


      // Step 6: Execute with the same parameters
      const hash = await universalRouter.write.execute([commands, inputs, deadline], {
        account: userAddress,
        chain: anvil,
        value: totalETHNeeded,
        gas: 30000000n,
      });

      // Wait for confirmation
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

import {
    type Address,
    createPublicClient,
    encodeAbiParameters,
    encodePacked,
    erc20Abi,
    formatUnits,
    type Hash,
    http,
    keccak256
} from 'viem';
import {getPoolKey} from '$lib/services/market/operations';
import {getStateView} from '$generated/types/StateView';
import {getPoolManager} from '$generated/types/PoolManager';
import {getPredictionManager} from '$generated/types/PredictionManager';
import {getIUniversalRouter} from '$generated/types/IUniversalRouter';
import {getCurrentNetworkConfig} from '$lib/utils/network';
import {appKit} from '$lib/configs/wallet.config';
import {
    PUBLIC_PREDICTIONMANAGER_ADDRESS,
    PUBLIC_STATEVIEW_ADDRESS,
    PUBLIC_UNIV4_POOLMANAGER_ADDRESS,
    PUBLIC_UNIVERSAL_ROUTER_ADDRESS
} from '$env/static/public';
import type {PriceFetchResult, SwapQuoteResult} from './types';
import type {PoolKey} from '$lib/services/market/types';

/** Q96 constant used in Uniswap V4 price calculations */
const Q96 = 2n ** 96n;

/** Address representing native ETH in Uniswap V4 */
const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Cache for token decimal information to reduce RPC calls */
const decimalsCache = new Map<string, number>();

/** Universal Router command for V4 swaps */
const V4_SWAP_COMMAND = 0x10;

/** V4Router action for exact input single swaps */
const SWAP_EXACT_IN_SINGLE = 0x06;

/** V4Router action to settle all open positions */
const SETTLE_ALL = 0x0c;

/** V4Router action to take all available assets */
const TAKE_ALL = 0x0f;

/**
 * Prediction outcome types for market predictions.
 * @namespace PredictionTypes
 */
export namespace PredictionTypes {
    /**
     * Possible prediction outcomes.
     * @enum {number}
     */
    export enum Outcome {
        /** Prediction that the price will be below the target */
        BELOW_TARGET = 0,
        /** Prediction that the price will be above the target */
        ABOVE_TARGET = 1
    }
}

/**
 * Token information extracted from pool currencies.
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
 * Retrieves the number of decimals for a given token address.
 * Caches results to minimize RPC calls.
 *
 * @param {Address} address - The token contract address
 * @returns {Promise<number>} The number of decimals for the token (defaults to 18 for ETH or on error)
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
        const {rpcUrl, chain} = getCurrentNetworkConfig();
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
 * Calculates a unique pool ID based on pool key parameters.
 * This ID is used to identify pools in the Uniswap V4 PoolManager.
 *
 * @param {PoolKey} poolKey - The pool key containing token addresses, fee, and tick spacing
 * @returns {`0x${string}`} The keccak256 hash of the encoded pool parameters
 */
function calculatePoolId(poolKey: PoolKey): `0x${string}` {
    const encodedData = encodeAbiParameters(
        [
            {type: 'address'},
            {type: 'address'},
            {type: 'uint24'},
            {type: 'int24'},
            {type: 'address'}
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
 * Creates and returns a StateView contract instance for reading pool state.
 * @returns {ReturnType<typeof getStateView>} The StateView contract instance
 */
function getStateViewContract() {
    const {rpcUrl, chain} = getCurrentNetworkConfig();
    return getStateView({
        address: PUBLIC_STATEVIEW_ADDRESS as Address,
        chain,
        transport: http(rpcUrl)
    });
}

/**
 * Creates and returns a PoolManager contract instance.
 * @returns {ReturnType<typeof getPoolManager>} The PoolManager contract instance
 */
function getPoolManagerContract() {
    const {rpcUrl, chain} = getCurrentNetworkConfig();
    return getPoolManager({
        address: PUBLIC_UNIV4_POOLMANAGER_ADDRESS as Address,
        chain,
        transport: http(rpcUrl)
    });
}

/**
 * Creates and returns a PredictionManager contract instance for protocol configuration.
 * @returns {ReturnType<typeof getPredictionManager>} The PredictionManager contract instance
 */
function getPredictionManagerContract(): ReturnType<typeof getPredictionManager> {
    const {rpcUrl, chain} = getCurrentNetworkConfig();
    return getPredictionManager({
        address: PUBLIC_PREDICTIONMANAGER_ADDRESS as Address,
        chain,
        transport: http(rpcUrl)
    });
}

/**
 * Converts a sqrtPriceX96 value to its corresponding price.
 *
 * In Uniswap V4, prices are stored as sqrt(price) in Q64.96 fixed-point format.
 * This function converts that back to a regular price.
 *
 * @param {bigint} sqrtPriceX96 - The square root of the price in Q64.96 format
 * @returns {number} The calculated price as a floating point number
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
    if (sqrtPriceX96 === 0n) return 0;

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
 * Creates properly formatted hookData for the SwapCastHook.
 *
 * The hookData is packed as: [userAddress, marketId, outcome, stakeAmount]
 * This data is passed to the hook during swap execution to record the prediction.
 *
 * @param {Address} userAddress - The address of the user making the prediction
 * @param {bigint} marketId - The ID of the prediction market
 * @param {number} outcome - The predicted outcome (0 for bearish, 1 for bullish)
 * @param {bigint} stakeAmount - The amount being staked in wei (must fit in uint128)
 * @returns {`0x${string}`} Formatted hook data as a hex string
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

    console.log('HookData created:', hookData);
    return hookData;
}

/**
 * Calculates the total ETH amount needed for a prediction including protocol fees.
 *
 * @param {bigint} stakeAmount - The base stake amount in wei
 * @param {bigint} feeBasisPoints - Protocol fee in basis points (e.g., 200 = 2%)
 * @returns {bigint} Total ETH needed (stake + fees) in wei
 */
function calculateTotalETHNeeded(stakeAmount: bigint, feeBasisPoints: bigint): bigint {
    const MAX_BASIS_POINTS = 10000n;
    const fee = (stakeAmount * feeBasisPoints) / MAX_BASIS_POINTS;
    const total = stakeAmount + fee;

    console.log('ETH calculation:', {
        stake: stakeAmount.toString(),
        fee: fee.toString(),
        total: total.toString()
    });

    return total;
}

/**
 * Retrieves protocol configuration including fees and minimum stake amounts.
 * Falls back to default values if the contract call fails.
 *
 * @returns {Promise<{protocolFeeBasisPoints: bigint, minStakeAmount: bigint}>} Protocol configuration
 */
async function getProtocolConfig(): Promise<{ protocolFeeBasisPoints: bigint; minStakeAmount: bigint }> {
    try {
        const predictionManager = getPredictionManagerContract();
        const [protocolFeeBasisPoints, minStakeAmount] = await Promise.all([
            predictionManager.read.protocolFeeBasisPoints(),
            predictionManager.read.minStakeAmount()
        ]);
        return {protocolFeeBasisPoints, minStakeAmount};
    } catch (error) {
        console.warn('Failed to fetch protocol config, using defaults:', error);
        return {
            protocolFeeBasisPoints: 300n,
            minStakeAmount: BigInt('1000000000000000')
        };
    }
}

/**
 * Extracts token information from a pool currency address.
 * Handles both native ETH and ERC20 tokens, fetching actual decimals and symbols.
 *
 * @param {string} currency - The currency address from the pool
 * @param {PoolKey} poolKey - The pool key for context
 * @returns {Promise<TokenInfo>} Token information including address, symbol, decimals, and native status
 */
async function getTokenFromCurrency(currency: string, poolKey: PoolKey): Promise<TokenInfo> {
    const isNative = currency.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();

    if (isNative) {
        return {
            address: NATIVE_ETH_ADDRESS as Address,
            symbol: 'ETH',
            decimals: 18,
            isNative: true
        };
    }

    // Fetch actual token decimals
    const decimals = await getTokenDecimals(currency as Address);

    // For now, use generic symbol - could be enhanced to fetch actual symbol
    const isCurrency0 = currency.toLowerCase() === poolKey.currency0.toLowerCase();

    return {
        address: currency as Address,
        symbol: isCurrency0 ? 'TOKEN0' : 'TOKEN1', // Could fetch actual symbol here
        decimals,
        isNative: false
    };
}

/**
 * Validates that an address has sufficient ETH balance for a transaction.
 *
 * @param {Address} address - The address to check balance for
 * @param {bigint} requiredAmount - The minimum required ETH balance in wei
 * @throws {Error} If the address has insufficient ETH balance
 * @returns {Promise<void>}
 */
async function validateEthBalance(address: Address, requiredAmount: bigint): Promise<void> {
    const {rpcUrl, chain} = getCurrentNetworkConfig();
    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl)
    });

    const balance = await publicClient.getBalance({address});

    if (balance < requiredAmount) {
        throw new Error(
            `Insufficient ETH balance. Need ${formatUnits(requiredAmount, 18)} ETH, have ${formatUnits(balance, 18)} ETH`
        );
    }
}

/**
 * Fetches and calculates price information for a given market.
 *
 * This function retrieves the current pool state and calculates token prices
 * adjusted for decimal differences between the tokens.
 *
 * @param {string | bigint} marketId - The ID of the market to fetch prices for
 * @returns {Promise<PriceFetchResult>} Object containing price data or error information
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

        const token0Decimals = await getTokenDecimals(poolKey.currency0);
        const token1Decimals = await getTokenDecimals(poolKey.currency1);

        console.log('Token decimals:', {token0Decimals, token1Decimals});

        const rawPrice = sqrtPriceX96ToPrice(sqrtPriceX96);

        const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
        const adjustedPrice = rawPrice * decimalAdjustment;

        console.log('Price calculation breakdown:', {
            rawPrice,
            decimalAdjustment,
            adjustedPrice
        });

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
 * Gets a swap quote for trading between two tokens in a given market.
 *
 * This function calculates the expected output amount for a given input amount,
 * taking into account the current pool price and estimated fees.
 *
 * @param {string | bigint} marketId - The ID of the market to get a quote for
 * @param {Address} tokenIn - The address of the input token
 * @param {bigint} amountIn - The amount of input token in its smallest unit
 * @returns {Promise<SwapQuoteResult>} Object containing the swap quote or error information
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

        const {token0Price, token1Price, sqrtPriceX96} = priceResult.prices!;

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
        console.log('Pool prices:', {token0Price, token1Price});
        console.log('Token details:', {
            tokenIn,
            tokenOut,
            isToken0,
            tokenInDecimals,
            tokenOutDecimals
        });

        let exchangeRate: number;
        if (isToken0) {
            exchangeRate = token0Price;
            console.log(`Swapping token0 for token1, using token0Price: ${exchangeRate}`);
        } else {
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
 * Validates swap requirements including token balances and approvals.
 *
 * For ETH swaps: Validates that the user has enough ETH for both swap and prediction
 * For token swaps: Validates ETH balance for prediction and token balance/approval for swap
 *
 * @param {Address} address - The user's wallet address
 * @param {TokenInfo} inputToken - The input token details
 * @param {bigint} swapAmount - The amount of tokens to swap
 * @param {bigint} predictionETHNeeded - The amount of ETH needed for the prediction
 * @throws {Error} If validation fails due to insufficient balance or approval
 * @returns {Promise<void>}
 */
async function validateSwapRequirements(
    address: Address,
    inputToken: TokenInfo,
    swapAmount: bigint,
    predictionETHNeeded: bigint
): Promise<void> {
    // Validate that swap amount is not zero
    if (swapAmount === 0n) {
        throw new Error('Swap amount cannot be zero');
    }

    if (inputToken.symbol === 'ETH') {
        const totalETHNeeded = swapAmount + predictionETHNeeded;
        await validateEthBalance(address, totalETHNeeded);
    } else {
        await validateEthBalance(address, predictionETHNeeded);
        await validateTokenBalanceAndApproval(address, inputToken.address, swapAmount);
    }
}

/**
 * Validates token balance and approval for a given token and amount.
 *
 * @param {Address} userAddress - The user's wallet address
 * @param {Address} tokenAddress - The token contract address to validate
 * @param {bigint} amount - The amount to validate against balance and approval
 * @throws {Error} If token balance or approval is insufficient
 * @returns {Promise<void>}
 */
async function validateTokenBalanceAndApproval(
    userAddress: Address,
    tokenAddress: Address,
    amount: bigint
): Promise<void> {
    const {rpcUrl, chain} = getCurrentNetworkConfig();
    const publicClient = createPublicClient({chain, transport: http(rpcUrl)});

    const [balance, allowance] = await Promise.all([
        publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [userAddress]
        }),
        publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [userAddress, PUBLIC_UNIVERSAL_ROUTER_ADDRESS as Address]
        })
    ]);

    const decimals = await getTokenDecimals(tokenAddress);

    if (balance < amount) {
        throw new Error(
            `Insufficient token balance. Need ${formatUnits(amount, decimals)}, have ${formatUnits(balance, decimals)}`
        );
    }

    if (allowance < amount) {
        throw new Error(
            `Insufficient token approval. Please approve ${formatUnits(amount, decimals)} tokens.`
        );
    }
}

/**
 * Builds the necessary parameters for a Universal Router swap transaction.
 *
 * This function constructs the commands, actions, and parameters needed for
 * a Uniswap V4 swap through the Universal Router with hook data attached.
 *
 * @param {PoolKey} poolKey - The pool key containing token addresses and fee information
 * @param {boolean} zeroForOne - Whether to swap token0 for token1 (true) or token1 for token0 (false)
 * @param {bigint} swapAmount - The amount of input token to swap
 * @param {bigint} amountOutMinimum - The minimum amount of output token expected
 * @param {`0x${string}`} hookData - The encoded hook data for the prediction
 * @returns {{commands: `0x${string}`, actions: `0x${string}`, swapParams: `0x${string}`}} The encoded swap parameters
 */
function buildSwapParams(
    poolKey: PoolKey,
    zeroForOne: boolean,
    swapAmount: bigint,
    amountOutMinimum: bigint,
    hookData: `0x${string}`
): { commands: `0x${string}`; actions: `0x${string}`; swapParams: `0x${string}`; } {
    const poolKeyStruct = {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks
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
                    {name: 'currency0', type: 'address'},
                    {name: 'currency1', type: 'address'},
                    {name: 'fee', type: 'uint24'},
                    {name: 'tickSpacing', type: 'int24'},
                    {name: 'hooks', type: 'address'}
                ]
            },
            {name: 'zeroForOne', type: 'bool'},
            {name: 'amountIn', type: 'uint128'},
            {name: 'amountOutMinimum', type: 'uint128'},
            {name: 'hookData', type: 'bytes'}
        ]
    }], [{
        poolKey: poolKeyStruct,
        zeroForOne,
        amountIn: swapAmount,
        amountOutMinimum,
        hookData
    }]);

    return {commands, actions, swapParams};
}

/**
 * Calculates the total ETH value needed for the transaction.
 *
 * For ETH swaps: swap amount + prediction ETH needed
 * For token swaps: only prediction ETH needed (tokens handled via approval)
 *
 * @param {TokenInfo} inputToken - The input token details
 * @param {bigint} swapAmount - The amount of input token being swapped
 * @param {bigint} predictionETHNeeded - The amount of ETH needed for the prediction
 * @returns {bigint} The total ETH value required
 */
function calculateETHValue(
    inputToken: TokenInfo,
    swapAmount: bigint,
    predictionETHNeeded: bigint
): bigint {
    // Use symbol-based check instead of isNative flag
    const isETH = inputToken.symbol === 'ETH' ||
        inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();

    return isETH ? swapAmount + predictionETHNeeded : predictionETHNeeded;
}

/**
 * Executes a token swap with an attached price prediction through the Universal Router.
 *
 * This is the main function for executing swaps with predictions in the dApp.
 * It handles both ETH and ERC20 token swaps, validates all requirements,
 * and executes the transaction atomically.
 *
 * Flow:
 * 1. Validates user account and network configuration
 * 2. Fetches protocol configuration (fees, etc.)
 * 3. Determines input/output tokens and validates requirements
 * 4. Constructs Universal Router transaction with hook data
 * 5. Executes transaction and waits for confirmation
 *
 * @param {PoolKey} poolKey - The pool key containing token addresses and fee information
 * @param {boolean} zeroForOne - Whether to swap token0 for token1 (true) or token1 for token0 (false)
 * @param {bigint} amountIn - The amount of input token to swap
 * @param {bigint} amountOutMinimum - The minimum amount of output token expected
 * @param {bigint} marketId - The ID of the prediction market
 * @param {PredictionTypes.Outcome} outcome - The predicted outcome (ABOVE_TARGET or BELOW_TARGET)
 * @param {bigint} convictionStake - The amount of ETH to stake on the prediction
 * @returns {Promise<Hash>} The transaction hash of the executed swap
 * @throws {Error} If chain configuration is missing, no account is connected, or transaction fails
 * @example
 * const hash = await executeSwapWithPrediction(
 *   poolKey,
 *   true, // zeroForOne
 *   parseEther('1'), // 1 ETH
 *   0n, // amountOutMinimum
 *   123n, // marketId
 *   PredictionTypes.Outcome.ABOVE_TARGET,
 *   parseEther('0.1') // convictionStake
 * );
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
    if (!chain) throw new Error('Chain configuration not available');

    const address = appKit.getAccount()?.address;
    if (!address) throw new Error('No connected account found');

    const { protocolFeeBasisPoints } = await getProtocolConfig();
    const predictionETHNeeded = calculateTotalETHNeeded(convictionStake, protocolFeeBasisPoints);

    const token0Info = await getTokenFromCurrency(poolKey.currency0, poolKey);
    const token1Info = await getTokenFromCurrency(poolKey.currency1, poolKey);
    const inputToken = zeroForOne ? token0Info : token1Info;
    const outputToken = zeroForOne ? token1Info : token0Info;

    await validateSwapRequirements(address as Address, inputToken, amountIn, predictionETHNeeded);

    // Use 0 for amountOutMinimum to avoid slippage issues during testing
    // TODO: Calculate proper slippage protection
    const safeAmountOutMinimum = BigInt(0);

    const hookData = createPredictionHookData(address as Address, marketId, outcome, convictionStake);
    const { commands, actions, swapParams } = buildSwapParams(poolKey, zeroForOne, amountIn, safeAmountOutMinimum, hookData);

    const settleParams = encodeAbiParameters(
        [{ name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' }],
        [inputToken.address, amountIn]
    );

    const takeParams = encodeAbiParameters(
        [{ name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' }],
        [outputToken.address, BigInt(0)]
    );

    const inputs = [encodeAbiParameters(
        [{ name: 'actions', type: 'bytes' }, { name: 'params', type: 'bytes[]' }],
        [actions, [swapParams, settleParams, takeParams]]
    )];

    const totalETHValue = calculateETHValue(inputToken, amountIn, predictionETHNeeded);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

    try {
        const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
        const universalRouter = getIUniversalRouter({
            address: PUBLIC_UNIVERSAL_ROUTER_ADDRESS as Address,
            chain,
            transport: http(rpcUrl)
        });

        const hash = await universalRouter.write.execute([commands, inputs, deadline], {
            account: address as `0x${string}`,
            chain,
            value: totalETHValue,
            gas: 30000000n,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
            throw new Error(`Transaction failed with status ${receipt.status}`);
        }

        return hash;
    } catch (error: any) {
        if (error.message?.includes('user rejected')) {
            throw new Error('Transaction was rejected by the user.');
        }
        if (error.message?.includes('revert')) {
            throw new Error(`Transaction reverted: ${error.message}`);
        }
        throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
    }
}

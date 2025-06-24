<script lang="ts">
    import type {PredictionSide, Token} from '$lib/types';
    import type {Market} from '$lib/services/market';
    import {getMarketDetails} from '$lib/services/market';
    import {PUBLIC_PREDICTIONMANAGER_ADDRESS} from '$env/static/public';
    import TokenInput from '$lib/components/app/swap-panel/components/TokenInput.svelte';
    import PredictionSection from '$lib/components/app/swap-panel/components/PredictionSection.svelte';
    import ConfirmationModal from '$lib/components/app/swap-panel/components/ConfirmationModal.svelte';
    import HelpModal from '$lib/components/app/swap-panel/components/HelpModal.svelte';
    import {ArrowUpDown} from 'lucide-svelte';
    import {Spinner} from 'flowbite-svelte';
    import {getTokenBalance} from '$lib/services/balance';
    import {
        calculateExchangeRate,
        calculatePredictionStakeAmount,
        calculateReceiveAmount,
        executeSwapWithPrediction,
        fetchPoolPrices,
        getPrimaryError,
        isFormValid,
        validateSwapForm,
        verifyMarketExists
    } from '$lib/services/swap';
    import {type Address, createPublicClient, formatUnits, http, parseUnits} from 'viem';
    import {getPoolKey} from '$lib/services/market/operations';
    import {toastStore} from '$lib/stores/toastStore';
    import {appKit} from '$lib/configs/wallet.config';
    import {getCurrentNetworkConfig} from '$lib/utils/network';
    import {getPredictionManager} from '$generated/types/PredictionManager';
    import {getTokenAddress, getTokenDecimals, getTokenInfo} from '$lib/services/token/utils';
    import {goto} from '$app/navigation';

    let {
        marketId,
        onPredictionSelect,
        onMarketChange,
        disabled = false
    }: {
        marketId: string | null;
        onPredictionSelect?: (side: PredictionSide, targetPrice?: number) => void;
        onMarketChange?: (marketId: string) => void;
        disabled?: boolean;
    } = $props();

    const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

    let payAmount = $state(0);
    let receiveAmount = $state(0);
    let payToken = $state<Token>({symbol: 'ETH', name: 'Ethereum'});
    let receiveToken = $state<Token>({symbol: 'USDC', name: 'USD Coin'});
    let predictionSide = $state<PredictionSide>(undefined);
    let predictedTargetPrice = $state<number | undefined>(undefined);
    let showConfirmationModal = $state(false);
    let showHelpModal = $state(false);
    let isSubmitting = $state(false);

    // Market data state
    interface BaseMarketData {
        assetPair?: string;
        [key: string]: unknown;
    }

    interface MarketWithStakes extends BaseMarketData {
        totalStake0: bigint | number;
        totalStake1: bigint | number;
    }

    interface MarketWithConviction extends BaseMarketData {
        totalConvictionBullish: bigint | number;
        totalConvictionBearish: bigint | number;
    }

    type AnyMarketData = Market | MarketWithStakes | MarketWithConviction | null;

    let marketData = $state<AnyMarketData>(null);
    let isLoadingMarket = $state(false);
    let marketError = $state<string | null>(null);

    // Wallet connection state
    let connectedAddress = $state<string | null>(null);
    let isConnected = $state(false);

    // Token balances
    let payTokenBalance = $state(0);
    let receiveTokenBalance = $state(0);
    let isLoadingBalances = $state(false);

    // Pool and price state
    interface PoolPrices {
        token0Price?: number;
        token1Price?: number;
        fee?: number;
        sqrtPriceX96?: bigint;
        tick?: number;
        protocolFee?: number;
        lpFee?: number;
    }

    let poolPrices = $state<PoolPrices | null>(null);
    let isLoadingPrices = $state(false);
    let hasShownLiquidityWarning = $state(false);
    let priceError = $state<string | null>(null);

    // Market parameters
    let ethPrice = $state(2500);
    let networkFee = $state(0.002);
    let totalBullWeight = $state(0);
    let totalBearWeight = $state(0);
    let protocolFeeRate = $state(0.003);

    // Flag to prevent infinite updates - BETTER IMPLEMENTATION
    let isUpdatingReceiveAmount = $state(false);
    let updateReceiveAmountTimeout: ReturnType<typeof setTimeout> | null = null;

    // Debounced update function to prevent constant refreshing
    function scheduleReceiveAmountUpdate() {
        if (updateReceiveAmountTimeout) {
            clearTimeout(updateReceiveAmountTimeout);
        }
        updateReceiveAmountTimeout = setTimeout(() => {
            updateReceiveAmount();
        }, 300); // 300ms debounce
    }

    /**
     * Decode contract error messages from transaction failures
     */
    function decodeContractError(error: any): { title: string; message: string } {
        try {
            const errorMessage = error?.message || error?.toString() || '';
            const errorData = error?.cause?.data || error?.data;

            console.log('🔍 Decoding error:', {
                message: errorMessage,
                data: errorData,
                cause: error?.cause,
                shortMessage: error?.shortMessage
            });

            // Check for revert reason string first (most reliable)
            const revertMatch = errorMessage.match(/reverted with reason string '([^']+)'/);
            if (revertMatch) {
                const reason = revertMatch[1];
                return {
                    title: 'Contract Error',
                    message: reason
                };
            }

            // Check for custom error names
            const customErrorMatch = errorMessage.match(/reverted with custom error '([^']+)'/);
            if (customErrorMatch) {
                const errorName = customErrorMatch[1];
                return {
                    title: 'Contract Error',
                    message: formatCustomError(errorName)
                };
            }

            // Check for common user actions
            const lowerMessage = errorMessage.toLowerCase();
            if (lowerMessage.includes('user rejected') || lowerMessage.includes('user denied')) {
                return {
                    title: 'Transaction Cancelled',
                    message: 'You cancelled the transaction.'
                };
            }

            if (lowerMessage.includes('insufficient funds') || lowerMessage.includes('insufficient balance')) {
                return {
                    title: 'Insufficient Balance',
                    message: 'Not enough ETH to complete the transaction.'
                };
            }

            // Use shortMessage if available (viem provides good error messages)
            if (error?.shortMessage) {
                return {
                    title: 'Transaction Error',
                    message: error.shortMessage
                };
            }

            // Fallback to the raw message
            return {
                title: 'Transaction Failed',
                message: errorMessage || 'Unknown error occurred'
            };

        } catch (parseError) {
            console.error('Error parsing contract error:', parseError);
            return {
                title: 'Error Processing Failed',
                message: error?.message || 'Unknown error occurred'
            };
        }
    }

    /**
     * Format known custom error names to user-friendly messages
     */
    function formatCustomError(errorName: string): string {
        const customErrors: Record<string, string> = {
            'AlreadyPredicted': 'You have already made a prediction for this market. Each wallet can only predict once per market.',
            'MarketDoesNotExist': 'This prediction market does not exist on-chain.',
            'MarketAlreadyResolved': 'This market has already been resolved and no longer accepts predictions.',
            'MarketExpired': 'This market has expired and no longer accepts new predictions.',
            'InsufficientConvictionStake': 'The prediction stake amount is too low.',
            'InvalidOutcome': 'Invalid prediction outcome specified.',
            'InvalidHookDataLength': 'Invalid transaction data format.',
            'NoConvictionStakeDeclaredInHookData': 'No prediction stake was declared in the transaction.',
            'Unauthorized': 'You are not authorized to perform this action.',
            'Paused': 'The contract is currently paused.'
        };

        return customErrors[errorName] || `Contract error: ${errorName}`;
    }

    /**
     * Monitor wallet connection status
     */
    $effect(() => {
        let mounted = true;

        const checkConnection = () => {
            if (!mounted) return;

            const account = appKit.getAccount();
            const newAddress = account?.address || null;
            const connected = appKit.getIsConnectedState();

            if (newAddress !== connectedAddress || connected !== isConnected) {
                connectedAddress = newAddress;
                isConnected = connected && !!newAddress;
            }
        };

        checkConnection();
        const interval = setInterval(checkConnection, 2000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    });

    /**
     * Fetch token balances for the connected wallet
     */
    async function fetchBalances() {
        if (!isConnected || !connectedAddress || !payToken?.symbol || !receiveToken?.symbol) {
            payTokenBalance = 0;
            receiveTokenBalance = 0;
            return;
        }

        isLoadingBalances = true;

        try {
            const [payBalance, receiveBalance] = await Promise.all([
                getTokenBalance(connectedAddress, payToken.symbol),
                getTokenBalance(connectedAddress, receiveToken.symbol)
            ]);

            payTokenBalance = payBalance;
            receiveTokenBalance = receiveBalance;
        } catch (error) {
            console.error('Failed to fetch balances:', error);
            payTokenBalance = 0;
            receiveTokenBalance = 0;
        } finally {
            isLoadingBalances = false;
        }
    }

    /**
     * React to wallet connection changes
     */
    $effect(() => {
        if (!isConnected || !connectedAddress) {
            payTokenBalance = 0;
            receiveTokenBalance = 0;
            return;
        }

        fetchBalances();
    });

    /**
     * Fetch market data when marketId changes - FIXED TOKEN HANDLING
     */
    $effect(() => {
        if (!marketId) {
            marketData = null;
            return;
        }

        const fetchMarketData = async () => {
            isLoadingMarket = true;
            marketError = null;

            try {
                console.log('🔍 Fetching market data for ID:', marketId);
                const result = await getMarketDetails(marketId);
                console.log('🔍 Market data result:', result);

                if (!result) {
                    throw new Error('No market data returned');
                }

                // Reset values first
                totalBullWeight = 0;
                totalBearWeight = 0;
                marketData = result;

                try {
                    const market = result as any;

                    if ('totalStake1' in market && 'totalStake0' in market) {
                        totalBullWeight = Number(market.totalStake1 || 0n) / 1e18;
                        totalBearWeight = Number(market.totalStake0 || 0n) / 1e18;
                        console.log('🔍 Using Market type - Bull:', totalBullWeight, 'Bear:', totalBearWeight);
                    } else if ('totalConvictionBullish' in market && 'totalConvictionBearish' in market) {
                        totalBullWeight = Number(market.totalConvictionBullish || 0n);
                        totalBearWeight = Number(market.totalConvictionBearish || 0n);
                        console.log(
                            '🔍 Using MarketDetailsResult type - Bull:',
                            totalBullWeight,
                            'Bear:',
                            totalBearWeight
                        );
                    } else {
                        console.warn(
                            '⚠️ Market data does not contain expected stake fields:',
                            Object.keys(market)
                        );
                    }
                } catch (error) {
                    console.error('❌ Error processing market data:', error);
                    totalBullWeight = 0;
                    totalBearWeight = 0;
                }

                // FIXED: Get actual tokens from pool key instead of parsing asset pair
                try {
                    const poolKey = await getPoolKey(marketId);
                    if (poolKey) {
                        console.log('🔍 Pool key currencies:', {
                            currency0: poolKey.currency0,
                            currency1: poolKey.currency1
                        });

                        // Get token info dynamically from contracts - NO HARDCODING
                        const [token0Info, token1Info] = await Promise.all([
                            getTokenInfo(poolKey.currency0),
                            getTokenInfo(poolKey.currency1)
                        ]);

                        console.log('🔍 Token info from contracts:', {
                            token0: token0Info,
                            token1: token1Info
                        });

                        // Set tokens based on actual contract data
                        payToken = {
                            symbol: token0Info.symbol,
                            name: token0Info.symbol,
                            balance: payTokenBalance
                        };
                        receiveToken = {
                            symbol: token1Info.symbol,
                            name: token1Info.symbol,
                            balance: receiveTokenBalance
                        };

                        console.log('🔍 Set tokens from pool contracts:', {
                            payToken: payToken.symbol,
                            receiveToken: receiveToken.symbol
                        });
                    } else {
                        throw new Error('Could not get pool key for market');
                    }
                } catch (poolError) {
                    console.error('❌ Failed to get pool tokens, falling back to asset pair:', poolError);

                    // Fallback to parsing asset pair
                    const assetPair = (marketData as any)?.assetPair;
                    console.log('🔍 Fallback to asset pair:', assetPair);

                    if (assetPair && typeof assetPair === 'string' && assetPair.includes('/')) {
                        const [baseSymbol, quoteSymbol] = assetPair.split('/');

                        if (baseSymbol && quoteSymbol) {
                            payToken = {
                                symbol: baseSymbol.trim(),
                                name: baseSymbol.trim(),
                                balance: payTokenBalance
                            };
                            receiveToken = {
                                symbol: quoteSymbol.trim(),
                                name: quoteSymbol.trim(),
                                balance: receiveTokenBalance
                            };
                            console.log('🔍 Set tokens from asset pair:', {
                                payToken: payToken.symbol,
                                receiveToken: receiveToken.symbol
                            });
                        }
                    } else {
                        console.error('❌ Invalid asset pair format:', assetPair);
                        // Final fallback
                        payToken = {symbol: 'ETH', name: 'Ethereum', balance: payTokenBalance};
                        receiveToken = {symbol: 'USDC', name: 'USD Coin', balance: receiveTokenBalance};
                        console.log('🔍 Using default tokens ETH/USDC');
                    }
                }
            } catch (error) {
                console.error('❌ Failed to fetch market data:', error);
                marketError = error instanceof Error ? error.message : 'Failed to load market data';
                marketData = null;
                totalBullWeight = 0;
                totalBearWeight = 0;
            } finally {
                isLoadingMarket = false;
            }
        };

        fetchMarketData();
    });

    /**
     * Fetch pool prices when market data changes
     */
    $effect(() => {
        if (!marketId || !marketData) {
            poolPrices = null;
            return;
        }

        const fetchPrices = async () => {
            isLoadingPrices = true;
            priceError = null;

            try {
                const result = await fetchPoolPrices(marketId);

                if (result.success && result.prices) {
                    poolPrices = result.prices;

                    if (poolPrices.sqrtPriceX96 === 0n && !hasShownLiquidityWarning) {
                        toastStore.warning('This pool has no liquidity. Swap quotes may not be accurate.', {
                            duration: 6000,
                            position: 'top-center'
                        });
                        hasShownLiquidityWarning = true;
                    }

                    // Schedule receive amount update with debounce to prevent constant refreshing
                    if (!isUpdatingReceiveAmount) {
                        scheduleReceiveAmountUpdate();
                    }
                } else {
                    priceError = result.error || 'Failed to fetch pool prices';
                    console.error('Failed to fetch pool prices:', priceError);
                }
            } catch (error) {
                console.error('Error fetching pool prices:', error);
                priceError = error instanceof Error ? error.message : 'Unknown error';
            } finally {
                isLoadingPrices = false;
            }
        };

        fetchPrices();
    });

    /**
     * Calculate exchange rate between pay and receive tokens
     */
    let exchangeRate = $derived(() => {
        return calculateExchangeRate(poolPrices, marketData?.assetPair, payToken, receiveToken);
    });

    let displayExchangeRate = $derived(() => {
        const rate = exchangeRate();
        return rate > 0 ? rate.toFixed(6) : '0.000000';
    });

    /**
     * Calculate prediction stake amount (1% of pay amount, minimum 0.001 ETH)
     */
    let predictionStakeAmount = $derived(() => {
        return calculatePredictionStakeAmount(payAmount);
    });

    let marketName = $derived((): string => {
        if (!marketData) return 'Unknown Market';

        if (marketData && 'name' in marketData && typeof marketData.name === 'string') {
            return marketData.name;
        } else if (
            marketData &&
            'description' in marketData &&
            typeof marketData.description === 'string'
        ) {
            return marketData.description;
        }

        return 'Unknown Market';
    });

    /**
     * Validate form inputs - PROPERLY FIXED VALIDATION
     */
    let validationErrors = $derived(() => {
        const errors: string[] = [];

        if (!isConnected) {
            errors.push('Connect your wallet to continue');
            return errors;
        }

        if (!marketData) {
            errors.push('Please select a market');
            return errors;
        }

        if (disabled) {
            errors.push('Trading is currently disabled');
            return errors;
        }

        // Only check amount if we have a number > 0
        if (!payAmount || payAmount <= 0) {
            errors.push('Enter an amount to swap');
            return errors;
        }

        // Only check balance if we have tokens and a connected wallet
        if (payToken?.symbol && payTokenBalance > 0 && payAmount > payTokenBalance) {
            errors.push(`Insufficient ${payToken.symbol} balance`);
        }

        // Only check prediction if amount is valid
        if (!predictionSide) {
            errors.push('Select a price prediction (Up or Down)');
        }

        // Only check target price if prediction side is selected
        if (predictionSide && (!predictedTargetPrice || predictedTargetPrice <= 0)) {
            errors.push('Enter a target price for your prediction');
        }

        return errors;
    });

    // Cache validation results to prevent constant recalculation
    let formValid = $derived(() => {
        const errors = validationErrors();
        return errors.length === 0;
    });

    let primaryError = $derived(() => {
        const errors = validationErrors();
        return errors.length > 0 ? errors[0] : null;
    });

    let isSubmitEnabled = $derived(() => {
        return formValid() && !isSubmitting && !disabled;
    });

    function handleTokenSwap() {
        // Store current values
        const tempToken = payToken;
        const tempBalance = payTokenBalance;

        // Swap tokens
        payToken = receiveToken;
        receiveToken = tempToken;

        // Reset amounts - let user enter new amount
        payAmount = 0;
        receiveAmount = 0;

        // Swap balances
        payTokenBalance = receiveTokenBalance;
        receiveTokenBalance = tempBalance;

        console.log('🔄 Tokens swapped:', {
            newPayToken: payToken.symbol,
            newReceiveToken: receiveToken.symbol
        });
    }

    function handlePredictionSelect(side: PredictionSide, targetPrice?: number) {
        predictionSide = side;
        if (targetPrice !== undefined) {
            predictedTargetPrice = targetPrice;
        }
        onPredictionSelect?.(side, targetPrice);
    }

    /**
     * Execute the swap and prediction transaction -
     */
    async function executeSwapAndPredict() {
        if (!formValid) {
            console.error('Form is not valid:', validationErrors());
            return;
        }

        if (!marketId) {
            toastStore.error('No market ID available. Please select a market.');
            return;
        }

        const marketExists = await verifyMarketExists(marketId);
        if (!marketExists) {
            toastStore.error(
                `Market with ID ${marketId} does not exist on-chain. Please select a different market.`
            );
            return;
        }

        if (!marketData || !payToken || !receiveToken || !predictionSide || !predictedTargetPrice) {
            toastStore.error('Missing required data for swap execution');
            return;
        }

        isSubmitting = true;

        try {
            const poolKey = await getPoolKey(marketId);
            if (!poolKey) {
                throw new Error(`Could not get pool key for market ${marketId}`);
            }

            const actualPayTokenAddress = getTokenAddress(payToken.symbol);
            const actualReceiveTokenAddress = getTokenAddress(receiveToken.symbol);

            const payTokenDecimals = await getTokenDecimals(actualPayTokenAddress);
            const receiveTokenDecimals = await getTokenDecimals(actualReceiveTokenAddress);

            // FIXED: Determine swap direction correctly
            const isPayTokenCurrency0 =
                actualPayTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase();
            const isPayTokenCurrency1 =
                actualPayTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase();

            // Validate that pay token is actually in the pool
            if (!isPayTokenCurrency0 && !isPayTokenCurrency1) {
                throw new Error(
                    `Pay token ${payToken.symbol} (${actualPayTokenAddress}) is not in pool. Pool has ${poolKey.currency0} and ${poolKey.currency1}`
                );
            }

            // zeroForOne means: swapping token0 for token1
            const zeroForOne = isPayTokenCurrency0;

            console.log('🔄 Swap direction:', {
                payToken: payToken.symbol,
                payTokenAddress: actualPayTokenAddress,
                receiveToken: receiveToken.symbol,
                receiveTokenAddress: actualReceiveTokenAddress,
                poolCurrency0: poolKey.currency0,
                poolCurrency1: poolKey.currency1,
                isPayTokenCurrency0,
                zeroForOne,
                swapDescription: zeroForOne ? 'token0 → token1' : 'token1 → token0'
            });

            // Validate token pair matches pool
            const isValidPair =
                (actualPayTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase() &&
                    actualReceiveTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase()) ||
                (actualPayTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase() &&
                    actualReceiveTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase());

            if (!isValidPair) {
                const errorMsg = `Token pair mismatch: trying to swap ${payToken.symbol}→${receiveToken.symbol} but pool is ${poolKey.currency0}/${poolKey.currency1}`;
                throw new Error(errorMsg);
            }

            const amountIn = parseUnits(payAmount.toString(), payTokenDecimals);

            const slippage = 0.005;
            const amountOutMinimum = parseUnits(
                (receiveAmount * (1 - slippage)).toString(),
                receiveTokenDecimals
            );

            // Map prediction side to outcome
            const outcome = predictionSide === 'above_target' ? 1 : 0;

            const convictionStakeWei = parseUnits(predictionStakeAmount().toString(), 18);

            // Validate ETH balance
            if (connectedAddress) {
                const {rpcUrl, chain} = getCurrentNetworkConfig();
                const publicClient = createPublicClient({
                    chain,
                    transport: http(rpcUrl)
                });

                const balance = await publicClient.getBalance({
                    address: connectedAddress as `0x${string}`
                });

                const predictionManager = getPredictionManager({
                    address: PUBLIC_PREDICTIONMANAGER_ADDRESS as Address,
                    chain,
                    transport: http(rpcUrl)
                });
                const protocolFeeBps = await predictionManager.read.protocolFeeBasisPoints();
                const protocolFee = (convictionStakeWei * protocolFeeBps) / 10000n;
                const totalRequired = convictionStakeWei + protocolFee;

                if (balance < totalRequired) {
                    throw new Error(
                        `Insufficient ETH for prediction. Need ${formatUnits(totalRequired, 18)} ETH, have ${formatUnits(balance, 18)} ETH`
                    );
                }
            }

            try {
                let marketIdBigInt: bigint;
                if (marketId) {
                    marketIdBigInt = BigInt(marketId);
                } else if (marketData && 'id' in marketData && marketData.id != null) {
                    marketIdBigInt = BigInt(String(marketData.id));
                } else if (
                    marketData &&
                    'marketId' in marketData &&
                    typeof marketData.marketId === 'bigint'
                ) {
                    marketIdBigInt = marketData.marketId;
                } else {
                    throw new Error('Could not determine market ID');
                }

                console.log('🚀 Executing swap with prediction:', {
                    poolKey,
                    zeroForOne,
                    amountIn: amountIn.toString(),
                    amountOutMinimum: amountOutMinimum.toString(),
                    marketId: marketIdBigInt.toString(),
                    outcome,
                    convictionStake: convictionStakeWei.toString()
                });

                const txHash = await executeSwapWithPrediction(
                    poolKey,
                    zeroForOne,
                    amountIn,
                    amountOutMinimum,
                    marketIdBigInt,
                    outcome,
                    convictionStakeWei
                );
                const {rpcUrl, chain} = getCurrentNetworkConfig();
                const publicClient = createPublicClient({
                    chain,
                    transport: http(rpcUrl)
                });
                const receipt = await publicClient.waitForTransactionReceipt({hash: txHash});

                if (receipt.status === 'success') {
                    // Show detailed success message
                    toastStore.success(
                        `Successfully swapped ${payAmount.toFixed(4)} ${payToken.symbol} for ${receiveAmount.toFixed(4)} ${receiveToken.symbol} and predicted ${predictionSide === 'above_target' ? 'BULLISH' : 'BEARISH'} with ${predictionStakeAmount().toFixed(6)} ETH stake!`,
                        {
                            duration: 8000,
                            position: 'top-center',
                        }
                    );
                } else {
                    toastStore.error(`Transaction failed with status: ${receipt.status}`, {
                        duration: 8000,
                        position: 'top-center'
                    });
                }

                // Refresh data after successful transaction
                try {
                    await fetchBalances();

                    if (marketId) {
                        marketData = await getMarketDetails(marketId);
                    }

                    if (marketId) {
                        const result = await fetchPoolPrices(marketId);
                        if (result.success && result.prices) {
                            poolPrices = result.prices;
                        }
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh data after swap:', refreshError);
                }

                // Reset form
                payAmount = 0;
                receiveAmount = 0;
                predictionSide = undefined;
                predictedTargetPrice = undefined;

            } catch (error) {
                console.error('Transaction execution failed:', error);

                // Use the contract error decoder
                const {message} = decodeContractError(error);

                toastStore.error(message, {
                    duration: 10000,
                    position: 'top-center',
                });
            }
        } catch (error) {
            console.error('Failed to execute swap and prediction:', error);

            const {message} = decodeContractError(error);

            toastStore.error(message, {
                duration: 10000,
                position: 'top-center',
            });
        } finally {
            isSubmitting = false;
            showConfirmationModal = false;
            setTimeout(() => {
                goto('/my-predictions');
            }, 100);
        }
    }

    function handlePayAmountChange(amount: number) {
        payAmount = amount;
        // Debounced update to prevent constant refreshing while typing
        scheduleReceiveAmountUpdate();
    }

    function handleReceiveAmountChange(amount: number) {
        receiveAmount = amount;
    }

    /**
     * Update the receive amount - SIMPLIFIED to prevent constant updates
     */
    async function updateReceiveAmount(): Promise<void> {
        if (isUpdatingReceiveAmount || payAmount <= 0 || !marketId || !payToken?.symbol) {
            if (payAmount <= 0) receiveAmount = 0;
            return;
        }

        isUpdatingReceiveAmount = true;

        try {
            if (!poolPrices) {
                const rate = exchangeRate();
                receiveAmount = payAmount * rate;
                return;
            }

            const result = await calculateReceiveAmount(
                marketId,
                marketData,
                payAmount,
                payToken,
                poolPrices
            );

            if (result !== null) {
                receiveAmount = result;
            } else {
                const rate = exchangeRate();
                receiveAmount = payAmount * rate;
            }
        } catch (error) {
            console.error('Error updating receive amount:', error);
            const rate = exchangeRate();
            receiveAmount = payAmount * rate;
        } finally {
            isUpdatingReceiveAmount = false;
        }
    }

    function handleConnectWallet() {
        appKit.open();
    }

    function handleRefreshBalances() {
        if (connectedAddress && payToken?.symbol && receiveToken?.symbol) {
            isLoadingBalances = true;

            Promise.all([
                getTokenBalance(connectedAddress, payToken.symbol),
                getTokenBalance(connectedAddress, receiveToken.symbol)
            ])
                .then(([payBalance, receiveBalance]) => {
                    payTokenBalance = payBalance;
                    receiveTokenBalance = receiveBalance;
                })
                .catch((error) => {
                    console.error('Failed to refresh balances:', error);
                })
                .finally(() => {
                    isLoadingBalances = false;
                });
        }
    }
</script>

<div class="flex justify-center">
    <div class="w-[480px] rounded-2xl border border-gray-200 bg-white shadow-sm {disabled ? 'opacity-60' : ''}">
        <div class="border-b border-gray-100 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Swap & Predict</h2>
            <p class="text-sm text-gray-500">Trade tokens and make price predictions</p>
        </div>

        <div class="space-y-4 p-6 flex flex-col items-center">
            {#if !isConnected}
                <div class="py-8 text-center">
                    <div class="mb-4">
                        <div
                                class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"
                        >
                            <svg
                                    class="h-6 w-6 text-blue-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                            >
                                <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                    </div>
                    <h3 class="mb-2 text-lg font-medium text-gray-900">Connect Your Wallet</h3>
                    <p class="mb-4 text-sm text-gray-500">
                        Connect your wallet to view balances and start trading
                    </p>
                    <button
                            onclick={handleConnectWallet}
                            class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        Connect Wallet
                    </button>
                </div>
            {:else}
                <div class="space-y-4 w-full max-w-[400px]">
                    <TokenInput
                            label="You pay"
                            amount={payAmount}
                            token={{ ...payToken, balance: payTokenBalance }}
                            onAmountChange={handlePayAmountChange}
                            {disabled}
                            showBalance={true}
                            {ethPrice}
                            isLoadingBalance={isLoadingBalances}
                            onRefreshBalance={handleRefreshBalances}
                    />

                    <div class="relative z-10 -my-2 flex justify-center">
                        <button
                                onclick={handleTokenSwap}
                                class="flex h-12 w-12 items-center justify-center rounded-full border-4 border-gray-100 bg-white text-gray-600 shadow-lg transition-all hover:border-gray-200 hover:bg-gray-50 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                                {disabled}
                                title="Swap tokens"
                        >
                            <ArrowUpDown size={20}/>
                        </button>
                    </div>

                    <TokenInput
                            label="You receive"
                            amount={receiveAmount}
                            token={{ ...receiveToken, balance: receiveTokenBalance }}
                            onAmountChange={handleReceiveAmountChange}
                            readOnly={true}
                            {disabled}
                            showExchangeRate={true}
                            exchangeRate={displayExchangeRate()}
                            fromTokenSymbol={payToken?.symbol}
                            toTokenSymbol={receiveToken?.symbol}
                            isLoadingBalance={isLoadingBalances}
                            onRefreshBalance={handleRefreshBalances}
                    />
                </div>

                <!-- CENTERED PREDICTION SECTION -->
                <div class="w-full max-w-[400px]">
                    <PredictionSection
                            {predictionSide}
                            predictionStakeAmount={predictionStakeAmount()}
                            {payToken}
                            {payAmount}
                            {ethPrice}
                            {totalBullWeight}
                            {totalBearWeight}
                            {protocolFeeRate}
                            {predictedTargetPrice}
                            onPredictionSelect={handlePredictionSelect}
                            onTargetPriceChange={(price) => (predictedTargetPrice = price)}
                            onHelpClick={() => (showHelpModal = true)}
                    />
                </div>

                <div class="space-y-3 w-full max-w-[400px]">
                    {#if validationErrors().length > 0}
                        <div class="space-y-2">
                            {#each validationErrors() as error, i}
                                <div
                                        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                >
                                    <div class="flex items-start gap-2">
                                        <svg
                                                class="mt-0.5 h-5 w-5 flex-shrink-0"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                        >
                                            <path
                                                    fill-rule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clip-rule="evenodd"
                                            />
                                        </svg>
                                        <div>
                                            <span class="font-medium">{error}</span>
                                            {#if error.includes('Connect your wallet')}
                                                <div class="mt-1">
                                                    <button
                                                            onclick={handleConnectWallet}
                                                            class="text-red-600 hover:text-red-700 underline text-sm"
                                                    >
                                                        Click here to connect
                                                    </button>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                                {#if i === 0 && validationErrors().length > 1}
                                    <div class="px-2 text-xs text-gray-500">
                                        + {validationErrors().length - 1} more issue{validationErrors().length > 2
                                        ? 's'
                                        : ''} to resolve
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}

                    <button
                            type="button"
                            onclick={() => {
                                // Only open modal if form is actually valid
                                if (isSubmitEnabled()) {
                                    showConfirmationModal = true;
                                }
                            }}
                            class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:from-gray-400 disabled:to-gray-500 disabled:hover:from-gray-400 disabled:hover:to-gray-500"
                            disabled={!isSubmitEnabled()}
                            title={!isSubmitEnabled() ? (primaryError() || 'Please complete all required fields') : 'Swap & Predict'}
                    >
                        {#if isSubmitting}
                            <div class="flex items-center justify-center gap-2">
                                <Spinner size="4" color="blue"/>
                                <span>Processing...</span>
                            </div>
                        {:else}
                            Swap & Predict
                        {/if}
                    </button>

                    {#if marketError}
                        <div class="mt-2 text-center text-sm text-red-500">
                            {marketError}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>

<ConfirmationModal
        bind:open={showConfirmationModal}
        {payAmount}
        {payToken}
        {receiveAmount}
        {receiveToken}
        predictionSide={predictionSide ?? undefined}
        {predictedTargetPrice}
        predictionStakeAmount={predictionStakeAmount()}
        {networkFee}
        marketName={marketName() ?? 'Unknown Market'}
        {totalBullWeight}
        {totalBearWeight}
        {protocolFeeRate}
        onConfirm={executeSwapAndPredict}
        onClose={() => (showConfirmationModal = false)}
        {isSubmitting}
        displayExchangeRate={displayExchangeRate()}
/>

<HelpModal
        bind:open={showHelpModal}
        onClose={() => (showHelpModal = false)}
        {ethPrice}
        payTokenSymbol={payToken?.symbol}
/>

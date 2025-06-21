<script lang="ts">
    import type {PredictionSide, Token} from '$lib/types';
    import type {Market, MarketDetailsResult} from '$lib/services/market';
    import {getMarketDetails} from '$lib/services/market';
    import { PUBLIC_PREDICTIONMANAGER_ADDRESS } from '$env/static/public';
    import TokenInput from '$lib/components/app/swap-panel/components/TokenInput.svelte';
    import PredictionSection from '$lib/components/app/swap-panel/components/PredictionSection.svelte';
    import ConfirmationModal from '$lib/components/app/swap-panel/components/ConfirmationModal.svelte';
    import HelpModal from '$lib/components/app/swap-panel/components/HelpModal.svelte';
    import {ArrowUpDown} from 'lucide-svelte';
    import {Spinner} from 'flowbite-svelte';
    import {getTokenBalance} from "$lib/services/balance";
    import { executeSwapWithPrediction, verifyMarketExists, calculatePredictionStakeAmount, calculateReceiveAmount, calculateExchangeRate } from '$lib/services/swap';
    import { validateSwapForm, isFormValid, getPrimaryError } from '$lib/services/swap';
    import { parseUnits, createPublicClient, http, formatUnits, type Address } from 'viem';
    import { fetchPoolPrices } from '$lib/services/swap';
    import { getPoolKey } from '$lib/services/market/operations';
    import { toastStore } from '$lib/stores/toastStore';
    import { appKit } from '$lib/configs/wallet.config';
    import { getCurrentNetworkConfig } from '$lib/utils/network';
    import { getPredictionManager } from '$generated/types/PredictionManager';
    import { getTokenDecimals, getTokenAddress } from '$lib/services/token';

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
    let receiveToken = $state<Token>({symbol: 'USDT', name: 'Tether'});
    let predictionSide = $state<PredictionSide>(undefined);
    let predictedTargetPrice = $state<number | undefined>(undefined);
    let showConfirmationModal = $state(false);
    let showHelpModal = $state(false);
    let isSubmitting = $state(false);
    let isSubmitEnabled = $derived(() => isFormValid(validationErrors()) && !isSubmitting);
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
     * Fetch market data when marketId changes - IMPROVED ERROR HANDLING
     */
    // Log important state changes
    function logState() {
        const marketDataToLog = (() => {
            if (!marketData) return null;
            const base = {
                assetPair: marketData.assetPair,
                raw: marketData
            };
            return 'priceThreshold' in marketData 
                ? { ...base, priceThreshold: marketData.priceThreshold }
                : base;
        })();

        console.log('🔍 Market data updated:', {
            marketId,
            marketData: marketDataToLog,
            poolPrices: poolPrices ? {
                token0Price: poolPrices.token0Price,
                token1Price: poolPrices.token1Price,
                fee: poolPrices.fee,
                sqrtPriceX96: poolPrices.sqrtPriceX96?.toString(),
                tick: poolPrices.tick,
                protocolFee: poolPrices.protocolFee,
                lpFee: poolPrices.lpFee
            } : null,
            tokens: {
                pay: payToken?.symbol,
                receive: receiveToken?.symbol,
                payBalance: payTokenBalance,
                receiveBalance: receiveTokenBalance
            },
            amounts: {
                pay: payAmount,
                receive: receiveAmount,
                exchangeRate: exchangeRate(),
                displayExchangeRate: displayExchangeRate()
            },
            prediction: {
                side: predictionSide,
                targetPrice: predictedTargetPrice,
                stakeAmount: predictionStakeAmount()
            },
            validation: validationErrors(),
            isFormValid: formValid,
            primaryError: primaryError()
        });
    }

    // Log state when important dependencies change
    $effect(() => {
        logState();
    });

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
                    // Handle both Market and MarketDetailsResult types with type assertions
                    const market = result as any; // Temporary type assertion to handle both types
                    
                    if ('totalStake1' in market && 'totalStake0' in market) {
                        // Handle Market type
                        totalBullWeight = Number(market.totalStake1 || 0n) / 1e18;
                        totalBearWeight = Number(market.totalStake0 || 0n) / 1e18;
                        console.log('🔍 Using Market type - Bull:', totalBullWeight, 'Bear:', totalBearWeight);
                    } else if ('totalConvictionBullish' in market && 'totalConvictionBearish' in market) {
                        // Handle MarketDetailsResult type
                        totalBullWeight = Number(market.totalConvictionBullish || 0n);
                        totalBearWeight = Number(market.totalConvictionBearish || 0n);
                        console.log('🔍 Using MarketDetailsResult type - Bull:', totalBullWeight, 'Bear:', totalBearWeight);
                    } else {
                        console.warn('⚠️ Market data does not contain expected stake fields:', Object.keys(market));
                    }
                } catch (error) {
                    console.error('❌ Error processing market data:', error);
                    totalBullWeight = 0;
                    totalBearWeight = 0;
                }

                // Handle token pair setup with proper null checks
                const assetPair = (marketData as any)?.assetPair;
                console.log('🔍 Processing asset pair:', assetPair);
                
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
                        console.log('🔍 Set tokens from market pair:', { 
                            payToken: payToken.symbol, 
                            receiveToken: receiveToken.symbol 
                        });
                    }
                } else {
                    console.error('❌ Invalid asset pair format:', assetPair);
                    console.error('Expected format like "BTC/USDT", got:', assetPair);
                    // Fallback to default
                    payToken = {symbol: 'ETH', name: 'Ethereum', balance: payTokenBalance};
                    receiveToken = {symbol: 'USDT', name: 'Tether', balance: receiveTokenBalance};
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

                    updateReceiveAmount();
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
        
        // Handle both Market and MarketDetailsResult types
        if (marketData && 'name' in marketData && typeof marketData.name === 'string') {
            return marketData.name;
        } else if (marketData && 'description' in marketData && typeof marketData.description === 'string') {
            return marketData.description;
        }
        
        return 'Unknown Market';
    });

    /**
     * Validate form inputs
     */
    let validationErrors = $derived(() => {
        return validateSwapForm({
            isConnected,
            marketData,
            disabled,
            payAmount,
            payToken,
            payTokenBalance,
            predictionSide,
            predictedTargetPrice,
            receiveAmount,
            receiveToken,
            exchangeRate: exchangeRate()
        });
    });

    /**
     * Determine if the form is valid based on validation errors
     */
    let formValid = $derived(() => isFormValid(validationErrors()));

    /**
     * Get the primary error to display to the user
     */
    let primaryError = $derived(() => getPrimaryError(validationErrors()));

    function handleTokenSwap() {
        const tempToken = payToken;
        const tempAmount = payAmount;
        const tempBalance = payTokenBalance;

        payToken = receiveToken;
        receiveToken = tempToken;
        payAmount = receiveAmount;
        receiveAmount = tempAmount;
        payTokenBalance = receiveTokenBalance;
        receiveTokenBalance = tempBalance;
    }

    function handlePredictionSelect(side: PredictionSide, targetPrice?: number) {
        predictionSide = side;
        if (targetPrice !== undefined) {
            predictedTargetPrice = targetPrice;
        }
        onPredictionSelect?.(side, targetPrice);
    }

    /**
     * Execute the swap and prediction transaction
     */
    async function executeSwapAndPredict() {
        // Early validation checks
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
            toastStore.error(`Market with ID ${marketId} does not exist on-chain. Please select a different market.`);
            return;
        }

        if (!marketData) {
            toastStore.error('Market data is not available');
            return;
        }
        
        if (!payToken || !receiveToken) {
            toastStore.error('Token information is missing');
            return;
        }
        
        if (!predictionSide || !predictedTargetPrice) {
            toastStore.error('Prediction details are missing');
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

            const isPayTokenCurrency0 = actualPayTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase();
            const zeroForOne = isPayTokenCurrency0;

            const isValidPair = (
                (actualPayTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase() &&
                    actualReceiveTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase()) ||
                (actualPayTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase() &&
                    actualReceiveTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase())
            );

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

            const outcome = predictionSide === 'above_target' ? 1 : 0;

            const convictionStakeWei = parseUnits(predictionStakeAmount().toString(), 18);

            if (connectedAddress) {
                const { rpcUrl, chain } = getCurrentNetworkConfig();
                const publicClient = createPublicClient({
                    chain,
                    transport: http(rpcUrl)
                });

                const balance = await publicClient.getBalance({ address: connectedAddress as `0x${string}` });

                const predictionManager = getPredictionManager({
                    address: PUBLIC_PREDICTIONMANAGER_ADDRESS as Address,
                    chain,
                    transport: http(rpcUrl)
                });
                const protocolFeeBps = await predictionManager.read.protocolFeeBasisPoints();
                const protocolFee = (convictionStakeWei * protocolFeeBps) / 10000n;
                const totalRequired = convictionStakeWei + protocolFee;

                if (balance < totalRequired) {
                    throw new Error(`Insufficient ETH for prediction. Need ${formatUnits(totalRequired, 18)} ETH, have ${formatUnits(balance, 18)} ETH`);
                }
            }

            try {
                // Handle both Market and MarketDetailsResult types
                let marketIdBigInt: bigint;
                if (marketId) {
                    marketIdBigInt = BigInt(marketId);
                } else if (marketData && 'id' in marketData && marketData.id != null) {
                    marketIdBigInt = BigInt(String(marketData.id));
                } else if (marketData && 'marketId' in marketData && typeof marketData.marketId === 'bigint') {
                    marketIdBigInt = marketData.marketId;
                } else {
                    throw new Error('Could not determine market ID');
                }
                
                const txHash = await executeSwapWithPrediction(
                    poolKey,
                    zeroForOne,
                    amountIn,
                    amountOutMinimum,
                    marketIdBigInt,
                    outcome,
                    convictionStakeWei
                );

                toastStore.success('Swap and prediction executed successfully!', {
                    duration: 5000
                });

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

                showConfirmationModal = false;
                payAmount = 0;
                receiveAmount = 0;
                predictionSide = undefined;
                predictedTargetPrice = undefined;

            } catch (error) {
                const txError = error as Error;
                console.error('Transaction execution failed:', txError);

                let errorMessage = '';
                if (txError.message?.includes('InvalidHookDataLength')) {
                    errorMessage = 'Transaction failed: Invalid hook data format. Please try again.';
                } else if (txError.message?.includes('NoConvictionStakeDeclaredInHookData')) {
                    errorMessage = 'Transaction failed: No prediction stake declared. Please set a prediction amount.';
                } else if (txError.message?.includes('MarketDoesNotExist')) {
                    errorMessage = 'Transaction failed: This prediction market does not exist.';
                } else if (txError.message?.includes('MarketAlreadyResolved')) {
                    errorMessage = 'Transaction failed: This market has already been resolved.';
                } else if (txError.message?.includes('MarketExpired')) {
                    errorMessage = 'Transaction failed: This market has expired and no longer accepts predictions.';
                } else if (txError.message?.includes('user rejected')) {
                    errorMessage = 'Transaction was cancelled by the user.';
                } else if (txError.message?.includes('insufficient funds')) {
                    errorMessage = 'Transaction failed: Insufficient ETH balance.';
                } else if (txError.message?.includes('Insufficient ETH')) {
                    errorMessage = txError.message;
                } else {
                    errorMessage = `Transaction failed: ${txError.message || 'Unknown error'}`;
                }

                toastStore.error(errorMessage, {
                    duration: 8000,
                    position: 'top-center'
                });
            }
        } catch (error) {
            console.error('Failed to execute swap and prediction:', error);
            toastStore.error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`, {
                duration: 8000
            });
        } finally {
            isSubmitting = false;
        }
    }

    function handlePayAmountChange(amount: number) {
        payAmount = amount;
        updateReceiveAmount();
    }

    function handleReceiveAmountChange(amount: number) {
        receiveAmount = amount;
    }

    /**
     * Update the receive amount based on the pay amount and pool prices
     */
    async function updateReceiveAmount(): Promise<void> {
        if (payAmount <= 0 || !marketId || !payToken?.symbol) {
            receiveAmount = 0;
            return;
        }

        if (!poolPrices) {
            const rate = exchangeRate();
            receiveAmount = payAmount * rate;
            return;
        }

        try {
            // Use the utility function to calculate receive amount
            const result = await calculateReceiveAmount(
                marketId, 
                marketData, // Pass marketData as the second parameter
                payAmount, 
                payToken, 
                poolPrices
            );
            
            if (result !== null) {
                receiveAmount = result;
            } else {
                receiveAmount = 0;
                console.error('Failed to get swap quote');
            }
        } catch (error) {
            console.error('Error updating receive amount:', error);
            const rate = exchangeRate();
            receiveAmount = payAmount * rate;
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
            ]).then(([payBalance, receiveBalance]) => {
                payTokenBalance = payBalance;
                receiveTokenBalance = receiveBalance;
            }).catch(error => {
                console.error('Failed to refresh balances:', error);
            }).finally(() => {
                isLoadingBalances = false;
            });
        }
    }
</script>

<div class="space-y-6">
    <div class="rounded-2xl border border-gray-200 bg-white shadow-sm {disabled ? 'opacity-60' : ''}">
        <div class="border-b border-gray-100 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Swap & Predict</h2>
            <p class="text-sm text-gray-500">Trade tokens and make price predictions</p>
        </div>

        <div class="space-y-6 p-6">
            {#if !isConnected}
                <div class="text-center py-8">
                    <div class="mb-4">
                        <div class="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                        </div>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
                    <p class="text-sm text-gray-500 mb-4">Connect your wallet to view balances and start trading</p>
                    <button
                            onclick={handleConnectWallet}
                            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Connect Wallet
                    </button>
                </div>
            {:else}
                <div class="space-y-4">
                    <TokenInput
                            label="You pay"
                            amount={payAmount}
                            token={{...payToken, balance: payTokenBalance}}
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
                            token={{...receiveToken, balance: receiveTokenBalance}}
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

                <div class="space-y-3">
                    {#if validationErrors().length > 0}
                        <div class="space-y-2">
                            {#each validationErrors() as error, i}
                                <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                                    <div class="flex items-start gap-2">
                                        <svg class="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                        </svg>
                                        <span class="font-medium">{error}</span>
                                    </div>
                                </div>
                                {#if i === 0 && validationErrors().length > 1}
                                    <div class="text-xs text-gray-500 px-2">
                                        + {validationErrors().length - 1} more issue{validationErrors().length > 2 ? 's' : ''} to resolve
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}

                    <button
                            type="button"
                            onclick={() => (showConfirmationModal = true)}
                            class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!formValid || isSubmitting}
                            title={primaryError() || 'Swap & Predict'}
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
        totalBullWeight={totalBullWeight}
        totalBearWeight={totalBearWeight}
        protocolFeeRate={protocolFeeRate}
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
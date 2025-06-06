<script lang="ts">
    import type {PredictionSide, Token} from '$lib/types';
    import type {Market} from '$lib/services/market';
    import {getMarketDetails} from '$lib/services/market';
    import TokenInput from '$lib/components/app/swap-panel/components/TokenInput.svelte';
    import PredictionSection from '$lib/components/app/swap-panel/components/PredictionSection.svelte';
    import ConfirmationModal from '$lib/components/app/swap-panel/components/ConfirmationModal.svelte';
    import HelpModal from '$lib/components/app/swap-panel/components/HelpModal.svelte';
    import {ArrowUpDown} from 'lucide-svelte';
    import {Spinner} from 'flowbite-svelte';
    import {getTokenBalance} from "$lib/services/balance";
    import { executeSwapWithPrediction } from '$lib/services/swap/universalRouter';
    import { parseUnits } from 'viem';
    import { fetchPoolPrices, getSwapQuote } from '$lib/services/swap';
    import { getPoolKey } from '$lib/services/market/operations';
    import { toastStore } from '$lib/stores/toastStore';
	import { appKit } from '$lib/configs/wallet.config';

    // Props
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

    // Internal state
    let payAmount = $state(0);
    let receiveAmount = $state(0);
    let payToken = $state<Token>({symbol: 'ETH', name: 'Ethereum'});
    let receiveToken = $state<Token>({symbol: 'USDC', name: 'USD Coin'});
    let predictionSide = $state<PredictionSide>(undefined);
    let predictedTargetPrice = $state<number | undefined>(undefined);
    let showConfirmationModal = $state(false);
    let showHelpModal = $state(false);
    let isSubmitting = $state(false);

    // Market data
    let marketData = $state<Market | null>(null);
    let isLoadingMarket = $state(false);
    let marketError = $state<string | null>(null);

    // Wallet connection state
    let connectedAddress = $state<string | null>(null);
    let isConnected = $state(false);

    // Token balances
    let payTokenBalance = $state(0);
    let receiveTokenBalance = $state(0);
    let isLoadingBalances = $state(false);

    // Pool pricing state
    let poolPrices = $state<any>(null);
    let isLoadingPrices = $state(false);
    let hasShownLiquidityWarning = $state(false);
    let priceError = $state<string | null>(null);

    // Mock data for development
    let ethPrice = $state(2500);
    let networkFee = $state(0.002);
    let totalBullWeight = $state(0);
    let totalBearWeight = $state(0);
    let protocolFeeRate = $state(0.003);

    // Check wallet connection status
    $effect(() => {
        const checkConnection = () => {
            const account = appKit.getAccount();
            const newAddress = account?.address || null;
            const connected = appKit.getIsConnectedState();

            connectedAddress = newAddress;
            isConnected = connected && !!newAddress;

            console.log('Wallet status:', { connected, newAddress, isConnected });
        };

        checkConnection();
        // Listen for connection changes if available
        const interval = setInterval(checkConnection, 1000);
        return () => clearInterval(interval);
    });

    // Fetch balances when wallet connects or tokens change
    $effect(() => {
        const fetchBalances = async () => {
            if (!isConnected || !connectedAddress || !payToken?.symbol || !receiveToken?.symbol) {
                console.log('Skipping balance fetch:', { isConnected, connectedAddress, payToken: payToken?.symbol, receiveToken: receiveToken?.symbol });
                payTokenBalance = 0;
                receiveTokenBalance = 0;
                return;
            }

            isLoadingBalances = true;
            console.log('Fetching balances for:', payToken.symbol, receiveToken.symbol);

            try {
                const [payBalance, receiveBalance] = await Promise.all([
                    getTokenBalance(connectedAddress, payToken.symbol),
                    getTokenBalance(connectedAddress, receiveToken.symbol)
                ]);

                payTokenBalance = payBalance;
                receiveTokenBalance = receiveBalance;

                console.log('Balances fetched:', { payBalance, receiveBalance });
            } catch (error) {
                console.error('Failed to fetch balances:', error);
                payTokenBalance = 0;
                receiveTokenBalance = 0;
            } finally {
                isLoadingBalances = false;
            }
        };

        fetchBalances();
    });

    // Fetch market data when marketId changes
    $effect(() => {
        if (!marketId) {
            marketData = null;
            return;
        }

        const fetchMarketData = async () => {
            isLoadingMarket = true;
            marketError = null;

            try {
                marketData = await getMarketDetails(marketId);

                // Update internal state based on market data
                totalBullWeight = Number(marketData?.totalStake1 || 0) / 1e18;
                totalBearWeight = Number(marketData?.totalStake0 || 0) / 1e18;

                // Set default tokens based on market asset pair
                if (marketData?.assetPair) {
                    const [baseSymbol, quoteSymbol] = marketData.assetPair.split('/');
                    payToken = {
                        symbol: baseSymbol,
                        name: baseSymbol,
                        balance: payTokenBalance // Set current balance
                    };
                    receiveToken = {
                        symbol: quoteSymbol,
                        name: quoteSymbol,
                        balance: receiveTokenBalance // Set current balance
                    };
                }
            } catch (error) {
                console.error('Failed to fetch market data:', error);
                marketError = 'Failed to load market data';
                marketData = null;
            } finally {
                isLoadingMarket = false;
            }
        };

        fetchMarketData();
    });

    // Fetch pool prices when market data changes
    $effect(() => {
        if (!marketId || !marketData) {
            poolPrices = null;
            return;
        }

        const fetchPrices = async () => {
            isLoadingPrices = true;
            priceError = null;

            try {
                console.log(`Fetching pool prices for marketId: ${marketId}`);
                const result = await fetchPoolPrices(marketId);

                if (result.success && result.prices) {
                    poolPrices = result.prices;
                    console.log('Pool prices received:', poolPrices);

                    // Check if the pool has no liquidity (sqrtPriceX96 is 0)
                    if (poolPrices.sqrtPriceX96 === 0n && !hasShownLiquidityWarning) {
                        toastStore.warning('This pool has no liquidity. Swap quotes may not be accurate.', {
                            duration: 6000,
                            position: 'top-center'
                        });
                        hasShownLiquidityWarning = true;
                    }

                    // Update exchange rate based on real pool prices
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

    // Real exchange rate calculation based on pool prices
    let exchangeRate = $derived(() => {
        if (!poolPrices || payAmount === 0) return 0;

        // Use the correct price based on which token is being paid
        if (payToken?.symbol === marketData?.assetPair?.split('/')[0]) {
            return poolPrices.token0Price;
        } else {
            return poolPrices.token1Price;
        }
    });

    let displayExchangeRate = $derived(() => {
        const rate = exchangeRate();
        return rate > 0 ? rate.toFixed(6) : '0.000000';
    });

    // FIXED: Use 1% instead of 10% for prediction stake
    let predictionStakeAmount = $derived(() => {
        // 1% of pay amount, minimum 0.001 ETH (not 0.01)
        return Math.max(0.001, payAmount * 0.01);
    });

    let marketName = $derived(() => {
        return marketData?.name || 'Unknown Market';
    });

    // FIXED: Comprehensive validation - only validate pay amount, not receive
    let validationErrors = $derived(() => {
        const errors: string[] = [];

        if (!isConnected) {
            errors.push('Please connect your wallet');
        }

        if (!marketData) {
            errors.push('Market data not available');
        }

        if (disabled) {
            errors.push('Trading is currently disabled');
        }

        if (payAmount <= 0) {
            errors.push('Enter an amount to pay');
        } else {
            // Only check balance for PAY token, not receive token
            if (payToken?.symbol && isConnected) {
                if (payTokenBalance === 0) {
                    errors.push(`No ${payToken.symbol} balance available`);
                } else if (payAmount > payTokenBalance) {
                    // FIXED: Use floor for display consistency
                    const flooredBalance = Math.floor(payTokenBalance * 1000000) / 1000000;
                    const flooredAmount = Math.floor(payAmount * 1000000) / 1000000;
                    errors.push(`Insufficient ${payToken.symbol} balance (need ${flooredAmount.toFixed(6)}, have ${flooredBalance.toFixed(6)})`);
                }
            }
        }

        // Don't validate receive amount - it's calculated automatically

        if (!predictionSide) {
            errors.push('Select a price prediction');
        }

        if (!predictedTargetPrice || predictedTargetPrice <= 0) {
            errors.push('Enter a target price');
        }

        return errors;
    });

    let isFormValid = $derived(() => {
        return validationErrors().length === 0;
    });

    let primaryError = $derived(() => {
        return validationErrors().length > 0 ? validationErrors()[0] : '';
    });

    // Event handlers
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

    async function executeSwapAndPredict() {
        if (!isFormValid()) return;

        isSubmitting = true;
        try {
            if (!marketData || !payToken || !receiveToken || !predictionSide || !predictedTargetPrice) {
                throw new Error('Missing required parameters for swap and prediction');
            }

            // Get the pool key for the swap using the market ID
            const poolKey = await getPoolKey(marketData.id);
            if (!poolKey) {
                throw new Error('Failed to get pool key');
            }

            // Determine swap direction (zeroForOne)
            // Default to true if address is undefined
            const zeroForOne = poolKey.currency0.toLowerCase() === (payToken?.address?.toLowerCase() || poolKey.currency0.toLowerCase());

            // Convert amounts to bigint with proper decimals
            const amountIn = parseUnits(
                payAmount.toString(),
                payToken?.decimals || 18
            );
            
            // Calculate minimum amount out (with 0.5% slippage)
            const slippage = 0.005; // 0.5%
            const amountOutMinimum = parseUnits(
                (receiveAmount * (1 - slippage)).toString(),
                receiveToken?.decimals || 18
            );

            // Map prediction side to outcome
            // Convert from PredictionSide type to numeric outcome
            const outcome = predictionSide === 'above_target' ? 1 : 0;

            // Calculate conviction stake (for now, use a fixed amount)
            const convictionStake = parseUnits('0.01', 18); // 0.01 ETH

            // Execute the swap with prediction
            const txHash = await executeSwapWithPrediction(
                poolKey,
                zeroForOne,
                amountIn,
                amountOutMinimum,
                BigInt(marketData.id),
                outcome,
                convictionStake
            );

            // Show success message
            toastStore.success('Swap and prediction executed successfully!');

            // Reset form
            showConfirmationModal = false;
            payAmount = 0;
            receiveAmount = 0;
            predictionSide = undefined;
            predictedTargetPrice = undefined;
        } catch (error) {
            console.error('Failed to execute swap and prediction:', error);
            toastStore.error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        // Calculate pay amount based on exchange rate
        const isBaseToken = payToken?.symbol === 'ETH' || payToken?.symbol === 'BTC';
        const isStablecoin = ['USDC', 'DAI', 'USDT'].includes(payToken?.symbol || '');
        const otherIsBaseToken = receiveToken?.symbol === 'ETH' || receiveToken?.symbol === 'BTC';
        const otherIsStablecoin = ['USDC', 'DAI', 'USDT'].includes(receiveToken?.symbol || '');

        if (isBaseToken && otherIsStablecoin) {
            // Base token to stablecoin: divide by base token price
            const price = payToken?.symbol === 'ETH' ? ethPrice : 45000; // Use ethPrice for ETH, mock price for BTC
            payAmount = price > 0 ? amount / price : 0;
        } else if (isStablecoin && otherIsBaseToken) {
            // Stablecoin to base token: multiply by base token price
            const price = receiveToken?.symbol === 'ETH' ? ethPrice : 45000; // Use ethPrice for ETH, mock price for BTC
            payAmount = amount * price;
        } else {
            // Default 1:1 for other token pairs
            payAmount = amount;
        }
    }

    /**
     * Updates the receive amount based on the pay amount and real pool prices
     * Uses the swap service to calculate accurate swap amounts
     */
    async function updateReceiveAmount(): Promise<void> {
        if (payAmount <= 0 || !marketId || !payToken?.symbol) {
            receiveAmount = 0;
            return;
        }

        // Track if we've already shown a zero liquidity warning in this function
        let hasShownZeroLiquidityWarning = false;

        // Early return if we don't have pool prices yet
        if (!poolPrices) {
            console.log('Pool prices not available yet, using simple calculation');
            // Fallback to simple calculation
            receiveAmount = payAmount * (exchangeRate() || 0);
            return;
        }

        try {
            // Convert payAmount to bigint (assuming 18 decimals)
            const amountBigInt = BigInt(Math.floor(payAmount * 10**18));

            // Get token addresses from market data
            // Make sure we have market data
            if (!marketData) {
                console.error('Market data not available');
                return;
            }

            // Get the market data from the contract
            const [baseSymbol, quoteSymbol] = marketData.assetPair.split('/');

            // Determine which token is being paid
            const isToken0 = payToken.symbol === baseSymbol;

            // Get the pool key to access the actual token addresses
            const poolKey = await getPoolKey(marketId);
            if (!poolKey) {
                throw new Error('Failed to get pool key for market');
            }

            // Use the correct token address from the pool key
            const tokenInAddress = isToken0 ? poolKey.currency0 : poolKey.currency1;

            // Log the token information for debugging
            console.log('Using token addresses for swap quote:', {
                isBaseToken: isToken0,
                baseSymbol,
                quoteSymbol,
                tokenInAddress,
                poolKey
            });

            // Get swap quote from service
            const quoteResult = await getSwapQuote(marketId, tokenInAddress, amountBigInt);

            if (quoteResult.success && quoteResult.quote) {
                // Convert the output amount from bigint to number
                receiveAmount = Number(quoteResult.quote.amountOut) / 10**18;
                console.log('Swap quote received:', quoteResult.quote);
            } else {
                console.error('Failed to get swap quote:', quoteResult.error);

                // Check for zero liquidity error
                if (quoteResult.error === 'ZERO_LIQUIDITY_POOL' && !hasShownZeroLiquidityWarning) {
                    toastStore.warning(quoteResult.details || 'This pool has no liquidity. Swap quotes may not be accurate.', {
                        duration: 6000,
                        position: 'top-center'
                    });
                    hasShownZeroLiquidityWarning = true;
                }

                // Fallback to simple calculation
                receiveAmount = payAmount * (exchangeRate() || 0);
            }
        } catch (error) {
            console.error('Error updating receive amount:', error);
            // Fallback to simple calculation
            receiveAmount = payAmount * (exchangeRate() || 0);
        }
    }

    function handleConnectWallet() {
        appKit.open();
    }

    function handleRefreshBalances() {
        // Trigger balance refetch by clearing and refetching
        if (connectedAddress && payToken?.symbol && receiveToken?.symbol) {
            console.log('Manually refreshing balances');
            isLoadingBalances = true;

            Promise.all([
                getTokenBalance(connectedAddress, payToken.symbol),
                getTokenBalance(connectedAddress, receiveToken.symbol)
            ]).then(([payBalance, receiveBalance]) => {
                payTokenBalance = payBalance;
                receiveTokenBalance = receiveBalance;
                console.log('Balances refreshed:', { payBalance, receiveBalance });
            }).catch(error => {
                console.error('Failed to refresh balances:', error);
            }).finally(() => {
                isLoadingBalances = false;
            });
        }
    }
</script>

<div class="space-y-6">
    <!-- Main Swap Card -->
    <div class="rounded-2xl border border-gray-200 bg-white shadow-sm {disabled ? 'opacity-60' : ''}">
        <!-- Header -->
        <div class="border-b border-gray-100 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Swap & Predict</h2>
            <p class="text-sm text-gray-500">Trade tokens and make price predictions</p>
        </div>

        <div class="space-y-6 p-6">
            {#if !isConnected}
                <!-- Wallet Connection Required -->
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
                <!-- Swap Interface -->
                <div class="space-y-4">
                    <!-- You Pay Section -->
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

                    <!-- Swap Button -->
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

                    <!-- You Receive Section -->
                    <TokenInput
                            label="You receive"
                            amount={receiveAmount}
                            token={{...receiveToken, balance: receiveTokenBalance}}
                            onAmountChange={handleReceiveAmountChange}
                            readOnly={false}
                            {disabled}
                            showExchangeRate={true}
                            exchangeRate={displayExchangeRate()}
                            fromTokenSymbol={payToken?.symbol}
                            toTokenSymbol={receiveToken?.symbol}
                            isLoadingBalance={isLoadingBalances}
                            onRefreshBalance={handleRefreshBalances}
                    />
                </div>

                <!-- Prediction Section -->
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

                <!-- Action Buttons -->
                <div class="space-y-3">
                    <!-- Error Messages (show before button) -->
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
                                <!-- Show count of additional errors -->
                                {#if i === 0 && validationErrors().length > 1}
                                    <div class="text-xs text-gray-500 px-2">
                                        + {validationErrors().length - 1} more issue{validationErrors().length > 2 ? 's' : ''} to resolve
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}

                    <button
                            onclick={() => (showConfirmationModal = true)}
                            class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!isFormValid()}
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

<!-- Modals -->
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
        marketName={marketName()}
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

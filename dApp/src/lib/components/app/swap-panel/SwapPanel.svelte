<script lang="ts">
    import type { PredictionSide, Token } from '$lib/types';
    import type { Market } from '$lib/services/market/types';
    import { getTokenBySymbol, getTokenLogoUrl } from '$lib/services/token/operations';
    import { getMarketDetails } from '$lib/services/market/contracts';
    import { getPoolKey } from '$lib/services/market/operations';
    import { clearBalanceCache, getTokenBalance } from '$lib/services/balance/operations';
    import { ArrowUpDown, RefreshCw } from 'lucide-svelte';
    import { Spinner } from 'flowbite-svelte';
    import { appKit } from '$lib/configs/wallet.config';
    import TokenInput from './TokenInput.svelte';
    import PredictionSection from '$lib/components/app/swap-panel/PredictionSection.svelte';
    import ConfirmationModal from '$lib/components/app/swap-panel/ConfirmationModal.svelte';
    import HelpModal from '$lib/components/app/swap-panel/HelpModal.svelte';
    import { fetchPoolPrices, getSwapQuote } from '$lib/services/swap';
    import { toastStore } from '$lib/stores/toastStore';

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
    // Initialize with generic placeholder tokens until market data loads
    // Using empty placeholders to avoid any hardcoded token references
    let payToken = $state<Token>({symbol: '', name: 'Loading...'});
    let receiveToken = $state<Token>({symbol: '', name: 'Loading...'});
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
    let isConnected = $state(appKit.getIsConnectedState());

    // Token balances
    let payTokenBalance = $state(0);
    let receiveTokenBalance = $state(0);
    let isLoadingBalances = $state(false);

    // Mock data for development
    let ethPrice = $state(2500);
    let networkFee = $state(0.002);
    let totalBullWeight = $state(0);
    let totalBearWeight = $state(0);
    let protocolFeeRate = $state(0.003);

    // Check wallet connection status on component initialization
    $effect(() => {
        const account = appKit.getAccount();
        const newAddress = account?.address || null;
        
        // If address changed, clear the balance cache for the old address
        if (connectedAddress && newAddress !== connectedAddress) {
            console.log('Wallet address changed, clearing balance cache');
            clearBalanceCache(connectedAddress);
        }
        
        connectedAddress = newAddress;
        isConnected = !!connectedAddress;
        console.log('Wallet connection status:', { isConnected, connectedAddress });
    });

    // Fetch balances when tokens change or wallet connects
    $effect(() => {
        // Early return if not connected or tokens not set
        if (!isConnected) {
            console.log('Not connected, skipping balance fetch');
            return;
        }
        
        if (!payToken?.symbol || !receiveToken?.symbol) {
            console.log('Tokens not set yet, skipping balance fetch');
            return;
        }
        
        const fetchBalances = async () => {
            // Get the connected address
            const account = appKit.getAccount();
            connectedAddress = account?.address || null;
            
            if (!connectedAddress) {
                console.error('No connected address found');
                return;
            }

            isLoadingBalances = true;
            
            // Clear any cached balances to ensure fresh data
            await clearBalanceCache();
            
            try {
                console.log(`Fetching balances for tokens: ${payToken.symbol}, ${receiveToken.symbol}`);
                
                // Fetch pay token balance
                let payBalance = 0;
                try {
                    payBalance = await getTokenBalance(connectedAddress, payToken.symbol);
                    console.log(`Successfully fetched ${payToken.symbol} balance: ${payBalance}`);
                } catch (payError) {
                    console.error(`Error fetching ${payToken.symbol} balance:`, payError);
                }
                
                // Fetch receive token balance
                let receiveBalance = 0;
                try {
                    receiveBalance = await getTokenBalance(connectedAddress, receiveToken.symbol);
                    console.log(`Successfully fetched ${receiveToken.symbol} balance: ${receiveBalance}`);
                } catch (receiveError) {
                    console.error(`Error fetching ${receiveToken.symbol} balance:`, receiveError);
                }

                console.log('Balances received:', { payBalance, receiveBalance });
                payTokenBalance = payBalance;
                receiveTokenBalance = receiveBalance;
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
                console.log(`Fetching market details for marketId: ${marketId}`);
                marketData = await getMarketDetails(marketId);
                console.log('Market data received:', marketData);

                // Update internal state based on market data
                totalBullWeight = Number(marketData?.totalStake1 || 0) / 1e18;
                totalBearWeight = Number(marketData?.totalStake0 || 0) / 1e18;

                // Set tokens based on market asset pair - ONLY use the exact tokens from the market
                if (marketData?.assetPair) {
                    console.log(`Processing asset pair: ${marketData.assetPair}`);
                    
                    // Ensure we have a valid asset pair with both tokens
                    if (!marketData.assetPair.includes('/')) {
                        const error = `Invalid asset pair format: ${marketData.assetPair}. Must be in format 'BASE/QUOTE'`;
                        console.error(error);
                        throw new Error(error);
                    }
                    
                    const [baseSymbol, quoteSymbol] = marketData.assetPair.split('/');
                    console.log(`Extracted symbols - Base: ${baseSymbol}, Quote: ${quoteSymbol}`);
                    
                    if (!baseSymbol || !quoteSymbol) {
                        const error = `Invalid asset pair: ${marketData.assetPair}. Missing base or quote symbol`;
                        console.error(error);
                        throw new Error(error);
                    }
                    
                    // Initialize basic token objects first with synchronous logo assignment
                    payToken = {
                        symbol: baseSymbol,
                        name: baseSymbol,
                        logoURI: getTokenLogoUrl(baseSymbol, true) // Use synchronous version with fallback
                    };
                    
                    receiveToken = {
                        symbol: quoteSymbol,
                        name: quoteSymbol,
                        logoURI: getTokenLogoUrl(quoteSymbol, true) // Use synchronous version with fallback
                    };
                    
                    console.log('Initial tokens set from market asset pair:', { 
                        assetPair: marketData.assetPair,
                        payToken,
                        receiveToken
                    });
                    
                    // Then fetch complete token details asynchronously
                    const fetchTokenDetails = async () => {
                        try {
                            // Fetch both tokens in parallel
                            const [payTokenDetails, receiveTokenDetails] = await Promise.all([
                                getTokenBySymbol(baseSymbol),
                                getTokenBySymbol(quoteSymbol)
                            ]);
                            
                            // Update tokens with additional details if available
                            if (payTokenDetails) {
                                payToken = { 
                                    ...payToken, 
                                    name: payTokenDetails.name || baseSymbol,
                                    logoURI: payTokenDetails.logoURI || payToken.logoURI,
                                    chainId: payTokenDetails.chainId
                                };
                            }
                            
                            if (receiveTokenDetails) {
                                receiveToken = { 
                                    ...receiveToken, 
                                    name: receiveTokenDetails.name || quoteSymbol,
                                    logoURI: receiveTokenDetails.logoURI || receiveToken.logoURI,
                                    chainId: receiveTokenDetails.chainId
                                };
                            }
                            
                            console.log('Updated tokens with full details:', {
                                payToken,
                                receiveToken
                            });
                            
                            // Fetch token balances after setting tokens
                            if (isConnected && payToken && connectedAddress) {
                                payToken.balance = await getTokenBalance(payToken.symbol, connectedAddress);
                            }
                            if (isConnected && receiveToken && connectedAddress) {
                                receiveToken.balance = await getTokenBalance(receiveToken.symbol, connectedAddress);
                            }
                        } catch (error) {
                            console.error('Error fetching token details:', error);
                            // Token balances still need to be fetched even if details failed
                            if (isConnected && payToken && connectedAddress) {
                                payToken.balance = await getTokenBalance(payToken.symbol, connectedAddress);
                            }
                            if (isConnected && receiveToken && connectedAddress) {
                                receiveToken.balance = await getTokenBalance(receiveToken.symbol, connectedAddress);
                            }
                        }
                    };
                    
                    // Start fetching token details in the background
                    fetchTokenDetails();
                } else {
                    const error = 'Market data is missing asset pair information';
                    console.error(error);
                    throw new Error(error);
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
    let poolPrices = $state<any>(null);
    let isLoadingPrices = $state(false);
    let hasShownLiquidityWarning = $state(false); // Track if we've shown the warning
    let priceError = $state<string | null>(null);
    
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
    
    // Calculate exchange rate based on pool prices
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

    let predictionStakeAmount = $derived(() => {
        return Math.max(0.01, payAmount * 0.1);
    });

    let marketName = $derived(() => {
        return marketData?.name || 'Unknown Market';
    });

    /**
     * Determines the validation error message based on the current form state
     * This is a derived value that doesn't mutate state
     */
    let getValidationErrorMessage = $derived(() => {
        // Basic validation
        if (!isConnected) {
            return 'Please connect your wallet';
        }
        
        if (!marketData) {
            return 'Market data not available';
        }
        
        if (disabled) {
            return 'Swap panel is currently disabled';
        }
        
        // Amount validation
        if (payAmount <= 0) {
            return 'Please enter an amount to pay';
        }
        
        if (receiveAmount <= 0) {
            return 'Receive amount must be greater than zero';
        }
        
        // Balance validation - ensure user has enough tokens
        if (payToken?.symbol && payTokenBalance !== undefined) {
            if (payAmount > payTokenBalance) {
                return `Insufficient ${payToken.symbol} balance`;
            }
        }
        
        // Prediction validation
        if (!predictionSide) {
            return 'Please select a prediction (Bullish or Bearish)';
        }
        
        // No errors
        return '';
    });
    
    /**
     * Validates the form to ensure all conditions are met before allowing submission
     * Uses the validation error message to determine validity
     */
    let isFormValid = $derived(() => {
        return getValidationErrorMessage() === '';
    });

    // Event handlers
    /**
     * Swaps the pay and receive tokens, including their amounts and balances
     * Triggers immediate validation after swapping
     */
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
        
        // Immediately validate the new token configuration
        // This will trigger the validation in TokenInput via props
        if (payAmount > 0 && payTokenBalance !== undefined) {
            // Force validation by simulating an input event
            handlePayAmountChange(payAmount);
        }
    }

    function handlePredictionSelect(side: PredictionSide, targetPrice?: number) {
        predictionSide = side;
        predictedTargetPrice = targetPrice;
        onPredictionSelect?.(side, targetPrice);
    }

    async function executeSwapAndPredict() {
        if (!isFormValid()) return;

        isSubmitting = true;
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Execute the swap and prediction transaction
            // Implementation will be added when contract integration is complete

            showConfirmationModal = false;
            // Reset form
            payAmount = 0;
            receiveAmount = 0;
            predictionSide = undefined;
            predictedTargetPrice = undefined;
        } catch (error) {
            console.error('Failed to execute swap and prediction:', error);
        } finally {
            isSubmitting = false;
        }
    }
    
    /**
     * Refreshes token balances by clearing the cache for the current address
     * and triggering a new balance fetch
     */
    function refreshBalances(): void {
        if (!connectedAddress) return;
        
        console.log('Manually refreshing balances for address:', connectedAddress);
        clearBalanceCache(connectedAddress);
        
        // Trigger balance fetch
        isLoadingBalances = true;
        const fetchBalances = async () => {
            try {
                console.log('Fetching fresh balances for tokens:', payToken?.symbol, receiveToken?.symbol);
                
                if (!payToken?.symbol || !receiveToken?.symbol) {
                    console.log('Missing token symbols, skipping balance refresh');
                    return;
                }
                
                // Ensure connectedAddress is not null before calling getTokenBalance
                if (!connectedAddress) {
                    console.error('Connected address is null, cannot fetch balances');
                    return;
                }
                
                const payBalancePromise = getTokenBalance(connectedAddress, payToken.symbol);
                const receiveBalancePromise = getTokenBalance(connectedAddress, receiveToken.symbol);
                
                const [payBalance, receiveBalance] = await Promise.all([
                    payBalancePromise,
                    receiveBalancePromise
                ]);

                console.log('Fresh balances received:', { payBalance, receiveBalance });
                payTokenBalance = payBalance;
                receiveTokenBalance = receiveBalance;
            } catch (error) {
                console.error('Failed to refresh balances:', error);
            } finally {
                isLoadingBalances = false;
            }
        };
        
        fetchBalances();
    }

    /**
     * Handles changes to the pay amount
     * Updates the receive amount based on the exchange rate
     */
    function handlePayAmountChange(value: number): void {
        payAmount = value;
        updateReceiveAmount();
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

    /**
     * Handles changes to the receive amount and calculates the corresponding pay amount
     * based on the token pair and exchange rate
     * 
     * @param amount - The new receive amount
     */
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

    function handleConnectWallet() {
        appKit.open();
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
                            onRefreshBalance={refreshBalances}
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
                            onRefreshBalance={refreshBalances}
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
                    <button
                            onclick={() => (showConfirmationModal = true)}
                            class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50"
                            disabled={!isFormValid()}
                            title={getValidationErrorMessage() || 'Swap & Predict'}
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
                    
                    <!-- Validation Error Message -->
                    {#if getValidationErrorMessage() && !isFormValid()}
                        <div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                            <div class="flex items-center gap-2">
                                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                                <span>{getValidationErrorMessage()}</span>
                            </div>
                        </div>
                    {/if}

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

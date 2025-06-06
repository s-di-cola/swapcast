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
    import { executeSwapWithPrediction } from '$lib/services/swap';
    import { parseUnits, createPublicClient, http, formatUnits, type Address } from 'viem';
    import { fetchPoolPrices, getSwapQuote } from '$lib/services/swap';
    import { getPoolKey } from '$lib/services/market/operations';
    import { toastStore } from '$lib/stores/toastStore';
    import { appKit } from '$lib/configs/wallet.config';
    import { getCurrentNetworkConfig } from '$lib/utils/network';
    import { getPredictionManager } from '$generated/types/PredictionManager';

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

    console.log('=== SWAPPANEL V2 INITIALIZATION ===');
    console.log('Props:', { marketId, disabled });

    // Native ETH address for Uniswap V4
    const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

    // Token address mapping for native ETH support
    function getTokenAddress(symbol: string): Address {
        const addressMap: Record<string, string> = {
            'ETH': NATIVE_ETH_ADDRESS,
            'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            'BTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
            'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
        };

        const address = addressMap[symbol.toUpperCase()];
        if (!address) {
            console.error(`Unknown token symbol: ${symbol}`);
            throw new Error(`Unknown token symbol: ${symbol}`);
        }

        console.log(`Token address mapping: ${symbol} → ${address}`);
        return address as Address;
    }

    // Get token decimals
    function getTokenDecimals(address: Address): number {
        if (address === NATIVE_ETH_ADDRESS) return 18; // ETH
        if (address === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') return 6; // USDC
        return 18; // Default for most tokens
    }

    // Internal state
    let payAmount = $state(0);
    let receiveAmount = $state(0);
    let payToken = $state<Token>({symbol: 'ETH', name: 'Ethereum'});
    let receiveToken = $state<Token>({symbol: 'USDT', name: 'Tether'});
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

    console.log('=== INITIAL STATE ===');
    console.log('payToken:', payToken);
    console.log('receiveToken:', receiveToken);

    // FIXED: Wallet connection check (prevents infinite loop)
    $effect(() => {
        let mounted = true;

        const checkConnection = () => {
            if (!mounted) return;

            const account = appKit.getAccount();
            const newAddress = account?.address || null;
            const connected = appKit.getIsConnectedState();

            // Only update if values actually changed
            if (newAddress !== connectedAddress || connected !== isConnected) {
                connectedAddress = newAddress;
                isConnected = connected && !!newAddress;

                console.log('=== WALLET STATUS UPDATE ===');
                console.log('Wallet status:', { connected, newAddress, isConnected });
            }
        };

        // Check immediately
        checkConnection();

        // Set up interval with longer delay to reduce frequency
        const interval = setInterval(checkConnection, 2000); // Every 2 seconds instead of 1

        // Cleanup function
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    });

    /**
     * Fetches token balances for the connected wallet
     * @returns Promise that resolves when balances are updated
     */
    async function fetchBalances() {
        console.log('=== FETCH BALANCES CALLED ===');
        console.log('Check requirements:', {
            isConnected,
            connectedAddress,
            payTokenSymbol: payToken?.symbol,
            receiveTokenSymbol: receiveToken?.symbol
        });

        if (!isConnected || !connectedAddress || !payToken?.symbol || !receiveToken?.symbol) {
            console.log('Skipping balance fetch - missing requirements');
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

            console.log('=== BALANCES FETCHED ===');
            console.log('Balances fetched:', { payBalance, receiveBalance });
        } catch (error) {
            console.error('Failed to fetch balances:', error);
            payTokenBalance = 0;
            receiveTokenBalance = 0;
        } finally {
            isLoadingBalances = false;
        }
    }

    $effect(() => {
        console.log('=== BALANCE EFFECT TRIGGERED ===');
        if (!isConnected || !connectedAddress) {
            console.log('Not connected, clearing balances');
            payTokenBalance = 0;
            receiveTokenBalance = 0;
            return;
        }

        fetchBalances();
    });

    // Fetch market data when marketId changes
    $effect(() => {
        console.log('=== MARKET DATA EFFECT ===');
        console.log('MarketId:', marketId);

        if (!marketId) {
            console.log('No marketId, clearing market data');
            marketData = null;
            return;
        }

        const fetchMarketData = async () => {
            isLoadingMarket = true;
            marketError = null;

            try {
                console.log('Fetching market data for ID:', marketId);
                marketData = await getMarketDetails(marketId);
                console.log('Market data received:', marketData);

                // Update internal state based on market data
                totalBullWeight = Number(marketData?.totalStake1 || 0) / 1e18;
                totalBearWeight = Number(marketData?.totalStake0 || 0) / 1e18;

                // FIXED: Set tokens based on market asset pair with debug
                if (marketData?.assetPair) {
                    console.log('=== SETTING TOKENS FROM MARKET ===');
                    console.log('Asset pair from market:', marketData.assetPair);
                    
                    const [baseSymbol, quoteSymbol] = marketData.assetPair.split('/');
                    console.log('Parsed symbols:', { baseSymbol, quoteSymbol });
                    
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

                    console.log('Updated tokens:', {
                        payToken: payToken.symbol,
                        receiveToken: receiveToken.symbol
                    });
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
        console.log('=== POOL PRICES EFFECT ===');
        console.log('Conditions:', { marketId, hasMarketData: !!marketData });

        if (!marketId || !marketData) {
            console.log('No market data, clearing pool prices');
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
                    console.log('=== POOL PRICES RECEIVED ===');
                    console.log('Pool prices received:', poolPrices);

                    // Check if the pool has no liquidity (sqrtPriceX96 is 0)
                    if (poolPrices.sqrtPriceX96 === 0n && !hasShownLiquidityWarning) {
                        toastStore.warning('This pool has no liquidity. Swap quotes may not be accurate.', {
                            duration: 6000,
                            position: 'top-center'
                        });
                        hasShownLiquidityWarning = true;
                    }

                    // FIXED: Update receive amount using REAL pool prices, not bullshit calculations
                    console.log('Triggering receive amount update with real pool prices');
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

    // FIXED: Real exchange rate from pool prices, no more bullshit calculations
    let exchangeRate = $derived(() => {
        console.log('=== CALCULATING EXCHANGE RATE ===');
        
        if (!poolPrices || !marketData?.assetPair) {
            console.log('No pool prices or asset pair available');
            return 0;
        }

        console.log('Pool prices available:', {
            token0Price: poolPrices.token0Price,
            token1Price: poolPrices.token1Price,
            assetPair: marketData.assetPair
        });

        // Determine which token is token0 in the pool
        const [baseSymbol] = marketData.assetPair.split('/');
        const isPayTokenBase = payToken?.symbol === baseSymbol;
        
        const rate = isPayTokenBase ? poolPrices.token0Price : poolPrices.token1Price;
        
        console.log('Exchange rate calculation:', {
            baseSymbol,
            payTokenSymbol: payToken?.symbol,
            isPayTokenBase,
            selectedRate: rate
        });

        return rate || 0;
    });

    let displayExchangeRate = $derived(() => {
        const rate = exchangeRate();
        console.log('Display exchange rate:', rate);
        return rate > 0 ? rate.toFixed(6) : '0.000000';
    });

    // FIXED: Use 1% instead of 10% for prediction stake
    let predictionStakeAmount = $derived(() => {
        // 1% of pay amount, minimum 0.001 ETH
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
        console.log('=== TOKEN SWAP ===');
        console.log('Before swap:', {
            payToken: payToken.symbol,
            receiveToken: receiveToken.symbol,
            payAmount,
            receiveAmount
        });

        const tempToken = payToken;
        const tempAmount = payAmount;
        const tempBalance = payTokenBalance;

        payToken = receiveToken;
        receiveToken = tempToken;
        payAmount = receiveAmount;
        receiveAmount = tempAmount;
        payTokenBalance = receiveTokenBalance;
        receiveTokenBalance = tempBalance;

        console.log('After swap:', {
            payToken: payToken.symbol,
            receiveToken: receiveToken.symbol,
            payAmount,
            receiveAmount
        });
    }

    function handlePredictionSelect(side: PredictionSide, targetPrice?: number) {
        console.log('=== PREDICTION SELECTED ===');
        console.log('Prediction:', { side, targetPrice });
        
        predictionSide = side;
        if (targetPrice !== undefined) {
            predictedTargetPrice = targetPrice;
        }
        onPredictionSelect?.(side, targetPrice);
    }

    /**
     * FIXED: Executes the swap and prediction transaction with native ETH support
     */
    async function executeSwapAndPredict() {
        console.log('=== FIXED executeSwapAndPredict called ===');
        if (!isFormValid()) {
            console.error('Form is not valid:', validationErrors());
            return;
        }

        isSubmitting = true;
        try {
            console.log('Starting swap and prediction execution with:', {
                marketData: marketData?.id,
                payToken: payToken?.symbol,
                receiveToken: receiveToken?.symbol,
                predictionSide,
                predictedTargetPrice,
                payAmount,
                receiveAmount,
                predictionStakeAmount: predictionStakeAmount()
            });

            if (!marketData || !payToken || !receiveToken || !predictionSide || !predictedTargetPrice) {
                throw new Error('Missing required parameters for swap and prediction');
            }

            // Get the pool key for the swap using the market ID
            console.log('Getting pool key for market ID:', marketData.id);
            const poolKey = await getPoolKey(marketData.id);
            if (!poolKey) {
                throw new Error('Failed to get pool key');
            }
            console.log('Pool key retrieved:', poolKey);

            // FIXED: Get actual token addresses for native ETH support
            const actualPayTokenAddress = getTokenAddress(payToken.symbol);
            const actualReceiveTokenAddress = getTokenAddress(receiveToken.symbol);

            console.log('=== TOKEN ADDRESS MAPPING ===');
            console.log('Pay token mapping:', {
                symbol: payToken.symbol,
                address: actualPayTokenAddress
            });
            console.log('Receive token mapping:', {
                symbol: receiveToken.symbol,
                address: actualReceiveTokenAddress
            });

            // FIXED: Determine swap direction based on ACTUAL pool configuration
            const isPayTokenCurrency0 = actualPayTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase();
            const zeroForOne = isPayTokenCurrency0;

            console.log('=== SWAP DIRECTION ANALYSIS ===');
            console.log('NATIVE ETH Swap direction analysis:', {
                payTokenSymbol: payToken.symbol,
                receiveTokenSymbol: receiveToken.symbol,
                actualPayTokenAddress,
                actualReceiveTokenAddress,
                poolCurrency0: poolKey.currency0,
                poolCurrency1: poolKey.currency1,
                isPayTokenCurrency0,
                zeroForOne,
                isNativeETH: actualPayTokenAddress === NATIVE_ETH_ADDRESS
            });

            // VALIDATION: Ensure both tokens are actually in this pool
            const isValidPair = (
                (actualPayTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase() &&
                    actualReceiveTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase()) ||
                (actualPayTokenAddress.toLowerCase() === poolKey.currency1.toLowerCase() &&
                    actualReceiveTokenAddress.toLowerCase() === poolKey.currency0.toLowerCase())
            );

            if (!isValidPair) {
                const errorMsg = `Token pair mismatch: trying to swap ${payToken.symbol}→${receiveToken.symbol} but pool is ${poolKey.currency0}/${poolKey.currency1}`;
                console.error('=== POOL VALIDATION FAILED ===');
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            console.log('✅ Pool validation passed');

            // FIXED: Use correct decimals for each token
            const payTokenDecimals = getTokenDecimals(actualPayTokenAddress);
            const receiveTokenDecimals = getTokenDecimals(actualReceiveTokenAddress);

            const amountIn = parseUnits(payAmount.toString(), payTokenDecimals);
            console.log('Amount in (parsed):', amountIn.toString(), `(${payTokenDecimals} decimals)`);

            // Calculate minimum amount out (with 0.5% slippage)
            const slippage = 0.005; // 0.5%
            const amountOutMinimum = parseUnits(
                (receiveAmount * (1 - slippage)).toString(),
                receiveTokenDecimals
            );
            console.log('Amount out minimum (parsed):', amountOutMinimum.toString(), `(${receiveTokenDecimals} decimals)`);

            // FIXED: Map prediction side to outcome correctly
            const outcome = predictionSide === 'above_target' ? 1 : 0;
            console.log('Prediction outcome:', outcome, '(', predictionSide, ')');

            // FIXED: Use the actual prediction stake amount from the UI (always in ETH)
            const convictionStakeWei = parseUnits(predictionStakeAmount().toString(), 18);
            console.log('Conviction stake:', {
                amount: predictionStakeAmount(),
                wei: convictionStakeWei.toString()
            });

            // VALIDATION: Check if user has enough ETH for the conviction stake + protocol fee
            if (connectedAddress) {
                const { rpcUrl, chain } = getCurrentNetworkConfig();
                const publicClient = createPublicClient({
                    chain,
                    transport: http(rpcUrl)
                });

                const balance = await publicClient.getBalance({ address: connectedAddress as `0x${string}` });

                // Get protocol fee
                const predictionManager = getPredictionManager({
                    address: process.env.PUBLIC_PREDICTIONMANAGER_ADDRESS as Address,
                    chain,
                    transport: http(rpcUrl)
                });
                const protocolFeeBps = await predictionManager.read.protocolFeeBasisPoints();
                const protocolFee = (convictionStakeWei * protocolFeeBps) / 10000n;
                const totalRequired = convictionStakeWei + protocolFee;

                console.log('ETH Balance Check:', {
                    userBalance: formatUnits(balance, 18),
                    convictionStake: formatUnits(convictionStakeWei, 18),
                    protocolFee: formatUnits(protocolFee, 18),
                    totalRequired: formatUnits(totalRequired, 18)
                });

                if (balance < totalRequired) {
                    throw new Error(`Insufficient ETH for prediction. Need ${formatUnits(totalRequired, 18)} ETH, have ${formatUnits(balance, 18)} ETH`);
                }
            }

            // Execute the swap with prediction
            console.log('Executing swap with prediction (FIXED)...');
            try {
                console.log('Sending transaction and waiting for confirmation...');
                const txHash = await executeSwapWithPrediction(
                    poolKey,
                    zeroForOne,
                    amountIn,
                    amountOutMinimum,
                    BigInt(marketData.id),
                    outcome,
                    convictionStakeWei
                );

                console.log('Transaction confirmed successfully! Hash:', txHash);

                // Show success message only after transaction is confirmed
                toastStore.success('Swap and prediction executed successfully!', {
                    duration: 5000
                });

                // Refresh balances and market data immediately
                console.log('Refreshing data after successful transaction...');
                try {
                    // Refresh balances
                    console.log('Refreshing balances...');
                    await fetchBalances();

                    // Refresh market data to get updated pool state
                    if (marketId) {
                        console.log('Refreshing market data...');
                        marketData = await getMarketDetails(marketId);
                    }

                    // Refresh pool prices
                    if (marketId) {
                        console.log('Refreshing pool prices...');
                        const result = await fetchPoolPrices(marketId);
                        if (result.success && result.prices) {
                            poolPrices = result.prices;
                            console.log('New pool prices:', poolPrices);
                        }
                    }

                    console.log('Balances and market data refreshed after swap');
                } catch (refreshError) {
                    console.error('Failed to refresh data after swap:', refreshError);
                }

                // Reset form
                console.log('Resetting form...');
                showConfirmationModal = false;
                payAmount = 0;
                receiveAmount = 0;
                predictionSide = undefined;
                predictedTargetPrice = undefined;

            } catch (error) {
                const txError = error as Error;
                console.error('Transaction execution failed:', txError);

                // FIXED: Better error messages based on the actual errors
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
                    errorMessage = txError.message; // Use the detailed balance error message
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
            console.log('Swap execution completed (success or failure)');
            isSubmitting = false;
        }
    }

    function handlePayAmountChange(amount: number) {
        console.log('=== PAY AMOUNT CHANGE ===');
        console.log('New pay amount:', amount);
        payAmount = amount;
        updateReceiveAmount();
    }

    function handleReceiveAmountChange(amount: number) {
        console.log('=== RECEIVE AMOUNT CHANGE ===');
        console.log('New receive amount:', amount);
        
        // REMOVED: All the bullshit 1:1 ratio calculations
        // The receive amount should be READ-ONLY and calculated from pool quotes
        
        receiveAmount = amount;
        console.log('Receive amount manually set to:', amount);
    }

    /**
     * FIXED: Updates the receive amount using REAL pool quotes, no more fake calculations
     */
    async function updateReceiveAmount(): Promise<void> {
        console.log('=== UPDATE RECEIVE AMOUNT ===');
        console.log('Conditions:', {
            payAmount,
            marketId,
            payTokenSymbol: payToken?.symbol,
            hasPoolPrices: !!poolPrices
        });

        if (payAmount <= 0 || !marketId || !payToken?.symbol) {
            console.log('Clearing receive amount - missing requirements');
            receiveAmount = 0;
            return;
        }

        // Track if we've already shown a zero liquidity warning in this function
        let hasShownZeroLiquidityWarning = false;

        // Early return if we don't have pool prices yet
        if (!poolPrices) {
            console.log('Pool prices not available yet, using exchange rate fallback');
            // FIXED: Use real exchange rate, not 1:1 bullshit
            const rate = exchangeRate();
            receiveAmount = payAmount * rate;
            console.log('Fallback calculation:', {
                payAmount,
                exchangeRate: rate,
                receiveAmount
            });
            return;
        }

        try {
            // Get actual token address for the pay token
            const actualPayTokenAddress = getTokenAddress(payToken.symbol);
            const payTokenDecimals = getTokenDecimals(actualPayTokenAddress);

            // Convert payAmount to bigint with correct decimals
            const amountBigInt = parseUnits(payAmount.toString(), payTokenDecimals);

            console.log('=== SWAP QUOTE REQUEST ===');
            console.log('Quote parameters:', {
                marketId,
                payTokenSymbol: payToken.symbol,
                actualPayTokenAddress,
                payAmount,
                amountBigInt: amountBigInt.toString(),
                decimals: payTokenDecimals
            });

            // Make sure we have market data
            if (!marketData) {
                console.error('Market data not available');
                return;
            }

            // Get the pool key to access the actual token addresses
            const poolKey = await getPoolKey(marketId);
            if (!poolKey) {
                throw new Error('Failed to get pool key for market');
            }

            console.log('Pool key for quote:', poolKey);

            // Get swap quote from service
            const quoteResult = await getSwapQuote(marketId, actualPayTokenAddress, amountBigInt);

            if (quoteResult.success && quoteResult.quote) {
                // Convert the output amount from bigint to number with correct decimals
                const receiveTokenAddress = quoteResult.quote.tokenOut;
                const receiveTokenDecimals = getTokenDecimals(receiveTokenAddress);
                receiveAmount = Number(quoteResult.quote.amountOut) / (10 ** receiveTokenDecimals);
                
                console.log('=== SWAP QUOTE SUCCESS ===');
                console.log('Swap quote received:', {
                    tokenIn: quoteResult.quote.tokenIn,
                    tokenOut: quoteResult.quote.tokenOut,
                    amountIn: quoteResult.quote.amountIn.toString(),
                    amountOut: quoteResult.quote.amountOut.toString(),
                    receiveTokenDecimals,
                    calculatedReceiveAmount: receiveAmount
                });
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

                // FIXED: Fallback to real exchange rate, not 1:1 bullshit
                const rate = exchangeRate();
                receiveAmount = payAmount * rate;
                console.log('Quote failed, using exchange rate fallback:', {
                    exchangeRate: rate,
                    fallbackReceiveAmount: receiveAmount
                });
            }
        } catch (error) {
            console.error('Error updating receive amount:', error);
            // FIXED: Fallback to real exchange rate, not 1:1 bullshit
            const rate = exchangeRate();
            receiveAmount = payAmount * rate;
            console.log('Error fallback using exchange rate:', {
                exchangeRate: rate,
                fallbackReceiveAmount: receiveAmount
            });
        }
    }

    function handleConnectWallet() {
        console.log('=== CONNECT WALLET CLICKED ===');
        appKit.open();
    }

    function handleRefreshBalances() {
        console.log('=== MANUAL BALANCE REFRESH ===');
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

                <!-- Pool Information Display -->
                {#if poolPrices}
                    <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <h4 class="text-sm font-medium text-blue-900 mb-2">Pool Information</h4>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between">
                                <span class="text-blue-700">Exchange Rate:</span>
                                <span class="font-medium text-blue-900">
                                    1 {payToken?.symbol} = {displayExchangeRate()} {receiveToken?.symbol}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-blue-700">Pool Fee:</span>
                                <span class="font-medium text-blue-900">0.3%</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-blue-700">Slippage:</span>
                                <span class="font-medium text-blue-900">0.5%</span>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Debug Information (DEV ONLY - Remove in production) -->
                {#if poolPrices}
                    <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                        <h4 class="text-sm font-medium text-yellow-900 mb-2">🧪 Debug Info</h4>
                        <div class="space-y-1 text-xs font-mono">
                            <div>Market: {marketData?.name || 'Loading...'}</div>
                            <div>Asset Pair: {marketData?.assetPair || 'Loading...'}</div>
                            <div>Pay Token: {payToken?.symbol} (Balance: {payTokenBalance})</div>
                            <div>Receive Token: {receiveToken?.symbol} (Balance: {receiveTokenBalance})</div>
                            <div>Pool Price (token0): {poolPrices.token0Price}</div>
                            <div>Pool Price (token1): {poolPrices.token1Price}</div>
                            <div>Exchange Rate: {exchangeRate()}</div>
                        </div>
                    </div>
                {/if}

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
                            type="button"
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
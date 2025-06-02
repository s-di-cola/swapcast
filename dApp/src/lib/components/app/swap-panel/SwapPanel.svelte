<script lang="ts">
	import type { Token, PredictionSide } from '$lib/types';
	import type { Market } from '$lib/services/market';
	import { getMarketDetails } from '$lib/services/market';
	import TokenInput from '$lib/components/app/swap-panel/TokenInput.svelte';
	import PredictionSection from '$lib/components/app/swap-panel/PredictionSection.svelte';
	import ConfirmationModal from '$lib/components/app/swap-panel/ConfirmationModal.svelte';
	import HelpModal from '$lib/components/app/swap-panel/HelpModal.svelte';
	import { ArrowUpDown } from 'lucide-svelte';
	import { Modal, Spinner } from 'flowbite-svelte';

	// Simplified Props - only what the parent needs to provide
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

	// Internal state - managed by SwapPanel
	let payAmount = $state(0);
	let receiveAmount = $state(0);
	let payToken = $state<Token>({ symbol: 'ETH', name: 'Ethereum' });
	let receiveToken = $state<Token>({ symbol: 'USDC', name: 'USD Coin' });
	let predictionSide = $state<PredictionSide>(undefined);
	let predictedTargetPrice = $state<number | undefined>(undefined);
	let showConfirmationModal = $state(false);
	let showHelpModal = $state(false);
	let isSubmitting = $state(false);

	// Market data - fetched internally
	let marketData = $state<Market | null>(null);
	let isLoadingMarket = $state(false);
	let marketError = $state<string | null>(null);

	// Mock data for development - these would come from services in production
	let ethPrice = $state(2500);
	let networkFee = $state(0.002);
	let totalBullWeight = $state(0);
	let totalBearWeight = $state(0);
	let protocolFeeRate = $state(0.003);

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
				const market = await getMarketDetails(marketId);
				marketData = market;

				// Update internal state based on market data
				totalBullWeight = Number(marketData?.totalStake1 || 0) / 1e18; // Convert from wei
				totalBearWeight = Number(marketData?.totalStake0 || 0) / 1e18; // Convert from wei

				// Set default tokens based on market asset pair
				if (marketData?.assetPair) {
					const [baseSymbol, quoteSymbol] = marketData.assetPair.split('/');
					payToken = { symbol: baseSymbol, name: baseSymbol };
					receiveToken = { symbol: quoteSymbol, name: quoteSymbol };
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

	// Derived values
	let exchangeRate = $derived(() => {
		if (payAmount === 0) return 0;
		return receiveAmount / payAmount;
	});

	let displayExchangeRate = $derived(() => {
		const rate = exchangeRate();
		return rate > 0 ? rate.toFixed(6) : '0.000000';
	});

	let predictionStakeAmount = $derived(() => {
		return Math.max(0.01, payAmount * 0.1); // 10% of swap amount, minimum 0.01 ETH
	});

	let marketName = $derived(() => {
		return marketData?.name || 'Unknown Market';
	});

	let isFormValid = $derived(() => {
		return payAmount > 0 && receiveAmount > 0 && marketData && !disabled;
	});

	// Event handlers
	function handleTokenSwap() {
		const tempToken = payToken;
		const tempAmount = payAmount;

		payToken = receiveToken;
		receiveToken = tempToken;
		payAmount = receiveAmount;
		receiveAmount = tempAmount;
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

			console.log('Executing swap and prediction:', {
				payAmount,
				payToken,
				receiveAmount,
				receiveToken,
				predictionSide,
				predictedTargetPrice,
				marketId
			});

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

	function handlePayAmountChange(amount: number) {
		payAmount = amount;
		// Simple 1:1 exchange rate for demo
		receiveAmount = amount;
	}

	function handleReceiveAmountChange(amount: number) {
		receiveAmount = amount;
		// Simple 1:1 exchange rate for demo
		payAmount = amount;
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
			<!-- Swap Interface -->
			<div class="space-y-4">
				<!-- You Pay Section -->
				<TokenInput
					label="You pay"
					amount={payAmount}
					token={payToken}
					onAmountChange={handlePayAmountChange}
					{disabled}
					showBalance={true}
					{ethPrice}
				/>

				<!-- Swap Button -->
				<div class="relative z-10 -my-2 flex justify-center">
					<button
						onclick={handleTokenSwap}
						class="flex h-12 w-12 items-center justify-center rounded-full border-4 border-gray-100 bg-white text-gray-600 shadow-lg transition-all hover:border-gray-200 hover:bg-gray-50 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
						{disabled}
						title="Swap tokens"
					>
						<ArrowUpDown size={20} />
					</button>
				</div>

				<!-- You Receive Section -->
				<TokenInput
					label="You receive"
					amount={receiveAmount}
					token={receiveToken}
					onAmountChange={handleReceiveAmountChange}
					readOnly={false}
					{disabled}
					showExchangeRate={true}
					exchangeRate={displayExchangeRate()}
					fromTokenSymbol={payToken?.symbol}
					toTokenSymbol={receiveToken?.symbol}
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
				>
					{#if isSubmitting}
						<div class="flex items-center justify-center gap-2">
							<Spinner size="4" color="blue" />
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

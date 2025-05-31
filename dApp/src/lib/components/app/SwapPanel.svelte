<script lang="ts">
	import {
		ArrowDownOutline,
		ArrowUpOutline,
		CheckOutline,
		SortHorizontalOutline,
		InfoCircleSolid,
		ChartPieSolid,
		QuestionCircleSolid
	} from 'flowbite-svelte-icons';
	import { browser } from '$app/environment';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Button, Modal, Tooltip, Spinner } from 'flowbite-svelte';
	import type { PredictionSide, Token } from '../../types';

	interface Props {
		payAmount?: number;
		payToken: Token;
		receiveAmount?: number;
		receiveToken: Token;
		ethPrice: number;
		networkFee: number;
		totalBullWeight: number;
		totalBearWeight: number;
		protocolFeeRate: number;
		onPredictionSelect: (side: PredictionSide, targetPrice?: number) => void;
		selectedMarket?: any; // Temporarily using 'any' type, should be properly typed
		disabled?: boolean;
	}

	let {
		payAmount = $bindable(),
		payToken = $bindable(),
		receiveAmount = $bindable(),
		receiveToken = $bindable(),
		ethPrice,
		networkFee,
		totalBullWeight,
		totalBearWeight,
		protocolFeeRate,
		onPredictionSelect,
		selectedMarket,
		disabled = false
	}: Props = $props();

	// Core state variables
	let predictionSide = $state<PredictionSide>(undefined);
	let predictedTargetPrice = $state<number | undefined>(undefined);
	let isTargetPriceInputFocused = $state(false);
	let isSubmitting = $state(false);
	let showConfirmationModal = $state(false);
	let showHelpModal = $state(false);
	let animatePrediction = $state(false);
	let errorMessage = $state<string | null>(null);

	const predictionStakeAmount = $derived(payAmount && payAmount > 0 ? payAmount * 0.01 : 0);
	const displayStakeInfo = $derived(predictionStakeAmount > 0);

	// Default target price to current price + 5% when market is selected
	$effect(() => {
		if (selectedMarket && ethPrice && !predictedTargetPrice) {
			predictedTargetPrice = Math.round(ethPrice * 105) / 100; // Default to current price + 5%
		}
	});

	const placeholderTargetPrice = $derived(
		`Target price (e.g., ${ethPrice ? ethPrice.toFixed(2) : '2500'})`
	);
	
	// Market display helpers
	const marketName = $derived(selectedMarket ? `${selectedMarket.baseToken.symbol}/${selectedMarket.quoteToken.symbol}` : 'Select a Market');
	const marketPriceChange = $derived(selectedMarket?.priceChange24h || 0);
	const priceChangeClass = $derived(marketPriceChange >= 0 ? 'text-green-500' : 'text-red-500');
	const priceChangeSign = $derived(marketPriceChange >= 0 ? '+' : '');
	const formattedPriceChange = $derived(`${priceChangeSign}${marketPriceChange.toFixed(2)}%`);

	const exchangeRate = $derived(() => {
		if (payToken?.symbol === 'ETH' && receiveToken?.symbol === 'USDC') {
			return ethPrice;
		} else if (payToken?.symbol === 'USDC' && receiveToken?.symbol === 'ETH') {
			return ethPrice > 0 ? 1 / ethPrice : 0;
		}
		return 0;
	});

	const displayExchangeRate = $derived(() => {
		if (payToken?.symbol === 'ETH') {
			return ethPrice.toFixed(2);
		} else {
			return (1 / ethPrice).toFixed(6);
		}
	});

	const potentialRewards = $derived(() => {
		if (
			predictionStakeAmount <= 0 ||
			!predictionSide ||
			(predictionSide !== 'above_target' && predictionSide !== 'below_target') ||
			totalBullWeight < 0 ||
			totalBearWeight < 0
		) {
			return { netProfit: 0, totalReward: 0 };
		}

		const effectiveSide = predictionSide === 'above_target' ? 'bullish' : 'bearish';
		const totalPoolWeight = totalBullWeight + totalBearWeight;

		if (
			totalPoolWeight === 0 ||
			(effectiveSide === 'bullish' && totalBullWeight === 0) ||
			(effectiveSide === 'bearish' && totalBearWeight === 0)
		) {
			return { netProfit: 0, totalReward: predictionStakeAmount };
		}

		const payoutRatio =
			effectiveSide === 'bullish'
				? totalPoolWeight / totalBullWeight
				: totalPoolWeight / totalBearWeight;

		const grossReward = predictionStakeAmount * payoutRatio;
		const profit = grossReward - predictionStakeAmount;
		const fee = profit > 0 ? profit * protocolFeeRate : 0;
		const netProfit = profit - fee;
		const totalReward = predictionStakeAmount + netProfit;

		return { netProfit, totalReward };
	});

	function recalculateReceiveAmount(): void {
		if (payAmount && payToken && receiveToken && ethPrice > 0) {
			const rate = exchangeRate();
			receiveAmount = rate > 0 ? parseFloat((payAmount * rate).toFixed(8)) : 0;
		} else {
			receiveAmount = 0;
		}
	}

	function selectPredictionSide(side: PredictionSide): void {
		predictionSide = side === predictionSide ? undefined : side;
		
		// Add animation flag for visual feedback
		animatePrediction = true;
		setTimeout(() => {
			animatePrediction = false;
		}, 500);
		
		onPredictionSelect(predictionSide, predictedTargetPrice);
	}
	
	function setQuickTargetPrice(percentChange: number): void {
		if (!ethPrice) return;
		
		// Calculate new target price based on percentage change
		const multiplier = 1 + (percentChange / 100);
		predictedTargetPrice = Math.round(ethPrice * multiplier * 100) / 100;
		
		// If prediction side isn't set, default to appropriate direction
		if (!predictionSide) {
			selectPredictionSide(percentChange > 0 ? 'above_target' : 'below_target');
		} else {
			onPredictionSelect(predictionSide, predictedTargetPrice);
		}
	}
	
	function handleSwapAndPredict(): void {
		if (!payAmount || payAmount <= 0 || !predictionSide || !predictedTargetPrice || predictedTargetPrice <= 0) {
			return;
		}
		
		// Show confirmation modal
		showConfirmationModal = true;
	}
	
	async function executeSwapAndPredict(): Promise<void> {
		try {
			isSubmitting = true;
			errorMessage = null;
			
			// Simulate API call with timeout
			await new Promise(resolve => setTimeout(resolve, 1500));
			
			// Close modal and reset state
			showConfirmationModal = false;
			
			// Show success message or redirect
			console.log('Swap and prediction executed successfully');
		} catch (error) {
			console.error('Error executing swap and prediction:', error);
			errorMessage = 'Failed to execute transaction. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	function handleTargetPriceInput(): void {
		if (predictionSide) {
			predictionSide = undefined;
			onPredictionSelect(undefined, predictedTargetPrice);
		}
	}

	function handleTokenSwap(): void {
		if (!payToken || !receiveToken) return;

		// Swap tokens
		const tempToken = payToken;
		payToken = receiveToken;
		receiveToken = tempToken;

		// Swap amounts
		if (receiveAmount !== undefined && receiveAmount > 0) {
			payAmount = receiveAmount;
		} else {
			payAmount = undefined;
		}
	}

	function getPredictionButtonClass(side: 'above' | 'below'): string {
		const isActive =
			(side === 'above' && predictionSide === 'above_target') ||
			(side === 'below' && predictionSide === 'below_target');

		const baseClass =
			'flex h-10 w-12 items-center justify-center rounded-md p-2.5 text-sm font-bold text-white transition';

		if (isActive) {
			return side === 'above'
				? `${baseClass} bg-sky-500 ring-2 ring-sky-300 hover:bg-sky-600`
				: `${baseClass} bg-rose-500 ring-2 ring-rose-300 hover:bg-rose-600`;
		}

		return `${baseClass} bg-slate-400 hover:bg-slate-500 disabled:opacity-50`;
	}

	function getActionButtonClass(): string {
		const baseClass =
			'flex w-full items-center justify-center gap-3 rounded-lg px-6 py-4 text-xl font-extrabold text-white shadow-md transition focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

		if (predictionSide === 'above_target') {
			return `${baseClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
		} else if (predictionSide === 'below_target') {
			return `${baseClass} bg-rose-600 hover:bg-rose-700 focus:ring-rose-500`;
		}

		return `${baseClass} bg-gray-600 hover:bg-gray-700 focus:ring-gray-500`;
	}

	function getPredictionDisplayClass(): string {
		const baseClass = 'rounded-md p-2 text-center text-xs transition-all duration-300 ease-in-out';

		return predictionSide === 'above_target'
			? `${baseClass} bg-blue-100 text-blue-700`
			: `${baseClass} bg-rose-100 text-rose-700`;
	}

	// Reactive effects
	$effect(() => {
		recalculateReceiveAmount();
	});

</script>

<div class="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-xl md:p-8 {disabled ? 'opacity-60' : ''}">
	<!-- Market Header -->
	{#if selectedMarket}
	<div class="mb-2 flex items-center justify-between rounded-xl bg-slate-50 p-3" transition:fade={{ duration: 200 }}>
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
				<ChartPieSolid class="h-4 w-4 text-blue-600" />
			</div>
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-gray-900">{marketName}</span>
				<span class="text-xs text-gray-500">Current price: ${ethPrice?.toFixed(2)}</span>
			</div>
		</div>
		<div class="flex flex-col items-end">
			<span class="text-sm font-medium {priceChangeClass}">{formattedPriceChange}</span>
			<span class="text-xs text-gray-500">24h change</span>
		</div>
	</div>
	{/if}

	<!-- Pay Section -->
	<div>
		<label for="payAmountInput" class="mb-1 block text-sm font-medium text-gray-700">You Pay</label>
		<div class="flex items-center gap-4">
			<input
				type="number"
				id="payAmountInput"
				bind:value={payAmount}
				class="block w-full rounded-lg border-0 py-3 text-2xl font-bold text-gray-900 focus:ring-0 disabled:opacity-50"
				placeholder="0.0"
				min="0"
				step="any"
				disabled={disabled}
			/>
			<button
				title="Select Token (Not implemented)"
				class="flex cursor-not-allowed items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-lg font-bold text-sky-600 shadow transition hover:bg-slate-200"
			>
				{#if payToken?.symbol}
					<img
						src="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92b25668/svg/color/{payToken.symbol.toLowerCase()}.svg"
						alt={payToken.symbol}
						class="h-5 w-5"
						onerror={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
					/>
					{payToken.symbol}
				{:else}
					Select Token
				{/if}
			</button>
		</div>
	</div>

	<!-- Exchange Rate & Swap Button -->
	<div class="relative -my-3 flex items-center justify-center">
		<span class="absolute top-1/2 left-0 -translate-y-1/2 text-xs text-gray-500">
			1 {payToken?.symbol ?? ''} ≈ {displayExchangeRate()}
			{receiveToken?.symbol ?? ''}
		</span>
		<button
			onclick={handleTokenSwap}
			class="z-10 rounded-full border border-slate-300 bg-slate-200 p-2 text-slate-600 shadow transition hover:bg-slate-300"
			aria-label="Swap tokens"
		>
			{#if browser}
				<SortHorizontalOutline class="h-5 w-5" />
			{/if}
		</button>
		<span class="absolute top-1/2 right-0 -translate-y-1/2 text-xs text-gray-500">
			Pool Fee: 0.3%
		</span>
	</div>

	<!-- You Receive Section -->
	<div>
		<label for="receiveAmountInput" class="mb-1 block text-sm font-medium text-gray-700">
			You Receive (Estimated)
		</label>
		<div class="flex items-center gap-4">
			<input
				type="number"
				id="receiveAmountInput"
				class="flex-1 bg-transparent px-0 py-2 text-3xl font-bold text-gray-500 outline-none"
				value={receiveAmount ?? 0}
				readonly
			/>
			<button
				title="Select Token (Not implemented)"
				class="flex cursor-not-allowed items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-lg font-bold text-sky-600 shadow transition hover:bg-slate-200"
			>
				{#if receiveToken?.symbol}
					<img
						src="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92b25668/svg/color/{receiveToken.symbol.toLowerCase()}.svg"
						alt={receiveToken.symbol}
						class="h-5 w-5"
						onerror={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
					/>
					{receiveToken.symbol}
				{:else}
					Select Token
				{/if}
			</button>
		</div>
	</div>

	<!-- Prediction Block -->
	<div class="mt-0 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
		<div class="flex items-center justify-between">
			<span class="font-semibold text-gray-700">Set Your Price Prediction:</span>
			<button 
				class="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
				onclick={() => showHelpModal = true}
			>
				<QuestionCircleSolid class="h-3.5 w-3.5" />
				How it works
			</button>
		</div>
		<div class="text-xs text-slate-600">
			Predict if {payToken?.symbol ?? 'asset'} price relative to {receiveToken?.symbol ?? 'asset'} will
			be above or below your target in 24 hours.
		</div>
		
		<!-- Quick Select Buttons -->
		{#if ethPrice && ethPrice > 0}
		<div class="mt-1 flex flex-wrap gap-2">
			<button 
				class="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 transition-colors"
				onclick={() => setQuickTargetPrice(-10)}
			>
				-10%
			</button>
			<button 
				class="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 transition-colors"
				onclick={() => setQuickTargetPrice(-5)}
			>
				-5%
			</button>
			<button 
				class="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
				onclick={() => setQuickTargetPrice(0)}
			>
				Current
			</button>
			<button 
				class="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
				onclick={() => setQuickTargetPrice(5)}
			>
				+5%
			</button>
			<button 
				class="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
				onclick={() => setQuickTargetPrice(10)}
			>
				+10%
			</button>
			<button 
				class="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
				onclick={() => setQuickTargetPrice(20)}
			>
				+20%
			</button>
		</div>
		{/if}
		
		<div class="mt-1 flex items-center gap-2">
			<input
				type="number"
				id="targetPriceInput"
				bind:value={predictedTargetPrice}
				onfocusin={() => isTargetPriceInputFocused = true}
				onfocusout={() => isTargetPriceInputFocused = false}
				class="block w-full rounded-lg border-0 py-3 text-2xl font-bold text-gray-900 focus:ring-0 disabled:opacity-50"
				placeholder={placeholderTargetPrice}
				min="0"
				step="0.01"
				disabled={disabled}
			/>

			<button
				onclick={() => selectPredictionSide('above_target')}
				class={getPredictionButtonClass('above')}
				disabled={!predictedTargetPrice || predictedTargetPrice <= 0 || disabled}
				aria-label="Predict price will be above target"
			>
				<ArrowUpOutline class="h-5 w-5" />
			</button>

			<button
				onclick={() => selectPredictionSide('below_target')}
				class={getPredictionButtonClass('below')}
				disabled={!predictedTargetPrice || predictedTargetPrice <= 0 || disabled}
				aria-label="Predict price will be below target"
			>
				<ArrowDownOutline class="h-5 w-5" />
			</button>
		</div>

		{#if (predictionSide === 'above_target' || predictionSide === 'below_target') && predictedTargetPrice && predictedTargetPrice > 0}
			<div class={getPredictionDisplayClass()}>
				You predict {payToken?.symbol ?? ''}/{receiveToken?.symbol ?? ''} price will be
				<span class="font-bold">
					{predictionSide === 'above_target' ? 'ABOVE' : 'BELOW'}
					{predictedTargetPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}
				</span> in 24h.
			</div>
		{/if}
	</div>

	<!-- Prediction Stake Info -->
	{#if displayStakeInfo}
		<div
			class="-mt-1 mb-3 px-2 text-center text-xs text-gray-500 transition-opacity duration-300 ease-in-out"
		>
			(Your prediction stake: <span class="font-semibold text-gray-700">
				{predictionStakeAmount.toFixed(
					Math.min(8, (payAmount?.toString().split('.')[1] || '').length + 2)
				)}
				{payToken?.symbol}
			</span>, 1% of swap)
		</div>
	{/if}

	<!-- Prediction Details & Potential Reward -->
	{#if predictionStakeAmount > 0 && (predictionSide === 'above_target' || predictionSide === 'below_target')}
		<div
			class="mt-0 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-300 ease-in-out"
		>
			<div class="flex justify-between">
				<span>Your Prediction Stake:</span>
				<span class="font-semibold text-slate-800">
					{predictionStakeAmount.toFixed(6)}
					{payToken?.symbol}
				</span>
			</div>
			<div class="mt-1 flex justify-between">
				<span>Potential Net Profit:</span>
				<span
					class="font-semibold {potentialRewards().netProfit >= 0
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{potentialRewards().netProfit >= 0 ? '+' : ''}{potentialRewards().netProfit.toFixed(6)}
					{payToken?.symbol}
				</span>
			</div>
			<div class="mt-1 flex justify-between">
				<span>Potential Total Reward:</span>
				<span class="font-semibold text-slate-800">
					{potentialRewards().totalReward.toFixed(6)}
					{payToken?.symbol}
				</span>
			</div>
			<div class="mt-2 text-xs text-slate-500">
				This is an estimate. Actual rewards depend on final pool sizes and market resolution.
			</div>
		</div>
	{/if}

	<!-- Action Button -->
	<button
		class={getActionButtonClass()}
		disabled={!payAmount ||
			payAmount <= 0 ||
			!predictionSide ||
			!predictedTargetPrice ||
			predictedTargetPrice <= 0 ||
			isSubmitting}
		onclick={handleSwapAndPredict}
	>
		{#if isSubmitting}
			<Spinner class="h-7 w-7" color="blue" />
			PROCESSING...
		{:else}
			<CheckOutline class="h-7 w-7" />
			SWAP & PREDICT
		{/if}
	</button>

	<!-- Fee Information -->
	<div class="text-center text-xs text-gray-500">
		Network Fee: {networkFee ? networkFee.toFixed(5) : 'N/A'} ETH | Protocol Fee: {(
			protocolFeeRate * 100
		).toFixed(1)}% on prediction pool
	</div>
</div>

<!-- Confirmation Modal -->
<Modal
	bind:open={showConfirmationModal}
	autoclose
	outsideclose
	size="sm"
	class="w-full max-w-md"
>
	<div class="p-4">
		<h3 class="mb-4 text-xl font-bold text-gray-900">Confirm Swap & Prediction</h3>
		<div class="mb-4 space-y-3 text-sm text-gray-700">
			<div class="flex justify-between">
				<span>You pay:</span>
				<span class="font-semibold">{payAmount} {payToken?.symbol}</span>
			</div>
			<div class="flex justify-between">
				<span>You receive:</span>
				<span class="font-semibold">{receiveAmount} {receiveToken?.symbol}</span>
			</div>
			<div class="flex justify-between">
				<span>Prediction stake:</span>
				<span class="font-semibold">{predictionStakeAmount.toFixed(6)} {payToken?.symbol}</span>
			</div>
			<div class="flex justify-between">
				<span>Your prediction:</span>
				<span class="font-semibold {predictionSide === 'above_target' ? 'text-blue-600' : 'text-rose-600'}">
					Price will be {predictionSide === 'above_target' ? 'ABOVE' : 'BELOW'} ${predictedTargetPrice}
				</span>
			</div>
			<div class="flex justify-between">
				<span>Potential reward:</span>
				<span class="font-semibold text-green-600">
					{potentialRewards().totalReward.toFixed(6)} {payToken?.symbol}
				</span>
			</div>
			<div class="mt-2 text-xs text-slate-500">
				Prediction results will be available in 24 hours.
			</div>
		</div>
		
		{#if errorMessage}
			<div class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
				{errorMessage}
			</div>
		{/if}
		
		<div class="flex justify-end gap-3">
			<button class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-300 disabled:opacity-50" onclick={() => showConfirmationModal = false} disabled={isSubmitting}>
				Cancel
			</button>
			<button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 disabled:opacity-50" onclick={executeSwapAndPredict} disabled={isSubmitting}>
				{#if isSubmitting}
					<div class="inline-block mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent"></div>
					Processing...
				{:else}
					Confirm
				{/if}
			</button>
		</div>
	</div>
</Modal>

<!-- Help Modal -->
<Modal
	bind:open={showHelpModal}
	autoclose
	outsideclose
	size="md"
	class="w-full max-w-lg"
>
	<div class="p-4">
		<h3 class="mb-4 text-xl font-bold text-gray-900">How SwapCast Predictions Work</h3>
		<div class="space-y-4 text-sm text-gray-700">
			<div>
				<h4 class="mb-1 font-semibold text-gray-900">1. Make a Swap</h4>
				<p>When you swap tokens, 1% of your swap amount is automatically staked in a prediction pool.</p>
			</div>
			
			<div>
				<h4 class="mb-1 font-semibold text-gray-900">2. Set Your Prediction</h4>
				<p>Choose a target price and predict whether the price will be above or below that target in 24 hours.</p>
			</div>
			
			<div>
				<h4 class="mb-1 font-semibold text-gray-900">3. Collect Rewards</h4>
				<p>If your prediction is correct, you'll earn a share of the prediction pool proportional to your stake.</p>
			</div>
			
			<div>
				<h4 class="mb-1 font-semibold text-gray-900">Reward Calculation</h4>
				<p>Rewards are calculated based on the total stake in the prediction pool and the distribution of predictions. The fewer people who predict correctly, the higher your potential reward.</p>
			</div>
			
			<div class="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
				<p class="font-semibold">Pro Tip:</p>
				<p>Use the quick-select buttons to easily set common target prices based on the current market price.</p>
			</div>
		</div>
		
		<div class="mt-4 flex justify-end">
			<button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-300" onclick={() => showHelpModal = false}>
				Got it
			</button>
		</div>
	</div>
</Modal>

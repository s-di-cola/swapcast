<script lang="ts">
	import { ArrowDownOutline, ArrowUpOutline, CheckOutline, SortHorizontalOutline } from 'flowbite-svelte-icons';
	import { browser } from '$app/environment';
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
		onPredictionSelect
	}: Props = $props();
	
	let predictionSide = $state<PredictionSide>(undefined);
	let predictedTargetPrice = $state<number | undefined>(undefined);
	let isTargetPriceInputFocused = $state(false);
	
	const predictionStakeAmount = $derived(payAmount && payAmount > 0 ? payAmount * 0.01 : 0);
	const displayStakeInfo = $derived(predictionStakeAmount > 0);
	
	const placeholderTargetPrice = $derived(
		`Target price (e.g., ${ethPrice ? ethPrice.toFixed(2) : '2500'})`
	);
	
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
	
		const payoutRatio = effectiveSide === 'bullish' 
			? totalPoolWeight / totalBullWeight 
			: totalPoolWeight / totalBearWeight;
	
		const grossReward = predictionStakeAmount * payoutRatio;
		const profit = grossReward - predictionStakeAmount;
		const fee = profit > 0 ? profit * protocolFeeRate : 0;
		const netProfit = profit - fee;
		const totalReward = predictionStakeAmount + netProfit;
	
		return { netProfit, totalReward };
	})
	
	function recalculateReceiveAmount(): void {
		if (payAmount && payToken && receiveToken && ethPrice > 0) {
			const rate = exchangeRate();
			receiveAmount = rate > 0 ? parseFloat((payAmount * rate).toFixed(8)) : 0;
		} else {
			receiveAmount = 0;
		}
	}
	
	function handleTargetPrediction(side: 'above' | 'below'): void {
		const newSide: PredictionSide = side === 'above' ? 'above_target' : 'below_target';
		
		if (!predictedTargetPrice || predictedTargetPrice <= 0) {
			predictedTargetPrice = parseFloat(ethPrice.toFixed(2));
		}
		
		predictionSide = predictionSide === newSide ? undefined : newSide;
		onPredictionSelect(predictionSide, predictedTargetPrice);
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
		const isActive = (side === 'above' && predictionSide === 'above_target') || 
						 (side === 'below' && predictionSide === 'below_target');
		
		const baseClass = "flex h-10 w-12 items-center justify-center rounded-md p-2.5 text-sm font-bold text-white transition";
		
		if (isActive) {
			return side === 'above' 
				? `${baseClass} bg-sky-500 ring-2 ring-sky-300 hover:bg-sky-600`
				: `${baseClass} bg-rose-500 ring-2 ring-rose-300 hover:bg-rose-600`;
		}
		
		return `${baseClass} bg-slate-400 hover:bg-slate-500 disabled:opacity-50`;
	}
	
	function getActionButtonClass(): string {
		const baseClass = "flex w-full items-center justify-center gap-3 rounded-lg px-6 py-4 text-xl font-extrabold text-white shadow-md transition focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
		
		if (predictionSide === 'above_target') {
			return `${baseClass} bg-sky-500 hover:bg-sky-600 focus:ring-sky-400`;
		} else if (predictionSide === 'below_target') {
			return `${baseClass} bg-rose-500 hover:bg-rose-600 focus:ring-rose-400`;
		}
		
		return `${baseClass} bg-slate-600 hover:bg-slate-700 focus:ring-slate-500`;
	}
	
	function getPredictionDisplayClass(): string {
		const baseClass = "rounded-md p-2 text-center text-xs transition-all duration-300 ease-in-out";
		
		return predictionSide === 'above_target'
			? `${baseClass} bg-sky-100 text-sky-700`
			: `${baseClass} bg-rose-100 text-rose-700`;
	}
	
	// Reactive effects
	$effect(() => {
		recalculateReceiveAmount();
	});
	</script>
	
	<div class="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
		<!-- You Pay Section -->
		<div>
			<label for="payAmountInput" class="mb-1 block text-sm font-medium text-gray-700">You Pay</label>
			<div class="flex items-center gap-4">
				<input
					type="number"
					id="payAmountInput"
					min="0"
					step="any"
					class="flex-1 bg-transparent px-0 py-2 text-3xl font-bold text-gray-700 outline-none"
					bind:value={payAmount}
					placeholder="0"
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
				1 {payToken?.symbol ?? ''} ≈ {displayExchangeRate()} {receiveToken?.symbol ?? ''}
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
			</div>
			<div class="text-xs text-slate-600">
				Predict if {payToken?.symbol ?? 'asset'} price relative to {receiveToken?.symbol ?? 'asset'} will
				be above or below your target in 24 hours.
			</div>
			<div class="mt-1 flex items-center gap-2">
				<input
					type="number"
					bind:value={predictedTargetPrice}
					oninput={handleTargetPriceInput}
					onfocus={() => (isTargetPriceInputFocused = true)}
					onblur={() => (isTargetPriceInputFocused = false)}
					class="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-sky-500"
					placeholder={placeholderTargetPrice}
					min="0.000001"
					step="any"
				/>
				
				<button
					onclick={() => handleTargetPrediction('above')}
					class={getPredictionButtonClass('above')}
					disabled={!predictedTargetPrice || predictedTargetPrice <= 0}
					aria-label="Predict price will be above target"
				>
					<ArrowUpOutline class="h-5 w-5" />
				</button>
				
				<button
					onclick={() => handleTargetPrediction('below')}
					class={getPredictionButtonClass('below')}
					disabled={!predictedTargetPrice || predictedTargetPrice <= 0}
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
			<div class="-mt-1 mb-3 px-2 text-center text-xs text-gray-500 transition-opacity duration-300 ease-in-out">
				(Your prediction stake: <span class="font-semibold text-gray-700">
					{predictionStakeAmount.toFixed(Math.min(8, (payAmount?.toString().split('.')[1] || '').length + 2))}
					{payToken?.symbol}
				</span>, 1% of swap)
			</div>
		{/if}
	
		<!-- Prediction Details & Potential Reward -->
		{#if predictionStakeAmount > 0 && (predictionSide === 'above_target' || predictionSide === 'below_target')}
			<div class="mt-0 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-300 ease-in-out">
				<div class="flex justify-between">
					<span>Your Prediction Stake:</span>
					<span class="font-semibold text-slate-800">
						{predictionStakeAmount.toFixed(6)} {payToken?.symbol}
					</span>
				</div>
				<div class="mt-1 flex justify-between">
					<span>Potential Net Profit:</span>
					<span class="font-semibold {potentialRewards().netProfit >= 0 ? 'text-green-600' : 'text-red-600'}">
						{potentialRewards().netProfit >= 0 ? '+' : ''}{potentialRewards().netProfit.toFixed(6)}
						{payToken?.symbol}
					</span>
				</div>
				<div class="mt-1 flex justify-between">
					<span>Potential Total Reward:</span>
					<span class="font-semibold text-slate-800">
						{potentialRewards().totalReward.toFixed(6)} {payToken?.symbol}
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
			disabled={!payAmount || payAmount <= 0 || !predictionSide || !predictedTargetPrice || predictedTargetPrice <= 0}
		>
			<CheckOutline class="h-7 w-7" />
			SWAP & PREDICT
		</button>
	
		<!-- Fee Information -->
		<div class="text-center text-xs text-gray-500">
			Network Fee: {networkFee ? networkFee.toFixed(5) : 'N/A'} ETH | Protocol Fee: {(protocolFeeRate * 100).toFixed(1)}% on prediction pool
		</div>
	</div>
<script lang="ts">
    import {ArrowDownOutline, ArrowUpOutline, CheckOutline, SortHorizontalOutline} from 'flowbite-svelte-icons';
    import type {PredictionSide, Token} from '../../types';
    import {browser} from '$app/environment'; // Import browser check

    export let payAmount: number | undefined = undefined;
	export let payToken: Token;
	export let receiveAmount: number | undefined = undefined;
	export let receiveToken: Token;
	export let ethPrice: number;
	export let networkFee: number;
	export let totalBullWeight: number;
	export let totalBearWeight: number;
	export let protocolFeeRate: number;
	export let onPredictionSelect: (side: PredictionSide, targetPrice?: number) => void;

	let predictionSide: PredictionSide = undefined;
	let predictedTargetPrice: number | undefined = undefined;
	let isTargetPriceInputFocused: boolean = false;

	let predictionStakeAmount: number = 0;
	let displayStakeInfo: boolean = false;
	let potentialNetProfit: number = 0;
	let potentialTotalReward: number = 0;

	function recalculateReceiveAmount() {
		if (payAmount && payToken && receiveToken && ethPrice && ethPrice > 0) {
			if (payToken.symbol === 'ETH' && receiveToken.symbol === 'USDC') {
				receiveAmount = parseFloat((payAmount * ethPrice).toFixed(2));
			} else if (payToken.symbol === 'USDC' && receiveToken.symbol === 'ETH') {
				if (ethPrice > 0) {
					receiveAmount = parseFloat((payAmount / ethPrice).toFixed(8));
				} else {
					receiveAmount = 0;
				}
			} else {
				receiveAmount = 0;
			}
		} else {
			receiveAmount = 0;
		}
	}

	function updatePredictionStake() {
		if (payAmount && payAmount > 0) {
			predictionStakeAmount = payAmount * 0.01;
			displayStakeInfo = true;
		} else {
			predictionStakeAmount = 0;
			displayStakeInfo = false;
		}
	}

	function calculatePotentialReward() {
		if (
			predictionStakeAmount > 0 &&
			predictionSide &&
			(predictionSide === 'above_target' || predictionSide === 'below_target') &&
			totalBullWeight >= 0 &&
			totalBearWeight >= 0
		) {
			const effectiveSide = predictionSide === 'above_target' ? 'bullish' : 'bearish';
			const totalPoolWeight = totalBullWeight + totalBearWeight;

			if (
				totalPoolWeight === 0 ||
				(effectiveSide === 'bullish' && totalBullWeight === 0) ||
				(effectiveSide === 'bearish' && totalBearWeight === 0)
			) {
				potentialNetProfit = 0;
				potentialTotalReward = predictionStakeAmount;
				return;
			}

			let payoutRatio = 0;
			if (effectiveSide === 'bullish') {
				payoutRatio = totalPoolWeight / totalBullWeight;
			} else {
				// bearish
				payoutRatio = totalPoolWeight / totalBearWeight;
			}

			const grossReward = predictionStakeAmount * payoutRatio;
			const profit = grossReward - predictionStakeAmount;
			const fee = profit > 0 ? profit * protocolFeeRate : 0;
			potentialNetProfit = profit - fee;
			potentialTotalReward = predictionStakeAmount + potentialNetProfit;
		} else {
			potentialNetProfit = 0;
			potentialTotalReward = 0;
		}
	}

	function handleTargetPrediction(side: 'above' | 'below') {
		const newSide: PredictionSide = side === 'above' ? 'above_target' : 'below_target';
		if (!predictedTargetPrice || predictedTargetPrice <= 0) {
			predictedTargetPrice = parseFloat(ethPrice.toFixed(2));
		}
		if (predictionSide === newSide) {
			predictionSide = undefined;
		} else {
			predictionSide = newSide;
		}
		onPredictionSelect(predictionSide, predictedTargetPrice);
	}

	function handleTargetPriceInput() {
		if (predictionSide) {
			predictionSide = undefined;
			onPredictionSelect(undefined, predictedTargetPrice);
		}
	}

	function handleTokenSwap() {
		if (!payToken || !receiveToken) return;
		const tempToken = payToken;
		payToken = receiveToken;
		receiveToken = tempToken;

		const tempAmount = payAmount;
		if (receiveAmount !== undefined && receiveAmount !== null && receiveAmount > 0) {
			payAmount = receiveAmount;
		} else {
			payAmount = undefined;
		}
	}

	$: if (payAmount !== undefined || payToken || receiveToken || ethPrice)
		recalculateReceiveAmount();

	$: if (payAmount !== undefined) updatePredictionStake();

	$: if (
		predictionStakeAmount !== undefined ||
		predictionSide ||
		totalBullWeight !== undefined ||
		totalBearWeight !== undefined ||
		protocolFeeRate !== undefined
	)
		calculatePotentialReward();

	let placeholderTargetPrice: string;
	$: placeholderTargetPrice = `Target price (e.g., ${ethPrice ? ethPrice.toFixed(2) : '2500'})`;
</script>

<!-- Restored Template -->
<div class="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
	<!-- Input for Pay Amount -->
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
				{#if payToken && payToken.symbol}
					<img
						src="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92b25668/svg/color/{payToken.symbol.toLowerCase()}.svg"
						alt={payToken.symbol}
						class="h-5 w-5"
						on:error={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
					/>
					{payToken.symbol}
				{:else}
					Select Token
				{/if}
			</button>
		</div>
	</div>

	<!-- Current ETH Price Display & Swap Button -->
	<div class="relative -my-3 flex items-center justify-center">
		<span class="absolute top-1/2 left-0 -translate-y-1/2 text-xs text-gray-500"
			>1 {payToken?.symbol ?? ''} ≈ {payToken?.symbol === 'ETH'
				? ethPrice.toFixed(2)
				: (1 / ethPrice).toFixed(6)}
			{receiveToken?.symbol ?? ''}</span
		>
		<button
			on:click={handleTokenSwap}
			class="z-10 rounded-full border border-slate-300 bg-slate-200 p-2 text-slate-600 shadow transition hover:bg-slate-300"
			aria-label="Swap tokens"
		>
			{#if browser}
				<SortHorizontalOutline class="h-5 w-5" />
			{/if}
		</button>
		<span class="absolute top-1/2 right-0 -translate-y-1/2 text-xs text-gray-500"
			>Pool Fee: 0.3%</span
		>
	</div>

	<!-- Input for Receive Amount -->
	<div>
		<label for="receiveAmountInput" class="mb-1 block text-sm font-medium text-gray-700"
			>You Receive (Estimated)</label
		>
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
				{#if receiveToken && receiveToken.symbol}
					<img
						src="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92b25668/svg/color/{receiveToken.symbol.toLowerCase()}.svg"
						alt={receiveToken.symbol}
						class="h-5 w-5"
						on:error={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
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
				on:input={handleTargetPriceInput}
				on:focus={() => (isTargetPriceInputFocused = true)}
				on:blur={() => (isTargetPriceInputFocused = false)}
				class="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-sky-500"
				placeholder={placeholderTargetPrice}
				min="0.000001"
				step="any"
			/>
			<!-- Bullish (Above Target) Button -->
			<button
				on:click={() => handleTargetPrediction('above')}
				class:button-active={predictionSide === 'above_target'}
				class:button-inactive={predictionSide !== 'above_target'}
				class="flex h-10 w-12 items-center justify-center rounded-md p-2.5 text-sm font-bold text-white transition
          {predictionSide === 'above_target'
					? 'bg-sky-500 ring-2 ring-sky-300 hover:bg-sky-600'
					: 'bg-slate-400 hover:bg-slate-500 disabled:opacity-50'}"
				disabled={!predictedTargetPrice || predictedTargetPrice <= 0}
				aria-label="Predict price will be above target"
			>
				<ArrowUpOutline class="h-5 w-5" />
			</button>
			<!-- Bearish (Below Target) Button -->
			<button
				on:click={() => handleTargetPrediction('below')}
				class:button-active={predictionSide === 'below_target'}
				class:button-inactive={predictionSide !== 'below_target'}
				class="flex h-10 w-12 items-center justify-center rounded-md p-2.5 text-sm font-bold text-white transition
          {predictionSide === 'below_target'
					? 'bg-rose-500 ring-2 ring-rose-300 hover:bg-rose-600'
					: 'bg-slate-400 hover:bg-slate-500 disabled:opacity-50'}"
				disabled={!predictedTargetPrice || predictedTargetPrice <= 0}
				aria-label="Predict price will be below target"
			>
				<ArrowDownOutline class="h-5 w-5" />
			</button>
		</div>

		{#if (predictionSide === 'above_target' || predictionSide === 'below_target') && predictedTargetPrice && predictedTargetPrice > 0}
			<div
				class="rounded-md p-2 text-center text-xs
        {predictionSide === 'above_target'
					? 'bg-sky-100 text-sky-700'
					: 'bg-rose-100 text-rose-700'} transition-all duration-300 ease-in-out"
			>
				You predict {payToken?.symbol ?? ''}/{receiveToken?.symbol ?? ''} price will be
				<span class="font-bold"
					>{predictionSide === 'above_target' ? 'ABOVE' : 'BELOW'}
					{predictedTargetPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span
				> in 24h.
			</div>
		{/if}
	</div>

	<!-- Prediction Stake Info -->
	{#if displayStakeInfo}
		<div
			class="-mt-1 mb-3 px-2 text-center text-xs text-gray-500 transition-opacity duration-300 ease-in-out"
		>
			(Your prediction stake: <span class="font-semibold text-gray-700"
				>{predictionStakeAmount.toFixed(
					Math.min(8, (payAmount?.toString().split('.')[1] || '').length + 2)
				)}
				{payToken?.symbol}</span
			>, 1% of swap)
		</div>
	{/if}

	<!-- Prediction Details & Potential Reward -->
	{#if predictionStakeAmount > 0 && (predictionSide === 'above_target' || predictionSide === 'below_target') && potentialTotalReward !== undefined}
		<div
			class="mt-0 mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-300 ease-in-out"
		>
			<div class="flex justify-between">
				<span>Your Prediction Stake:</span>
				<span class="font-semibold text-slate-800"
					>{predictionStakeAmount.toFixed(6)} {payToken?.symbol}</span
				>
			</div>
			<div class="mt-1 flex justify-between">
				<span>Potential Net Profit:</span>
				<span class="font-semibold {potentialNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}">
					{potentialNetProfit >= 0 ? '+' : ''}{potentialNetProfit.toFixed(6)}
					{payToken?.symbol}
				</span>
			</div>
			<div class="mt-1 flex justify-between">
				<span>Potential Total Reward:</span>
				<span class="font-semibold text-slate-800"
					>{potentialTotalReward.toFixed(6)} {payToken?.symbol}</span
				>
			</div>
			<div class="mt-2 text-xs text-slate-500">
				This is an estimate. Actual rewards depend on final pool sizes and market resolution.
			</div>
		</div>
	{/if}

	<!-- Action Button -->
	<button
		class="flex w-full items-center justify-center gap-3 rounded-lg px-6 py-4 text-xl font-extrabold text-white shadow-md transition focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60
      {predictionSide === 'above_target'
			? 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-400'
			: predictionSide === 'below_target'
				? 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-400'
				: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500'}"
		disabled={!payAmount ||
			payAmount <= 0 ||
			!predictionSide ||
			!predictedTargetPrice ||
			predictedTargetPrice <= 0}
	>
		<CheckOutline class="h-7 w-7" />
		SWAP & PREDICT
	</button>

	<!-- Fee Information -->
	<div class="text-center text-xs text-gray-500">
		Network Fee: {networkFee ? networkFee.toFixed(5) : 'N/A'} ETH | Protocol Fee: {(
			protocolFeeRate * 100
		).toFixed(1)}% on prediction pool
	</div>
</div>

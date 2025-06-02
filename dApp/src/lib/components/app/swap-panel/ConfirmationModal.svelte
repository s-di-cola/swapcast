<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { formatNumber } from '$lib/helpers/formatters';
	import type { PredictionSide, Token } from '$lib/types';

	let {
		open = $bindable(false),
		payAmount = 0,
		payToken,
		receiveAmount = 0,
		receiveToken,
		predictionSide,
		predictedTargetPrice,
		predictionStakeAmount = 0,
		networkFee = 0,
		marketName = '',
		totalBullWeight = 0,
		totalBearWeight = 0,
		protocolFeeRate = 0.05,
		onConfirm,
		onClose,
		isSubmitting = false,
		displayExchangeRate = '0.00'
	}: {
		open?: boolean;
		payAmount?: number;
		payToken: Token;
		receiveAmount?: number;
		receiveToken: Token;
		predictionSide?: PredictionSide;
		predictedTargetPrice?: number;
		predictionStakeAmount?: number;
		networkFee?: number;
		marketName?: string;
		totalBullWeight?: number;
		totalBearWeight?: number;
		protocolFeeRate?: number;
		onConfirm: () => Promise<void>;
		onClose: () => void;
		isSubmitting?: boolean;
		displayExchangeRate?: string;
	} = $props();

	// Calculate potential rewards based on README formulas
	const calculations = $derived(() => {
		const convictionWeight = predictionStakeAmount; // In ETH
		const totalPool = totalBullWeight + totalBearWeight + convictionWeight;
		const protocolFee = totalPool * protocolFeeRate;
		const distributablePool = totalPool - protocolFee;

		const isAbove = predictionSide === 'above_target';
		const currentSideWeight = isAbove ? totalBullWeight : totalBearWeight;
		const totalWinningWeight = currentSideWeight + convictionWeight;

		// Potential reward if prediction wins
		const potentialReward =
			totalWinningWeight > 0 ? (convictionWeight / totalWinningWeight) * distributablePool : 0;

		// Net payout (reward minus original stake)
		const netPayout = potentialReward - convictionWeight;

		// Return on investment
		const roi = convictionWeight > 0 ? (netPayout / convictionWeight) * 100 : 0;

		return {
			totalPool,
			distributablePool,
			potentialReward,
			netPayout,
			roi,
			protocolFee,
			currentSideWeight,
			oppositeSideWeight: isAbove ? totalBearWeight : totalBullWeight
		};
	});
</script>

<Modal bind:open class="w-full max-w-md overflow-hidden p-0">
	<div class="p-6">
		<h3 class="mb-4 text-xl font-semibold text-gray-900">Confirm Swap & Prediction</h3>

		<div class="space-y-6">
			<!-- Swap Details -->
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-gray-500">You are swapping</h4>
				<div class="rounded-xl bg-gray-50 p-4">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-2xl font-semibold text-gray-900">{formatNumber(payAmount)}</div>
							<div class="text-sm text-gray-500">{payToken?.symbol}</div>
						</div>
						<div class="text-right">
							<div class="text-2xl font-semibold text-gray-900">→</div>
							<div class="text-sm text-gray-500">
								1 {payToken?.symbol} = {displayExchangeRate}
								{receiveToken?.symbol}
							</div>
						</div>
						<div class="text-right">
							<div class="text-2xl font-semibold text-gray-900">{formatNumber(receiveAmount)}</div>
							<div class="text-sm text-gray-500">{receiveToken?.symbol}</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Prediction Details -->
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-gray-500">And predicting that</h4>
				<div class="rounded-xl bg-gray-50 p-4">
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Market</span>
							<span class="font-medium">{marketName}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Prediction</span>
							<span
								class="rounded-full px-2 py-1 text-xs font-medium"
								class:bg-emerald-100={predictionSide === 'above_target'}
								class:text-emerald-700={predictionSide === 'above_target'}
								class:bg-red-100={predictionSide === 'below_target'}
								class:text-red-700={predictionSide === 'below_target'}
							>
								{predictionSide === 'above_target' ? 'Price Goes Up' : 'Price Goes Down'}
							</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Target Price</span>
							<span class="font-medium">${predictedTargetPrice?.toFixed(2)}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Prediction Stake</span>
							<span class="font-medium"
								>{formatNumber(predictionStakeAmount)} {payToken?.symbol}</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Potential Reward</span>
							<span class="font-medium"
								>{formatNumber(calculations().potentialReward)} {payToken?.symbol}</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Net Payout</span>
							<span class="font-medium"
								>{formatNumber(calculations().netPayout)} {payToken?.symbol}</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600">Return on Investment (ROI)</span>
							<span class="font-medium">{calculations().roi?.toFixed(2)}%</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Pool Information -->
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-gray-500">Pool Information</h4>
				<div class="rounded-xl bg-blue-50 p-4">
					<div class="space-y-2 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-gray-600">Total Pool</span>
							<span class="font-medium">{formatNumber(calculations().totalPool)} ETH</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-gray-600"
								>Your Side ({predictionSide === 'above_target' ? 'Bullish' : 'Bearish'})</span
							>
							<span class="font-medium"
								>{formatNumber(calculations().currentSideWeight + predictionStakeAmount)} ETH</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-gray-600">Opposite Side</span>
							<span class="font-medium">{formatNumber(calculations().oppositeSideWeight)} ETH</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-gray-600">Protocol Fee ({(protocolFeeRate * 100).toFixed(1)}%)</span
							>
							<span class="font-medium">{formatNumber(calculations().protocolFee)} ETH</span>
						</div>
						<div class="flex items-center justify-between border-t pt-2">
							<span class="font-medium text-gray-600">Distributable Pool</span>
							<span class="font-semibold">{formatNumber(calculations().distributablePool)} ETH</span
							>
						</div>
					</div>
				</div>
			</div>

			<!-- Network Fees -->
			<div class="space-y-2 text-sm">
				<div class="flex items-center justify-between">
					<span class="text-gray-500">Network Fee</span>
					<span class="font-medium">{networkFee.toFixed(8)} ETH</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-gray-500">Exchange Rate</span>
					<span class="font-medium"
						>1 {payToken?.symbol} = {displayExchangeRate} {receiveToken?.symbol}</span
					>
				</div>
			</div>

			<button
				onclick={onConfirm}
				disabled={isSubmitting}
				class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-70"
			>
				{#if isSubmitting}
					<div class="flex items-center justify-center gap-2">
						<svg
							class="h-5 w-5 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span>Confirming...</span>
					</div>
				{:else}
					Confirm Swap & Prediction
				{/if}
			</button>

			<p class="text-center text-xs text-gray-500">
				By confirming, you agree to our Terms of Service and acknowledge that you may lose your
				prediction stake.
			</p>
		</div>
	</div>
</Modal>

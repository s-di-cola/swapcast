<script lang="ts">
	import type { Token, PredictionSide } from '../../../types';
	import { TrendingUp, TrendingDown, HelpCircle, Check } from 'lucide-svelte';

	let {
		predictionSide,
		predictionStakeAmount = 0,
		payToken,
		payAmount = 0,
		ethPrice = 0,
		totalBullWeight = 0,
		totalBearWeight = 0,
		protocolFeeRate = 0.03,
		predictedTargetPrice,
		onPredictionSelect,
		onTargetPriceChange,
		onHelpClick
	}: {
		predictionSide: PredictionSide | null;
		predictionStakeAmount?: number;
		payToken: Token;
		payAmount?: number;
		ethPrice?: number;
		totalBullWeight?: number;
		totalBearWeight?: number;
		protocolFeeRate?: number;
		predictedTargetPrice: number | undefined;
		onPredictionSelect: (side: PredictionSide) => void;
		onTargetPriceChange: (price: number) => void;
		onHelpClick: () => void;
	} = $props();

	// Derived calculations
	let bullishPercentage = $derived(() => {
		const total = totalBullWeight + totalBearWeight;
		return total > 0 ? (totalBullWeight / total) * 100 : 50;
	});

	let bearishPercentage = $derived(() => {
		const total = totalBullWeight + totalBearWeight;
		return total > 0 ? (totalBearWeight / total) * 100 : 50;
	});

	// Advanced reward calculations based on README formulas
	let rewardAnalysis = $derived(() => {
		if (!predictionStakeAmount || predictionStakeAmount <= 0 || !predictionSide) {
			return {
				potentialReward: 0,
				roi: 0,
				poolShare: 0,
				riskLevel: 'unknown',
				timingBonus: 0,
				yourSideWeight: 0,
				oppositeSideWeight: 0,
				isEarlyPosition: false,
				crowdedSide: null,
				totalPool: 0,
				distributablePool: 0
			};
		}

		const convictionWeight = predictionStakeAmount;
		const totalPool = totalBullWeight + totalBearWeight + convictionWeight;
		const protocolFee = totalPool * protocolFeeRate;
		const distributablePool = totalPool - protocolFee;

		const isAbove = predictionSide === 'above_target';
		const currentSideWeight = isAbove ? totalBullWeight : totalBearWeight;
		const oppositeSideWeight = isAbove ? totalBearWeight : totalBullWeight;
		const totalWinningWeight = currentSideWeight + convictionWeight;

		// Potential reward calculation
		const potentialReward =
			totalWinningWeight > 0 ? (convictionWeight / totalWinningWeight) * distributablePool : 0;

		// ROI calculation
		const netPayout = potentialReward - convictionWeight;
		const roi = convictionWeight > 0 ? (netPayout / convictionWeight) * 100 : 0;

		// Pool share percentage
		const poolShare = totalWinningWeight > 0 ? (convictionWeight / totalWinningWeight) * 100 : 0;

		// Risk assessment
		const sideRatio = oppositeSideWeight > 0 ? currentSideWeight / oppositeSideWeight : 1;
		let riskLevel: 'low' | 'medium' | 'high';
		if (sideRatio > 2)
			riskLevel = 'high'; // Your side is crowded
		else if (sideRatio > 0.5) riskLevel = 'medium';
		else riskLevel = 'low'; // Your side is underdog

		// Early position bonus (if total pool is small)
		const isEarlyPosition = totalPool < 1.0; // Less than 1 ETH total
		const timingBonus = isEarlyPosition ? 25 : 0;

		// Determine crowded side
		const crowdedSide =
			totalBullWeight > totalBearWeight * 1.5
				? 'bull'
				: totalBearWeight > totalBullWeight * 1.5
					? 'bear'
					: null;

		return {
			potentialReward,
			roi,
			poolShare,
			riskLevel,
			timingBonus,
			yourSideWeight: currentSideWeight + convictionWeight,
			oppositeSideWeight,
			isEarlyPosition,
			crowdedSide,
			totalPool,
			distributablePool
		};
	});

	let potentialPayout = $derived(() => rewardAnalysis().potentialReward);

	let animatePrediction = false;
	let isTargetPriceInputFocused = false;

	const placeholderTargetPrice = `e.g., ${ethPrice ? ethPrice.toFixed(2) : '2500'}`;

	function setQuickTargetPrice(percentChange: number): void {
		if (!ethPrice) return;

		const multiplier = 1 + percentChange / 100;
		const newPrice = Math.round(ethPrice * multiplier * 100) / 100;
		onTargetPriceChange(newPrice);

		if (!predictionSide) {
			onPredictionSelect(percentChange > 0 ? 'above_target' : 'below_target');
		}
	}

	function selectPredictionSide(side: PredictionSide): void {
		onPredictionSelect(side);
		animatePrediction = true;
		setTimeout(() => (animatePrediction = false), 500);
	}

	function handleTargetPriceInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		const value = parseFloat(target.value) || 0;
		onTargetPriceChange(value);
	}
</script>

<div
	class="space-y-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-5"
>
	<!-- Prediction Header -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="font-semibold text-gray-900">Price Prediction</h3>
			<div class="space-y-1 text-sm text-gray-600">
				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"
					>
						<span class="text-orange-600">🔸</span>
						ETH Stake
					</span>
					<span class="font-semibold text-gray-900">{predictionStakeAmount.toFixed(6)} ETH</span>
				</div>
				<div class="ml-2 text-xs text-gray-500">
					(1% of your {payAmount.toFixed(6)}
					{payToken?.symbol} swap)
				</div>
			</div>
		</div>
		<button
			type="button"
			class="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-100"
			onclick={onHelpClick}
		>
			<HelpCircle class="h-3 w-3" />
			Help
		</button>
	</div>

	<div class="mt-4 space-y-4">
		<!-- Prediction Buttons -->
		<div class="grid grid-cols-2 gap-3">
			<button
				type="button"
				onclick={() => onPredictionSelect('above_target')}
				class:bg-emerald-50={predictionSide === 'above_target'}
				class:border-emerald-500={predictionSide === 'above_target'}
				class:text-emerald-700={predictionSide === 'above_target'}
				class="relative flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-4 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
				>
					<TrendingUp class="h-6 w-6" />
				</div>
				<span class="mt-2 font-medium">Price Goes Up</span>
				<span class="text-xs text-gray-500">Above target price</span>
				{#if predictionSide === 'above_target'}
					<div
						class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"
					>
						<Check class="h-4 w-4" />
					</div>
				{/if}
			</button>

			<button
				type="button"
				onclick={() => onPredictionSelect('below_target')}
				class:bg-red-50={predictionSide === 'below_target'}
				class:border-red-500={predictionSide === 'below_target'}
				class:text-red-700={predictionSide === 'below_target'}
				class="relative flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-4 text-center transition-all hover:border-red-300 hover:bg-red-50/50 hover:shadow-sm"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"
				>
					<TrendingDown class="h-6 w-6" />
				</div>
				<span class="mt-2 font-medium">Price Goes Down</span>
				<span class="text-xs text-gray-500">Below target price</span>
				{#if predictionSide === 'below_target'}
					<div
						class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
					>
						<Check class="h-4 w-4" />
					</div>
				{/if}
			</button>
		</div>

		<!-- Target Price Input -->
		<div class="space-y-3">
			<div class="space-y-2">
				<label for="targetPriceInput" class="text-sm font-medium text-gray-700"
					>Target price in 24h</label
				>
				<div class="relative">
					<div class="absolute top-1/2 left-4 -translate-y-1/2 text-gray-500">$</div>
					<input
						type="number"
						bind:value={predictedTargetPrice}
						oninput={handleTargetPriceInput}
						onfocusin={() => (isTargetPriceInputFocused = true)}
						onfocusout={() => (isTargetPriceInputFocused = false)}
						class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-sm font-medium transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="Enter target price"
						min="0"
						step="0.01"
					/>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => onTargetPriceChange(ethPrice * 1.05)}
					class="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
				>
					+5%
				</button>
				<button
					type="button"
					onclick={() => onTargetPriceChange(ethPrice * 1.1)}
					class="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
				>
					+10%
				</button>
				<button
					type="button"
					onclick={() => onTargetPriceChange(ethPrice * 1.2)}
					class="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
				>
					+20%
				</button>
				<button
					type="button"
					onclick={() => onTargetPriceChange(ethPrice * 1.5)}
					class="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
				>
					+50%
				</button>
			</div>
		</div>
	</div>

	<!-- Advanced Reward Breakdown -->
	{#if predictionStakeAmount > 0 && (predictionSide === 'above_target' || predictionSide === 'below_target')}
		<div class="mt-4 space-y-3">
			<!-- Main Reward Display -->
			<div
				class="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-green-50 p-4 shadow-sm"
			>
				<div class="relative z-10">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
							<span class="text-sm font-semibold text-emerald-900">Potential Reward</span>
						</div>
						<div class="flex items-center gap-1">
							{#if rewardAnalysis().riskLevel === 'low'}
								<div class="h-2 w-2 rounded-full bg-green-500"></div>
								<span class="text-xs font-medium text-green-700">Low Risk</span>
							{:else if rewardAnalysis().riskLevel === 'medium'}
								<div class="h-2 w-2 rounded-full bg-yellow-500"></div>
								<span class="text-xs font-medium text-yellow-700">Medium Risk</span>
							{:else}
								<div class="h-2 w-2 rounded-full bg-red-500"></div>
								<span class="text-xs font-medium text-red-700">High Risk</span>
							{/if}
						</div>
					</div>

					<div class="flex items-end justify-between">
						<div>
							<div class="text-2xl font-bold text-emerald-900">
								{rewardAnalysis().potentialReward.toFixed(3)} ETH
							</div>
							<div class="text-sm text-emerald-700">
								${(rewardAnalysis().potentialReward * ethPrice).toFixed(2)} USD
							</div>
						</div>
						<div class="text-right">
							<div class="text-lg font-bold text-emerald-800">
								+{rewardAnalysis().roi.toFixed(0)}%
							</div>
							<div class="text-xs text-emerald-600">ROI</div>
						</div>
					</div>

					<!-- Pool Share Progress Bar -->
					<div class="mt-3">
						<div class="mb-1 flex items-center justify-between">
							<span class="text-xs text-emerald-700">Your Pool Share</span>
							<span class="text-xs font-medium text-emerald-800"
								>{rewardAnalysis().poolShare.toFixed(1)}%</span
							>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-emerald-100">
							<div
								class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500 ease-out"
								style="width: {Math.min(rewardAnalysis().poolShare, 100)}%"
							></div>
						</div>
					</div>
				</div>

				<!-- Background decoration -->
				<div
					class="absolute top-0 right-0 h-20 w-20 translate-x-10 -translate-y-10 rounded-full bg-emerald-200/30"
				></div>
				<div
					class="absolute bottom-0 left-0 h-16 w-16 -translate-x-8 translate-y-8 rounded-full bg-green-200/20"
				></div>
			</div>

			<!-- Pool Dynamics -->
			<div class="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700">Pool Dynamics</span>
					{#if rewardAnalysis().isEarlyPosition}
						<div class="flex items-center gap-1">
							<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"></div>
							<span class="text-xs font-medium text-orange-700"
								>Early Position +{rewardAnalysis().timingBonus}%</span
							>
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-3 text-xs">
					<div class="space-y-1">
						<div class="flex justify-between">
							<span class="text-gray-600">Your Side</span>
							<span class="font-medium">{rewardAnalysis().yourSideWeight.toFixed(3)} ETH</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Opposite Side</span>
							<span class="font-medium">{rewardAnalysis().oppositeSideWeight.toFixed(3)} ETH</span>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between">
							<span class="text-gray-600">Total Pool</span>
							<span class="font-medium">{rewardAnalysis().totalPool.toFixed(3)} ETH</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">After Fees</span>
							<span class="font-medium">{rewardAnalysis().distributablePool.toFixed(3)} ETH</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Smart Insights -->
			{#if rewardAnalysis().crowdedSide || rewardAnalysis().isEarlyPosition || rewardAnalysis().riskLevel === 'low'}
				<div class="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
					<div class="flex items-start gap-2">
						<div class="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
							<span class="text-xs font-bold text-white">💡</span>
						</div>
						<div class="flex-1 text-xs text-blue-800">
							{#if rewardAnalysis().riskLevel === 'low'}
								<span class="font-medium">Great odds!</span> You're betting on the underdog side - higher
								potential rewards if you're right.
							{:else if rewardAnalysis().isEarlyPosition}
								<span class="font-medium">Early bird bonus!</span> Small pool means your prediction has
								high impact and better rewards.
							{:else if rewardAnalysis().crowdedSide === 'bull' && predictionSide === 'below_target'}
								<span class="font-medium">Smart contrarian play!</span> Most people are bullish - bearish
								side has better odds.
							{:else if rewardAnalysis().crowdedSide === 'bear' && predictionSide === 'above_target'}
								<span class="font-medium">Against the crowd!</span> Most people are bearish - bullish
								side could pay big.
							{:else}
								<span class="font-medium">Balanced market!</span> Both sides have decent participation
								- fair odds.
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

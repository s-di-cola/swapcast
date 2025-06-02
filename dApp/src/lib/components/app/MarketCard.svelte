<script lang="ts">
	import type { Market } from '$lib/services/market/types';
	import { formatNumber } from '$lib/helpers/formatters';

	// Use SvelteKit 5 syntax for props
	const {
		market,
		currentPrice = market.priceThreshold, // Default to threshold if not provided
		onSelect = (id: string) => {},
		onViewDetails = (id: string) => {},
		selectButtonText = 'Select Market'
	} = $props<{
		market: Market;
		currentPrice?: number | null;
		onSelect?: (marketId: string) => void;
		onViewDetails?: (marketId: string) => void;
		selectButtonText?: string;
	}>();

	// Derived values from the Market type
	const bullishStake = Number(market.totalStake1) / 1e18; // Convert from wei to ETH
	const bearishStake = Number(market.totalStake0) / 1e18; // Convert from wei to ETH
	const totalStake = bullishStake + bearishStake;
	const bullishPercentage = totalStake > 0 ? (bullishStake / totalStake) * 100 : 0;
	const bearishPercentage = totalStake > 0 ? (bearishStake / totalStake) * 100 : 0;
</script>

<!-- Remove the clickable wrapper and events -->
<div class="market-card-wrapper">
	<div
		class="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 shadow-lg transition-all duration-300 hover:border-indigo-200 hover:shadow-xl"
	>
		<!-- Market header with pair name and status -->
		<div class="mb-3 flex items-center justify-between">
			<p class="text-sm font-medium text-gray-600">{market.name} Market</p>
			<div class="flex items-center space-x-2">
				<span
					class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
				>
					<svg
						class="mr-0.5 h-3 w-3"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					{market.expirationDisplay}
				</span>
				{#if totalStake > 0}
					<span
						class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
					>
						<svg
							class="mr-0.5 h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							></path>
						</svg>
						{formatNumber(totalStake)} ETH
					</span>
				{/if}
				<span
					class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
				>
					{market.status}
				</span>
			</div>
		</div>

		<!-- Price information -->
		<div class="mb-5 flex justify-between">
			<div>
				<p class="text-xs text-gray-500">Current Price</p>
				<p class="text-lg font-semibold text-gray-800">${formatNumber(currentPrice)}</p>
			</div>
			<div class="text-right">
				<p class="text-xs text-gray-500">Threshold</p>
				<p class="text-lg font-semibold text-gray-800">${formatNumber(market.priceThreshold)}</p>
			</div>
		</div>

		<!-- Above/Below threshold boxes -->
		<div class="mb-3 flex space-x-2">
			<div class="w-1/2 rounded-lg p-3" style="background-color: #ecfdf5">
				<div class="mb-2 flex items-center justify-between">
					<span
						class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
					>
						<svg
							class="mr-0.5 h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 10l7-7m0 0l7 7m-7-7v18"
							></path>
						</svg>
						Above
					</span>
					<span
						class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
					>
						<svg
							class="mr-0.5 h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							></path>
						</svg>
						{formatNumber(bullishStake)} ETH
					</span>
				</div>
				<div class="text-center text-sm font-bold text-green-800">
					{formatNumber(bullishPercentage, 1)}% conviction
				</div>
			</div>
			<div class="w-1/2 rounded-lg p-3" style="background-color: #fef2f2">
				<div class="mb-2 flex items-center justify-between">
					<span
						class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
					>
						<svg
							class="mr-0.5 h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 14l-7 7m0 0l-7-7m7 7V3"
							></path>
						</svg>
						Below
					</span>
					<span
						class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
					>
						<svg
							class="mr-0.5 h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							></path>
						</svg>
						{formatNumber(bearishStake)} ETH
					</span>
				</div>
				<div class="text-center text-sm font-bold text-red-800">
					{formatNumber(bearishPercentage, 1)}% conviction
				</div>
			</div>
		</div>

		<!-- Sentiment bar -->
		<div class="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
			<div class="h-full rounded-full bg-indigo-600" style="width: {bullishPercentage}%"></div>
		</div>

		<!-- Footer with labels -->
		<div class="mb-4 flex items-center justify-between text-xs">
			<div class="font-medium text-indigo-600">Bullish</div>
			<div class="text-gray-500">Bearish</div>
		</div>

		<!-- Action buttons - side by side -->
		<div class="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
			<!-- View Details button -->
			<button
				class="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 sm:flex-1 sm:px-4 sm:text-base"
				onclick={() => onViewDetails(market.id)}
			>
				<svg
					class="h-4 w-4 flex-shrink-0 sm:mr-1"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					></path>
				</svg>
				<span class="ml-1 sm:ml-0">View Details</span>
			</button>

			<!-- Select/Change Market button -->
			<button
				class="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:flex-1 sm:px-4 sm:text-base"
				onclick={() => onSelect(market.id)}
			>
				<svg
					class="h-4 w-4 flex-shrink-0 sm:mr-1"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d={selectButtonText === 'Change Market'
							? 'M11 17l-5-5m0 0l5-5m-5 5h12'
							: 'M13 7l5 5m0 0l-5 5m5-5H6'}
					></path>
				</svg>
				<span class="ml-1 sm:ml-0">{selectButtonText}</span>
			</button>
		</div>
	</div>
</div>

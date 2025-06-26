<script lang="ts">
	import type { Market } from '$lib/services/market';
	import { formatCurrency } from '$lib/helpers/formatters';

	interface Props {
		market: Market;
	}

	let { market }: Props = $props();

	// Calculate percentages for the progress bars
	const totalStake = $derived(Number(market.totalStake0) + Number(market.totalStake1));
	const bearishPercentage = $derived(totalStake > 0 ? (Number(market.totalStake0) / totalStake) * 100 : 0);
	const bullishPercentage = $derived(totalStake > 0 ? (Number(market.totalStake1) / totalStake) * 100 : 0);

	// Format stake values
	const bearishStake = $derived(formatCurrency(Number(market.totalStake0) / 1e18));
	const bullishStake = $derived(formatCurrency(Number(market.totalStake1) / 1e18));
</script>

<div class="rounded-lg bg-white p-6 shadow-sm">
	<h2 class="mb-4 text-lg font-semibold text-gray-900">Opposition Summary</h2>

	<!-- Bearish Position -->
	<div class="mb-6">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center">
				<span class="mr-2 text-sm font-medium text-gray-700">Bearish</span>
				<span class="text-sm text-gray-500">({bearishStake} ETH)</span>
			</div>
			<span class="text-sm font-medium text-gray-700">{bearishPercentage.toFixed(1)}%</span>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-red-500 transition-all duration-500"
				style="width: {bearishPercentage}%"
			/>
		</div>
	</div>

	<!-- Bullish Position -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center">
				<span class="mr-2 text-sm font-medium text-gray-700">Bullish</span>
				<span class="text-sm text-gray-500">({bullishStake} ETH)</span>
			</div>
			<span class="text-sm font-medium text-gray-700">{bullishPercentage.toFixed(1)}%</span>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-green-500 transition-all duration-500"
				style="width: {bullishPercentage}%"
			/>
		</div>
	</div>

	<!-- Total Stake -->
	<div class="mt-4 text-center text-sm text-gray-500">
		Total Stake: {formatCurrency(totalStake / 1e18)} ETH
	</div>
</div> 
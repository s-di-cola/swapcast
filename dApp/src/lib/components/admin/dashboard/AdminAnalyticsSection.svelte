<script lang="ts">
	import AdminAnalyticsChart from './AdminAnalyticsChart.svelte';

	interface Props {
		activeMarketsCount?: number;
	}

	interface LegendItem {
		color: string;
		label: string;
	}

	let { activeMarketsCount = 0 }: Props = $props();

	let selectedTimeRange = $state<'7d' | '30d'>('7d');

	const LEGEND_ITEMS: LegendItem[] = [
		{ color: 'bg-indigo-500', label: 'Markets Created' },
		{ color: 'bg-emerald-500', label: 'Active Predictions' }
	] as const;

	function setTimeRange(range: '7d' | '30d'): void {
		selectedTimeRange = range;
	}
</script>

<section class="mb-10">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-semibold text-gray-800">Platform Analytics</h2>
	</div>

	<div
		class="min-h-[300px] rounded-lg border border-gray-100 bg-white p-6 shadow-sm md:min-h-[400px]"
	>
		<div class="mb-6 flex items-center justify-between">
			<div class="space-y-2">
				{#each LEGEND_ITEMS as item}
					<div class="flex items-center space-x-2">
						<div class="h-3 w-3 rounded-full {item.color}"></div>
						<span class="text-sm text-gray-600">{item.label}</span>
					</div>
				{/each}
			</div>

			<div class="text-right">
				<h3 class="text-2xl font-bold text-gray-900">{activeMarketsCount}</h3>
				<p class="text-sm text-gray-500">Active Markets</p>
			</div>
		</div>

		<div class="h-64 border-t border-gray-100 pt-6">
			<AdminAnalyticsChart timeRange={selectedTimeRange} />
		</div>
	</div>
</section>

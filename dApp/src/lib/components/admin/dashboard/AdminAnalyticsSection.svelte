<script lang="ts">
	import { onMount } from 'svelte';
	import { getGlobalStats } from '$lib/services/subgraph';
	import AdminAnalyticsChart from './AdminAnalyticsChart.svelte';
	import { formatEth } from '$lib/utils/formatter';

	interface LegendItem {
		color: string;
		label: string;
	}

	let treasuryBalance = $state('0');
	let selectedTimeRange = $state<'7d' | '30d'>('7d');

	const LEGEND_ITEMS: LegendItem[] = [
		{ color: 'bg-indigo-500', label: 'Markets Created' },
		{ color: 'bg-emerald-500', label: 'Active Predictions' }
	] as const;

	onMount(async () => {
		await fetchProtocolFees();
	});

	/**
	 * Fetches total protocol fees from subgraph global stats
	 */
	async function fetchProtocolFees() {
		try {
			const globalStats = await getGlobalStats();
			if (globalStats) {
				treasuryBalance = formatEth(globalStats.totalProtocolFees, { fromWei: true });
			} else {
				console.warn('No global stats available');
				treasuryBalance = '0';
			}
		} catch (error) {
			console.error('Error fetching protocol fees:', error);
			treasuryBalance = '0';
		}
	}

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
				<h3 class="text-2xl font-bold text-gray-900">{treasuryBalance} ETH</h3>
				<p class="text-sm text-gray-500">Treasury Balance</p>
			</div>
		</div>

		<div class="h-64 border-t border-gray-100 pt-6">
			<AdminAnalyticsChart timeRange={selectedTimeRange} />
		</div>
	</div>
</section>

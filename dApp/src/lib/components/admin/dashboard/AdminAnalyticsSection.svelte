<script lang="ts">
	import { PUBLIC_TREASURY_ADDRESS } from '$env/static/public';
	import { getCurrentNetworkConfig } from '$lib/utils/network';
	import { onMount } from 'svelte';
	import { createPublicClient, http } from 'viem';
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
		await fetchTreasuryBalance();
	});

	async function fetchTreasuryBalance() {
        try {
			const { chain , rpcUrl} = getCurrentNetworkConfig();
            const publicClient = createPublicClient({
				chain,
				transport: http(rpcUrl)
			});
            const balance = await publicClient.getBalance({
                address: PUBLIC_TREASURY_ADDRESS
            });
            
             treasuryBalance = formatEth(balance,{fromWei: true});
        } catch (error) {
            console.error('Error fetching treasury balance:', error);
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

<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getMarketDetails, type Market } from '$lib/services/market';
	import MarketStatus from '$lib/components/app/market/MarketStatus.svelte';
	import OppositionSummary from '$lib/components/app/market/OppositionSummary.svelte';
	import TransactionHistory from '$lib/components/app/market/TransactionHistory.svelte';
	
	// Get the market ID from the URL
	let marketId = $derived($page.params.id);

	// Market state
	let market = $state<Market | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	async function fetchMarketData() {
		try {
			isLoading = true;
			error = null;
			const data = await getMarketDetails(marketId);
			if (data?.exists) {
				market = data;
			} else {
				error = 'Market not found';
			}
		} catch (err) {
			console.error('Error fetching market details:', err);
			error = 'Failed to load market details';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchMarketData();
	});
</script>

<div class="max-w-6xl mx-auto p-6 pt-24">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">Market Details</h1>
		<p class="text-gray-600">Market ID: {marketId}</p>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600"></div>
			<span class="ml-3 text-gray-600">Loading market details...</span>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
			<h3 class="text-lg font-semibold">Error</h3>
			<p>{error}</p>
		</div>
	{:else if market}
		<div class="space-y-6">
			<!-- Market Status Section -->
			<MarketStatus {market} />

			<!-- Opposition Summary Section -->
			<OppositionSummary {market} />

			<!-- Transaction History Section -->
			<TransactionHistory {market} />

			<!-- Your Positions Section -->
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<h2 class="text-lg font-semibold mb-2">Your Positions</h2>
				<p class="text-gray-500">Your bets in this market will appear here...</p>
			</div>

			<!-- Claim Rewards Section -->
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<h2 class="text-lg font-semibold mb-2">Claim Rewards</h2>
				<p class="text-gray-500">Claimable rewards will appear here...</p>
			</div>
		</div>
	{/if}
</div> 
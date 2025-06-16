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
	<div class="mb-8">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Market Details</h1>
				<p class="text-gray-600 mt-1">Market ID: {marketId}</p>
			</div>
			<div class="flex gap-3">
				<button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
					Place Bet
				</button>
				<button class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
					Share Market
				</button>
			</div>
		</div>
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
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Left Column: Market Status and Opposition Summary -->
			<div class="lg:col-span-2 space-y-6">
				<div class="bg-white rounded-xl border border-gray-200 shadow-sm">
					<MarketStatus {market} />
				</div>

				<div class="bg-white rounded-xl border border-gray-200 shadow-sm">
					<OppositionSummary {market} />
				</div>

				<div class="bg-white rounded-xl border border-gray-200 shadow-sm">
					<TransactionHistory {market} />
				</div>
			</div>

			<!-- Right Column: User Actions and Info -->
			<div class="space-y-6">
				<!-- Your Positions Section -->
				<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
					<h2 class="text-xl font-semibold mb-4">Your Positions</h2>
					<div class="space-y-4">
						<div class="p-4 bg-gray-50 rounded-lg">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium">Bullish Position</span>
								<span class="text-green-600">+2.5 ETH</span>
							</div>
							<div class="text-sm text-gray-500">
								Potential Payout: 5.0 ETH
							</div>
						</div>
						<button class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
							Increase Position
						</button>
					</div>
				</div>

				<!-- Claim Rewards Section -->
				<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
					<h2 class="text-xl font-semibold mb-4">Claim Rewards</h2>
					<div class="space-y-4">
						<div class="p-4 bg-gray-50 rounded-lg">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium">Available Rewards</span>
								<span class="text-green-600">3.2 ETH</span>
							</div>
							<div class="text-sm text-gray-500">
								Market ends in 2 days
							</div>
						</div>
						<button class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
							Claim Rewards
						</button>
					</div>
				</div>

				<!-- Market Info Card -->
				<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
					<h2 class="text-xl font-semibold mb-4">Market Info</h2>
					<div class="space-y-3">
						<div class="flex justify-between">
							<span class="text-gray-600">Created</span>
							<span class="font-medium">2 days ago</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Total Volume</span>
							<span class="font-medium">125.4 ETH</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Total Bets</span>
							<span class="font-medium">48</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div> 
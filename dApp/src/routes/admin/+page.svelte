<script lang="ts">
    import {onMount} from 'svelte';
    import {page} from '$app/stores';
    import {getAllMarkets, getMarketCount, type Market} from '$lib/services/market/marketService';
    import CreateMarketModal from '$lib/components/admin/CreateMarketModal.svelte';
    import MarketDetailsModal from '$lib/components/admin/MarketDetailsModal.svelte';
    import {toastStore} from '$lib/stores/toastStore';

    // State variables with Svelte 5 runes
	let markets = $state<Market[]>([]);
	let marketCount = $state(0);
	let totalStake = $state(0);
	let loading = $state(true);
	let error = $state('');
	let showCreateMarketModal = $state(false);
	let showMarketDetailsModal = $state(false);
	let selectedMarketId = $state<string | null>(null);
	
	// Toast notifications are now handled by the global toast store

	// Format currency values
	function formatCurrency(value: string | number): string {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (num >= 1_000_000) {
			return `$${(num / 1_000_000).toFixed(2)}M`;
		} else if (num >= 1_000) {
			return `$${(num / 1_000).toFixed(2)}K`;
		} else {
			return `$${num.toFixed(2)}`;
		}
	}

	// Show toast notification using the global toast store
	function showToast(type: 'success' | 'error', message: string, duration: number = 5000) {
		const options = { duration };
		if (type === 'success') {
			toastStore.success(message, options);
		} else {
			toastStore.error(message, options);
		}
	}

	// Fetch market data
	async function fetchMarketData() {
		try {
			loading = true;
			error = '';

			// Get market count
			marketCount = await getMarketCount();

			// Get all markets
			markets = await getAllMarkets();

			// Calculate total stake
			totalStake = markets.reduce((sum, market) => {
				return sum + parseFloat(market.totalStake || '0');
			}, 0);

			loading = false;
		} catch (err) {
			console.error('Error fetching market data:', err);
			error = 'Failed to load market data. Please try again.';
			showToast('error', 'Failed to load market data. Please try again.');
			loading = false;
		}
	}

	// Open market details modal
	function handleMarketClick(marketId: string) {
		console.log(`[AdminDashboard] handleMarketClick called for marketId: ${marketId}`);
		selectedMarketId = marketId;
		showMarketDetailsModal = true;
	}

	// Refresh data
	function refreshData() {
		fetchMarketData();
		showToast('success', 'Market data refreshed successfully');
	}

	// Handle market creation from modal
	function handleMarketCreated() {
		fetchMarketData(); // Refresh market list
		showToast('success', 'New market created successfully!');
	}

	// Create derived values using $derived rune
	let openMarketsCount = $derived(markets.filter(m => m.status === 'Open').length);
	let expiredMarketsCount = $derived(markets.filter(m => m.status === 'Expired').length);
	let resolvedMarketsCount = $derived(markets.filter(m => m.status === 'Resolved').length);

	// Check URL parameters for market ID on mount
	onMount(() => {
		fetchMarketData();

		// Check if marketId is in URL parameters
		const marketIdParam = $page.url.searchParams.get('marketId');
		if (marketIdParam) {
			selectedMarketId = marketIdParam;
			showMarketDetailsModal = true;
		}
	});

	// Setup an effect to update the page title when market count changes
	$effect(() => {
		if (marketCount > 0) {
			document.title = `SwapCast Admin (${marketCount} Markets)`;
		} else {
			document.title = 'SwapCast Admin';
		}
	});

</script>

<div class="mx-auto min-h-screen max-w-7xl p-6 md:p-10" style="background-color: #f8fafc;">
	<header class="mb-10 flex items-center justify-between border-b border-gray-200 pb-6">
		<div>
			<h1 class="text-4xl font-bold text-gray-800">SwapCast Admin</h1>
			<p class="text-md mt-2 text-gray-600">
				Overview of platform activity and market management tools.
			</p>
		</div>
		<div>
			<button
				type="button"
				onclick={() => (showCreateMarketModal = true)}
				class="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-center text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 focus:outline-none"
			>
				<svg
					class="mr-2 -ml-1 h-5 w-5"
					fill="currentColor"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
					><path
						fill-rule="evenodd"
						d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
						clip-rule="evenodd"
					></path></svg
				>
				Create New Market
			</button>
		</div>
	</header>

	<!-- Summary Boxes Section -->
	<section class="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		<div class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-sm font-semibold tracking-wider text-gray-600 uppercase">Total Markets</h2>
				<div class="rounded-full bg-indigo-50 p-2">
					<svg
						class="h-5 w-5 text-indigo-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
						></path>
					</svg>
				</div>
			</div>
			<p class="text-3xl font-bold text-gray-900">{loading ? '--' : marketCount}</p>
			<p class="mt-1 text-sm text-gray-500">{loading ? 'Fetching data...' : 'Markets created'}</p>
		</div>
		<div class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-sm font-semibold tracking-wider text-gray-600 uppercase">Active Markets</h2>
				<div class="rounded-full bg-green-50 p-2">
					<svg
						class="h-5 w-5 text-green-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
				</div>
			</div>
			<p class="text-3xl font-bold text-gray-900">
				{loading ? '--' : markets.filter((m) => m.status === 'Open').length}
			</p>
			<p class="mt-1 text-sm text-gray-500">{loading ? 'Fetching data...' : 'Currently open'}</p>
		</div>
		<div class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-sm font-semibold tracking-wider text-gray-600 uppercase">Total Volume</h2>
				<div class="rounded-full bg-purple-50 p-2">
					<svg
						class="h-5 w-5 text-purple-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
				</div>
			</div>
			<p class="text-3xl font-bold text-gray-900">
				{loading ? '$--' : formatCurrency(totalStake)}
			</p>
			<p class="mt-1 text-sm text-gray-500">
				{loading ? 'Fetching data...' : 'Total stake across all markets'}
			</p>
		</div>
	</section>

	<!-- Graph Placeholder Section -->
	<section class="mb-10">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-gray-800">Platform Analytics</h2>
			<div class="flex space-x-2">
				<button class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600"
					>Last 24h</button
				>
				<button class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
					>Last 7d</button
				>
				<button class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
					>Last 30d</button
				>
			</div>
		</div>
		<div
			class="min-h-[300px] rounded-lg border border-gray-100 bg-white p-6 shadow-sm md:min-h-[400px]"
		>
			<div class="mb-6 flex items-center justify-between">
				<div>
					<div class="flex items-center space-x-2">
						<div class="h-3 w-3 rounded-full bg-indigo-500"></div>
						<span class="text-sm text-gray-600">Markets Created</span>
					</div>
					<div class="mt-1 flex items-center space-x-2">
						<div class="h-3 w-3 rounded-full bg-green-500"></div>
						<span class="text-sm text-gray-600">Active Predictions</span>
					</div>
					<div class="mt-1 flex items-center space-x-2">
						<div class="h-3 w-3 rounded-full bg-purple-500"></div>
						<span class="text-sm text-gray-600">Platform Volume</span>
					</div>
				</div>
				<div class="text-right">
					<p class="text-2xl font-bold text-gray-900">{marketCount}</p>
					<p class="text-sm text-gray-500">Total Markets</p>
				</div>
			</div>
			<div class="flex h-64 items-center justify-center border-t border-gray-100 pt-6">
				<p class="text-sm text-gray-400">Placeholder for analytics graph</p>
			</div>
		</div>
	</section>

	<!-- Market List Table Section -->
	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-gray-800">Market List</h2>
			<button
				onclick={refreshData}
				class="flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mr-2 h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				Refresh
			</button>
		</div>

		{#if error}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
				{error}
			</div>
		{/if}

		<div class="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-100">
				<thead>
					<tr>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Market ID</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Market Name</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Asset Pair</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Status</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Ends In</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Price Threshold</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Total Stake</th
						>
						<th
							scope="col"
							class="bg-gray-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Actions</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#if loading}
						<tr>
							<td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
								<div class="flex items-center justify-center space-x-2">
									<svg
										class="h-5 w-5 animate-spin text-emerald-600"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
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
									<span>Loading market data...</span>
								</div>
							</td>
						</tr>
					{:else if markets.length > 0}
						{#each markets as market (market.id)}
							<tr
							class="cursor-pointer transition-colors hover:bg-gray-50"
							onclick={() => handleMarketClick(market.id)}
						>
								<td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900"
									>#{market.id}</td
								>
								<td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900"
									>{market.name}</td
								>
								<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{market.assetPair}</td
								>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold"
										class:bg-green-50={market.status === 'Open'}
										class:text-green-700={market.status === 'Open'}
										class:bg-yellow-50={market.status === 'Expired'}
										class:text-yellow-700={market.status === 'Expired'}
										class:bg-gray-50={market.status === 'Resolved'}
										class:text-gray-700={market.status === 'Resolved'}
									>
										{market.status}
									</span>
								</td>
								<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
									>{market.expirationDisplay}</td
								>
								<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
									>${market.priceThreshold}</td
								>
								<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
									>{formatCurrency(market.totalStake)}</td
								>
								<td class="px-6 py-4 text-sm font-medium whitespace-nowrap">
									<button class="text-indigo-600 transition-colors hover:text-indigo-800"
										>Details</button
									>
								</td>
							</tr>
						{/each}
					{:else}
						<tr>
							<td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
								No markets found. <a href="/admin/market" class="text-emerald-600 hover:underline"
									>Create your first market</a
								>.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Toast notifications are now handled by the global ToastContainer component in the layout -->

<!-- Modal components -->
<CreateMarketModal
	bind:showModal={showCreateMarketModal}
	onClose={() => (showCreateMarketModal = false)}
	on:marketCreated={handleMarketCreated}
/>

	<MarketDetailsModal
	bind:showModal={showMarketDetailsModal}
	marketId={selectedMarketId}
	onClose={() => (showMarketDetailsModal = false)}
	on:marketUpdated={() => {
		fetchMarketData();
		showToast('success', 'Market updated successfully');
	}}
/>
</div>

<style>
	/* Scoped styles for the admin dashboard */
	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes progress {
		from { width: 0%; }
		to { width: 100%; }
	}

	:global(.animate-slide-down) {
		animation: slideDown 0.2s ease-out;
	}

	:global(.shadow-stripe) {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
	}

	:global(.progress-bar) {
		animation: progress 5s linear forwards;
		width: 0%;
	}
</style>

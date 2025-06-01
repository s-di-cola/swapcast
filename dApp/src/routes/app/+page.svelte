<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import SwapPanel from '$lib/components/app/swap-panel/SwapPanel.svelte';
	import MarketCard from '$lib/components/app/MarketCard.svelte';
	import CompactMarketCard from '$lib/components/app/CompactMarketCard.svelte';
	import MarketDetailsModal from '$lib/components/admin/market/MarketDetailsModal.svelte';
	import type { PredictionSide } from '$lib/types';
	import type { Market } from '$lib/services/market/types';
	
	let selectedMarket: Market | null = $state(null);

	// State for market details modal
	let showDetailsModal = $state(false);
	let selectedMarketId = $state<string | null>(null);

	// UI state for the two-step flow
	let isMarketSelectionView = $state(true);

	// Search state
	let searchQuery = $state('');

	// Mock available markets using proper Market type
	const availableMarkets: Market[] = [
		{
			id: '1',
			name: 'ETH/USD Price Prediction',
			assetSymbol: 'ETH',
			assetPair: 'ETH/USD',
			exists: true,
			resolved: false,
			winningOutcome: 0,
			totalStake0: 2500000000000000000n, // 2.5 ETH in wei (bearish)
			totalStake1: 3500000000000000000n, // 3.5 ETH in wei (bullish)
			expirationTime: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days from now
			priceAggregator: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as `0x${string}`, // ETH/USD Chainlink
			priceThreshold: 2500, // $2500
			status: 'Open' as const,
			expirationDisplay: '7 days',
			totalStake: '6.0'
		},
		{
			id: '2',
			name: 'BTC/USD Price Prediction',
			assetSymbol: 'BTC',
			assetPair: 'BTC/USD',
			exists: true,
			resolved: false,
			winningOutcome: 0,
			totalStake0: 1800000000000000000n, // 1.8 ETH in wei (bearish)
			totalStake1: 4200000000000000000n, // 4.2 ETH in wei (bullish)
			expirationTime: Math.floor(Date.now() / 1000) + 86400 * 5, // 5 days from now
			priceAggregator: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c' as `0x${string}`, // BTC/USD Chainlink
			priceThreshold: 45000, // $45000
			status: 'Open' as const,
			expirationDisplay: '5 days',
			totalStake: '6.0'
		},
		{
			id: '3',
			name: 'USDC/USD Price Prediction',
			assetSymbol: 'USDC',
			assetPair: 'USDC/USD',
			exists: true,
			resolved: false,
			winningOutcome: 0,
			totalStake0: 5000000000000000000n, // 5.0 ETH in wei (bearish)
			totalStake1: 3000000000000000000n, // 3.0 ETH in wei (bullish)
			expirationTime: Math.floor(Date.now() / 1000) + 86400 * 3, // 3 days from now
			priceAggregator: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6' as `0x${string}`, // USDC/USD Chainlink
			priceThreshold: 1.01, // $1.01
			status: 'Open' as const,
			expirationDisplay: '3 days',
			totalStake: '8.0'
		}
	];

	// Filter markets based on search query
	const filteredMarkets: Market[] = $derived(
		searchQuery
			? availableMarkets.filter((market: Market) =>
				market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				market.assetPair.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: availableMarkets
	);

	// Function to handle market selection by Market object
	function handleMarketSelect(market: Market): void {
		console.log('handleMarketSelect called with:', market);

		selectedMarket = market;
		isMarketSelectionView = false;
		// Update URL with market ID using SvelteKit navigation
		replaceState(`?market=${market.id}`, {});
		console.log('Market selected, switching to swap view');
	}

	// Wrapper function to handle market selection by ID (for MarketCard compatibility)
	function handleMarketSelectById(marketId: string): void {
		const market = availableMarkets.find(m => m.id === marketId);
		if (market) {
			handleMarketSelect(market);
		}
	}

	// Simplified function to handle viewing market details
	function handleViewMarketDetails(marketId: string): void {
		selectedMarketId = marketId;
		showDetailsModal = true;
	}

	// Function to change market (go back to market selection view)
	function changeMarket(): void {
		isMarketSelectionView = true; // Switch back to market selection view
	}

	// Prediction selection handler
	function onPredictionSelect(side: PredictionSide, targetPrice?: number) {
		// In a real app, this would handle the prediction selection
		console.log('Prediction selected:', { side, targetPrice });
	}

	// Reset selected market
	function resetMarketSelection() {
		selectedMarket = null;
		isMarketSelectionView = true;
	}

	onMount(() => {
		// If there's a market ID in the URL, try to pre-select it
		const marketIdFromUrl = page.url.searchParams.get('market');
		if (marketIdFromUrl) {
			console.warn('Market ID from URL detected, but pre-selection is mocked.');
			// In a real app, you'd fetch the market details by ID here
			// For now, we'll just set a mock selected market
			// This part would need to be integrated with your subgraph service
			// Example mock:
			// selectedMarket = { id: marketIdFromUrl, description: 'Mock Market from URL', ... };
		}
	});
</script>

<svelte:head>
	<title>SwapCast App</title>
	<meta name="description" content="SwapCast Decentralized Prediction Market" />
</svelte:head>

<div class="min-h-screen bg-gray-50 text-gray-800 pt-20">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="flex flex-col items-center justify-center text-center mb-10">
			<h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
				<span class="block xl:inline">Predict. Swap. Earn.</span>
			</h1>
			<p class="mt-3 max-w-md text-base text-gray-500 sm:text-lg md:mt-5 md:max-w-3xl md:text-xl">
				Your hub for decentralized predictions.
			</p>
		</div>

		<div class="flex justify-center">
			<div class="w-full max-w-2xl">
				<div class="rounded-xl border border-gray-100 bg-white shadow-lg p-6 md:p-8">
					<!-- Uniswap-like interface with two states -->
					{#if isMarketSelectionView}
						<!-- Market Selection View -->
						<div class="mb-6">
							<h2 class="text-xl font-bold text-gray-900 mb-4">Select a Market</h2>

							<!-- Search bar -->
							<div class="relative mb-6">
								<input
									type="text"
									bind:value={searchQuery}
									placeholder="Search markets..."
									class="w-full rounded-lg border border-gray-300 px-4 py-3 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
								/>
								<svg
									class="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>

							<!-- Market grid using MarketCard components directly -->
							<div class="grid grid-cols-1 gap-8">
								{#if filteredMarkets.length === 0}
									<div class="col-span-full py-8 text-center">
										<svg
											class="mx-auto h-12 w-12 text-gray-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1"
												d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										<h3 class="mt-2 text-sm font-medium text-gray-900">No markets found</h3>
										<p class="mt-1 text-sm text-gray-500">Try adjusting your search to find what you're looking for.</p>
									</div>
								{:else}
									{#each filteredMarkets as market}
									<MarketCard
										market={market}
										onSelect={(marketId) => {
											// When clicking the Select button, go to swap interface
											handleMarketSelect(market);
										}}
										onViewDetails={(marketId) => {
											// When clicking the card, only show details modal
											handleViewMarketDetails(marketId);
										}}
									/>
								{/each}
								{/if}
							</div>
						</div>
					{:else}
						<!-- Swap Interface View -->
						<div>
							<!-- Compact Market Card -->
							{#if selectedMarket}
								<CompactMarketCard
									market={selectedMarket}
									onChangeMarket={() => {
										isMarketSelectionView = true;
										replaceState('', {});
									}}
								/>
							{/if}

							<!-- SwapPanel Component -->
							<SwapPanel
								marketId={selectedMarket?.id || null}
								onPredictionSelect={onPredictionSelect}
								onMarketChange={handleMarketSelectById}
								disabled={!selectedMarket}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Market Details Modal - Simplified without custom handlers -->
<div class="z-50">
	<MarketDetailsModal
		bind:showModal={showDetailsModal}
		marketId={selectedMarketId}
	/>
</div>

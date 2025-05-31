<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SwapPanel from '$lib/components/app/SwapPanel.svelte';
	import MarketCard from '$lib/components/app/MarketCard.svelte';
	import MarketDetailsModal from '$lib/components/admin/market/MarketDetailsModal.svelte';
	import type { PredictionSide, Token } from '$lib/types';
	
	// Define custom event types
	type MarketCardEvents = {
		viewDetails: CustomEvent<{ marketId: string }>
	};

	// Define formatNumber and formatPercentage functions directly
	function formatNumber(value: number | undefined, decimals: number = 2): string {
		if (value === undefined || value === null) return '0';
		return value.toLocaleString('en-US', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}
	
	function formatPercentage(value: number | undefined): string {
		if (value === undefined || value === null) return '0%';
		return `${value}%`;
	}

	interface Market {
		id: string;
		description: string;
		volume24h: number;
		change24h: number;
		image: string;
		currentPrice?: number;
		threshold?: number;
		expirationDate?: string;
		bullishStake?: number;
		bearishStake?: number;
		bullishPercentage: number;
		bearishPercentage: number;
	}

	// Type for the selected market
	let selectedMarket: Market | null = $state(null);
	
	// State for market details modal
	let showDetailsModal = $state(false);
	let selectedMarketId = $state<string | null>(null);

	// Define Token Objects
	const ethToken: Token = { symbol: 'ETH', name: 'Ethereum' };
	const usdcToken: Token = { symbol: 'USDC', name: 'USD Coin' };

	// UI state for the two-step flow
	let isMarketSelectionView = $state(true);

	// Available markets with more details
	const availableMarkets: Market[] = [
		{
			id: 'eth-usdc-1',
			description: 'ETH/USD',
			volume24h: 12500000,
			change24h: 2.5,
			image: '/icons/eth.png',
			currentPrice: 2389.42,
			threshold: 2400.00,
			expirationDate: 'Jun 15, 2025 12:00 UTC',
			bullishStake: 75000,
			bearishStake: 25000,
			bullishPercentage: 75,
			bearishPercentage: 25
		},
		{
			id: 'btc-usdc-1',
			description: 'BTC/USD',
			volume24h: 28700000,
			change24h: -1.2,
			image: '/icons/btc.png',
			currentPrice: 42156.78,
			threshold: 2400.00,
			expirationDate: 'Jul 01, 2025 18:00 UTC',
			bullishStake: 120000,
			bearishStake: 40000,
			bullishPercentage: 75,
			bearishPercentage: 25
		},
		{
			id: 'sol-usdc-1',
			description: 'SOL/USD',
			volume24h: 5800000,
			change24h: 4.7,
			image: '/icons/sol.png',
			currentPrice: 98.76,
			threshold: 2400.00,
			expirationDate: 'Jun 22, 2025 00:00 UTC',
			bullishStake: 45000,
			bearishStake: 15000,
			bullishPercentage: 75,
			bearishPercentage: 25
		},
		{
			id: 'avax-usdc-1',
			description: 'AVAX/USD',
			volume24h: 3200000,
			change24h: -0.8,
			image: '/icons/avax.png',
			currentPrice: 34.21,
			threshold: 2400.00,
			expirationDate: 'Jun 30, 2025 06:00 UTC',
			bullishStake: 30000,
			bearishStake: 10000,
			bullishPercentage: 75,
			bearishPercentage: 25
		},
		{
			id: 'link-usd',
			description: 'LINK/USD',
			volume24h: 7600000,
			change24h: 1.23,
			image: '/icons/link.png',
			currentPrice: 15.67,
			bullishPercentage: 50,
			bearishPercentage: 50
		},
		{
			id: 'aave-usd',
			description: 'AAVE/USD',
			volume24h: 5400000,
			change24h: -2.1,
			image: '/icons/aave.png',
			currentPrice: 87.32,
			bullishPercentage: 40,
			bearishPercentage: 60
		}
	];

	// Search state
	let searchQuery = $state('');

	// Filter markets based on search query
	const filteredMarkets: Market[] = $derived(
		searchQuery
			? availableMarkets.filter((market: Market) =>
				market.description.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: availableMarkets
	);

	// Swap panel state (will be passed to SwapPanel)
	let payAmount = $state(0);
	let payToken = $state(ethToken);
	let receiveAmount = $state(0);
	let receiveToken = $state(usdcToken);
	let ethPrice = 2389.42; // Mock data
	let networkFee = 0.0012; // Mock data
	let totalBullWeight = 7500; // Mock data
	let totalBearWeight = 5500; // Mock data
	let protocolFeeRate = 0.05; // 5% Mock data

	// Function to handle market selection
	function handleMarketSelect(market: Market): void {
		selectedMarket = market;
		isMarketSelectionView = false;
		// Update URL with market ID
		const url = new URL(window.location.href);
		url.searchParams.set('market', market.id);
		window.history.replaceState({}, '', url);
	}
	
	// Function to handle viewing market details
	function handleViewMarketDetails(marketId: string): void {
		selectedMarketId = marketId;
		showDetailsModal = true;
	}
	
	// Function to close market details modal
	function closeMarketDetailsModal(): void {
		showDetailsModal = false;
		selectedMarketId = null;
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

<!-- No modals needed for the Uniswap-like interface -->

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
							<!-- Market header with back button -->
							<div class="flex items-center justify-between mb-6">
								<h2 class="text-xl font-bold text-gray-900">
									<span class="text-indigo-600">{selectedMarket?.description}</span>
								</h2>
								<button
									onclick={changeMarket}
									class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150"
								>
									<svg class="-ml-1 mr-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
									</svg>
									Change Market
								</button>
							</div>
							
							<!-- Market details summary -->
							<div class="bg-gray-50 rounded-lg p-4 mb-6">
								<div class="grid grid-cols-3 gap-4 text-center">
									<div>
										<p class="text-sm text-gray-500">Current Price</p>
										<p class="text-lg font-semibold">${selectedMarket && selectedMarket.currentPrice ? selectedMarket.currentPrice.toFixed(2) : '0.00'}</p>
									</div>
									<div>
										<p class="text-sm text-gray-500">24h Volume</p>
										<p class="text-lg font-semibold">${selectedMarket ? (selectedMarket.volume24h / 1000000).toFixed(1) : '0.0'}M</p>
									</div>
									<div>
										<p class="text-sm text-gray-500">24h Change</p>
										<p class="text-lg font-semibold ${selectedMarket && selectedMarket.change24h >= 0 ? 'text-green-600' : 'text-red-600'}">
											{selectedMarket ? (selectedMarket.change24h >= 0 ? '+' : '') + selectedMarket.change24h + '%' : '0.00%'}
										</p>
									</div>
								</div>
							</div>

							<!-- SwapPanel Component -->
							<SwapPanel
								bind:payAmount
								bind:payToken
								bind:receiveAmount
								bind:receiveToken
								ethPrice={ethPrice}
								networkFee={networkFee}
								totalBullWeight={totalBullWeight}
								totalBearWeight={totalBearWeight}
								protocolFeeRate={protocolFeeRate}
								onPredictionSelect={onPredictionSelect}
								selectedMarket={selectedMarket}
								disabled={!selectedMarket}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

<!-- Market Details Modal -->
<MarketDetailsModal 
	showModal={showDetailsModal} 
	marketId={selectedMarketId} 
	onClose={closeMarketDetailsModal} 
/>
</div>
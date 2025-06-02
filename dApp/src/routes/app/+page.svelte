<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import SwapPanel from '$lib/components/app/swap-panel/SwapPanel.svelte';
	import MarketCard from '$lib/components/app/MarketCard.svelte';
	import CompactMarketCard from '$lib/components/app/CompactMarketCard.svelte';
	import MarketDetailsModal from '$lib/components/admin/market/MarketDetailsModal.svelte';
	import type { PredictionSide } from '$lib/types';
	import {
		getAllMarkets,
		getMarketDetails,
		type Market,
		type MarketPaginationOptions,
		type PaginatedMarkets
	} from '$lib/services/market';
	import { getCurrentPriceBySymbol } from '$lib/services/price/operations';

	// Import component types
	import type { ComponentProps } from 'svelte';
	import type { SvelteComponent } from 'svelte';
	type MarketCardProps = ComponentProps<typeof MarketCard>;
	type CompactMarketCardProps = ComponentProps<typeof CompactMarketCard>;

	// Market selection state
	let selectedMarket: Market | null = $state(null);
	let isMarketSelectionView = $state(true);

	// Layout preferences
	let layoutView = $state<'grid' | 'list'>('grid'); // Default to grid view

	// Market details modal state
	let showDetailsModal = $state(false);
	let selectedMarketId = $state<string | null>(null);

	// Search state
	let searchQuery = $state('');

	// Markets loading state
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(5);
	let marketData = $state<PaginatedMarkets | null>(null);

	// Store for current prices
	let marketPrices = $state<Record<string, number | null>>({});

	// Fetch markets with pagination
	async function fetchMarkets() {
		isLoading = true;
		loadError = null;

		try {
			const paginationOptions: MarketPaginationOptions = {
				page: currentPage,
				pageSize,
				sortField: 'expirationTime',
				sortDirection: 'asc'
			};

			marketData = await getAllMarkets(paginationOptions);
			console.log('Fetched markets:', marketData);

			// Fetch prices for the loaded markets
			fetchPricesForMarkets(marketData.markets);

		} catch (error) {
			console.error('Error fetching markets:', error);
			loadError = error instanceof Error ? error.message : 'Failed to load markets';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Fetch current prices for all markets in the current page
	 * @param markets - List of markets to fetch prices for
	 */
	async function fetchPricesForMarkets(markets: Market[]) {
		if (!markets || markets.length === 0) return;

		// Create a unique list of asset symbols to fetch prices for
		const assetSymbols = [...new Set(markets.map(market => market.assetSymbol))];

		// Fetch prices for each asset symbol
		const pricePromises = assetSymbols.map(async (symbol) => {
			try {
				const price = await getCurrentPriceBySymbol(symbol);
				return { symbol, price };
			} catch (error) {
				console.error(`Error fetching price for ${symbol}:`, error);
				return { symbol, price: null };
			}
		});

		// Wait for all price fetches to complete
		const results = await Promise.all(pricePromises);

		// Update the prices state
		const newPrices: Record<string, number | null> = {};
		results.forEach(({ symbol, price }) => {
			newPrices[symbol] = price;
		});

		marketPrices = { ...marketPrices, ...newPrices };
	}

	// Filter markets based on search query
	let filteredMarkets: Market[] = $state([]);

	$effect(() => {
		if (!marketData?.markets) {
			filteredMarkets = [];
			return;
		}

		filteredMarkets = searchQuery
			? marketData.markets.filter((market) =>
				market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				market.assetPair.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: marketData.markets;
	});

	// Pagination handlers
	function goToNextPage() {
		if (marketData && currentPage < marketData.totalPages) {
			currentPage++;
			fetchMarkets();
		}
	}

	function goToPrevPage() {
		if (currentPage > 1) {
			currentPage--;
			fetchMarkets();
		}
	}

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
	async function handleMarketSelectById(marketId: string): Promise<void> {
		try {
			// First try to find the market in our current data
			let market = marketData?.markets.find(m => m.id === marketId);

			// If not found, fetch it directly
			if (!market) {
				const bigIntId = BigInt(marketId);
				market = await getMarketDetails(bigIntId);
			}

			if (market && market.exists) {
				handleMarketSelect(market);
			}
		} catch (error) {
			console.error('Error fetching market details:', error);
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

	onMount(async () => {
		// Start fetching markets
		await fetchMarkets();

		// If there's a market ID in the URL, try to pre-select it
		const marketIdFromUrl = page.url.searchParams.get('market');
		if (marketIdFromUrl) {
			console.log('Market ID from URL detected, attempting to load market:', marketIdFromUrl);
			await handleMarketSelectById(marketIdFromUrl);
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
				<div class="rounded-xl border border-gray-100 bg-white shadow-lg p-6 md:p-8">
					<!-- Uniswap-like interface with two states -->
					{#if isMarketSelectionView}
						<!-- Market Selection View -->
						<div class="mb-6">
							<h2 class="text-xl font-bold text-gray-900 mb-4">Select a Market</h2>

							<!-- Search and layout controls -->
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
								<!-- Search input -->
								<div class="relative flex-grow w-full sm:w-auto">
									<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
										<svg class="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
											<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
										</svg>
									</div>
									<input
										type="search"
										bind:value={searchQuery}
										class="block w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
										placeholder="Search markets..."
									/>
								</div>

								<!-- Layout toggle -->
								<div class="inline-flex rounded-md shadow-sm" role="group">
									<button
										type="button"
										onclick={() => layoutView = 'grid'}
										class="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-l-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 ${layoutView === 'grid' ? 'bg-blue-50 text-blue-700' : ''}"
									>
										<svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 18">
											<path d="M6.143 0H1.857A1.857 1.857 0 0 0 0 1.857v4.286C0 7.169.831 8 1.857 8h4.286A1.857 1.857 0 0 0 8 6.143V1.857A1.857 1.857 0 0 0 6.143 0Zm10 0h-4.286A1.857 1.857 0 0 0 10 1.857v4.286C10 7.169 10.831 8 11.857 8h4.286A1.857 1.857 0 0 0 18 6.143V1.857A1.857 1.857 0 0 0 16.143 0Zm-10 10H1.857A1.857 1.857 0 0 0 0 11.857v4.286C0 17.169.831 18 1.857 18h4.286A1.857 1.857 0 0 0 8 16.143v-4.286A1.857 1.857 0 0 0 6.143 10Zm10 0h-4.286A1.857 1.857 0 0 0 10 11.857v4.286c0 1.026.831 1.857 1.857 1.857h4.286A1.857 1.857 0 0 0 18 16.143v-4.286A1.857 1.857 0 0 0 16.143 10Z"/>
										</svg>
										<span class="sr-only">Grid view</span>
									</button>
									<button
										type="button"
										onclick={() => layoutView = 'list'}
										class="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-r-md hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 ${layoutView === 'list' ? 'bg-blue-50 text-blue-700' : ''}"
									>
										<svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
											<path d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z"/>
										</svg>
										<span class="sr-only">List view</span>
									</button>
								</div>
							</div>

							<!-- Market grid or list using MarketCard components with loading states -->
							<div class={layoutView === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full' : 'grid grid-cols-1 gap-6 w-full max-w-2xl mx-auto'}>
								{#if isLoading}
									<div class="col-span-full py-8 text-center">
										<div class="animate-pulse flex flex-col items-center">
											<div class="rounded-full bg-gray-200 h-12 w-12 mb-4"></div>
											<div class="h-4 bg-gray-200 rounded w-24 mb-2.5"></div>
											<div class="h-3 bg-gray-200 rounded w-36"></div>
										</div>
										<p class="mt-4 text-sm text-gray-500">Loading markets...</p>
									</div>
								{:else if loadError}
									<div class="col-span-full py-8 text-center">
										<svg
											class="mx-auto h-12 w-12 text-red-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.5"
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
											/>
										</svg>
										<h3 class="mt-2 text-sm font-medium text-gray-900">Error loading markets</h3>
										<p class="mt-1 text-sm text-red-500">{loadError}</p>
										<button
											class="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											onclick={fetchMarkets}
										>
											Try Again
										</button>
									</div>
								{:else if filteredMarkets.length === 0}
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
										currentPrice={marketPrices[market.assetSymbol]}
										onSelect={() => {
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

								<!-- Pagination controls -->
								{#if marketData && marketData.totalPages > 1}
									<div class="col-span-full flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4 rounded-lg">
										<div class="flex flex-1 justify-between sm:hidden">
											<button
												onclick={goToPrevPage}
												class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
												disabled={currentPage === 1}
											>
												Previous
											</button>
											<button
												onclick={goToNextPage}
												class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
												disabled={!marketData || currentPage >= marketData.totalPages}
											>
												Next
											</button>
										</div>
										<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
											<div>
												<p class="text-sm text-gray-700">
													Showing <span class="font-medium">{filteredMarkets.length}</span> markets
													{#if marketData}
														(Page <span class="font-medium">{currentPage}</span> of <span class="font-medium">{marketData.totalPages}</span>)
													{/if}
												</p>
											</div>
											<div>
												<nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
													<button
														onclick={goToPrevPage}
														class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
														disabled={currentPage === 1}
													>
														<span class="sr-only">Previous</span>
														<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
															<path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
														</svg>
													</button>

													<!-- Current page indicator -->
													<span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 bg-indigo-50">
														{currentPage} of {marketData.totalPages}
													</span>

													<button
														onclick={goToNextPage}
														class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${!marketData || currentPage >= marketData.totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
														disabled={!marketData || currentPage >= marketData.totalPages}
													>
														<span class="sr-only">Next</span>
														<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
															<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
														</svg>
													</button>
												</nav>
											</div>
										</div>
									</div>
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
									currentPrice={marketPrices[selectedMarket.assetSymbol]}
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

<!-- Market Details Modal - Simplified without custom handlers -->
<div class="z-50">
	<MarketDetailsModal
		bind:showModal={showDetailsModal}
		marketId={selectedMarketId}
	/>
</div>

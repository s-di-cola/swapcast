<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { 
        getAllMarkets, 
        getMarketCount,
        getActiveMarketsCount,
        type Market, 
        type MarketSortField, 
        type SortDirection,
        type MarketPaginationOptions,
        type PaginatedMarkets
    } from '$lib/services/market/marketService';
    import CreateMarketModal from '$lib/components/admin/CreateMarketModal.svelte';
    import MarketDetailsModal from '$lib/components/admin/MarketDetailsModal.svelte';
    import { toastStore } from '$lib/stores/toastStore';
    import { setCreateMarketAction, clearCreateMarketAction } from '$lib/stores/headerStore';
    
    // Core admin components
    import AdminSummaryCards from '$lib/components/admin/AdminSummaryCards.svelte';
    import AdminAnalyticsSection from '$lib/components/admin/AdminAnalyticsSection.svelte';
    import AdminMarketTable from '$lib/components/admin/AdminMarketTable.svelte';

    // State variables with Svelte 5 runes
	let markets = $state<Market[]>([]);
	let marketCount = $state(0);
	let totalStake = $state(0);
	let loading = $state(true);
	let error = $state('');
	let showCreateMarketModal = $state(false);
	let showMarketDetailsModal = $state(false);
	let selectedMarketId = $state<string | null>(null);
	
	// Pagination and sorting state
	let currentPage = $state(1);
	let totalPages = $state(1);
	let pageSize = $state(10); // 10 markets per page
	let sortField = $state<MarketSortField>('id');
	let sortDirection = $state<SortDirection>('asc');
	
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

	// Show toast notification
	function showToast(type: 'success' | 'error' | 'info' | 'warning', message: string, duration = 5000) {
		try {
			if (type === 'success') {
				toastStore.success(message, { duration });
			} else if (type === 'error') {
				toastStore.error(message, { duration });
			} else if (type === 'info') {
				toastStore.info(message, { duration });
			} else {
				toastStore.warning(message, { duration });
			}
		} catch (error) {
			console.error('Error showing toast:', error);
		}
	}

	/**
	 * Base function to fetch market data with pagination and sorting
	 * @param showToastNotification Whether to show a toast notification after fetching data
	 */
	async function fetchMarketDataBase(showToastNotification: boolean = false) {
		try {
			loading = true;
			error = '';

			// Create pagination options
			const paginationOptions: MarketPaginationOptions = {
				page: currentPage,
				pageSize: pageSize,
				sortField: sortField,
				sortDirection: sortDirection
			};

			// Fetch paginated markets
			const paginatedResult = await getAllMarkets(paginationOptions);

			// Update markets and pagination info
			markets = paginatedResult.markets;
			
			// Use the filtered count from paginatedResult for both the market count and pagination
			// This ensures consistency between the summary cards and the market list
			marketCount = paginatedResult.totalCount;
			
			// Calculate total pages based on the total count from the API
			// This ensures we handle cases where there are exactly pageSize+1 markets (e.g., 11 markets with page size 10)
			totalPages = Math.ceil(paginatedResult.totalCount / pageSize);
			currentPage = paginatedResult.currentPage;
			
			// Get active markets count directly from the service
			openMarketsCount = await getActiveMarketsCount();
			
			// Calculate total stake across all displayed markets
			totalStake = paginatedResult.markets.reduce((sum: number, market: Market) => {
				const stake0 = Number(market.totalStake0) / 1e18; // Convert from wei to ETH
				const stake1 = Number(market.totalStake1) / 1e18; // Convert from wei to ETH
				return sum + stake0 + stake1;
			}, 0);
			
			// Only show success toast if requested
			if (showToastNotification) {
				showToast('success', `Successfully loaded ${paginatedResult.markets.length} of ${paginatedResult.totalCount} markets`);
			}
			
			return true;
		} catch (err) {
			console.error('Error fetching market data:', err);
			error = 'Failed to load market data. Please try again later.';
			
			// Always show error toasts
			showToast('error', error);
			return false;
		} finally {
			loading = false;
		}
	}
	
	// Fetch market data with toast notification (for refresh button)
	async function fetchMarketData() {
		return fetchMarketDataBase(true);
	}
	
	// Fetch market data without toast notification (for pagination and sorting)
	async function updateMarketData() {
		return fetchMarketDataBase(false);
	}

	// Handle sorting when a column header is clicked
	function handleSort(field: MarketSortField, direction: SortDirection) {
		console.log(`Sorting by ${field} in ${direction} order`);
		sortField = field;
		sortDirection = direction;
		
		// Reset to page 1 when sorting changes
		currentPage = 1;
		
		// Fetch data with new sorting (without toast notification)
		updateMarketData();
	}
	
	// Handle page change for pagination
	function handlePageChange(page: number) {
		console.log(`Changing to page ${page}`);
		currentPage = page;
		// Fetch data with new page (without toast notification)
		updateMarketData();
	}

	// Open market details modal
	function handleMarketClick(marketId: string) {
		console.log(`[AdminDashboard] handleMarketClick called for marketId: ${marketId}`);
		selectedMarketId = marketId;
		showMarketDetailsModal = true;
	}

	// Refresh data - explicitly shows toast notification
	async function refreshData() {
		console.log('refreshData called');
		try {
			console.log('Calling fetchMarketData with toast notification...');
			// Use the version that shows toast notifications
			const success = await fetchMarketData();
			
			// No need for additional toast as fetchMarketData already shows one
		} catch (err) {
			console.error('Error refreshing data:', err);
			// No need for additional toast as fetchMarketData already shows error
		}
	}

	// Handle market creation from modal
	function handleMarketCreated() {
		fetchMarketData(); // Refresh market list
		showToast('success', 'New market created successfully!');
	}

	// Create derived values using $derived rune
	// Track the total number of open markets across all pages
	let openMarketsCount = $state(0);
	let expiredMarketsCount = $derived(markets.filter(m => m.status === 'Expired').length);
	let resolvedMarketsCount = $derived(markets.filter(m => m.status === 'Resolved').length);

	// Check URL parameters for market ID on mount
	onMount(() => {
		// Set the create market action in the header store
		setCreateMarketAction(() => (showCreateMarketModal = true));
		
		// Fetch market data without showing toast notification on initial load
		updateMarketData();
		
		// Check if marketId is in URL parameters
		const marketIdParam = $page.url.searchParams.get('marketId');
		if (marketIdParam) {
			selectedMarketId = marketIdParam;
			showMarketDetailsModal = true;
		}
		
		// Return cleanup function
		return () => {
			// Clean up header action on unmount
			clearCreateMarketAction();
		};
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

<div class="mx-auto min-h-screen max-w-7xl p-6 md:p-10 bg-gray-50">
	<main class="space-y-8">
		<!-- Summary Cards -->
		<AdminSummaryCards 
			marketCount={marketCount}
			openMarketsCount={openMarketsCount}
			totalStake={totalStake}
			loading={loading}
		/>

		<!-- Analytics Section -->
		<AdminAnalyticsSection />

			<!-- Market List with Pagination and Sorting -->
		<AdminMarketTable 
			markets={markets}
			loading={loading}
			onRefresh={fetchMarketData}
			onMarketClick={handleMarketClick}
			onSort={handleSort}
			onPageChange={handlePageChange}
			totalPages={totalPages}
			currentPage={currentPage}
		/>
	</main>

	<!-- Toast notifications are now handled by the global ToastContainer component in the layout -->

	<!-- Modals -->
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

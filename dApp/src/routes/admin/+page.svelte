<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { getAllMarkets, getMarketCount, type Market } from '$lib/services/market/marketService';
    import CreateMarketModal from '$lib/components/admin/CreateMarketModal.svelte';
    import MarketDetailsModal from '$lib/components/admin/MarketDetailsModal.svelte';
    import { toastStore } from '$lib/stores/toastStore';
    
    // Core admin components
    import AdminHeader from '$lib/components/admin/AdminHeader.svelte';
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

	// Fetch market data
	async function fetchMarketData() {
		try {
			loading = true;
			error = '';

			// Fetch all markets and count in parallel
			const [marketList, count] = await Promise.all([
				getAllMarkets(),
				getMarketCount()
			]);

			// Update markets and count
			markets = marketList;
			marketCount = count;
			
			// Calculate total stake across all markets
			totalStake = marketList.reduce((sum, market) => {
				const stake0 = Number(market.totalStake0) / 1e18; // Convert from wei to ETH
				const stake1 = Number(market.totalStake1) / 1e18; // Convert from wei to ETH
				return sum + stake0 + stake1;
			}, 0);
			
			// Show success toast
			showToast('success', `Successfully refreshed ${marketList.length} markets`);
			
		} catch (err) {
			console.error('Error fetching market data:', err);
			error = 'Failed to load market data. Please try again later.';
			showToast('error', error);
		} finally {
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
	async function refreshData() {
		console.log('refreshData called');
		try {
			console.log('Calling fetchMarketData...');
			await fetchMarketData();
			console.log('fetchMarketData completed, showing success toast');
			showToast('success', 'Market data refreshed successfully');
		} catch (error) {
			console.error('Error in refreshData:', error);
			showToast('error', 'Failed to refresh market data');
		}
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

<div class="mx-auto min-h-screen max-w-7xl p-6 md:p-10 bg-gray-50">
	<AdminHeader onCreateMarketClick={() => (showCreateMarketModal = true)} />

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

			<!-- Market List -->
		<AdminMarketTable 
			markets={markets}
			loading={loading}
			onRefresh={fetchMarketData}
			onMarketClick={handleMarketClick}
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

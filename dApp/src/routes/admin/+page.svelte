<script lang="ts">
	import {
		getAllMarkets,
		getActiveMarketsCount,
		type Market,
		type MarketSortField,
		type SortDirection,
		type MarketPaginationOptions
	} from '$lib/services/market';
	import { CreateMarketModal, MarketDetailsModal } from '$lib/components/admin/market';
	import {
		AdminSummaryCards,
		AdminAnalyticsSection,
		AdminMarketTable
	} from '$lib/components/admin/dashboard';
	import { toastStore } from '$lib/stores/toastStore';
	import { setCreateMarketAction, clearCreateMarketAction } from '$lib/stores/headerStore';
	import { formatCurrency } from '$lib/helpers/formatters';

	interface DashboardState {
		markets: Market[];
		marketCount: number;
		openMarketsCount: number;
		totalStake: number;
		loading: boolean;
		error: string;
	}

	interface PaginationState {
		currentPage: number;
		totalPages: number;
		pageSize: number;
		sortField: MarketSortField;
		sortDirection: SortDirection;
	}

	interface ModalState {
		showCreateMarket: boolean;
		showMarketDetails: boolean;
		selectedMarketId: string | null;
	}

	let dashboardState = $state<DashboardState>({
		markets: [],
		marketCount: 0,
		openMarketsCount: 0,
		totalStake: 0,
		loading: true,
		error: ''
	});

	let paginationState = $state<PaginationState>({
		currentPage: 1,
		totalPages: 1,
		pageSize: 10,
		sortField: 'id',
		sortDirection: 'asc'
	});

	let modalState = $state<ModalState>({
		showCreateMarket: false,
		showMarketDetails: false,
		selectedMarketId: null
	});

	const TOAST_CONFIG = {
		duration: 5000,
		successMessages: {
			marketCreated: 'New market created successfully!',
			marketUpdated: 'Market updated successfully',
			dataRefreshed: 'Data refreshed successfully'
		},
		errorMessages: {
			loadFailed: 'Failed to load market data. Please try again later.',
			sortFailed: 'Failed to update sorting',
			pageFailed: 'Failed to change page',
			refreshFailed: 'Failed to refresh data',
			toastError: 'Error showing notification'
		}
	} as const;

	const expiredMarketsCount = $derived(
		dashboardState.markets.filter((m) => m.status === 'Expired').length
	);

	const resolvedMarketsCount = $derived(
		dashboardState.markets.filter((m) => m.status === 'Resolved').length
	);

	function showToast(type: 'success' | 'error' | 'info' | 'warning', message: string): void {
		try {
			switch (type) {
				case 'success':
					toastStore.success(message, { duration: TOAST_CONFIG.duration });
					break;
				case 'error':
					toastStore.error(message, { duration: TOAST_CONFIG.duration });
					break;
				case 'info':
					toastStore.info(message, { duration: TOAST_CONFIG.duration });
					break;
				case 'warning':
					toastStore.warning(message, { duration: TOAST_CONFIG.duration });
					break;
			}
		} catch (error) {
			console.error('Toast error:', error);
		}
	}

	/**
	 * Calculate total stake for the markets provided
	 */
	function calculateTotalStake(markets: Market[]): number {
		return markets.reduce((sum: number, market: Market) => {
			// Convert bigint values to number if necessary and ensure we have numbers
			const stake0 =
				typeof market.totalStake0 === 'bigint'
					? Number(market.totalStake0) / 1e18
					: Number(market.totalStake0 || 0) / 1e18;

			const stake1 =
				typeof market.totalStake1 === 'bigint'
					? Number(market.totalStake1) / 1e18
					: Number(market.totalStake1 || 0) / 1e18;

			return sum + stake0 + stake1;
		}, 0);
	}

	/**
	 * Calculate total stake across ALL markets, not just the paginated ones
	 */
	async function calculateTotalStakeAcrossAllMarkets(): Promise<number> {
		try {
			// Get the total market count first
			const count = dashboardState.marketCount || 0;

			// Use a page size that will fit all markets (or 100 as a reasonable maximum)
			const pageSize = count > 0 ? Math.min(count, 100) : 50;

			// Get all markets in a single request
			const allMarketsResult = await getAllMarkets({
				page: 1,
				pageSize
			});
			return calculateTotalStake(allMarketsResult.markets);
		} catch (error) {
			console.error('Error calculating total stake across all markets:', error);
			return 0;
		}
	}

	async function fetchMarketDataBase(showToastNotification: boolean = false): Promise<boolean> {
		try {
			dashboardState.loading = true;
			dashboardState.error = '';

			const paginationOptions: MarketPaginationOptions = {
				page: paginationState.currentPage,
				pageSize: paginationState.pageSize,
				sortField: paginationState.sortField,
				sortDirection: paginationState.sortDirection
			};

			// Get paginated markets, active count, and total stake across all markets
			const [paginatedResult, activeCount, totalStakeAcrossAll] = await Promise.all([
				getAllMarkets(paginationOptions),
				getActiveMarketsCount(),
				calculateTotalStakeAcrossAllMarkets()
			]);

			dashboardState.markets = paginatedResult.markets;
			dashboardState.marketCount = paginatedResult.totalCount;
			dashboardState.openMarketsCount = activeCount;
			// Use the total stake across all markets, not just the current page
			dashboardState.totalStake = totalStakeAcrossAll;

			paginationState.totalPages = Math.ceil(paginatedResult.totalCount / paginationState.pageSize);
			paginationState.currentPage = paginatedResult.currentPage;

			if (showToastNotification) {
				const message = `Successfully loaded ${paginatedResult.markets.length} of ${paginatedResult.totalCount} markets`;
				showToast('success', message);
			}

			return true;
		} catch (err) {
			console.error('Error fetching market data:', err);
			dashboardState.error = TOAST_CONFIG.errorMessages.loadFailed;
			showToast('error', dashboardState.error);
			return false;
		} finally {
			dashboardState.loading = false;
		}
	}

	async function fetchMarketData(): Promise<boolean> {
		return fetchMarketDataBase(true);
	}

	async function updateMarketData(): Promise<boolean> {
		return fetchMarketDataBase(false);
	}

	function handleSort(field: MarketSortField, direction: SortDirection): void {
		paginationState.sortField = field;
		paginationState.sortDirection = direction;
		paginationState.currentPage = 1;

		updateMarketData().catch(() => {
			showToast('error', TOAST_CONFIG.errorMessages.sortFailed);
		});
	}

	function handlePageChange(page: number): void {
		paginationState.currentPage = page;

		updateMarketData().catch(() => {
			showToast('error', TOAST_CONFIG.errorMessages.pageFailed);
		});
	}

	function handleMarketClick(marketId: string): void {
		if (modalState.showMarketDetails) {
			modalState.showMarketDetails = false;
			modalState.selectedMarketId = null;

			setTimeout(() => {
				modalState.selectedMarketId = marketId;
				modalState.showMarketDetails = true;
			}, 100);
			setTimeout(() => {
				modalState.selectedMarketId = marketId;
				modalState.showMarketDetails = true;
			}, 100);
		} else {
			// If modal is not open, just set the state directly
			modalState.selectedMarketId = marketId;
			modalState.showMarketDetails = true;
		}
	}

	function handleRefresh(): void {
		// Reset to page 1 to ensure we get fresh data from the beginning
		paginationState.currentPage = 1;

		// Fetch market data with the updated pagination state
		fetchMarketData().catch(() => {
			showToast('error', TOAST_CONFIG.errorMessages.refreshFailed);
		});
	}

	async function handleMarketCreated(marketId: string, name: string): Promise<void> {
		modalState.showCreateMarket = false;

		// Force a delay to ensure the blockchain has time to update
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Reset to page 1 to ensure the new market is visible
		paginationState.currentPage = 1;
		paginationState.sortField = 'id';
		paginationState.sortDirection = 'desc';

		// Fetch market data with a retry mechanism
		let retryCount = 0;
		const maxRetries = 3;

		const attemptFetch = async () => {
			const success = await fetchMarketDataBase(false);
			if (!success && retryCount < maxRetries) {
				retryCount++;
				await new Promise((resolve) => setTimeout(resolve, 2000));
				return attemptFetch();
			}
		};

		await attemptFetch();
		showToast('success', TOAST_CONFIG.successMessages.marketCreated);
	}

	function handleMarketCreationFailed(error: string): void {
		showToast('error', error);
	}

	function handleMarketUpdated(): void {
		fetchMarketData();
		showToast('success', TOAST_CONFIG.successMessages.marketUpdated);
	}

	function handleCreateMarketClose(): void {
		modalState.showCreateMarket = false;
	}

	function handleMarketDetailsClose(): void {
		modalState.showMarketDetails = false;
		modalState.selectedMarketId = null;
	}

	function openCreateMarketModal(): void {
		modalState.showCreateMarket = true;
	}

	// Initialize component and handle cleanup
	$effect(() => {
		setCreateMarketAction(openCreateMarketModal);
		updateMarketData();

		return () => {
			clearCreateMarketAction();
		};
	});

	// Update page title reactively
	$effect(() => {
		const title =
			dashboardState.marketCount > 0
				? `SwapCast Admin (${dashboardState.marketCount} Markets)`
				: 'SwapCast Admin';
		document.title = title;
	});
</script>

<div class="mx-auto min-h-screen max-w-7xl bg-gray-50 p-6 pt-16 md:p-10 md:pt-20">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-4xl font-bold text-gray-800">SwapCast Admin</h1>
		<button
			type="button"
			onclick={openCreateMarketModal}
			class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
		>
			<svg
				class="mr-2 -ml-0.5 h-4 w-4"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
					clip-rule="evenodd"
				/>
			</svg>
			Create New Market
		</button>
	</div>

	<main class="space-y-8">
		<AdminSummaryCards
			marketCount={dashboardState.marketCount}
			openMarketsCount={dashboardState.openMarketsCount}
			totalStake={dashboardState.totalStake}
			loading={dashboardState.loading}
		/>

		<AdminAnalyticsSection activeMarketsCount={dashboardState.openMarketsCount} />

		<AdminMarketTable
			markets={dashboardState.markets}
			loading={dashboardState.loading}
			totalPages={paginationState.totalPages}
			currentPage={paginationState.currentPage}
			onRefresh={handleRefresh}
			onMarketClick={handleMarketClick}
			onSort={handleSort}
			onPageChange={handlePageChange}
		/>
	</main>

	<CreateMarketModal
		showModal={modalState.showCreateMarket}
		onClose={handleCreateMarketClose}
		onMarketCreated={handleMarketCreated}
		onMarketCreationFailed={handleMarketCreationFailed}
	/>

	<MarketDetailsModal
		showModal={modalState.showMarketDetails}
		marketId={modalState.selectedMarketId}
		onClose={handleMarketDetailsClose}
	/>
</div>

<script lang="ts">
	import { Button, Modal, Spinner } from 'flowbite-svelte';
	import { ExclamationCircleSolid, XSolid } from 'flowbite-svelte-icons';
	import { getMarketDetails, type Market } from '$lib/services/market';

	import MarketSummary from '$lib/components/admin/market/MarketSummary.svelte';
	import MarketFinancials from '$lib/components/admin/market/MarketFinancials.svelte';
	import MarketPriceChart from '$lib/components/admin/market/MarketPriceChart.svelte';
	import TransactionHistory from '$lib/components/admin/market/TransactionHistory.svelte';

	interface Props {
		showModal?: boolean;
		marketId?: string | null;
		onClose?: () => void;
	}

	interface MarketState {
		data: Market | null;
		isLoading: boolean;
		error: string;
	}

	let { showModal = $bindable(false), marketId = null, onClose = () => {} }: Props = $props();

	let marketState = $state<MarketState>({
		data: null,
		isLoading: false,
		error: ''
	});

	const UI_TEXT = {
		loadingTitle: 'Loading Market Details...',
		detailsTitle: 'Market Details',
		loadingMessage: 'Loading market details...',
		errorTitle: 'Error Loading Market',
		close: 'Close',
		refresh: 'Refresh Data',
		missingId: 'Market ID is missing.',
		notFound: 'Market not found or data is invalid.',
		fetchFailed: 'Failed to load market details. Please try again.'
	} as const;

	async function fetchMarketData(): Promise<void> {
		if (!marketId) {
			marketState.error = UI_TEXT.missingId;
			marketState.isLoading = false;
			return;
		}

		try {
			marketState.isLoading = true;
			marketState.error = '';

			const data = await getMarketDetails(marketId);

			if (data?.exists) {
				marketState.data = data;
			} else {
				marketState.error = UI_TEXT.notFound;
			}
		} catch (err) {
			console.error('Error fetching market details:', err);
			marketState.error = UI_TEXT.fetchFailed;
		} finally {
			marketState.isLoading = false;
		}
	}

	function getModalTitle(): string {
		if (marketState.isLoading) return UI_TEXT.loadingTitle;
		if (marketState.data) return marketState.data.name || `Market #${marketState.data.id}`;
		return UI_TEXT.detailsTitle;
	}

	function handleRefresh(): void {
		fetchMarketData();
	}

	// Reset state when modal closes
	$effect(() => {
		if (!showModal) {
			marketState = { data: null, isLoading: false, error: '' };
			onClose();
		}
	});

	// Fetch data when modal opens with valid marketId
	$effect(() => {
		if (showModal && marketId) {
			fetchMarketData();
		}
	});
</script>

<Modal
	bind:open={showModal}
	size="xl"
	autoclose={true}
	class="w-full max-w-4xl"
	outsideclose={true}
>
	<div class="mb-4 flex items-center justify-between border-b pb-4">
		<h3 class="text-xl font-semibold text-gray-900">
			{getModalTitle()}
		</h3>
	</div>

	{#if marketState.isLoading}
		<div class="flex flex-col items-center justify-center py-12">
			<Spinner size="12" />
			<p class="mt-4 text-gray-600">{UI_TEXT.loadingMessage}</p>
		</div>
	{:else if marketState.error}
		<div
			class="flex items-center rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700"
		>
			<ExclamationCircleSolid class="mr-3 h-6 w-6 text-red-600" />
			<div>
				<h3 class="text-lg font-semibold">{UI_TEXT.errorTitle}</h3>
				<p>{marketState.error}</p>
			</div>
		</div>
	{:else if marketState.data}
		<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
			<MarketSummary market={marketState.data} />
			<MarketFinancials market={marketState.data} />
		</div>

		<MarketPriceChart market={marketState.data} />
		<TransactionHistory market={marketState.data} />
	{/if}

	<svelte:fragment slot="footer">
		{#if marketState.data}
			<Button color="blue" onclick={handleRefresh}>{UI_TEXT.refresh}</Button>
		{/if}
	</svelte:fragment>
</Modal>

<script lang="ts">
    /**
     * MarketDetailsModal Component
     * 
     * A modal dialog that displays detailed information about a specific market.
     * Includes market summary, financials, price chart, and transaction history.
     * Handles loading states and error conditions when fetching market data.
     */
    import {Button, Modal, Spinner} from 'flowbite-svelte';
    import {ExclamationCircleSolid, XSolid} from 'flowbite-svelte-icons';
    import {getMarketDetails, type Market} from '$lib/services/market/marketService';
    
    import MarketSummary from './MarketSummary.svelte';
    import MarketFinancials from './MarketFinancials.svelte';
    import MarketPriceChart from './MarketPriceChart.svelte';
    import TransactionHistory from './TransactionHistory.svelte';

    export let showModal = false;
    export let marketId: string | null = null;
    export let onClose: () => void = () => {};

    let marketToDisplay: Market | null = null;
    let isLoading = false;
    let errorMsg = '';

    /**
     * Fetches market details from the API based on the provided marketId
     * Sets loading states and handles error conditions
     */
    async function fetchMarketData() {
        if (!marketId) {
            errorMsg = 'Market ID is missing.';
            isLoading = false;
            return;
        }

        try {
            isLoading = true;
            errorMsg = '';
            const data = await getMarketDetails(marketId);

            if (data && data.exists) {
                marketToDisplay = data;
            } else {
                errorMsg = 'Market not found or data is invalid.';
            }
        } catch (err) {
            errorMsg = 'Failed to load market details. Please try again.';
        } finally {
            isLoading = false;
        }
    }

    // Reactive statement to fetch data when modal is shown with a valid marketId
    $: if (showModal && marketId) {
        fetchMarketData();
    }
</script>

<Modal bind:open={showModal} size="xl" autoclose={false} class="w-full max-w-4xl" outsideclose>
    <div class="mb-4 flex items-center justify-between border-b pb-4">
        <h3 class="text-xl font-semibold text-gray-900">
            {#if isLoading}
                Loading Market Details...
            {:else if marketToDisplay}
                {marketToDisplay.name || `Market #${marketToDisplay.id}`}
            {:else}
                Market Details
            {/if}
        </h3>
        <Button onclick={() => onClose()}>
            <XSolid class="h-5 w-5" />
        </Button>
    </div>

    {#if isLoading}
        <div class="flex flex-col items-center justify-center py-12">
            <Spinner size="12" />
            <p class="mt-4 text-gray-600">Loading market details...</p>
        </div>
    {:else if errorMsg}
        <div
            class="flex items-center rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700"
        >
            <ExclamationCircleSolid class="mr-3 h-6 w-6 text-red-600" />
            <div>
                <h3 class="text-lg font-semibold">Error Loading Market</h3>
                <p>{errorMsg}</p>
            </div>
        </div>
    {:else if marketToDisplay}
        <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <!-- Market Summary Component -->
            <MarketSummary market={marketToDisplay} />
            
            <!-- Market Financials Component -->
            <MarketFinancials market={marketToDisplay} />
        </div>

        <!-- Price Chart Component -->
        <MarketPriceChart market={marketToDisplay} />
        
        <!-- Transaction History Component -->
        <TransactionHistory market={marketToDisplay} />
    {/if}

    <svelte:fragment slot="footer">
        <Button color="alternative" onclick={() => onClose()}>Close</Button>
        {#if marketToDisplay}
            <Button color="blue" onclick={() => fetchMarketData()}>Refresh Data</Button>
        {/if}
    </svelte:fragment>
</Modal>

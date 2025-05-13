<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getMarketDetails, type Market } from '$lib/services/marketService';
  import { ArrowLeftIcon, RefreshCwIcon, InfoIcon, ExternalLinkIcon } from 'lucide-svelte'; // Assuming lucide-svelte for icons

  // State variables
  let marketToDisplay: Market | null = null;
  let isLoading = true;
  let errorMsg = '';
  let marketIdFromParams: string | undefined;

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

  // Fetch market data
  async function fetchMarketData() {
    console.log('[MarketDetailsPage] fetchMarketData called.');
    if (!marketIdFromParams) {
      console.error('[MarketDetailsPage] marketIdFromParams is undefined in fetchMarketData.');
      errorMsg = 'Market ID is missing.';
      isLoading = false;
      return;
    }
    console.log(`[MarketDetailsPage] Attempting to fetch details for marketId: ${marketIdFromParams}`);
    try {
      isLoading = true;
      errorMsg = '';
      const data = await getMarketDetails(marketIdFromParams);
      console.log('[MarketDetailsPage] Data received from getMarketDetails:', JSON.stringify(data, null, 2));
      
      if (data && data.exists) {
        marketToDisplay = data;
      } else {
        console.warn(`[MarketDetailsPage] Market with ID ${marketIdFromParams} does not exist or data is invalid.`);
        errorMsg = 'Market not found or data is invalid.';
      }
    } catch (err) {
      console.error(`[MarketDetailsPage] Error fetching market details for ID ${marketIdFromParams}:`, err);
      errorMsg = 'Failed to load market details. Please try again.';
    } finally {
      isLoading = false;
      console.log(`[MarketDetailsPage] fetchMarketData finished. Loading: ${isLoading}, Error: '${errorMsg}'`);
    }
  }

  // Load data on component mount
  onMount(() => {
    console.log('[MarketDetailsPage] onMount called.');
    marketIdFromParams = $page.params.id;
    console.log(`[MarketDetailsPage] marketId from $page.params.id: ${marketIdFromParams}`);
    if (marketIdFromParams) {
      fetchMarketData();
    } else {
      console.error('[MarketDetailsPage] Market ID not found in page params during onMount.');
      errorMsg = 'Market ID not provided in URL.';
      isLoading = false;
    }
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'Open':
        return 'bg-emerald-100 text-emerald-800';
      case 'Expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'Resolved':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Helper function to get Etherscan link (adjust for your network if not mainnet)
  function getEtherscanLink(address: string) {
    return `https://etherscan.io/address/${address}`;
  }

  // Placeholder for market type if we decide to add it later
  // let marketTypeDisplay = 'Binary'; // Default or derived
</script>

<div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen bg-slate-50">
  <header class="mb-8 flex justify-between items-center">
    <a href="/admin" class="flex items-center text-emerald-600 hover:text-emerald-700 transition-colors">
      <ArrowLeftIcon size={20} class="mr-2" />
      Back to Dashboard
    </a>
    <button 
      on:click={fetchMarketData} 
      disabled={isLoading} 
      class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCwIcon size={18} class="mr-2 {isLoading ? 'animate-spin' : ''}" />
      Refresh Data
    </button>
  </header>

  {#if isLoading}
    <div class="flex flex-col items-center justify-center h-[60vh] text-gray-600">
      <RefreshCwIcon size={48} class="animate-spin mb-4 text-emerald-600" />
      <p class="text-xl font-semibold">Loading Market Details...</p>
      <p class="text-sm">Please wait while we fetch the latest information.</p>
    </div>
  {:else if errorMsg}
    <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg shadow-md flex items-center">
      <InfoIcon size={24} class="mr-3 text-red-600" />
      <div>
        <h3 class="text-lg font-semibold">Error Loading Market</h3>
        <p>{errorMsg}</p>
      </div>
    </div>
  {:else if marketToDisplay}
    <div class="bg-white shadow-xl rounded-xl overflow-hidden">
      <div class="bg-gradient-to-r from-emerald-600 to-green-500 p-6 md:p-8 text-white">
        <h1 class="text-3xl md:text-4xl font-bold mb-2">{marketToDisplay.name || `Market #${marketToDisplay.id}`}</h1>
        <p class="text-lg text-emerald-100">Detailed view of prediction market: #{marketToDisplay.id}</p>
      </div>

      <div class="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Key Information -->
        <div class="md:col-span-2 lg:col-span-3 p-6 bg-slate-50 rounded-lg shadow">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Key Information</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div class="flex flex-col">
              <dt class="font-medium text-gray-500">Asset Pair</dt>
              <dd class="text-gray-800 font-semibold text-base">{marketToDisplay.assetPair}</dd>
            </div>
            <div class="flex flex-col">
              <dt class="font-medium text-gray-500">Status</dt>
              <dd>
                <span class="px-3 py-1 text-xs font-semibold rounded-full {getStatusColor(marketToDisplay.status)}">
                  {marketToDisplay.status}
                </span>
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="font-medium text-gray-500">Price Threshold</dt>
              <dd class="text-gray-800 font-semibold text-base">${formatCurrency(marketToDisplay.priceThreshold)}</dd>
            </div>
            <div class="flex flex-col">
              <dt class="font-medium text-gray-500">Expires In</dt>
              <dd class="text-gray-800 font-semibold text-base">{marketToDisplay.expirationDisplay}</dd>
            </div>
             <div class="flex flex-col sm:col-span-2">
              <dt class="font-medium text-gray-500">Price Aggregator</dt>
              <dd class="text-gray-800 font-semibold text-base hover:text-emerald-600 transition-colors">
                <a href={getEtherscanLink(marketToDisplay.priceAggregator)} target="_blank" rel="noopener noreferrer" class="flex items-center">
                  {marketToDisplay.priceAggregator} <ExternalLinkIcon size={14} class="ml-1" />
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <!-- Financials -->
        <div class="p-6 bg-slate-50 rounded-lg shadow">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Financials</h2>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="font-medium text-gray-500">Total Stake</dt>
              <dd class="text-gray-800 font-semibold text-base">{formatCurrency(marketToDisplay.totalStake)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="font-medium text-gray-500">Market Resolved</dt>
              <dd class="text-gray-800 font-semibold text-base">{marketToDisplay.resolved ? 'Yes' : 'No'}</dd>
            </div>
            {#if marketToDisplay.resolved && marketToDisplay.winningOutcome !== undefined}
              <div class="flex justify-between">
                <dt class="font-medium text-gray-500">Winning Outcome</dt>
                <dd class="text-gray-800 font-semibold text-base">{marketToDisplay.winningOutcome === 0 ? 'Below/Equal' : 'Above'}</dd> <!-- Assuming 0 for Outcome0, 1 for Outcome1 -->
              </div>
            {/if}
          </dl>
        </div>

        <!-- Timestamps -->
        <div class="p-6 bg-slate-50 rounded-lg shadow">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Timestamps</h2>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="font-medium text-gray-500">Expiration Time</dt>
              <dd class="text-gray-800 font-semibold text-base">{new Date(marketToDisplay.expirationTime * 1000).toLocaleString()}</dd>
            </div>
            <!-- Add other relevant timestamps if available -->
          </dl>
        </div>

        <!-- Placeholder for actions or more details -->
        <div class="md:col-span-2 lg:col-span-3 p-6 bg-slate-50 rounded-lg shadow">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Market Actions</h2>
          <div class="text-center text-gray-500 italic py-4">
            <InfoIcon size={20} class="inline-block mr-2 mb-1" />
            Further actions like manual resolution or viewing bets could be placed here.
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-4 rounded-lg shadow-md flex items-center">
      <InfoIcon size={24} class="mr-3 text-yellow-600" />
      <div>
        <h3 class="text-lg font-semibold">No Market Data</h3>
        <p>Market data is not available. This market might not exist or there was an issue fetching its details.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Additional global styles or Tailwind CSS utility classes will handle most styling */
  /* You can add component-specific styles here if needed */
</style>
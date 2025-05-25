<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { getAllMarkets, getMarketCount, type Market } from '$lib/services/market/marketService';
  import CreateMarketModal from '$lib/components/admin/CreateMarketModal.svelte';
  import MarketDetailsModal from '$lib/components/admin/MarketDetailsModal.svelte';

  // State variables
  let markets: Market[] = [];
  let marketCount = 0;
  let totalStake = 0;
  let loading = true;
  let error = '';
  let showCreateMarketModal = false;
  let showMarketDetailsModal = false;
  let selectedMarketId: string | null = null;

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
  }

  // Handle market creation from modal
  function handleMarketCreated() {
    fetchMarketData(); // Refresh market list
  }

  // Check URL parameters for market ID on mount
  onMount(() => {
    fetchMarketData();
    
    // Check if marketId is in URL parameters
    const marketIdParam = page.url.searchParams.get('marketId');
    if (marketIdParam) {
      selectedMarketId = marketIdParam;
      showMarketDetailsModal = true;
    }
  });
</script>

<div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen" style="background-color: #f8fafc;">
  <header class="mb-10 pb-6 border-b border-gray-200 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold text-gray-800">SwapCast Admin</h1>
      <p class="text-md text-gray-600 mt-2">Overview of platform activity and market management tools.</p>
    </div>
    <div>
      <button 
        type="button" 
        on:click={() => showCreateMarketModal = true} 
        class="inline-flex items-center px-5 py-2.5 text-sm font-medium text-center text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 transition-all duration-200"
      >
        <svg class="mr-2 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
        Create New Market
      </button>
    </div>
  </header>

  <!-- Summary Boxes Section -->
  <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Total Markets</h2>
        <div class="p-2 bg-indigo-50 rounded-full">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
          </svg>
        </div>
      </div>
      <p class="text-3xl font-bold text-gray-900">{loading ? '--' : marketCount}</p>
      <p class="text-sm text-gray-500 mt-1">{loading ? 'Fetching data...' : 'Markets created'}</p>
    </div>
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Active Markets</h2>
        <div class="p-2 bg-green-50 rounded-full">
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
      </div>
      <p class="text-3xl font-bold text-gray-900">
        {loading ? '--' : markets.filter(m => m.status === 'Open').length}
      </p>
      <p class="text-sm text-gray-500 mt-1">{loading ? 'Fetching data...' : 'Currently open'}</p>
    </div>
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Total Volume</h2>
        <div class="p-2 bg-purple-50 rounded-full">
          <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
      </div>
      <p class="text-3xl font-bold text-gray-900">
        {loading ? '$--' : formatCurrency(totalStake)}
      </p>
      <p class="text-sm text-gray-500 mt-1">{loading ? 'Fetching data...' : 'Total stake across all markets'}</p>
    </div>
  </section>

  <!-- Graph Placeholder Section -->
  <section class="mb-10">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold text-gray-800">Platform Analytics</h2>
      <div class="flex space-x-2">
        <button class="px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-full">Last 24h</button>
        <button class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Last 7d</button>
        <button class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Last 30d</button>
      </div>
    </div>
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100 min-h-[300px] md:min-h-[400px]">
      <div class="flex justify-between items-center mb-6">
        <div>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-indigo-500 rounded-full"></div>
            <span class="text-sm text-gray-600">Markets Created</span>
          </div>
          <div class="flex items-center space-x-2 mt-1">
            <div class="w-3 h-3 bg-green-500 rounded-full"></div>
            <span class="text-sm text-gray-600">Active Predictions</span>
          </div>
          <div class="flex items-center space-x-2 mt-1">
            <div class="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span class="text-sm text-gray-600">Platform Volume</span>
          </div>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-gray-900">{marketCount}</p>
          <p class="text-sm text-gray-500">Total Markets</p>
        </div>
      </div>
      <div class="h-64 flex items-center justify-center border-t border-gray-100 pt-6">
        <p class="text-gray-400 text-sm">Placeholder for analytics graph</p>
      </div>
    </div>
  </section>

  <!-- Market List Table Section -->
  <section>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold text-gray-800">Market List</h2>
      <button 
        on:click={refreshData}
        class="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-all duration-150 ease-in-out flex items-center text-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Refresh
      </button>
    </div>
    
    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
        {error}
      </div>
    {/if}
    
    <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-100">
        <thead>
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Market ID</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Market Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Asset Pair</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Ends In</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Price Threshold</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Total Stake</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if loading}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
                <div class="flex justify-center items-center space-x-2">
                  <svg class="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading market data...</span>
                </div>
              </td>
            </tr>
          {:else if markets.length > 0}
            {#each markets as market (market.id)}
              <tr class="hover:bg-gray-50 cursor-pointer transition-colors" on:click={() => handleMarketClick(market.id)}>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{market.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{market.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.assetPair}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                        class:bg-green-50={market.status === 'Open'}
                        class:text-green-700={market.status === 'Open'}
                        class:bg-yellow-50={market.status === 'Expired'}
                        class:text-yellow-700={market.status === 'Expired'}
                        class:bg-gray-50={market.status === 'Resolved'}
                        class:text-gray-700={market.status === 'Resolved'}>
                    {market.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.expirationDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${market.priceThreshold}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(market.totalStake)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button class="text-indigo-600 hover:text-indigo-800 transition-colors">Details</button>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
                No markets found. <a href="/admin/market" class="text-emerald-600 hover:underline">Create your first market</a>.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Modal components -->
  <CreateMarketModal 
    bind:showModal={showCreateMarketModal} 
    onClose={() => showCreateMarketModal = false} 
  />
  
  <MarketDetailsModal
    bind:showModal={showMarketDetailsModal}
    marketId={selectedMarketId}
    onClose={() => showMarketDetailsModal = false}
  />

</div>

<style>
  /* Scoped styles for the admin dashboard */
</style>

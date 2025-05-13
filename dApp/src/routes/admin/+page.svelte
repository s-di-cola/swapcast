<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getAllMarkets, getMarketCount, type Market } from '$lib/services/marketService';
  import CreateMarketModal from '$lib/components/admin/CreateMarketModal.svelte';

  // State variables
  let markets: Market[] = [];
  let marketCount = 0;
  let totalStake = 0;
  let loading = true;
  let error = '';
  let showCreateMarketModal = false;

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

  // Navigate to market details
  function handleMarketClick(marketId: string) {
    console.log(`[AdminDashboard] handleMarketClick called for marketId: ${marketId}`);
    try {
      goto(`/admin/market/${marketId}`);
      console.log(`[AdminDashboard] goto('/admin/market/${marketId}') initiated.`);
    } catch (e) {
      console.error(`[AdminDashboard] Error during goto navigation:`, e);
    }
  }

  // Refresh data
  function refreshData() {
    fetchMarketData();
  }

  // Handle market creation from modal
  function handleMarketCreated() {
    fetchMarketData(); // Refresh market list
  }

  // Load data on component mount
  onMount(() => {
    fetchMarketData();
  });
</script>

<div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen" style="background-color: #f9fafb;">
  <header class="mb-10 pb-6 border-b border-gray-200 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold text-gray-800">SwapCast Admin Dashboard</h1>
      <p class="text-md text-gray-600 mt-2">Overview of platform activity and market management tools.</p>
    </div>
    <div>
      <button 
        type="button" 
        onclick={() => showCreateMarketModal = true} 
        class="inline-flex items-center px-5 py-2.5 text-sm font-medium text-center text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 focus:ring-4 focus:outline-none focus:ring-emerald-300 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-800"
      >
        <svg class="mr-2 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
        Create New Market
      </button>
    </div>
  </header>

  <!-- Summary Boxes Section -->
  <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Total Markets</h2>
      <p class="text-3xl font-bold text-emerald-600">{loading ? '--' : marketCount}</p>
      <p class="text-sm text-gray-500">{loading ? 'Fetching data...' : 'Markets created'}</p>
    </div>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Active Markets</h2>
      <p class="text-3xl font-bold text-emerald-600">
        {loading ? '--' : markets.filter(m => m.status === 'Open').length}
      </p>
      <p class="text-sm text-gray-500">{loading ? 'Fetching data...' : 'Currently open'}</p>
    </div>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Total Volume</h2>
      <p class="text-3xl font-bold text-emerald-600">
        {loading ? '$--' : formatCurrency(totalStake)}
      </p>
      <p class="text-sm text-gray-500">{loading ? 'Fetching data...' : 'Total stake across all markets'}</p>
    </div>
  </section>

  <!-- Graph Placeholder Section -->
  <section class="mb-10">
    <h2 class="text-2xl font-semibold text-gray-700 mb-4">Platform Analytics Overview</h2>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-h-[300px] md:min-h-[400px] flex items-center justify-center">
      <p class="text-gray-400 italic text-lg">Placeholder for a large graph showing Total Markets, Active Predictions, and Platform Volume over time.</p>
      <!-- Chart.js, D3.js, or other charting library integration would go here -->
    </div>
  </section>

  <!-- Market List Table Section -->
  <section>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-semibold text-gray-700">Market List</h2>
      <button 
        onclick={refreshData}
        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-150 ease-in-out flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    
    <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market ID</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Pair</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ends In</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Threshold</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Stake</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
              <tr class="hover:bg-gray-50 cursor-pointer" onclick={() => handleMarketClick(market.id)}>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{market.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{market.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.assetPair}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        class:bg-emerald-100={market.status === 'Open'}
                        class:text-emerald-800={market.status === 'Open'}
                        class:bg-yellow-100={market.status === 'Expired'}
                        class:text-yellow-800={market.status === 'Expired'}
                        class:bg-gray-100={market.status === 'Resolved'}
                        class:text-gray-800={market.status === 'Resolved'}>
                    {market.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.expirationDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${market.priceThreshold}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(market.totalStake)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button class="text-emerald-600 hover:text-emerald-800">Details</button>
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

  <!-- Add the modal component instance -->
  <CreateMarketModal 
    bind:showModal={showCreateMarketModal} 
    onClose={() => showCreateMarketModal = false} 
  />

</div>

<style>
  /* Scoped styles for the admin dashboard */
</style>

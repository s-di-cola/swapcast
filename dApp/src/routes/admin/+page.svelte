<script lang="ts">
  import { goto } from '$app/navigation'; // Import goto

  // Logic for the main admin dashboard can be added here in the future
  // e.g., fetching market data, platform statistics, etc.

  // Placeholder data for the market table
  const markets = [
    { id: '1', name: 'ETH/USDC Price above $2500 in 24h?', status: 'Open', assetPair: 'ETH/USDC', endsIn: '18h 23m', volume: '$1,250,000' },
    { id: '2', name: 'BTC/USD Price below $30,000 by EOW?', status: 'Open', assetPair: 'BTC/USD', endsIn: '3d 12h', volume: '$875,000' },
    { id: '3', name: 'SOL/USDT to reach $50 this month?', status: 'Closed', assetPair: 'SOL/USDT', endsIn: 'Resolved', volume: '$550,000' },
    { id: '4', name: 'DOGE/USD price range 0.10-0.15 for 48h', status: 'Open', assetPair: 'DOGE/USD', endsIn: '36h 02m', volume: '$320,000' },
  ];

  function handleMarketClick(marketId: string) {
    goto(`/admin/market/${marketId}`); // Navigate to the details page
  }
</script>

<div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen" style="background-color: #f9fafb;">
  <header class="mb-10 pb-6 border-b border-gray-200 flex justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold text-gray-800">SwapCast Admin Dashboard</h1>
      <p class="text-md text-gray-600 mt-2">Overview of platform activity and market management tools.</p>
    </div>
    <div>
      <a href="/admin/market" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out">
        + Create New Market
      </a>
    </div>
  </header>

  <!-- Summary Boxes Section -->
  <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Total Markets</h2>
      <p class="text-3xl font-bold text-emerald-600">--</p> <!-- Placeholder, e.g., 120 -->
      <p class="text-sm text-gray-500">Fetching data...</p>
    </div>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Active Predictions</h2>
      <p class="text-3xl font-bold text-emerald-600">--</p> <!-- Placeholder, e.g., 1,500 -->
      <p class="text-sm text-gray-500">Fetching data...</p>
    </div>
    <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Platform Volume (24h)</h2>
      <p class="text-3xl font-bold text-emerald-600">$--</p> <!-- Placeholder, e.g., $1.2M -->
      <p class="text-sm text-gray-500">Fetching data...</p>
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
    <h2 class="text-2xl font-semibold text-gray-700 mb-4">Market List</h2>
    <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Pair</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ends In / Resolved</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Volume</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if markets.length > 0}
            {#each markets as market (market.id)}
              <tr class="hover:bg-gray-50 cursor-pointer" on:click={() => handleMarketClick(market.id)}>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{market.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.assetPair}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class:px-2={true} 
                        class:inline-flex={true} 
                        class:text-xs={true} 
                        class:leading-5={true} 
                        class:font-semibold={true} 
                        class:rounded-full={true}
                        class:bg-emerald-100={market.status === 'Open'}
                        class:text-emerald-800={market.status === 'Open'}
                        class:bg-gray-100={market.status === 'Closed'}
                        class:text-gray-800={market.status === 'Closed'}>
                    {market.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.endsIn}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{market.volume}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button class="text-emerald-600 hover:text-emerald-800">Details</button>
                  <!-- More actions like 'Pause Market', 'Resolve Market' could go here -->
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500 italic">No markets found or data is loading...</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Removed the old 'Management Tools' section as the 'Create New Market' is now a prominent button in the header -->

</div>

<style>
  /* Scoped styles for the admin dashboard */
</style>

<script lang="ts">
  import { page } from '$app/stores';

  // Placeholder market data structure - in a real app, you'd fetch this by ID
  interface Prediction {
    id: string;
    predictorAddress: string;
    amount: string;
    outcome: string; // e.g., 'Price Above $2500' or 'In Range'
    timestamp: string;
  }

  interface MarketDetails {
    id: string;
    name: string;
    assetPair: string;
    tokenA_address: string;
    tokenB_address: string;
    marketType: 'price_binary' | 'price_range';
    targetPrice?: number;
    lowerBoundPrice?: number;
    upperBoundPrice?: number;
    durationHours: number;
    resolutionSource: string;
    status: 'Open' | 'Closed' | 'Resolving' | 'Resolved';
    createdAt: string;
    endsAt: string;
    potValueTokenA: string; // e.g. "15000 USDC"
    potValueTokenB: string; // e.g. "5 WETH"
    totalVolume: string; // e.g. "$1,250,000"
    totalPredictions: number;
    uniquePredictors: number;
    // For the graph, we might need time-series data for predictions/volume
    // predictionVolumeOverTime: Array<{timestamp: string, volume: number, predictionCount: number}>;
    predictions: Prediction[];
  }

  let market: MarketDetails | null = null;
  let isLoading = true;
  let errorLoading = false;

  // Simulate fetching market data based on ID from URL
  $: {
    const marketId = $page.params.id;
    // In a real app, fetch from an API or service: `market = await fetchMarketById(marketId);`
    // For now, using placeholder data based on a few possible IDs
    setTimeout(() => {
      if (marketId === '1') {
        market = {
          id: '1',
          name: 'ETH/USDC Price above $2500 in 24h?',
          assetPair: 'ETH/USDC',
          tokenA_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
          tokenB_address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          marketType: 'price_binary',
          targetPrice: 2500,
          durationHours: 24,
          resolutionSource: 'Chainlink ETH/USD Oracle',
          status: 'Open',
          createdAt: '2025-05-10T10:00:00Z',
          endsAt: '2025-05-11T10:00:00Z',
          potValueTokenA: '15000 USDC',
          potValueTokenB: '5 WETH',
          totalVolume: '$1,250,000',
          totalPredictions: 152,
          uniquePredictors: 88,
          // predictionVolumeOverTime: [ {timestamp: '2025-05-10T11:00:00Z', volume: 50000, predictionCount: 10}, ...]
          predictions: [
            { id: 'p1', predictorAddress: '0x123...', amount: '100 USDC', outcome: 'Above $2500', timestamp: '2025-05-10T11:05:00Z' },
            { id: 'p2', predictorAddress: '0x456...', amount: '2 ETH', outcome: 'Below $2500', timestamp: '2025-05-10T12:15:00Z' },
          ]
        };
      } else if (marketId === '3') {
         market = {
          id: '3',
          name: 'SOL/USDT to reach $50 this month?',
          assetPair: 'SOL/USDT',
          tokenA_address: '0xEs9vMFrzaCERmJfrF4H2FYD4KCoNqDMpJHXrmmgr दुबे', // SOL - Note: Invalid char, keeping for placeholder consistency
          tokenB_address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
          marketType: 'price_binary',
          targetPrice: 50,
          durationHours: 720, // Approx 30 days
          resolutionSource: 'Internal Oracle',
          status: 'Resolved',
          createdAt: '2025-04-01T00:00:00Z',
          endsAt: '2025-05-01T00:00:00Z',
          potValueTokenA: '50000 USDT',
          potValueTokenB: '1000 SOL',
          totalVolume: '$550,000',
          totalPredictions: 320,
          uniquePredictors: 150,
          // predictionVolumeOverTime: [],
          predictions: [] // Assume resolved, so not listing active ones
        };
      } else {
        errorLoading = true;
      }
      isLoading = false;
    }, 500); // Simulate network delay
  }

  function getStatusColor(status: MarketDetails['status']) {
    switch (status) {
      case 'Open': return 'bg-emerald-100 text-emerald-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      case 'Resolving': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen" style="background-color: #f9fafb;">
  <header class="mb-8 pb-4 border-b border-gray-200">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-800">
        Market Details
      </h1>
      <a href="/admin" class="text-sm text-emerald-600 hover:text-emerald-700 hover:underline">
        &larr; Back to Admin Dashboard
      </a>
    </div>
    {#if !isLoading && market}
      <p class="text-lg text-gray-600 mt-1">{market.name}</p>
    {/if}
  </header>

  {#if isLoading}
    <div class="flex justify-center items-center min-h-[300px]">
      <p class="text-xl text-gray-500">Loading market details...</p>
      <!-- You can add a spinner SVG here -->
    </div>
  {:else if errorLoading || !market}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline">Could not load market details. Please try again or check the market ID.</span>
    </div>
  {:else}
    <!-- Market Specific Summary Boxes -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Total Pot Value</h2>
        <p class="text-2xl md:text-3xl font-bold text-emerald-600">
          {market.potValueTokenA} + {market.potValueTokenB}
        </p>
        <p class="text-sm text-gray-500">Combined value in both tokens</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Predictions on Market</h2>
        <p class="text-2xl md:text-3xl font-bold text-emerald-600">{market.totalPredictions}</p>
        <p class="text-sm text-gray-500">from {market.uniquePredictors} unique predictors</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Market Volume</h2>
        <p class="text-2xl md:text-3xl font-bold text-emerald-600">{market.totalVolume}</p>
        <p class="text-sm text-gray-500">Total value predicted</p>
      </div>

      <!-- New Detailed Info Boxes -->
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Market ID</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{market.id}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Asset Pair</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{market.assetPair}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Status</h3>
        <p class="text-lg font-semibold text-gray-800">
          <span class="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusColor(market.status)}">
            {market.status}
          </span>
        </p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Market Type</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{market.marketType === 'price_binary' ? 'Binary Price' : 'Price Range'}</p>
      </div>

      {#if market.marketType === 'price_binary' && market.targetPrice}
        <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 class="text-sm font-medium text-gray-500 mb-1">Target Price</h3>
          <p class="text-lg font-semibold text-gray-800 break-words">{market.targetPrice} {market.assetPair.split('/')[1]}</p>
        </div>
      {/if}
      {#if market.marketType === 'price_range' && market.lowerBoundPrice && market.upperBoundPrice}
        <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 class="text-sm font-medium text-gray-500 mb-1">Price Range</h3>
          <p class="text-lg font-semibold text-gray-800 break-words">{market.lowerBoundPrice} - {market.upperBoundPrice} {market.assetPair.split('/')[1]}</p>
        </div>
      {/if}

      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Resolution Source</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{market.resolutionSource}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Created At</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{new Date(market.createdAt).toLocaleString()}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Ends / Resolved At</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{new Date(market.endsAt).toLocaleString()}</p>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-500 mb-1">Duration</h3>
        <p class="text-lg font-semibold text-gray-800 break-words">{market.durationHours} hours</p>
      </div>
    </section>

    <!-- Market Specific Graph Placeholder Section -->
    <section class="mb-10">
      <h2 class="text-2xl font-semibold text-gray-700 mb-4">Market Analytics</h2>
      <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-h-[300px] md:min-h-[400px] flex items-center justify-center">
        <p class="text-gray-400 italic text-lg">Placeholder for graph: Prediction Volume & Count Over Time for this Market</p>
      </div>
    </section>

    <!-- Predictions List Section -->
    <section>
      <h2 class="text-2xl font-semibold text-gray-700 mb-4">Prediction History for this Market</h2>
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
        {#if market.predictions.length > 0}
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Predictor</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome Chosen</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each market.predictions as prediction (prediction.id)}
                <tr>
                  <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-700 font-mono" title="{prediction.predictorAddress}">{prediction.predictorAddress.substring(0,10)}...</td>
                  <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{prediction.amount}</td>
                  <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{prediction.outcome}</td>
                  <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-700">{new Date(prediction.timestamp).toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="px-4 py-6 text-center text-sm text-gray-500 italic">No active predictions found for this market, or predictions are not displayed for its current status.</p>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  /* Scoped styles if needed */
</style>
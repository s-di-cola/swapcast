<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import SwapPanel from '$lib/components/SwapPanel.svelte';
  import MarketDetailsModal from '$lib/components/admin/MarketDetailsModal.svelte';
  import { Badge, Button, Card, Spinner } from 'flowbite-svelte';
  import { ChartLineUpOutline, ChartPieOutline, AwardOutline, AdjustmentsHorizontalOutline, ArrowRightOutline } from 'flowbite-svelte-icons';
  import type { Token, PredictionSide } from '$lib/types';
  import { getAllMarkets } from '$lib/services/marketService';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  

  // Define Token Objects
  const ethToken: Token = { symbol: 'ETH', name: 'Ethereum' };
  const usdcToken: Token = { symbol: 'USDC', name: 'USD Coin' };

  // Market details modal state
  let showMarketDetailsModal = false;
  let selectedMarketId: string | null = null;
  let markets: any[] = [];
  let isLoadingMarkets = true;
  let marketError = '';

  // Dummy data - replace with actual data fetching
  let payAmount = 0;
  let payToken: Token = ethToken;
  let receiveAmount = 0;
  let receiveToken: Token = usdcToken;
  let ethPrice = 2389.42;
  let networkFee = 0.0012;
  let predictionSide: PredictionSide = undefined;
  let totalBullWeight = 7500;
  let totalBearWeight = 5500;
  let protocolFeeRate = 0.05; // 5%

  // Placeholder for performance stats
  let accuracy = 78;
  let rank = 12;

  // Fetch markets data
  async function fetchMarkets() {
    try {
      isLoadingMarkets = true;
      markets = await getAllMarkets();
    } catch (error) {
      console.error('Error fetching markets:', error);
      marketError = 'Failed to load markets. Please try again.';
    } finally {
      isLoadingMarkets = false;
    }
  }

  // Handle market selection for modal
  function openMarketDetails(marketId: string) {
    selectedMarketId = marketId;
    showMarketDetailsModal = true;
  }

  // Close market details modal
  function closeMarketModal() {
    showMarketDetailsModal = false;
  }

  const onPredictionSelect = (side: PredictionSide, targetPrice: number | undefined) => {
    console.log('Dashboard: Prediction selected:', side, 'Target Price:', targetPrice);
  };
  
  // Initialize data on mount
  onMount(() => {
    fetchMarkets();
    
    // Check if we have a market ID in the URL (for direct links)
    const marketIdFromUrl = $page.url.searchParams.get('market');
    if (marketIdFromUrl) {
      openMarketDetails(marketIdFromUrl);
    }
  });

  // Placeholder for prediction history
  const predictionHistory = [
    { id: 1, timestamp: '2023-11-10 10:00', marketName: 'ETH Price', assetPair: 'ETH/USDC', predictedDirection: 'Above', predictedPrice: '$2400', stakedAmount: '0.5 ETH', outcome: 'Won' },
    { id: 2, timestamp: '2023-11-09 14:30', marketName: 'ETH Price', assetPair: 'ETH/USDC', predictedDirection: 'Below', predictedPrice: '$2300', stakedAmount: '1.2 ETH', outcome: 'Lost' },
    { id: 3, timestamp: '2023-11-12 09:00', marketName: 'BTC Target', assetPair: 'BTC/USDT', predictedDirection: 'Above', predictedPrice: '$35000', stakedAmount: '0.1 BTC', outcome: 'Pending' },
  ];

  function getStatusColor(outcome: string) {
    if (outcome === 'Won') return 'green';
    if (outcome === 'Lost') return 'red';
    return 'gray'; // For Pending or other states
  }

  // Generate price history data for chart
  const priceHistoryData = generatePriceHistoryData();
  
  function generatePriceHistoryData() {
    const data = [];
    const now = new Date();
    // Generate 24 hours of data points (one per hour)
    for (let i = 0; i < 24; i++) {
      const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      // Base price with some random variation
      const price = 2300 + Math.sin(i / 3) * 100 + Math.random() * 50;
      data.push({
        time: time.toISOString(),
        price: price
      });
    }
    return data;
  }

  // Calculate min and max prices for chart scaling
  const minPrice = Math.min(...priceHistoryData.map(d => d.price)) * 0.99;
  const maxPrice = Math.max(...priceHistoryData.map(d => d.price)) * 1.01;
  const priceRange = maxPrice - minPrice;

  // Generate SVG path for price chart
  function generateSvgPath() {
    const width = 800;
    const height = 300;
    
    // Map data points to SVG coordinates
    const points = priceHistoryData.map((d, i) => {
      const x = (i / (priceHistoryData.length - 1)) * width;
      const y = height - ((d.price - minPrice) / priceRange) * height;
      return `${x},${y}`;
    });
    
    return `M${points.join(' L')}`;
  }

  const pricePath = generateSvgPath();
</script>

<svelte:head>
  <title>SwapCast App</title>
  <meta name="description" content="SwapCast Decentralized Prediction Market" />
</svelte:head>

<!-- Market Details Modal -->
<MarketDetailsModal 
  bind:showModal={showMarketDetailsModal} 
  marketId={selectedMarketId} 
  onClose={closeMarketModal} 
/>

<div class="min-h-screen bg-gray-50 text-gray-800">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Page Title -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p class="text-gray-600 mt-1">View your predictions and market performance</p>
    </div>
    
    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Swap Panel -->
      <div class="lg:col-span-5 space-y-6">
        <!-- Account Summary Card -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Account Summary</h2>
            <span class="text-xs text-gray-500">Last updated: 5 min ago</span>
          </div>
          <div class="flex justify-between items-center">
            <div>
              <p class="text-3xl font-bold text-gray-900">2,500 USDC</p>
              <p class="text-sm text-gray-500 mt-1">≈ $2,500.00</p>
            </div>
          </div>
        </div>
        
        <!-- Swap Panel -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <SwapPanel 
            bind:payAmount
            bind:payToken
            bind:receiveAmount
            bind:receiveToken
            {ethPrice}
            {networkFee}
            {totalBullWeight}
            {totalBearWeight}
            {protocolFeeRate}
            {onPredictionSelect}
          />
        </div>
      </div>
      
      <!-- Right Column: Markets and Performance -->
      <div class="lg:col-span-7 space-y-6">
        <!-- Markets Section -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-100">
          <div class="p-6 border-b border-gray-100">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold text-gray-800">Available Markets</h2>
              <button class="px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors">
                View All Markets
              </button>
            </div>
          </div>
            
            {#if isLoadingMarkets}
              <div class="flex justify-center items-center py-12">
                <Spinner size="6" class="text-indigo-600" />
                <span class="ml-3 text-gray-500">Loading markets...</span>
              </div>
            {:else if marketError}
              <div class="p-6 text-center text-red-500">
                <p>{marketError}</p>
              </div>
            {:else if markets.length === 0}
              <div class="p-6 text-center text-gray-500">
                <p>No markets available at this time.</p>
              </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {#each markets.slice(0, 4) as market (market.id)}
                <button type="button" class="w-full text-left border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" on:click={() => openMarketDetails(market.id)}>
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="font-medium text-gray-900">{market.name}</h3>
                    <span class="px-2 py-1 text-xs font-medium rounded-full {market.resolved ? 'bg-gray-100 text-gray-800' : 'bg-emerald-100 text-emerald-800'}">
                      {market.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 mb-3">{market.assetPair}</p>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">Threshold: ${market.priceThreshold}</span>
                    <span class="text-gray-500">Expires: {new Date(market.expirationTime * 1000).toLocaleDateString()}</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
          </div>
          
        <!-- Price History Chart -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Price History (ETH/USDC)</h2>
            <div class="flex space-x-2">
              <button class="px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-full">24h</button>
              <button class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">7d</button>
              <button class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">30d</button>
            </div>
          </div>
          
          <div class="h-64 relative">
            <!-- SVG Chart Visualization -->
            <svg class="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
              <!-- Grid Lines -->
              <g class="grid-lines">
                <line x1="0" y1="0" x2="800" y2="0" stroke="#f3f4f6" stroke-width="1" />
                <line x1="0" y1="75" x2="800" y2="75" stroke="#f3f4f6" stroke-width="1" />
                <line x1="0" y1="150" x2="800" y2="150" stroke="#f3f4f6" stroke-width="1" />
                <line x1="0" y1="225" x2="800" y2="225" stroke="#f3f4f6" stroke-width="1" />
                <line x1="0" y1="300" x2="800" y2="300" stroke="#f3f4f6" stroke-width="1" />
              </g>
              
              <!-- Price Chart Line -->
              <path 
                d={pricePath}
                fill="none" 
                stroke="#6366f1" 
                stroke-width="3" 
                stroke-linejoin="round"
              />
              
              <!-- Area under the curve -->
              <path 
                d="{pricePath} L800,300 L0,300 Z" 
                fill="url(#gradient)" 
                opacity="0.2"
              />
              
              <!-- Gradient definition -->
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#6366f1" />
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
                </linearGradient>
              </defs>
            </svg>
            
            <!-- Price Labels -->
            <div class="absolute top-0 right-0 h-full flex flex-col justify-between text-xs text-gray-500 py-2 pr-2">
              <div>${maxPrice.toFixed(2)}</div>
              <div>${(minPrice + priceRange * 0.75).toFixed(2)}</div>
              <div>${(minPrice + priceRange * 0.5).toFixed(2)}</div>
              <div>${(minPrice + priceRange * 0.25).toFixed(2)}</div>
              <div>${minPrice.toFixed(2)}</div>
            </div>
            </div>
          </div>
          
        <!-- Performance Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Market Sentiment -->
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Market Sentiment</h2>
              <div class="p-2 bg-indigo-50 rounded-full">
                <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              </div>
              <div class="flex flex-col items-center justify-center">
                <div class="relative w-36 h-36">
                  <svg viewBox="0 0 36 36" class="w-full h-full">
                    <!-- Background Circle -->
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f3f4f6" stroke-width="2.17" />
                    
                    <!-- Progress Circle (Bullish Sentiment) -->
                    <path 
                      class="stroke-current text-indigo-500" 
                      fill="none" 
                      stroke-width="2.17" 
                      stroke-linecap="round" 
                      stroke-dasharray="{(totalBullWeight / (totalBullWeight + totalBearWeight)) * 100}, 100"
                      d="M18 2.0845
                         a 15.9155 15.9155 0 0 1 0 31.831
                         a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <text x="18" y="20.35" class="fill-current text-gray-700 text-[5px] font-bold" text-anchor="middle">{((totalBullWeight / (totalBullWeight + totalBearWeight)) * 100).toFixed(1)}% Bullish</text>
                  </svg>
                </div>
              </div>
            </div>
            
            <!-- Your Accuracy -->
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Your Accuracy</h2>
                <div class="p-2 bg-green-50 rounded-full">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <div class="flex flex-col items-center justify-center">
                <p class="text-4xl font-bold text-gray-900">{accuracy}%</p>
                <p class="text-sm text-gray-500 mt-1">Based on last 20 predictions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Prediction History Table -->
      <div class="mt-8 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-6 border-b border-gray-100">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold text-gray-800">Prediction History</h2>
            <button class="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-all duration-150 ease-in-out flex items-center text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Market</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Side / Target</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Amount</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Action</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              {#each predictionHistory as prediction (prediction.id)}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{prediction.timestamp}</td>
                  <td class="px-4 py-3 text-sm text-gray-700">
                    {prediction.marketName}
                    <span class="block text-xs text-gray-500">{prediction.assetPair}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm">
                    {#if prediction.predictedDirection === 'Above'}
                      <span class="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">Above</span>
                    {:else}
                      <span class="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full">Below</span>
                    {/if}
                    {#if prediction.predictedPrice}
                      <span class="ml-2 text-gray-600">{prediction.predictedPrice}</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{prediction.stakedAmount}</td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {#if prediction.outcome === 'Won'}
                      <span class="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">Won</span>
                    {:else if prediction.outcome === 'Lost'}
                      <span class="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full">Lost</span>
                    {:else}
                      <span class="px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 rounded-full">Pending</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {#if prediction.outcome === 'Won'}
                      <button class="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">Claim</button>
                    {:else if prediction.outcome === 'Pending'}
                      <span class="text-xs text-gray-400 italic">Pending</span>
                    {:else}
                      <span class="text-xs text-gray-400">-</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        <div class="p-4 border-t border-gray-100 flex justify-between items-center">
          <div class="text-sm text-gray-500">Showing 3 of 24 predictions</div>
          <div class="flex space-x-2">
            <button class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">
              Previous
            </button>
            <button class="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  


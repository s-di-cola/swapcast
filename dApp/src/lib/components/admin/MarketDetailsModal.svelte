<script lang="ts">
  import { Modal, Button, Spinner } from 'flowbite-svelte';
  import { XSolid, ChartPieSolid, ClockSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
  import { getMarketDetails, type Market } from '$lib/services/market/marketService';
  import { onMount } from 'svelte';

  export let showModal = false;
  export let marketId: string | null = null;
  export let onClose: () => void;

  let marketToDisplay: Market | null = null;
  let isLoading = true;
  let errorMsg = '';

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

  // Helper function to get Etherscan link
  function getEtherscanLink(address: string) {
    return `https://etherscan.io/address/${address}`;
  }

  // Fetch market data
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
      console.error(`Error fetching market details for ID ${marketId}:`, err);
      errorMsg = 'Failed to load market details. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Watch for changes to marketId and showModal
  $: if (showModal && marketId) {
    fetchMarketData();
  }
</script>

<Modal bind:open={showModal} size="xl" autoclose={false} class="w-full max-w-4xl" outsideclose>
  <div class="flex justify-between items-center pb-4 mb-4 border-b">
    <h3 class="text-xl font-semibold text-gray-900">
      {#if isLoading}
        Loading Market Details...
      {:else if marketToDisplay}
        {marketToDisplay.name || `Market #${marketToDisplay.id}`}
      {:else}
        Market Details
      {/if}
    </h3>
    <Button class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" on:click={() => onClose()}>
      <XSolid class="w-5 h-5" />
    </Button>
  </div>

  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-12">
      <Spinner size="12" />
      <p class="mt-4 text-gray-600">Loading market details...</p>
    </div>
  {:else if errorMsg}
    <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg flex items-center">
      <ExclamationCircleSolid class="w-6 h-6 mr-3 text-red-600" />
      <div>
        <h3 class="text-lg font-semibold">Error Loading Market</h3>
        <p>{errorMsg}</p>
      </div>
    </div>
  {:else if marketToDisplay}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <!-- Market Summary -->
      <div class="bg-gray-50 p-4 rounded-lg">
        <div class="flex items-center mb-3">
          <ChartPieSolid class="w-5 h-5 mr-2 text-gray-600" />
          <h4 class="text-lg font-semibold text-gray-700">Market Summary</h4>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-600">Asset Pair:</span>
            <span class="font-semibold">{marketToDisplay.assetPair}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Status:</span>
            <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full {getStatusColor(marketToDisplay.status)}">
              {marketToDisplay.status}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Price Threshold:</span>
            <span class="font-semibold">${formatCurrency(marketToDisplay.priceThreshold)}</span>
          </div>
        </div>
      </div>

      <!-- Financial Details -->
      <div class="bg-gray-50 p-4 rounded-lg">
        <div class="flex items-center mb-3">
          <div class="flex items-center justify-center w-5 h-5 mr-2 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 class="text-lg font-semibold text-gray-700">Financial Details</h4>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-600">Total Stake:</span>
            <span class="font-semibold">{formatCurrency(marketToDisplay.totalStake)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Market Resolved:</span>
            <span class="font-semibold">{marketToDisplay.resolved ? 'Yes' : 'No'}</span>
          </div>
          {#if marketToDisplay.resolved && marketToDisplay.winningOutcome !== undefined}
            <div class="flex justify-between">
              <span class="text-gray-600">Winning Outcome:</span>
              <span class="font-semibold">{marketToDisplay.winningOutcome === 0 ? 'Below/Equal' : 'Above'}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Time Information -->
    <div class="bg-gray-50 p-4 rounded-lg mb-6">
      <div class="flex items-center mb-3">
        <ClockSolid class="w-5 h-5 mr-2 text-gray-600" />
        <h4 class="text-lg font-semibold text-gray-700">Time Information</h4>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-600">Expires In:</span>
          <span class="font-semibold">{marketToDisplay.expirationDisplay}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Expiration Time:</span>
          <span class="font-semibold">{new Date(marketToDisplay.expirationTime * 1000).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Price Aggregator -->
    <div class="bg-gray-50 p-4 rounded-lg">
      <div class="flex items-center mb-3">
        <h4 class="text-lg font-semibold text-gray-700">Price Aggregator</h4>
      </div>
      <div class="overflow-hidden">
        <a href={getEtherscanLink(marketToDisplay.priceAggregator)} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 transition-colors text-sm break-all">
          {marketToDisplay.priceAggregator}
        </a>
      </div>
    </div>

    <!-- Chart Visualization -->
    <div class="mt-6 border border-gray-100 rounded-lg p-4 bg-white shadow-sm">
      <div class="flex justify-between items-center mb-4">
        <h4 class="text-lg font-semibold text-gray-700">Price Chart</h4>
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
          
          <!-- Price Threshold Line -->
          <line x1="0" y1="150" x2="800" y2="150" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,5" />
          
          <!-- Price Chart Line -->
          <path 
            d="M0,200 C50,180 100,220 150,190 C200,160 250,140 300,120 C350,100 400,80 450,90 C500,100 550,130 600,110 C650,90 700,70 750,60 L800,40" 
            fill="none" 
            stroke="#6366f1" 
            stroke-width="3" 
            stroke-linejoin="round"
          />
          
          <!-- Area under the line -->
          <path 
            d="M0,200 C50,180 100,220 150,190 C200,160 250,140 300,120 C350,100 400,80 450,90 C500,100 550,130 600,110 C650,90 700,70 750,60 L800,40 L800,300 L0,300 Z" 
            fill="url(#gradient)" 
            opacity="0.2"
          />
          
          <!-- Gradient definition -->
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#6366f1" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#6366f1" stop-opacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
        
        <!-- Price Labels -->
        <div class="absolute top-0 right-0 h-full flex flex-col justify-between text-xs text-gray-500 py-2 pr-2">
          <div>$2,500</div>
          <div>$2,000</div>
          <div>$1,500</div>
          <div>$1,000</div>
          <div>$500</div>
        </div>
        
        <!-- Threshold Label -->
        <div class="absolute top-1/2 left-2 transform -translate-y-1/2 text-xs font-medium text-red-500">
          Threshold: ${marketToDisplay?.priceThreshold || '0'}
        </div>
      </div>
      
      <div class="flex justify-between text-xs text-gray-500 mt-2">
        <span>May 6</span>
        <span>May 9</span>
        <span>May 12</span>
        <span>May 13</span>
      </div>
    </div>
    
    <!-- Transaction History Table -->
    <div class="mt-6 border border-gray-100 rounded-lg p-4 bg-white shadow-sm">
      <h4 class="text-lg font-semibold text-gray-700 mb-4">Transaction History</h4>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Transaction</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">User</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Prediction</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Amount</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Time</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            <!-- Sample transaction data (would be replaced with real data) -->
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                <a href="https://etherscan.io/tx/0x1234..." target="_blank" rel="noopener noreferrer" class="flex items-center">
                  0x1234...5678
                  <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">0xabcd...ef12</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">Bullish</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">0.5 ETH</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">13 May 2025, 14:32</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">Confirmed</span>
              </td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                <a href="https://etherscan.io/tx/0x5678..." target="_blank" rel="noopener noreferrer" class="flex items-center">
                  0x5678...9abc
                  <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">0xdef0...1234</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full">Bearish</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">0.25 ETH</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">13 May 2025, 14:28</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">Confirmed</span>
              </td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                <a href="https://etherscan.io/tx/0x9abc..." target="_blank" rel="noopener noreferrer" class="flex items-center">
                  0x9abc...def0
                  <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">0x5678...9abc</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">Bullish</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">1.0 ETH</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">13 May 2025, 14:15</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">Confirmed</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="flex justify-between items-center mt-4">
        <div class="text-sm text-gray-500">Showing 3 of 24 transactions</div>
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
  {/if}

  <svelte:fragment slot="footer">
    <Button color="alternative" on:click={() => onClose()}>Close</Button>
    {#if marketToDisplay}
      <Button color="blue" on:click={() => fetchMarketData()}>Refresh Data</Button>
    {/if}
  </svelte:fragment>
</Modal>

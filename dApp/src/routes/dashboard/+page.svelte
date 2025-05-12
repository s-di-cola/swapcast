<script lang="ts">
  import SwapPanel from '$lib/components/SwapPanel.svelte';
  import { Badge, Button, Card } from 'flowbite-svelte';
  import { ChartLineUpOutline, ChartPieOutline, AwardOutline, AdjustmentsHorizontalOutline } from 'flowbite-svelte-icons';
  import type { Token, PredictionSide } from '../../lib/types';

  // Define Token Objects
  const ethToken: Token = { symbol: 'ETH', name: 'Ethereum' };
  const usdcToken: Token = { symbol: 'USDC', name: 'USD Coin' };

  // Dummy data - replace with actual data fetching
  let payAmount = 0;
  let payToken: Token = ethToken; // Initialize with ethToken object
  let receiveAmount = 0;
  let receiveToken: Token = usdcToken; // Initialize with usdcToken object
  let ethPrice = 2389.42; // Example current price
  let networkFee = 0.0012; // Example network fee
  let predictionSide: PredictionSide = undefined; // Initialize with undefined
  let totalBullWeight = 7500; // Example total bullish stakes
  let totalBearWeight = 5500; // Example total bearish stakes
  let protocolFeeRate = 0.05; // 5%

  // Placeholder for performance stats
  let accuracy = 78; // Example accuracy
  let rank = 12;     // Example rank

  const onPredictionSelect = (side: PredictionSide, targetPrice: number | undefined) => {
    console.log('Dashboard: Prediction selected:', side, 'Target Price:', targetPrice);
  };

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
</script>

<svelte:head>
  <title>SwapCast Dashboard</title>
  <meta name="description" content="SwapCast Decentralized Prediction Market Dashboard" />
</svelte:head>

<div class="min-h-screen bg-slate-100 text-gray-800 p-4 md:p-6 lg:p-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <header class="mb-8 text-center">
      <h1 class="text-4xl font-bold tracking-tight text-gray-800 sm:text-5xl">Dashboard</h1>
      <p class="mt-3 text-lg text-gray-600">Manage your swaps, predictions, and track your market performance.</p>
    </header>

    <!-- Top Section: Two Columns (SwapPanel on Left, Charts/Performance on Right) -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start mb-8 md:mb-12">
      
      <!-- Left Column: Swap Panel (takes 2/5 on lg screens) -->
      <div class="lg:col-span-2 space-y-6">
        <Card class="!bg-white !border-gray-200 !shadow-xl p-0 overflow-hidden">
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
        </Card>
      </div>

      <!-- Right Column: Charts and Performance (takes 3/5 on lg screens) -->
      <div class="lg:col-span-3 flex flex-col gap-6 lg:gap-8">
        <!-- Placeholder: Price History Chart -->
        <Card class="!bg-white !border-gray-200 !shadow-lg">
          <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center">
            <ChartLineUpOutline class="w-5 h-5 mr-2 text-sky-600" /> Price History (ETH/USDC)
          </h3>
          <div class="flex-grow flex items-center justify-center text-gray-400 bg-slate-50 rounded-md border border-gray-200 p-4">
            <!-- Realistic Line Chart SVG Placeholder -->
            <svg viewBox="0 0 100 50" class="w-full h-auto text-gray-400" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M 0 40 C 10 10, 20 30, 30 20 S 50 45, 60 35 S 80 15, 90 25 L 100 20" />
              <line x1="0" y1="48" x2="100" y2="48" stroke-width="0.5" stroke-dasharray="2 2" class="text-gray-300"/>
              <line x1="0" y1="2" x2="100" y2="2" stroke-width="0.5" stroke-dasharray="2 2" class="text-gray-300"/>
              <line x1="2" y1="0" x2="2" y2="50" stroke-width="0.5" stroke-dasharray="2 2" class="text-gray-300"/>
              <line x1="98" y1="0" x2="98" y2="50" stroke-width="0.5" stroke-dasharray="2 2" class="text-gray-300"/>
            </svg>
          </div>
        </Card>

        <Card class="!bg-white !border-gray-200 !shadow-lg">
          <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center">
            <ChartPieOutline class="w-5 h-5 mr-2 text-sky-600" /> Market Sentiment
          </h3>
          <div class="flex-grow flex items-center justify-center text-gray-400 bg-slate-50 rounded-md border border-gray-200 p-4">
            <!-- Realistic Gauge/Donut Chart SVG Placeholder -->
            <svg viewBox="0 0 36 36" class="w-24 h-24">
              <path class="text-rose-200" stroke="currentColor" stroke-width="3" fill="none"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="text-sky-500" stroke="currentColor" stroke-width="3" fill="none"
                    stroke-dasharray="{ (totalBullWeight / (totalBullWeight + totalBearWeight)) * 100 }, 100"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="20.35" class="fill-current text-gray-700 text-[5px] font-bold" text-anchor="middle">{( (totalBullWeight / (totalBullWeight + totalBearWeight)) * 100 ).toFixed(1)}% Bullish</text>
            </svg>
          </div>
        </Card>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card class="!bg-white !border-gray-200 !shadow-lg flex flex-col justify-center items-center text-center">
            <h3 class="text-lg font-semibold text-gray-700 mb-2 flex items-center">
              <AwardOutline class="w-5 h-5 mr-2 text-amber-500" /> Your Accuracy
            </h3>
            <p class="text-4xl font-bold text-gray-800">{accuracy}%</p>
            <p class="text-sm text-gray-500 mt-1">Based on last 20 predictions</p>
          </Card>
          <Card class="!bg-white !border-gray-200 !shadow-lg flex flex-col justify-center items-center text-center">
            <h3 class="text-lg font-semibold text-gray-700 mb-2 flex items-center">
              <AdjustmentsHorizontalOutline class="w-5 h-5 mr-2 text-purple-500" /> Your Rank
            </h3>
            <p class="text-4xl font-bold text-gray-800">#{rank}</p>
            <p class="text-sm text-gray-500 mt-1">Among 100 participants</p>
          </Card>
        </div>
      </div>
    </div>

    <!-- Prediction History Table (Full Width Below Two Columns) -->
    <div class="bg-white p-5 md:p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Prediction History</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-slate-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side / Target</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each predictionHistory as prediction (prediction.id)}
              <tr class="hover:bg-slate-50/70 transition-colors duration-100">
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{prediction.timestamp}</td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {prediction.marketName}
                  <span class="block text-xs text-gray-500">{prediction.assetPair}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">
                  {#if prediction.predictedDirection === 'Above'}
                    <span class="font-medium text-sky-600">{prediction.predictedDirection}</span>
                  {:else}
                    <span class="font-medium text-rose-600">{prediction.predictedDirection}</span>
                  {/if}
                  {#if prediction.predictedPrice}
                    <span class="block text-xs text-gray-500">{prediction.predictedPrice}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{prediction.stakedAmount}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
                  <Badge color={getStatusColor(prediction.outcome)} class="!text-xs !font-medium px-2 py-0.5">{prediction.outcome}</Badge>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-center">
                  {#if prediction.outcome === 'Won'}
                    <Button pill={true} color="light" size="xs" class="!font-medium !text-xs !bg-sky-500 !text-white hover:!bg-sky-600 focus:!ring-sky-300 !border-sky-500">Claim</Button>
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
    </div>

    <footer class="text-center py-8 mt-8 text-gray-500 text-sm">
      &copy; {new Date().getFullYear()} SwapCast. All rights reserved.
    </footer>
  </div>
</div>

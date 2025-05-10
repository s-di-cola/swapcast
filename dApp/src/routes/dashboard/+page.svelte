<script lang="ts">
  import { Button, Card, Badge, Tooltip } from 'flowbite-svelte';
  
  import SwapPanel from '$lib/components/SwapPanel.svelte';
  
  
  // TODO: Replace with real wallet/user state
  let walletConnected = true;
  let userAddress = '0x71...4a92';
  let network = 'Ethereum Mainnet';
  // Dummy data for demo
  let payAmount: number | null = 0.5;
  let payToken = 'ETH';
  let receiveAmount = 1194.71;
  let receiveToken = 'USDC';
  let ethPrice = 2389.42;
  let networkFee = 3.24;
  let predictionValue = 2250;
  let marketConsensus = 2500;
  let accuracy = 68;
  let rank = 28;
  let predictionSide = 'bullish';
  let positions = [
    { market: 'ETH/USDC 24h', side: 'Bullish', amount: '0.5 ETH', status: 'Open', date: '2025-05-10' },
    { market: 'ETH/USDC 1w', side: 'Bearish', amount: '1.0 ETH', status: 'Pending', date: '2025-05-05' },
    { market: 'ETH/USDC 24h Long Name Market Example For Wrapping', side: 'Bullish', amount: '0.2 ETH', status: 'Win', date: '2025-05-01' },
    { market: 'ETH/USDC 1w', side: 'Bearish', amount: '0.3 ETH', status: 'Lose', date: '2025-04-30' }
  ];

  let convictionStake: number = 0; // Initialize
  $: {
    if (typeof payAmount === 'number' && !isNaN(payAmount)) {
      convictionStake = payAmount * 0.01;
    } else {
      convictionStake = 0; // Default to 0 if payAmount is not a valid number
    }
  }

</script>

<!-- Main page container with light gradient theme -->
<section class="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 text-gray-800 flex flex-col font-sans justify-between">
  <!-- Header -->
  <header class="px-6 py-4 flex justify-between items-center border-b border-emerald-200">
    <h1 class="text-xl font-semibold text-gray-800">Uniswap v4 <span class="text-gray-500">|</span> Prediction Oracle</h1>
    <div class="flex items-center gap-3">
      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      <span class="text-sm text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{userAddress}</span>
      <button class="text-gray-500 hover:text-gray-700" aria-label="User menu">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
      </button>
    </div>
  </header>

  <!-- Main content area -->
  <main class="flex-grow p-6 lg:p-8">
    <div class="w-full max-w-7xl mx-auto flex flex-col items-center">
      <!-- NEW Intermediate Wrapper for two-column row and prediction table -->
      <div class="w-full lg:w-auto flex flex-col gap-6 lg:gap-8">
        <!-- Two-column layout div and the Prediction History table div in a new parent div -->
        <div class="flex flex-col lg:flex-row items-start justify-center gap-6">
          
          <!-- Left Panel: Swap & Prediction -->
          <div class="flex-1 lg:max-w-lg bg-white bg-opacity-80 rounded-2xl shadow-lg p-8 border border-amber-100">
            <h2 class="text-xl font-bold text-gray-800 mb-1">Swap</h2>
            
            <!-- You Pay Section -->
            <div class="bg-emerald-50/50 rounded-lg p-4 border border-emerald-200">
              <div class="text-xs text-emerald-700 mb-1">You pay</div>
              <div class="flex items-center justify-between">
                <input type="number" bind:value={payAmount} class="text-2xl font-bold bg-transparent text-gray-800 outline-none w-full" placeholder="0.0" />
                <button class="px-3 py-1.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold text-sm transition">
                  ETH
                </button>
              </div>
            </div>

            <!-- Arrow Icon -->
            <div class="flex justify-center my-3">
              <button class="p-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition" aria-label="Swap direction">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </button>
            </div>

            <!-- You Receive Section -->
            <div class="bg-emerald-50/50 rounded-lg p-4 border border-emerald-200">
              <div class="text-xs text-emerald-700 mb-1">You receive</div>
              <div class="flex items-center justify-between">
                <input type="text" value={receiveAmount.toFixed(2)} readonly class="text-2xl font-bold bg-transparent text-gray-800 outline-none w-full" placeholder="0.0" />
                <button class="px-3 py-1.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold text-sm transition">
                  USDC
                </button>
              </div>
            </div>

            <!-- Rate and Network Fee -->
            <div class="text-xs text-gray-500 flex justify-between px-1 mt-3">
              <span>Rate <span class="text-gray-700 font-medium">1 ETH = {ethPrice} USDC</span></span>
              <span>Network fee <span class="text-gray-700 font-medium">≈ ${networkFee}</span></span>
            </div>

            <!-- Add Prediction Section -->
            <div class="bg-emerald-50/50 rounded-lg p-4 border border-emerald-200 mt-6">
              <div class="text-sm font-medium text-gray-800 mb-2">Add prediction</div>
              <div class="text-xs text-emerald-700 mb-2">ETH price in 24h:</div>
              <div class="flex items-center gap-2">
                <input type="number" bind:value={predictionValue} class="flex-1 bg-white border border-gray-300 text-gray-800 rounded-md px-3 py-2 outline-none focus:border-emerald-500 placeholder-gray-400" placeholder="$2,250" />
                <button class="p-2.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg transition w-12 h-10 flex items-center justify-center" aria-label="Predict price up">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                </button>
                <button class="p-2.5 rounded-md bg-red-500 hover:bg-red-600 text-white font-bold text-lg transition w-12 h-10 flex items-center justify-center" aria-label="Predict price down">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </button>
              </div>
              <div class="text-sm font-medium text-emerald-600 mt-3">
                Prediction Stake: {convictionStake.toFixed(6)} {payToken}
              </div>
            </div>
            
            <!-- SWAP Button -->
            <button class="w-full py-3 mt-6 rounded-lg bg-gradient-to-r from-yellow-400 via-emerald-400 to-emerald-500 text-white font-bold text-md shadow-lg hover:shadow-xl transition hover:scale-[1.02]">SWAP</button>
          </div>

          <!-- Right Panel: Charts & Performance -->
          <div class="flex-1 w-full lg:max-w-xl flex flex-col gap-6">
            <!-- Price History Chart -->
            <div class="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6 border border-amber-100">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">Price History</h3>
              <div class="h-60 flex items-center justify-center text-emerald-600 bg-emerald-50/30 rounded-md border border-emerald-200">
                <!-- Simple SVG Line Graph Placeholder -->
                <svg viewBox="0 0 100 40" class="w-full h-full" preserveAspectRatio="none">
                  <path d="M0 30 L10 25 L20 28 L30 20 L40 22 L50 15 L60 18 L70 10 L80 15 L90 5 L100 10" fill="none" stroke="#34d399" stroke-width="1" />
                  <circle cx="100" cy="10" r="1.5" fill="#34d399" />
                </svg>
              </div>
            </div>

            <!-- Market Predictions Chart -->
            <div class="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6 border border-amber-100">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">Market Predictions</h3>
              <div class="h-40 flex items-center justify-center text-emerald-600 bg-emerald-50/30 rounded-md border border-emerald-200 p-4">
                <!-- Simple SVG Bar Chart Placeholder -->
                <svg viewBox="0 0 100 40" class="w-full h-full" preserveAspectRatio="none">
                  <rect x="10" y="10" width="20" height="30" fill="#34d399" />
                  <rect x="40" y="20" width="20" height="20" fill="#fbbf24" />
                  <rect x="70" y="5" width="20" height="35" fill="#f87171" />
                </svg>
              </div>
              <div class="text-xs text-gray-500 mt-3 text-center">Market consensus: <span class="text-gray-800 font-semibold">${marketConsensus} (bullish)</span></div>
            </div>
            
            <!-- Your Performance -->
            <div class="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6 border border-amber-100">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Your Performance</h3>
                <div class="flex gap-4">
                  <div class="flex-1 bg-emerald-50/50 rounded-lg p-4 text-center border border-emerald-200">
                    <div class="text-xs text-emerald-700 mb-1">Accuracy</div>
                    <div class="text-3xl font-bold text-gray-800">{accuracy}%</div>
                  </div>
                  <div class="flex-1 bg-emerald-50/50 rounded-lg p-4 text-center border border-emerald-200">
                    <div class="text-xs text-emerald-700 mb-1">Rank</div>
                    <div class="text-3xl font-bold text-gray-800">#{rank}</div>
                  </div>
                   <div class="flex-1 bg-emerald-50/50 rounded-lg p-4 items-center justify-center flex border-dashed border-emerald-300 hover:border-emerald-400 cursor-pointer text-emerald-500 hover:text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                </div>
            </div>
          </div>
        </div>

        <!-- Prediction History Table (Now Full Width within the new intermediate wrapper) -->
        <div class="w-full bg-white bg-opacity-80 rounded-2xl shadow-lg p-6 border border-amber-100">
          <h3 class="text-xl font-bold text-gray-800 mb-4">Prediction History</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-emerald-200">
              <thead class="bg-emerald-50/50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Date</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Market</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Side</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Amount</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Status</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody class="bg-white/70 divide-y divide-gray-200">
                {#each positions as position, i (i)}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{position.date}</td>
                    <td class="px-6 py-4 text-sm text-gray-800 font-medium">{position.market}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <span class:text-emerald-600={position.side === 'Bullish'} class:text-red-600={position.side === 'Bearish'}>
                        {position.side}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{position.amount}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if position.status === 'Win'}
                        <Badge color="green">{position.status}</Badge>
                      {:else if position.status === 'Lose'}
                        <Badge color="red">{position.status}</Badge>
                      {:else if position.status === 'Open'}
                        <Badge color="blue">{position.status}</Badge>
                      {:else if position.status === 'Pending'}
                        <Badge color="yellow">{position.status}</Badge>
                      {:else}
                        <Badge>{position.status}</Badge>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {#if position.status === 'Win'}
                        <Button size="xs" class="!py-1 !px-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-teal-500 hover:to-emerald-400 text-white">Claim Reward</Button>
                      {:else}
                        -
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Bottom Navigation / Footer -->
  <footer class="px-6 py-4 border-t border-emerald-200 mt-auto">
    <div class="flex justify-between items-center max-w-7xl mx-auto">
      <div class="flex gap-6">
        <a href="/" class="text-sm text-emerald-600 hover:text-emerald-700 font-semibold">Swap</a>
        <a href="/" class="text-sm text-gray-500 hover:text-gray-700">Pool</a>
        <a href="/" class="text-sm text-gray-500 hover:text-gray-700">History</a>
      </div>
      <div class="flex gap-6">
        <a href="/" class="text-sm text-gray-500 hover:text-gray-700">Learn more</a>
        <a href="/" class="text-sm text-gray-500 hover:text-gray-700">Help</a>
      </div>
    </div>
  </footer>
</section>

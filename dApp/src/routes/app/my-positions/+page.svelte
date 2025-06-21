<script lang="ts">
  import {onMount} from 'svelte';
  import {formatEther} from 'viem';
  import {toastStore} from '$lib/stores/toastStore';

  // Mock data for UI testing
  const MOCK_POSITIONS: any[] = [
    {
      marketId: '1',
      amount: 1000000000000000000n, // 1 ETH
      predictedOutcome: 1, // Bullish
      claimed: false,
      market: {
        assetPair: 'ETH/USDC',
        resolutionTime: 0n,
        resolutionOutcome: 0,
        isResolved: false,
        isWinner: false
      }
    },
    {
      marketId: '2',
      amount: 2500000000000000000n, // 2.5 ETH
      predictedOutcome: 0, // Bearish
      claimed: true,
      market: {
        assetPair: 'BTC/USDT',
        resolutionTime: 1718900000n,
        resolutionOutcome: 1,
        isResolved: true,
        isWinner: false
      }
    },
    {
      marketId: '3',
      amount: 1500000000000000000n, // 1.5 ETH
      predictedOutcome: 1, // Bullish
      claimed: false,
      market: {
        assetPair: 'SOL/ETH',
        resolutionTime: 1719000000n,
        resolutionOutcome: 1,
        isResolved: true,
        isWinner: true
      }
    }
  ];

  // State
  let connectedAddress = $state<string | null>('0x1234567890123456789012345678901234567890');
  let isConnected = $state(true);
  let isLoading = $state(false);
  let userPositions = $state<MarketPosition[]>(MOCK_POSITIONS);
  let claimableAmount = $state(1500000000000000000n); // 1.5 ETH
  let totalWon = $state(2.5);
  let totalMarkets = $state(3);
  let winRate = $state(33);

  // Initialize
  onMount(() => {
    // Using mock data, no need for real connection
    calculateStats(MOCK_POSITIONS);
  });

  // Mock function to simulate loading positions
  function loadUserPositions() {
    // Using mock data, so just update the UI
    userPositions = MOCK_POSITIONS;
    calculateStats(MOCK_POSITIONS);
  }

  function calculateStats(positions: any[]) {
    totalMarkets = positions.length;
    const resolvedPositions = positions.filter(p => p.market.isResolved);
    const wonMarkets = resolvedPositions.filter(p => p.market.isWinner).length;

    winRate = resolvedPositions.length > 0
      ? Math.round((wonMarkets / resolvedPositions.length) * 100)
      : 0;

    // Calculate total claimable and won amounts
    const { claimable, won } = positions.reduce((acc, pos) => {
      if (pos.market.isResolved && pos.market.isWinner && !pos.claimed) {
        acc.claimable += pos.amount;
      }
      if (pos.market.isResolved && pos.market.isWinner) {
        acc.won += Number(formatEther(pos.amount));
      }
      return acc;
    }, { claimable: 0n, won: 0 });

    claimableAmount = claimable;
    totalWon = won;
  }

  function resetStats() {
    claimableAmount = 0n;
    totalWon = 0;
    totalMarkets = 0;
    winRate = 0;
  }

  async function claimRewards(marketId: string | bigint) {
    toastStore.success('Rewards claimed successfully! (Mock)');
    // Simulate a successful claim by marking the position as claimed
    userPositions = userPositions.map(pos =>
      pos.marketId === marketId.toString() ? { ...pos, claimed: true } : pos
    );
    calculateStats(userPositions);
  }

  function formatAmount(amount: bigint | number): string {
    const num = typeof amount === 'bigint' ? Number(formatEther(amount)) : amount;
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  }
</script>

<div class="container mx-auto pt-25 px-4 py-8">
  <h1 class="text-3xl font-bold mb-8">My Predictions</h1>

  {#if !isConnected}
    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-700">
            Please connect your wallet to view your prediction history and claim rewards.
          </p>
        </div>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  {:else}
    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-gray-500 text-sm font-medium">Total Markets</h3>
        <p class="text-3xl font-bold">{totalMarkets}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-gray-500 text-sm font-medium">Win Rate</h3>
        <p class="text-3xl font-bold">{winRate}%</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-gray-500 text-sm font-medium">Total Won</h3>
        <p class="text-3xl font-bold">{formatAmount(totalWon)} ETH</p>
      </div>
    </div>

    <!-- Claimable Rewards -->
    {#if claimableAmount > 0n}
      <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-medium text-blue-800">You have rewards to claim!</h3>
            <p class="text-blue-700">{formatAmount(claimableAmount)} ETH available to claim</p>
          </div>
          <button
            on:click={() => claimRewards('all')}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Claim All Rewards
          </button>
        </div>
      </div>
    {/if}

    <!-- Positions Table -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 class="text-lg leading-6 font-medium text-gray-900">My Predictions</h3>
        <p class="mt-1 max-w-2xl text-sm text-gray-500">Markets you've participated in</p>
      </div>

      {#if userPositions.length === 0}
        <div class="px-4 py-12 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No predictions yet</h3>
          <p class="mt-1 text-sm text-gray-500">Get started by making your first prediction on a market.</p>
          <div class="mt-6">
            <a href="/app" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
              View Markets
            </a>
          </div>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prediction</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each userPositions as position (position.marketId)}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">Market #{position.marketId}</div>
                    <div class="text-sm text-gray-500">
                      {position.market.assetPair || 'N/A'}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {position.predictedOutcome === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                      {position.predictedOutcome === 1 ? 'Bullish' : 'Bearish'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatAmount(position.amount)} ETH
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if !position.market.isResolved}
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    {:else if position.market.isWinner}
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Won
                      </span>
                    {:else}
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Lost
                      </span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {#if position.market.isResolved && position.market.isWinner && !position.claimed}
                      <button
                        on:click={() => {
                  const marketId = typeof position.marketId === 'string'
                    ? position.marketId
                    : position.marketId.toString();
                  claimRewards(marketId);
                }}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        Claim Rewards
                      </button>
                    {:else if position.claimed}
                      <span class="text-gray-500">Claimed</span>
                    {:else}
                      <span class="text-gray-500">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

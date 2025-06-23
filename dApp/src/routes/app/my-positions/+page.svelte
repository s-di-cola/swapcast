<script lang="ts">
  import {onMount} from 'svelte';
  import {formatEther} from 'viem';
  import {toastStore} from '$lib/stores/toastStore';

  // Types
  interface Market {
    assetPair: string;
    resolutionTime: bigint;
    resolutionOutcome: number;
    isResolved: boolean;
    isWinner: boolean;
  }

  interface MarketPosition {
    marketId: string;
    amount: bigint;
    predictedOutcome: number;
    claimed: boolean;
    market: Market;
  }

  // Mock data for UI testing - expanded to show pagination
  const MOCK_POSITIONS: MarketPosition[] = [
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
    },
    {
      marketId: '4',
      amount: 3000000000000000000n, // 3 ETH
      predictedOutcome: 0, // Bearish
      claimed: false,
      market: {
        assetPair: 'MATIC/USDC',
        resolutionTime: 0n,
        resolutionOutcome: 0,
        isResolved: false,
        isWinner: false
      }
    },
    {
      marketId: '5',
      amount: 800000000000000000n, // 0.8 ETH
      predictedOutcome: 1, // Bullish
      claimed: true,
      market: {
        assetPair: 'ADA/ETH',
        resolutionTime: 1719100000n,
        resolutionOutcome: 1,
        isResolved: true,
        isWinner: true
      }
    },
    {
      marketId: '6',
      amount: 2200000000000000000n, // 2.2 ETH
      predictedOutcome: 0, // Bearish
      claimed: false,
      market: {
        assetPair: 'DOT/USDT',
        resolutionTime: 1719200000n,
        resolutionOutcome: 0,
        isResolved: true,
        isWinner: true
      }
    },
    {
      marketId: '7',
      amount: 1800000000000000000n, // 1.8 ETH
      predictedOutcome: 1, // Bullish
      claimed: false,
      market: {
        assetPair: 'AVAX/ETH',
        resolutionTime: 0n,
        resolutionOutcome: 0,
        isResolved: false,
        isWinner: false
      }
    },
    {
      marketId: '8',
      amount: 4000000000000000000n, // 4 ETH
      predictedOutcome: 0, // Bearish
      claimed: true,
      market: {
        assetPair: 'LINK/USDC',
        resolutionTime: 1719300000n,
        resolutionOutcome: 0,
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
  let totalMarkets = $state(8);
  let winRate = $state(50);

  // Pagination state
  let currentPage = $state(1);
  let itemsPerPage = $state(5);

  // Derived pagination values
  let totalPages: number;
  let paginatedPositions: MarketPosition[];

  $effect(() => {
    totalPages = Math.ceil(userPositions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    paginatedPositions = userPositions.slice(startIndex, endIndex);
  });

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

  function calculateStats(positions: MarketPosition[]) {
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

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }
</script>

<div class="mx-auto min-h-screen max-w-7xl bg-gray-50 p-6 pt-16 md:p-10 md:pt-20">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">My Prediction Portfolio</h1>
    <p class="mt-2 text-gray-600">Track your active positions and claim your rewards</p>
  </div>

  {#if !isConnected}
    <div class="mb-6 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
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
    <div class="flex items-center justify-center py-12">
      <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
    </div>
  {:else}
    <!-- Stats Overview -->
    <div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-medium text-gray-500">Markets Predicted</h3>
        <p class="text-2xl font-bold text-gray-900">{totalMarkets}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-medium text-gray-500">Prediction Power</h3>
        <p class="text-2xl font-bold text-gray-900">{winRate}%</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-medium text-gray-500">Rewards Waiting</h3>
        <p class="text-2xl font-bold text-gray-900">{formatAmount(totalWon)} ETH</p>
      </div>
    </div>

    <!-- Claimable Rewards -->
    {#if claimableAmount > 0n}
      <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div class="flex flex-col items-start justify-between md:flex-row md:items-center">
          <div class="mb-3 md:mb-0">
            <h3 class="text-base font-medium text-blue-800">You have rewards to claim! 🎉</h3>
            <p class="text-sm text-blue-700">{formatAmount(claimableAmount)} ETH available to claim</p>
          </div>
          <button
                  onclick={() => claimRewards('all')}
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Claim All Rewards
          </button>
        </div>
      </div>
    {/if}

    <!-- Positions Table -->
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div class="border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Your Prediction History</h2>
            <p class="text-sm text-gray-500">Markets you've predicted on and their current status</p>
          </div>
          <div class="text-sm text-gray-500">
            Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, userPositions.length)} of {userPositions.length} positions
          </div>
        </div>
      </div>

      {#if userPositions.length === 0}
        <div class="flex flex-col items-center justify-center space-y-4 p-12 text-center">
          <svg class="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900">No active predictions</h3>
          <p class="max-w-md text-sm text-gray-500">Make your first prediction on a market to see your positions here. Predict the market and earn rewards!</p>
          <div class="mt-4">
            <a href="/app" class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              View Markets
            </a>
          </div>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <div class="inline-block min-w-full align-middle">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prediction</th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" class="relative px-6 py-3">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
              {#each paginatedPositions as position (position.marketId)}
                <tr class="hover:bg-gray-50">
                  <td class="whitespace-nowrap px-6 py-4">
                    <div class="flex items-center">
                      <div class="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-indigo-600 font-medium">
                            {position.market.assetPair?.split('/')[0]?.charAt(0) || '?'}
                          </span>
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">{position.market.assetPair || `Market #${position.marketId}`}</div>
                        <div class="text-sm text-gray-500">ID: {position.marketId}</div>
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4">
                    <div class="flex items-center">
                      <div class="h-2.5 w-2.5 rounded-full {position.predictedOutcome === 1 ? 'bg-green-500' : 'bg-red-500'} mr-2"></div>
                      <span class="text-sm font-medium text-gray-900">
                          {position.predictedOutcome === 1 ? 'Bullish' : 'Bearish'}
                        </span>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4 text-right">
                    <div class="text-sm font-medium text-gray-900">{formatAmount(position.amount)} ETH</div>
                    <div class="text-sm text-gray-500">
                      ${(Number(formatEther(position.amount)) * 2000).toFixed(2)} USD
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4">
                    {#if !position.market.isResolved}
                        <span class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          <svg class="-ml-0.5 mr-1.5 h-2 w-2 text-yellow-400" fill="currentColor" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                          Pending
                        </span>
                    {:else if position.market.isWinner}
                        <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          <svg class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                          Won
                        </span>
                    {:else}
                        <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          <svg class="-ml-0.5 mr-1.5 h-2 w-2 text-red-400" fill="currentColor" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                          Lost
                        </span>
                    {/if}
                  </td>
                  <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    {#if position.market.isResolved && position.market.isWinner && !position.claimed}
                      <button
                              onclick={() => {
                            const marketId = typeof position.marketId === 'string'
                              ? position.marketId
                              : position.marketId.toString();
                            claimRewards(marketId);
                          }}
                              class="text-indigo-600 hover:text-indigo-900"
                      >
                        Claim Rewards
                      </button>
                    {:else if position.claimed}
                        <span class="inline-flex items-center text-sm text-gray-500">
                          <svg class="mr-1.5 h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Claimed
                        </span>
                    {:else}
                      <span class="text-gray-400">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div class="flex items-center justify-between">
              <div class="flex flex-1 justify-between sm:hidden">
                <button
                        onclick={prevPage}
                        disabled={currentPage === 1}
                        class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                        onclick={nextPage}
                        disabled={currentPage === totalPages}
                        class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm text-gray-700">
                    Showing <span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to
                    <span class="font-medium">{Math.min(currentPage * itemsPerPage, userPositions.length)}</span> of
                    <span class="font-medium">{userPositions.length}</span> results
                  </p>
                </div>
                <div>
                  <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                            onclick={prevPage}
                            disabled={currentPage === 1}
                            class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span class="sr-only">Previous</span>
                      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                      </svg>
                    </button>

                    {#each Array.from({length: totalPages}, (_, i) => i + 1) as page}
                      {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
                        <button
                                onclick={() => goToPage(page)}
                                class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {page === currentPage
                            ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'}"
                        >
                          {page}
                        </button>
                      {:else if page === currentPage - 2 || page === currentPage + 2}
                        <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>
                      {/if}
                    {/each}

                    <button
                            onclick={nextPage}
                            disabled={currentPage === totalPages}
                            class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span class="sr-only">Next</span>
                      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

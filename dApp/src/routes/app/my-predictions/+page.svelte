<script lang="ts">
  import { appKit } from '$lib/configs/wallet.config';
  import { batchClaimRewards, claimReward, fetchUserPredictions, fetchUserPredictionStats } from '$lib/services/prediction';
  import type { PredictionStats, UserPrediction } from '$lib/services/prediction/types';
  import { toastStore } from '$lib/stores/toastStore';
  import { onMount } from 'svelte';

  // State using runes
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let positions = $state<UserPrediction[]>([]);
  let stats = $state<PredictionStats>({
    totalPredictions: 0,
    totalWon: 0,
    totalClaimed: '0',
    claimableAmount: '0'
  });

  // Pagination
  let currentPage = $state(1);
  const itemsPerPage = 10;

  // Non-reactive state for connection
  let isConnected = $state(false);
  let userAddress = $state('');
  
  // Derived state (non-reactive to appKit)
  const totalPages = $derived(Math.ceil(positions.length / itemsPerPage));
  const paginatedPositions = $derived(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return positions.slice(start, start + itemsPerPage);
  });

  // Stats derived values
  const totalMarkets = $derived(stats.totalPredictions);
  const winRate = $derived(stats.totalPredictions > 0 ? Math.round((stats.totalWon / stats.totalPredictions) * 100) : 0);
  const claimableAmount = $derived(parseFloat(stats.claimableAmount));

  // Retry mechanism for chunk loading errors
  let retryCount = 0;
  const maxRetries = 3;

  // Function to check connection status
  function updateConnectionStatus() {
    const account = appKit?.getAccount();
    isConnected = !!account?.address;
    userAddress = account?.address || '';
  }

  onMount(async () => {
    // Initial connection check
    updateConnectionStatus();
    
    // Set up wallet event listeners
    if (appKit) {
      appKit.subscribeAccount((account) => {
        const wasConnected = isConnected;
        updateConnectionStatus();
        
        // Only reload data if connection status changed or address changed
        if (isConnected && (!wasConnected || userAddress !== account?.address)) {
          loadDataWithRetry();
        }
      });
    }
    
    // Load initial data if connected
    if (isConnected) {
      await loadDataWithRetry();
    }
  });

  async function loadDataWithRetry() {
    try {
      await loadData();
    } catch (err) {
      if (isChunkLoadError(err) && retryCount < maxRetries) {
        retryCount++;
        console.log(`Chunk load failed, retrying... (${retryCount}/${maxRetries})`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        
        // Clear any cached modules that might be causing issues
        if ('webpackChunkName' in window) {
          delete (window as any).webpackChunkName;
        }
        
        await loadDataWithRetry();
      } else {
        throw err;
      }
    }
  }

  function isChunkLoadError(err: any): boolean {
    const errorMessage = err?.message?.toLowerCase() || '';
    return errorMessage.includes('loading chunk') || 
           errorMessage.includes('loading css chunk') ||
           errorMessage.includes('chunk load failed') ||
           errorMessage.includes('loading module');
  }

  async function loadData() {
    if (!isConnected || !userAddress) {
      toastStore.error('Please connect your wallet first');
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      error = null;

      // Add timeout and retry logic for API calls
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      const [predictions, predictionStats] = await Promise.race([
        Promise.all([
          fetchUserPredictions(userAddress),
          fetchUserPredictionStats(userAddress)
        ]),
        timeout
      ]) as [UserPrediction[], PredictionStats];

      positions = predictions || [];
      stats = predictionStats || {
        totalPredictions: 0,
        totalWon: 0,
        totalClaimed: '0',
        claimableAmount: '0'
      };
      
      console.log('Loaded data:', { positions, stats });
    } catch (err) {
      console.error('Failed to load data:', err);
      
      if (isChunkLoadError(err)) {
        error = 'Failed to load required resources. Please refresh the page.';
        toastStore.error('Page resources failed to load. Please refresh and try again.');
      } else {
        error = err instanceof Error ? err.message : 'Failed to load data';
        toastStore.error(error);
      }
    } finally {
      isLoading = false;
    }
  }

  function formatDate(timestamp: number): string {
    try {
      return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      console.error('Date formatting error:', err);
      return 'Invalid Date';
    }
  }

  function getOutcomeLabel(outcome: string): string {
    switch (outcome) {
      case 'above': return 'Bullish';
      case 'below': return 'Bearish';
      default: return 'Pending';
    }
  }

  function getOutcomeColor(outcome: string): string {
    switch (outcome) {
      case 'above': return 'bg-green-100 text-green-800';
      case 'below': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusColor(prediction: UserPrediction): string {
    if (!prediction.marketIsResolved) return 'bg-yellow-100 text-yellow-800';
    if (prediction.isWinning) return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  }

  function getStatusText(prediction: UserPrediction): string {
    if (!prediction.marketIsResolved) return 'Pending';
    if (prediction.marketWinningOutcome) {
      return prediction.isWinning ? 'Won' : 'Lost';
    }
    return 'Pending';
  }

  function isMarketResolved(prediction: UserPrediction): boolean {
    return prediction.marketIsResolved;
  }

  async function handleClaimReward(tokenId: string) {
    if (!tokenId) {
      toastStore.error('Invalid token ID');
      return;
    }

    try {
      await claimReward({ 
        tokenId,
        onSuccess: () => {
          toastStore.success('Reward claimed successfully!');
          loadDataWithRetry(); // Use retry version
        },
        onError: (error) => {
          console.error('Failed to claim reward:', error);
          toastStore.error('Failed to claim reward');
        }
      });
    } catch (err) {
      console.error('Failed to claim reward:', err);
      if (isChunkLoadError(err)) {
        toastStore.error('Failed to load claim interface. Please refresh and try again.');
      } else {
        toastStore.error('Failed to claim reward');
      }
    }
  }

  async function claimAllRewards() {
    const claimableTokenIds = positions
      .filter(p => p.isWinning && !p.claimed && p.tokenId)
      .map(p => p.tokenId!)
      .filter(Boolean);

    if (claimableTokenIds.length === 0) {
      toastStore.warning('No rewards to claim');
      return;
    }

    try {
      await batchClaimRewards(claimableTokenIds);
      await loadDataWithRetry(); // Use retry version
    } catch (err) {
      console.error('Failed to claim rewards:', err);
      if (isChunkLoadError(err)) {
        toastStore.error('Failed to load claim interface. Please refresh and try again.');
      } else {
        toastStore.error('Failed to claim some rewards');
      }
    }
  }

  function formatAmount(amount: string | number): string {
    try {
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return isNaN(num) ? '0.0000' : num.toFixed(4);
    } catch (err) {
      console.error('Amount formatting error:', err);
      return '0.0000';
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

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function getMarketDisplayName(prediction: UserPrediction): string {
    try {
      const desc = prediction.marketDescription;
      if (desc && desc.includes('/')) {
        return desc.split(' ')[0] || desc;
      }
      return desc || `Market #${prediction.marketId}`;
    } catch (err) {
      console.error('Market name formatting error:', err);
      return `Market #${prediction.marketId}`;
    }
  }

  function getMarketInitial(prediction: UserPrediction): string {
    try {
      const name = getMarketDisplayName(prediction);
      return name.charAt(0).toUpperCase();
    } catch (err) {
      console.error('Market initial formatting error:', err);
      return 'M';
    }
  }

  function estimateUSDValue(ethAmount: string, ethPrice: number = 2000): string {
    try {
      const amount = parseFloat(ethAmount);
      return isNaN(amount) ? '0.00' : (amount * ethPrice).toFixed(2);
    } catch (err) {
      console.error('USD value estimation error:', err);
      return '0.00';
    }
  }

  // Add error boundary for chunk loading
  function handleChunkError() {
    window.location.reload();
  }

  // Listen for chunk loading errors globally
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      if (event.error && isChunkLoadError(event.error)) {
        console.error('Chunk loading error detected:', event.error);
        // Optionally show a user-friendly message
        toastStore.error('Some resources failed to load. Refreshing page...');
        setTimeout(() => window.location.reload(), 2000);
      }
    });
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
  {:else if error}
    <div class="mb-6 rounded-lg border-l-4 border-red-400 bg-red-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-700">{error}</p>
          <div class="mt-2 flex gap-2">
            <button 
              onclick={loadDataWithRetry}
              class="text-sm text-red-800 underline hover:text-red-900"
            >
              Try again
            </button>
            {#if error.includes('resources') || error.includes('chunk')}
              <button 
                onclick={handleChunkError}
                class="text-sm text-red-800 underline hover:text-red-900"
              >
                Refresh page
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Stats Overview -->
    <div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-medium text-gray-500">Markets Predicted</h3>
        <p class="text-2xl font-bold text-gray-900">{totalMarkets}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-medium text-gray-500">Win Rate</h3>
        <p class="text-2xl font-bold text-gray-900">{winRate}%</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-sm font-medium text-gray-500">Rewards Waiting</h3>
        <p class="text-2xl font-bold text-gray-900">{formatAmount(stats.claimableAmount)} ETH</p>
      </div>
    </div>

    <!-- Claimable Rewards Banner -->
    {#if claimableAmount > 0}
      <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div class="flex flex-col items-start justify-between md:flex-row md:items-center">
          <div class="mb-3 md:mb-0">
            <h3 class="text-base font-medium text-blue-800">You have rewards to claim! 🎉</h3>
            <p class="text-sm text-blue-700">{formatAmount(stats.claimableAmount)} ETH available to claim</p>
          </div>
          <button
            onclick={claimAllRewards}
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
            Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, positions.length)} of {positions.length} positions
          </div>
        </div>
      </div>

      {#if positions.length === 0}
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
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                {#each paginatedPositions() as position (position.id)}
                  <tr class="hover:bg-gray-50">
                    <td class="whitespace-nowrap px-6 py-4">
                      <div class="flex items-center">
                        <div class="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span class="text-indigo-600 font-medium">
                            {getMarketInitial(position)}
                          </span>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">{getMarketDisplayName(position)}</div>
                          <div class="text-sm text-gray-500">ID: {position.marketId}</div>
                        </div>
                      </div>
                    </td>
                    <td class="whitespace-nowrap px-6 py-4">
                      <div class="flex items-center">
                        <div class="h-2.5 w-2.5 rounded-full {position.outcome === 'above' ? 'bg-green-500' : position.outcome === 'below' ? 'bg-red-500' : 'bg-gray-500'} mr-2"></div>
                        <span class="text-sm font-medium text-gray-900">
                          {getOutcomeLabel(position.outcome)}
                        </span>
                      </div>
                    </td>
                    <td class="whitespace-nowrap px-6 py-4 text-right">
                      <div class="text-sm font-medium text-gray-900">{formatAmount(position.amount)} ETH</div>
                      <div class="text-sm text-gray-500">
                        ${estimateUSDValue(position.amount)} USD
                      </div>
                    </td>
                    <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(position.timestamp)}
                    </td>
                    <td class="whitespace-nowrap px-6 py-4">
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getStatusColor(position)}">
                        <svg class="-ml-0.5 mr-1.5 h-2 w-2" fill="currentColor" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="3" />
                        </svg>
                        {getStatusText(position)}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      {#if isMarketResolved(position) && position.isWinning && !position.claimed && position.tokenId}
                        <button
                          onclick={() => handleClaimReward(position.tokenId!)}
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
                    <span class="font-medium">{Math.min(currentPage * itemsPerPage, positions.length)}</span> of
                    <span class="font-medium">{positions.length}</span> results
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
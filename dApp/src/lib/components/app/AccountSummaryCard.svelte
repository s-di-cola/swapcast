<script lang="ts">
  import { onMount } from 'svelte';
  import { modal, wagmiConfig } from '$lib/configs/wallet.config';
  import { getBalance } from '@wagmi/core/actions';
  import { formatUnits } from 'viem';

  // ETH balance display
  let ethBalance = '0';
  let lastUpdatedTime = new Date();
  let isLoading = true;

  // Function to fetch balance
  async function updateBalance() {
    isLoading = true;

    // Get the current account from AppKit
    const account = modal.getAccount();
    if (!account?.address) {
      ethBalance = '0';
      isLoading = false;
      return;
    }

    const address = account.address;
    if (address) {
      try {
        const balanceResult = await getBalance(wagmiConfig, { address: address as `0x${string}` });
        ethBalance = formatUnits(balanceResult.value, balanceResult.decimals);
      } catch (error) {
        console.error('Error fetching balance:', error);
        ethBalance = 'Error';
      }
    }
    lastUpdatedTime = new Date();
    isLoading = false;
  }

  // Format time since last update
  function getTimeSinceUpdate() {
    const seconds = Math.floor((new Date().getTime() - lastUpdatedTime.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  // Initialize and set up subscription
  onMount(() => {
    updateBalance();

    // Update when account changes
    modal.subscribeAccount(() => {
      updateBalance();
    });
  });
</script>

<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Account Summary</h2>
    <span class="text-xs text-gray-500">Last updated: {getTimeSinceUpdate()}</span>
  </div>
  <div class="flex justify-between items-center">
    <div>
      {#if isLoading}
        <p class="text-3xl font-bold text-gray-900">Loading...</p>
      {:else}
        <p class="text-3xl font-bold text-gray-900">{ethBalance} ETH</p>
        <p class="text-sm text-gray-500 mt-1">≈ ${parseFloat(ethBalance) * 2389.42}</p>
      {/if}
    </div>

    <!-- Refresh button -->
    <button 
      class="text-gray-400 hover:text-gray-600 transition-colors" 
      onclick={updateBalance}
      disabled={isLoading}
      title="Refresh balance"
      aria-label="Refresh balance"
    >
   
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" class:animate-spin={isLoading}>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  </div>
</div>

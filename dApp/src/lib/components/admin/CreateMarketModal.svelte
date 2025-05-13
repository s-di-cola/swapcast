<script lang="ts">
  import { onMount } from 'svelte';
  import { Modal, Button, Input, Label, Select, Helper, Spinner, Toast } from 'flowbite-svelte';
  import { CheckCircleSolid, CloseCircleSolid } from 'flowbite-svelte-icons';
  import { createMarket } from '$lib/services/marketService'; // Assuming createMarket exists
  import { parseEther, type Address } from 'viem'; // For converting price thresholds

  export let showModal = false;
  export let onClose: () => void; // Callback prop for closing

  interface Token {
    name: string;
    address: Address; // Use Address type from viem
    symbol: string;
    decimals: number;
    chainId: number;
    logoURI?: string;
  }

  // Form state
  let marketName: string = '';
  let tokenA_address: string = '';
  let tokenB_address: string = '';
  // TODO: Fetch actual token details (decimals) based on selected address for price conversion
  let predictionMarketType: 'price_binary' = 'price_binary'; // Simplifed for now
  let targetPriceStr: string = ''; // Use string for input
  let durationHours: number = 24;

  let tokenList: Token[] = [];
  let isLoadingTokens: boolean = true;
  let errorLoadingTokens: string | null = null;

  // Toast state
  let showSuccessToast = false;
  let showErrorToast = false;
  let toastMessage = '';

  // Submission state
  let isSubmitting = false;

  let modalElement: HTMLElement | null = null; // Variable to hold modal element reference

  onMount(async () => {
    // Fetch token list (same as original page)
    try {
      const response = await fetch('https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/mainnet.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch token list: ${response.statusText}`);
      }
      const data = await response.json();
      tokenList = data.filter((token: Token) => token.chainId === 1); // Assuming chainId 1 for now
    } catch (err: any) {
      console.error('Error fetching token list:', err);
      errorLoadingTokens = err.message || 'Could not load token list.';
    } finally {
      isLoadingTokens = false;
    }
  });

  async function handleSubmit() {
    if (!targetPriceStr || !tokenA_address || !tokenB_address || !marketName) {
        showErrorToast = true;
        toastMessage = 'Please fill in all required fields.';
        setTimeout(() => showErrorToast = false, 5000);
        return;
    }

    isSubmitting = true;
    showSuccessToast = false;
    showErrorToast = false;

    try {
        // Calculate market end time (ensure it's in seconds for the contract)
        const marketEndTime = BigInt(Math.floor(Date.now() / 1000) + durationHours * 60 * 60);

        // Convert target price string to BigInt using placeholder decimals (e.g., 18)
        // TODO: Replace '18' with actual decimals of the quote token (tokenB)
        const priceThreshold = parseEther(String(targetPriceStr)); // Ensure input is a string

        console.log('Creating market with params:', {
            marketName,
            tokenA: tokenA_address,
            tokenB: tokenB_address,
            marketEndTime,
            priceThreshold
        });

        // Call the actual contract function via marketService
        const marketId = await createMarket(
            marketName,
            tokenA_address as Address, // Cast to Address
            tokenB_address as Address, // Cast to Address
            marketEndTime,
            priceThreshold
        );

        console.log('Market created successfully with ID:', marketId);
        toastMessage = `Market "${marketName}" created successfully! ID: ${marketId}`; 
        showSuccessToast = true;
        setTimeout(() => showSuccessToast = false, 5000);
        
        // Dispatch 'marketCreated' event with Svelte 5 style from the modal element
        // modalElement?.dispatchEvent(new CustomEvent('marketCreated', { 
        //     detail: { marketId } 
        // }));
        
        // Reset form and close modal
        resetForm();
        showModal = false; // Close the modal

    } catch (error: any) {
        console.error('Error creating market:', error);
        toastMessage = `Failed to create market: ${error.message || 'Unknown error'}`;
        showErrorToast = true;
        setTimeout(() => showErrorToast = false, 5000);
    } finally {
        isSubmitting = false;
    }
  }

  function resetForm() {
      marketName = '';
      tokenA_address = '';
      tokenB_address = '';
      targetPriceStr = '';
      durationHours = 24;
  }

  function handleClose() {
      resetForm(); // Reset form when closing manually
      if (onClose) onClose(); // Call the parent's close handler
  }

  function handleCancelClick() {
    showModal = false;
    if (onClose) onClose(); // Call the parent's close handler
  }

</script>

{#if showSuccessToast}
  <Toast color="green" class="fixed top-5 right-5 z-50" dismissable={false}>
    <svelte:fragment slot="icon">
      <CheckCircleSolid class="w-5 h-5" />
      <span class="sr-only">Check icon</span>
    </svelte:fragment>
    {toastMessage}
  </Toast>
{/if}

{#if showErrorToast}
  <Toast color="red" class="fixed top-5 right-5 z-50" dismissable={false}>
    <svelte:fragment slot="icon">
      <CloseCircleSolid class="w-5 h-5" />
      <span class="sr-only">Error icon</span>
    </svelte:fragment>
    {toastMessage}
  </Toast>
{/if}

<Modal title="Create New Prediction Market" bind:open={showModal} on:close={handleClose} autoclose={false} size="xl">
  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    
    <div>
      <Label for="marketName" class="block mb-2">Market Name / Question</Label>
      <Input type="text" id="marketName" bind:value={marketName} required placeholder="e.g., Will ETH/USDC price be above $2500 in 24h?" />
      <Helper class="mt-1">A clear, unambiguous question for the market.</Helper>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label for="tokenA" class="block mb-2">Token A (Base)</Label>
        {#if isLoadingTokens}
          <Input disabled placeholder="Loading tokens..." />
        {:else if errorLoadingTokens}
          <Input disabled placeholder="Error loading tokens" />
          <Helper color="red" class="mt-1">{errorLoadingTokens}</Helper>
        {:else}
          <Select id="tokenA" bind:value={tokenA_address} required class="bg-white">
            <option value="" disabled>Select Token A</option>
            {#each tokenList as token (token.address)}
              <option value={token.address}>{token.symbol} ({token.name})</option>
            {/each}
          </Select>
        {/if}
        <Helper class="mt-1">Select the first token of the pair.</Helper>
      </div>
      <div>
        <Label for="tokenB" class="block mb-2">Token B (Quote)</Label>
         {#if isLoadingTokens}
          <Input disabled placeholder="Loading tokens..." />
        {:else if errorLoadingTokens}
          <Input disabled placeholder="Error loading tokens" />
          <Helper color="red" class="mt-1">{errorLoadingTokens}</Helper>
        {:else}
          <Select id="tokenB" bind:value={tokenB_address} required class="bg-white">
            <option value="" disabled>Select Token B</option>
            {#each tokenList as token (token.address)}
              <option value={token.address}>{token.symbol} ({token.name})</option>
            {/each}
          </Select>
        {/if}
        <Helper class="mt-1">Select the second token (price is relative to this token).</Helper>
      </div>
    </div>

    <div>
        <Label for="targetPrice" class="block mb-2">Target Price (in Token B)</Label>
        <Input type="number" id="targetPrice" bind:value={targetPriceStr} required placeholder="e.g., 2500" step="any" />
         <Helper class="mt-1">The price threshold for the prediction.</Helper>
    </div>

     <div>
        <Label for="durationHours" class="block mb-2">Market Duration (Hours)</Label>
        <Input type="number" id="durationHours" bind:value={durationHours} required min="1" placeholder="e.g., 24" />
        <Helper class="mt-1">How long the market will remain open for predictions (in hours).</Helper>
    </div>

    <!-- TODO: Add fields for resolution source if needed -->

    <div class="flex justify-end pt-4">
      <Button type="button" color="alternative" onclick={handleCancelClick} disabled={isSubmitting}>Cancel</Button>
      <button 
        type="submit" 
        class="ml-3 inline-flex items-center px-5 py-2.5 text-sm font-medium text-center text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 focus:ring-4 focus:outline-none focus:ring-emerald-300 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-800"
        disabled={isSubmitting}
      >
        {#if isSubmitting}
          <Spinner class="mr-2" size="4" /> Creating...
        {:else}
          Create Market
        {/if}
      </button>
    </div>

  </form>
</Modal>

<script lang="ts">
    /**
     * TransactionHistory Component
     * 
     * Displays a list of transactions related to a specific market.
     * Shows transaction details including hash, timestamp, sender, type, and amount.
     * Fetches real transaction data from the subgraph.
     */
    import { onMount } from 'svelte';
    import type { Market } from '$lib/services/market/marketService';
    import { getMarketPredictions, formatPredictionOutcome, formatTimestamp, type SubgraphPrediction } from '$lib/services/subgraph/subgraphService';

    export let market: Market;
    
    let transactions: SubgraphPrediction[] = [];
    let isLoading = false;
    let error: string | null = null;
    let page = 1;
    let pageSize = 10; // Number of transactions per page
    
    /**
     * Formats currency values for display with appropriate suffixes
     * 
     * @param value - The numeric value to format
     * @returns Formatted string with $ symbol and K/M suffix for large numbers
     */
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

    /**
     * Generates an Etherscan URL for a given address
     * 
     * @param address - Ethereum address to link to
     * @returns Etherscan URL for the address
     */
    function getEtherscanLink(address: string) {
        return `https://etherscan.io/address/${address}`;
    }
    
    /**
     * Fetches transaction data from the subgraph for the current market
     */
    async function fetchTransactions() {
        if (!market?.id) return;
        
        isLoading = true;
        error = null;
        
        try {
            transactions = await getMarketPredictions(market.id, pageSize);
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to fetch transaction data';
        } finally {
            isLoading = false;
        }
    }
    
    /**
     * Fetches more transactions when paginating
     * 
     * @param direction - Direction to paginate ('next' or 'prev')
     */
    async function fetchMoreTransactions(direction: 'next' | 'prev') {
        if (isLoading || !market?.id) return;
        
        if (direction === 'prev' && page > 1) {
            page--;
        } else if (direction === 'next' && transactions.length === pageSize) {
            page++;
        } else {
            return; // No need to fetch if we can't move in that direction
        }
        
        isLoading = true;
        error = null;
        
        try {
            transactions = await getMarketPredictions(market.id, pageSize, page);
        } catch (err) {
            // If we get an error, revert the page change
            if (direction === 'prev') page++;
            else if (direction === 'next') page--;
            
            error = err instanceof Error ? err.message : 'Failed to fetch transaction data';
        } finally {
            isLoading = false;
        }
    }
    
    // Fetch transactions when the component mounts or when the market changes
    $: if (market?.id) {
        fetchTransactions();
    }
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h3 class="mb-4 text-lg font-semibold text-gray-800">Transaction History</h3>

    {#if isLoading && transactions.length === 0}
        <div class="flex items-center justify-center py-8">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            <span class="ml-2 text-gray-600">Loading transactions...</span>
        </div>
    {:else if error}
        <div class="rounded-md bg-red-50 p-4 text-sm text-red-800">
            <p>Error: {error}</p>
            <button 
                class="mt-2 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                on:click={fetchTransactions}
            >
                Retry
            </button>
        </div>
    {:else if transactions.length === 0}
        <div class="py-8 text-center text-gray-500">
            <p>No transactions found for this market.</p>
        </div>
    {:else}
        <div class="overflow-x-auto relative">
            {#if isLoading && transactions.length > 0}
                <div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
                    <div class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                </div>
            {/if}
            <table class="min-w-full divide-y divide-gray-100">
                <thead>
                    <tr>
                        <th
                            class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                            Transaction
                        </th>
                        <th
                            class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                            Time
                        </th>
                        <th
                            class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                            User
                        </th>
                        <th
                            class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                            Position
                        </th>
                        <th
                            class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                            Amount
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                    {#each transactions as tx}
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm whitespace-nowrap text-blue-600 hover:text-blue-800">
                                <a
                                    href={getEtherscanLink(tx.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="truncate max-w-[150px] inline-block align-bottom"
                                >
                                    {tx.id.substring(0, 10)}...{tx.id.substring(tx.id.length - 8)}
                                </a>
                            </td>
                            <td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                                {formatTimestamp(tx.timestamp)}
                            </td>
                            <td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                                <a
                                    href={getEtherscanLink(tx.user.address)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="truncate max-w-[100px] inline-block align-bottom text-blue-600 hover:text-blue-800"
                                >
                                    {tx.user.address.substring(0, 6)}...{tx.user.address.substring(tx.user.address.length - 4)}
                                </a>
                            </td>
                            <td class="px-4 py-3 text-sm whitespace-nowrap">
                                <span
                                    class="rounded-full px-2.5 py-0.5 text-xs font-medium {tx.outcome === 1
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'}"
                                >
                                    {formatPredictionOutcome(tx.outcome)}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                                {formatCurrency(parseFloat(tx.amount) / 1e18)} ETH
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}

    {#if transactions.length > 0}
        <div class="mt-4 flex items-center justify-between">
            <div class="text-sm text-gray-500">Showing {transactions.length} transactions</div>
            <div class="flex space-x-2">
                <button
                    class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={() => fetchMoreTransactions('prev')}
                    disabled={isLoading || page === 1}
                >
                    Previous
                </button>
                <button
                    class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={() => fetchMoreTransactions('next')}
                    disabled={isLoading || transactions.length < pageSize}
                >
                    Next
                </button>
            </div>
        </div>
    {/if}
</div>

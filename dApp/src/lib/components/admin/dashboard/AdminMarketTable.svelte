<script lang="ts">
    import type { Market } from '$lib/services/market/marketService';
    import type { MarketSortField, SortDirection } from '$lib/services/market/marketService';
    
    /**
     * MarketList Component Props
     * 
     * A comprehensive table component for displaying market data with sorting,
     * pagination, and interactive features.
     */
    let {
        /** Array of market objects to display in the table */
        markets = [],
        /** Loading state to show spinner and disable interactions */
        loading = false,
        /** Callback function triggered when a market row is clicked */
        onMarketClick,
        /** Optional callback function for refresh button clicks */
        onRefresh = () => {},
        /** Optional callback function for column sorting */
        onSort = () => {},
        /** Optional callback function for pagination changes */
        onPageChange = () => {},
        /** Total number of pages for pagination display */
        totalPages = 1,
        /** Current active page number */
        currentPage = 1
    }: {
        markets?: Market[];
        loading?: boolean;
        onMarketClick: (marketId: string) => void;
        onRefresh?: () => void;
        onSort?: (field: MarketSortField, direction: SortDirection) => void;
        onPageChange?: (page: number) => void;
        totalPages?: number;
        currentPage?: number;
    } = $props();
    
    /** Current field being used for sorting */
    let sortField: MarketSortField = $state('id');
    /** Current sorting direction (ascending or descending) */
    let sortDirection: SortDirection = $state('asc');
    
    /**
     * Handles column header clicks for sorting functionality
     * 
     * When a user clicks on a sortable column header:
     * - If it's the same column, toggles between asc/desc
     * - If it's a different column, sets to ascending and updates the field
     * - Calls the parent component's onSort callback with new sort parameters
     * 
     * @param field - The market field to sort by
     */
    function handleSort(field: MarketSortField): void {
        // If clicking the same column, toggle direction
        if (field === sortField) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            sortField = field;
            sortDirection = 'asc';
        }
        
        // Call the parent's sort handler
        onSort(sortField, sortDirection);
    }
    
    /**
     * Formats numerical currency values with appropriate suffixes
     * 
     * Converts large numbers to more readable format:
     * - Values >= 1M: Shows as "$X.XXM" 
     * - Values >= 1K: Shows as "$X.XXK"
     * - Values < 1K: Shows as "$X.XX"
     * 
     * @param value - The currency value as string or number
     * @returns Formatted currency string with appropriate suffix
     */
    function formatCurrency(value: string | number): string {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (num >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) {
            return `${(num / 1_000).toFixed(2)}K`;
        } else {
            return `${num.toFixed(2)}`;
        }
    }
    
    /**
     * Generates visual sort indicator for table headers
     * 
     * Shows an arrow indicating the current sort direction:
     * - Returns '↑' for ascending sort on active column
     * - Returns '↓' for descending sort on active column  
     * - Returns empty string for inactive columns
     * 
     * @param field - The field to check for sort indicator
     * @returns Sort direction arrow or empty string
     */
    function getSortIndicator(field: MarketSortField): string {
        if (field !== sortField) return '';
        return sortDirection === 'asc' ? '↑' : '↓';
    }
</script>

<section class="mb-10">
    <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">Market List</h2>
        <button
            type="button"
            onclick={onRefresh}
            class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            disabled={loading}
        >
            <svg
                class="-ml-0.5 mr-2 h-4 w-4 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
        </button>
    </div>
    <div class="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('id')}
                    >
                        ID {getSortIndicator('id')}
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('name')}
                    >
                        Market {getSortIndicator('name')}
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('assetPair')}
                    >
                        Asset Pair {getSortIndicator('assetPair')}
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('status')}
                    >
                        Status {getSortIndicator('status')}
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('expirationTime')}
                    >
                        Expiration {getSortIndicator('expirationTime')}
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('priceThreshold')}
                    >
                        Target Price {getSortIndicator('priceThreshold')}
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                        onclick={() => handleSort('totalStake')}
                    >
                        Total Stake {getSortIndicator('totalStake')}
                    </th>
                    <th scope="col" class="relative px-6 py-3">
                        <span class="sr-only">Actions</span>
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
                {#if loading}
                    <tr>
                        <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
                            <div class="flex items-center justify-center space-x-2">
                                <svg
                                    class="h-5 w-5 animate-spin text-emerald-600"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <circle
                                        class="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        stroke-width="4"
                                    />
                                    <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                <span>Loading market data...</span>
                            </div>
                        </td>
                    </tr>
                {:else if markets.length > 0}
                    {#each markets as market (market.id)}
                        <tr
                            class="cursor-pointer transition-colors hover:bg-gray-50"
                            onclick={() => onMarketClick(market.id)}
                        >
                            <td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                                #{market.id}
                            </td>
                            <td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                                {market.name}
                            </td>
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                                {market.assetPair}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span
                                    class="inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold"
                                    class:bg-green-50={market.status === 'Open'}
                                    class:text-green-700={market.status === 'Open'}
                                    class:bg-yellow-50={market.status === 'Expired'}
                                    class:text-yellow-700={market.status === 'Expired'}
                                    class:bg-gray-50={market.status === 'Resolved'}
                                    class:text-gray-700={market.status === 'Resolved'}
                                >
                                    {market.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                                {market.expirationDisplay}
                            </td>
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                                ${market.priceThreshold}
                            </td>
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                                {formatCurrency(market.totalStake)}
                            </td>
                            <td class="px-6 py-4 text-sm font-medium whitespace-nowrap">
                                <button 
                                    class="text-indigo-600 transition-colors hover:text-indigo-800"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        onMarketClick(market.id);
                                    }}
                                >
                                    Details
                                </button>
                            </td>
                        </tr>
                    {/each}
                {:else}
                    <tr>
                        <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
                            No markets found. <a href="/admin/market" class="text-emerald-600 hover:underline">
                                Create your first market
                            </a>.
                        </td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>
    
    <!-- Pagination Controls -->
    {#if markets.length > 0}
        <div class="mt-4 flex items-center justify-between">
            <div class="text-sm text-gray-500">
                Showing page {currentPage} of {totalPages}
            </div>
            <div class="flex space-x-2">
                <button
                    type="button"
                    class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={() => onPageChange(currentPage - 1)}
                    disabled={loading || currentPage === 1}
                >
                    Previous
                </button>
                <button
                    type="button"
                    class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={() => onPageChange(currentPage + 1)}
                    disabled={loading || currentPage >= totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    {/if}
</section>
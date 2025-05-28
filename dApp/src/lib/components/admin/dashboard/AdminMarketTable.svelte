<script lang="ts">
    import type { Market } from '$lib/services/market';
    import type { MarketSortField, SortDirection } from '$lib/services/market';
    
    interface Props {
        markets?: Market[];
        loading?: boolean;
        onMarketClick: (marketId: string) => void;
        onRefresh?: () => void;
        onSort?: (field: MarketSortField, direction: SortDirection) => void;
        onPageChange?: (page: number) => void;
        totalPages?: number;
        currentPage?: number;
    }
    
    interface StatusStyle {
        bg: string;
        text: string;
    }
    
    interface Column {
        key: MarketSortField;
        label: string;
        sortable: boolean;
    }
    
    let {
        markets = [],
        loading = false,
        onMarketClick,
        onRefresh = () => {},
        onSort = () => {},
        onPageChange = () => {},
        totalPages = 1,
        currentPage = 1
    }: Props = $props();
    
    let sortField = $state<MarketSortField>('id');
    let sortDirection = $state<SortDirection>('asc');
    
    const COLUMNS: Column[] = [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'name', label: 'Market', sortable: true },
        { key: 'assetPair', label: 'Asset Pair', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'expirationTime', label: 'Expiration', sortable: true },
        { key: 'priceThreshold', label: 'Target Price', sortable: true },
        { key: 'totalStake', label: 'Total Stake', sortable: true }
    ] as const;
    
    const STATUS_STYLES: Record<string, StatusStyle> = {
        Open: { bg: 'bg-green-50', text: 'text-green-700' },
        Expired: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
        Resolved: { bg: 'bg-gray-50', text: 'text-gray-700' }
    } as const;
    
    const UI_TEXT = {
        title: 'Market List',
        refresh: 'Refresh',
        refreshing: 'Refreshing...',
        loading: 'Loading market data...',
        noMarkets: 'No markets found.',
        createFirst: 'Create your first market',
        details: 'Details',
        actions: 'Actions',
        showingPage: 'Showing page',
        of: 'of',
        previous: 'Previous',
        next: 'Next'
    } as const;
    
    function handleSort(field: MarketSortField): void {
        if (field === sortField) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }
        onSort(sortField, sortDirection);
    }
    
    function formatCurrency(value: string | number): string {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
        return `${num.toFixed(2)}`;
    }
    
    function getSortIndicator(field: MarketSortField): string {
        return field === sortField ? (sortDirection === 'asc' ? '↑' : '↓') : '';
    }
    
    function getStatusStyles(status: string): StatusStyle {
        return STATUS_STYLES[status] || STATUS_STYLES.Resolved;
    }
    
    function handleDetailsClick(e: Event, marketId: string): void {
        e.stopPropagation();
        onMarketClick(marketId);
    }
    </script>
    
    <section class="mb-10">
        <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-800">{UI_TEXT.title}</h2>
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
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                </svg>
                {loading ? UI_TEXT.refreshing : UI_TEXT.refresh}
            </button>
        </div>
        
        <div class="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        {#each COLUMNS as column}
                            <th
                                scope="col"
                                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                                class:cursor-pointer={column.sortable}
                                class:hover:bg-gray-100={column.sortable}
                                onclick={column.sortable ? () => handleSort(column.key) : undefined}
                            >
                                {column.label} {column.sortable ? getSortIndicator(column.key) : ''}
                            </th>
                        {/each}
                        <th scope="col" class="relative px-6 py-3">
                            <span class="sr-only">{UI_TEXT.actions}</span>
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
                                        aria-hidden="true"
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
                                    <span>{UI_TEXT.loading}</span>
                                </div>
                            </td>
                        </tr>
                    {:else if markets.length > 0}
                        {#each markets as market (market.id)}
                            {@const statusStyles = getStatusStyles(market.status)}
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
                                        class="inline-flex rounded-full px-2 py-1 text-xs leading-5 font-semibold {statusStyles.bg} {statusStyles.text}"
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
                                        onclick={(e) => handleDetailsClick(e, market.id)}
                                    >
                                        {UI_TEXT.details}
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    {:else}
                        <tr>
                            <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
                                {UI_TEXT.noMarkets} 
                                <a href="/admin/market" class="text-emerald-600 hover:underline">
                                    {UI_TEXT.createFirst}
                                </a>.
                            </td>
                        </tr>
                    {/if}
                </tbody>
            </table>
        </div>
        
        {#if markets.length > 0}
            <div class="mt-4 flex items-center justify-between">
                <div class="text-sm text-gray-500">
                    {UI_TEXT.showingPage} {currentPage} {UI_TEXT.of} {totalPages}
                </div>
                <div class="flex space-x-2">
                    <button
                        type="button"
                        class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={() => onPageChange(currentPage - 1)}
                        disabled={loading || currentPage === 1}
                    >
                        {UI_TEXT.previous}
                    </button>
                    <button
                        type="button"
                        class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={() => onPageChange(currentPage + 1)}
                        disabled={loading || currentPage >= totalPages}
                    >
                        {UI_TEXT.next}
                    </button>
                </div>
            </div>
        {/if}
    </section>
<script lang="ts">
    import type { Market } from '$lib/services/market/marketService';
    
    // Component for the market list table
    export let markets: Market[] = [];
    export let loading: boolean = false;
    export let onMarketClick: (marketId: string) => void;
    
    // Format currency values
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
</script>

<section class="mb-10">
    <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">Market List</h2>
    </div>
    <div class="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        ID
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        Market
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        Asset Pair
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        Status
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        Expiration
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        Target Price
                    </th>
                    <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                        Total Stake
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
                        on:click={() => onMarketClick(market.id)}
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
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
                                >{market.expirationDisplay}</td
                            >
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                                ${market.priceThreshold}
                            </td>
                            <td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                                {formatCurrency(market.totalStake)}
                            </td>
                            <td class="px-6 py-4 text-sm font-medium whitespace-nowrap">
                                <button class="text-indigo-600 transition-colors hover:text-indigo-800"
                                    >Details</button
                                >
                            </td>
                        </tr>
                    {/each}
                {:else}
                    <tr>
                        <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500 italic">
                            No markets found. <a href="/admin/market" class="text-emerald-600 hover:underline"
                                >Create your first market</a
                            >.
                        </td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>
</section>

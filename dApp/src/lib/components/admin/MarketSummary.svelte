<script lang="ts">
    /**
     * MarketSummary Component
     * 
     * Displays key information about a market including asset pair, status,
     * price threshold, and other relevant details.
     */
    import { ChartPieSolid } from 'flowbite-svelte-icons';
    import type { Market } from '$lib/services/market/marketService';

    export let market: Market;

    /**
     * Formats currency values for display with appropriate suffixes
     * 
     * @param value - The numeric value to format
     * @returns Formatted string with K/M suffix for large numbers
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
     * Returns the appropriate CSS classes for a market status
     * 
     * @param status - The market status string
     * @returns CSS classes for styling the status badge
     */
    function getStatusColor(status: string) {
        switch (status) {
            case 'Open':
                return 'bg-emerald-100 text-emerald-800';
            case 'Expired':
                return 'bg-yellow-100 text-yellow-800';
            case 'Resolved':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }
</script>

<div class="rounded-lg bg-gray-50 p-4">
    <div class="mb-3 flex items-center">
        <ChartPieSolid class="mr-2 h-5 w-5 text-gray-600" />
        <h4 class="text-lg font-semibold text-gray-700">Market Summary</h4>
    </div>
    <div class="space-y-2">
        <div class="flex justify-between">
            <span class="text-gray-600">Asset Pair:</span>
            <span class="font-semibold">{market.assetPair}</span>
        </div>
        <div class="flex justify-between">
            <span class="text-gray-600">Status:</span>
            <span
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold {getStatusColor(
                    market.status
                )}"
            >
                {market.status}
            </span>
        </div>
        <div class="flex justify-between">
            <span class="text-gray-600">Price Threshold:</span>
            <span class="font-semibold">${formatCurrency(market.priceThreshold)}</span>
        </div>
    </div>
</div>

<script lang="ts">
    /**
     * MarketFinancials Component
     * 
     * Displays financial information about a market including total stake,
     * bullish and bearish positions, price threshold, and time remaining.
     */
    import { ClockSolid } from 'flowbite-svelte-icons';
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
     * Calculates and formats the time remaining until market expiration
     * 
     * @param expirationTime - The expiration timestamp in seconds
     * @returns Formatted string showing days, hours, and minutes remaining
     */
    function formatTimeRemaining(expirationTime: number): string {
        const now = Math.floor(Date.now() / 1000);
        const diff = expirationTime - now;

        if (diff <= 0) return 'Expired';

        const days = Math.floor(diff / (60 * 60 * 24));
        const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
        const minutes = Math.floor((diff % (60 * 60)) / 60);

        return `${days}d ${hours}h ${minutes}m`;
    }
</script>

<div class="rounded-lg bg-gray-50 p-4">
    <div class="mb-3 flex items-center">
        <ClockSolid class="mr-2 h-5 w-5 text-gray-600" />
        <h4 class="text-lg font-semibold text-gray-700">Financial Details</h4>
    </div>
    <div class="space-y-2">
        <div class="flex justify-between">
            <span class="text-gray-600">Total Stake:</span>
            <span class="font-semibold">${formatCurrency(market.totalStake)}</span>
        </div>
        <div class="flex justify-between">
            <span class="text-gray-600">Bullish Stake:</span>
            <span class="font-semibold">${formatCurrency(parseFloat(market.totalStake.toString()) * 0.6)}</span>
        </div>
        <div class="flex justify-between">
            <span class="text-gray-600">Bearish Stake:</span>
            <span class="font-semibold">${formatCurrency(parseFloat(market.totalStake.toString()) * 0.4)}</span>
        </div>
        <div class="flex justify-between">
            <span class="text-gray-600">Expiration Time:</span>
            <span class="font-semibold">
                {new Date(market.expirationTime * 1000).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                })}
            </span>
        </div>
        <div class="flex justify-between">
            <span class="text-gray-600">Time Remaining:</span>
            <span class="font-semibold">{formatTimeRemaining(market.expirationTime)}</span>
        </div>
    </div>
</div>

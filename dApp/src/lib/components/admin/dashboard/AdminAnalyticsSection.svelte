<script lang="ts">
    /**
     * AdminAnalyticsSection Component
     * 
     * Displays platform analytics with interactive charts showing:
     * - Markets created over time
     * - Active predictions over time
     */
    import AdminAnalyticsChart from './AdminAnalyticsChart.svelte';
    
    // Component props using SvelteKit 5 syntax
    let { activeMarketsCount = 0 }: { activeMarketsCount?: number } = $props();
    
    // Component state using $state
    let selectedTimeRange = $state<'7d' | '30d'>('7d');
    
    // Handle time range selection
    function setTimeRange(range: '7d' | '30d'): void {
        selectedTimeRange = range;
    }
</script>

<section class="mb-10">
    <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">Platform Analytics</h2>
    </div>
    <div
        class="min-h-[300px] rounded-lg border border-gray-100 bg-white p-6 shadow-sm md:min-h-[400px]"
    >
        <div class="mb-6 flex items-center justify-between">
            <div>
                <div class="flex items-center space-x-2">
                    <div class="h-3 w-3 rounded-full bg-indigo-500"></div>
                    <span class="text-sm text-gray-600">Markets Created</span>
                </div>
                <div class="mt-1 flex items-center space-x-2">
                    <div class="h-3 w-3 rounded-full bg-emerald-500"></div>
                    <span class="text-sm text-gray-600">Active Predictions</span>
                </div>
            </div>
            <div class="text-right">
                <h3 class="text-2xl font-bold text-gray-900">{activeMarketsCount}</h3>
                <p class="text-sm text-gray-500">Active Markets</p>
            </div>
        </div>
        <div class="h-64 border-t border-gray-100 pt-6">
            <AdminAnalyticsChart timeRange={selectedTimeRange} />
        </div>
    </div>
</section>

<script lang="ts">
    // Component for the analytics section with placeholder graph
    export let marketCount: number = 0;
</script>

<section class="mb-10">
    <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">Platform Analytics</h2>
        <div class="flex space-x-2">
            <button class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-600"
                >Last 7d</button
            >
            <button class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                >Last 30d</button
            >
        </div>
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
                <h3 class="text-2xl font-bold text-gray-900">{marketCount}</h3>
                <p class="text-sm text-gray-500">Total Markets</p>
            </div>
        </div>
        <div class="flex h-64 items-center justify-center border-t border-gray-100 pt-6">
            <p class="text-sm text-gray-400">Placeholder for analytics graph</p>
        </div>
    </div>
</section>

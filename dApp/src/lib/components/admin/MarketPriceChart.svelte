<script lang="ts">
    /**
     * MarketPriceChart Component
     * 
     * Displays a line chart showing cryptocurrency price history for a market.
     * Fetches real-time data from CoinGecko when available, with fallback to mock data.
     * Supports different time ranges (24h, 7d, 30d).
     */
    import { Spinner, Button } from 'flowbite-svelte';
    import type { Market } from '$lib/services/market/marketService';
    import { onMount } from 'svelte';
    import { 
        getHistoricalPriceData, 
        getCoinIdFromAssetPair 
    } from '$lib/services/price/coinGeckoService';

    // Component props
    export let market: Market;
    
    // Component state
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let dateLabels: string[] = [];
    let priceData: number[] = [];
    let maxPrice = 0;
    let minPrice = 0;
    let isLoading = false;
    let error: string | null = null;
    let timeRange = 30; // Default to 30 days

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
     * Generates mock price data for testing or when real data is unavailable
     * 
     * Creates realistic-looking price data that starts below the threshold and
     * gradually increases with some random variation. The data follows a pattern
     * that makes sense for visualization purposes.
     * 
     * @param threshold - The price threshold to use as reference
     * @param days - Number of days of data to generate
     * @returns Object containing arrays of date labels and price values
     */
    function generatePriceData(threshold: number, days = 30) {
        const now = new Date();
        const labels: string[] = [];
        const data: number[] = [];
        
        // Use threshold as base price with some variance
        const basePrice = threshold * 0.9; // Start below threshold
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Generate a price with some randomness
            const variance = threshold * 0.3; // 30% variance
            const randomFactor = Math.random() * variance - (variance / 2);
            const price = basePrice + (i * threshold * 0.01) + randomFactor;
            data.push(Math.max(0, price)); // Ensure price is not negative
        }
        
        return { labels, data };
    }

    /**
     * Formats raw CoinGecko price data for chart display
     * 
     * Transforms the raw price data from CoinGecko's API into a format suitable
     * for rendering in the chart. Extracts timestamps and prices, and formats
     * the dates for display.
     * 
     * @param priceData - The raw price data from CoinGecko API
     * @returns Object containing arrays of formatted date labels and price values
     */
    function formatPriceDataForChart(priceData: any) {
        if (!priceData || !priceData.prices || !Array.isArray(priceData.prices)) {
            return { labels: [], data: [] };
        }
        
        const labels: string[] = [];
        const data: number[] = [];
        
        // CoinGecko returns data as [timestamp, price] pairs
        priceData.prices.forEach((item: [number, number]) => {
            const [timestamp, price] = item;
            const date = new Date(timestamp);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(price);
        });
        
        return { labels, data };
    }

    /**
     * Renders the price chart on the canvas element
     * 
     * This function handles all the drawing operations for the price chart,
     * including grid lines, price line, threshold line, and labels.
     * It automatically scales the chart based on the price range.
     */
    function drawChart() {
        if (!canvas) return;
        
        ctx = canvas.getContext('2d');
        if (!ctx) return; // Exit if we can't get the context
        
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Calculate price range for scaling
        maxPrice = Math.max(...priceData);
        minPrice = Math.min(...priceData);
        // Add some padding to the range
        const pricePadding = (maxPrice - minPrice) * 0.1;
        const effectiveMax = maxPrice + pricePadding;
        const effectiveMin = Math.max(0, minPrice - pricePadding);
        
        // Draw background
        ctx.fillStyle = '#f8fafc'; // Light gray background
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid lines
        const gridLines = 5;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= gridLines; i++) {
            const y = height - (i / gridLines) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // Price labels on the right
            const price = effectiveMin + (i / gridLines) * (effectiveMax - effectiveMin);
            ctx.fillStyle = '#64748b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(formatCurrency(price), width - 5, y - 5);
        }
        
        // Draw date labels (x-axis)
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        
        // Only show a subset of dates to avoid crowding
        const labelStep = Math.ceil(dateLabels.length / 5);
        for (let i = 0; i < dateLabels.length; i += labelStep) {
            const x = (i / (dateLabels.length - 1)) * width;
            ctx.fillText(dateLabels[i], x, height - 5);
        }
        
        // Draw threshold line if available
        if (market?.priceThreshold) {
            const thresholdY = height - ((market.priceThreshold - effectiveMin) / (effectiveMax - effectiveMin)) * height;
            
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444'; // Red line
            ctx.setLineDash([5, 3]); // Dashed line
            ctx.lineWidth = 1;
            ctx.moveTo(0, thresholdY);
            ctx.lineTo(width, thresholdY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset to solid line
            
            // Threshold label
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'left';
            ctx.fillText(`Threshold: ${formatCurrency(market.priceThreshold)}`, 5, thresholdY - 5);
        }
        
        // Draw price line
        ctx.beginPath();
        ctx.strokeStyle = '#6366f1'; // Indigo line
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        // Fill area under the line
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
        
        // Start path for fill
        ctx.beginPath();
        
        for (let i = 0; i < priceData.length; i++) {
            const x = (i / (priceData.length - 1)) * width;
            const y = height - ((priceData[i] - effectiveMin) / (effectiveMax - effectiveMin)) * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        // Complete the fill path
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Redraw the line on top
        ctx.beginPath();
        for (let i = 0; i < priceData.length; i++) {
            const x = (i / (priceData.length - 1)) * width;
            const y = height - ((priceData[i] - effectiveMin) / (effectiveMax - effectiveMin)) * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /**
     * Fetches price data for the current market from CoinGecko
     * 
     * This function attempts to retrieve historical price data from the CoinGecko API
     * based on the market's asset pair. If the asset pair cannot be mapped to a CoinGecko ID
     * or if an error occurs during the API call, it falls back to generating mock data.
     * 
     * @param days - Number of days of historical data to fetch (default: 30)
     */
    async function fetchPriceData(days = 30) {
        if (!market?.assetPair) {
            error = 'No asset pair specified';
            return;
        }
        
        isLoading = true;
        error = null;
        
        try {
            // Get the coin ID from the asset pair (e.g., "ETH/USD" -> "ethereum")
            const coinId = await getCoinIdFromAssetPair(market.assetPair);
            
            if (!coinId) {
                // If we can't get a real coin ID, fall back to mock data
                const { labels, data } = generatePriceData(market.priceThreshold);
                dateLabels = labels;
                priceData = data;
            } else {
                // Fetch real data from CoinGecko
                const geckoData = await getHistoricalPriceData(coinId, 'usd', days);
                const { labels, data } = formatPriceDataForChart(geckoData);
                dateLabels = labels;
                priceData = data;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to fetch price data';
            
            // Fall back to mock data on error
            const { labels, data } = generatePriceData(market.priceThreshold);
            dateLabels = labels;
            priceData = data;
        } finally {
            isLoading = false;
            
            // Wait for next tick to ensure canvas is mounted
            setTimeout(drawChart, 0);
        }
    }
    
    /**
     * Changes the time range for the price chart
     * 
     * Updates the timeRange state variable and triggers a new data fetch
     * with the specified number of days.
     * 
     * @param days - Number of days to display in the chart
     */
    function setTimeRange(days: number) {
        timeRange = days;
        fetchPriceData(days);
    }
    
    /**
     * Initialize the chart when the component mounts
     * 
     * Fetches initial price data using the default time range
     */
    onMount(() => {
        fetchPriceData(timeRange);
        // Wait for next tick to ensure canvas is mounted
        setTimeout(drawChart, 0);
    });
</script>

<div class="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
    <div class="mb-4 flex items-center justify-between">
        <h4 class="text-lg font-semibold text-gray-700">Price History</h4>
        
        <!-- Time range buttons -->
        <div class="flex space-x-2">
            <button 
                class="rounded-md {timeRange === 1 ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600'} px-3 py-1 text-xs font-medium"
                on:click={() => setTimeRange(1)}
            >24h</button>
            <button 
                class="rounded-md {timeRange === 7 ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600'} px-3 py-1 text-xs font-medium"
                on:click={() => setTimeRange(7)}
            >7d</button>
            <button 
                class="rounded-md {timeRange === 30 ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600'} px-3 py-1 text-xs font-medium"
                on:click={() => setTimeRange(30)}
            >30d</button>
        </div>
    </div>
    
    <!-- Chart container -->
    <div class="relative h-64 w-full">
        {#if isLoading}
            <div class="flex h-full w-full items-center justify-center">
                <Spinner size="6" />
                <p class="ml-2 text-gray-500">Loading chart data...</p>
            </div>
        {:else if error}
            <div class="flex h-full w-full flex-col items-center justify-center">
                <p class="text-red-500">{error}</p>
                <button 
                    class="mt-2 rounded-md bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                    on:click={() => fetchPriceData(timeRange)}
                >
                    Try Again
                </button>
            </div>
        {:else if priceData.length > 0}
            <canvas 
                bind:this={canvas} 
                width="800" 
                height="300"
                class="h-full w-full"
            ></canvas>
        {:else}
            <div class="flex h-full w-full items-center justify-center">
                <p class="text-gray-500">No price data available</p>
            </div>
        {/if}
    </div>
</div>

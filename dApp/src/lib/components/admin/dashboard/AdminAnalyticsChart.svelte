<script lang="ts">
    /**
     * AdminAnalyticsChart Component
     * 
     * Displays line charts showing platform analytics data:
     * - Markets created over time
     * - Active predictions over time
     * Uses canvas-based rendering similar to MarketPriceChart
     */
    import { onMount } from 'svelte';
    
    // Component props using SvelteKit 5 syntax
    let { timeRange = '7d' }: { timeRange?: '7d' | '30d' } = $props();
    
    // Component state using $state
    let canvas = $state<HTMLCanvasElement | null>(null);
    let ctx = $state<CanvasRenderingContext2D | null>(null);
    let isLoading = $state(false);
    
    // Mock data for demonstration
    // In a real implementation, this would come from an API
    const generateMockData = (days: number) => {
        const data = [];
        const marketsData = [];
        const predictionsData = [];
        
        // Start date (days ago from today)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        // Generate daily data points
        for (let i = 0; i <= days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            
            // Generate realistic looking growth data
            // Markets grow more steadily
            const marketBase = 5 + Math.floor(i * (8 / days)); // Base growth
            const marketRandom = Math.floor(Math.random() * 2); // Random variation
            const markets = marketBase + marketRandom;
            
            // Active predictions fluctuate more
            const predictionBase = 2 + Math.floor(i * (5 / days)); // Base growth
            const predictionRandom = Math.floor(Math.random() * 3) - 1; // More random variation
            const predictions = Math.max(1, predictionBase + predictionRandom); // Ensure at least 1
            
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            data.push({
                date: dateStr,
                markets,
                predictions
            });
            
            marketsData.push(markets);
            predictionsData.push(predictions);
        }
        
        return {
            labels: data.map(d => d.date),
            marketsData,
            predictionsData
        };
    };
    
    /**
     * Renders the analytics chart on the canvas element
     */
    function drawChart() {
        if (!canvas) return;
        
        ctx = canvas.getContext('2d');
        if (!ctx) return; // Exit if context is null
        
        // After this point, we know ctx is not null, so we can use the non-null assertion operator
        const context = ctx!;
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Get data based on selected time range
        const days = timeRange === '7d' ? 7 : 30;
        const { labels, marketsData, predictionsData } = generateMockData(days);
        
        // Chart dimensions
        const width = canvas.width;
        const height = canvas.height;
        const padding = { top: 20, right: 20, bottom: 30, left: 40 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // Find max value for scaling
        const maxMarkets = Math.max(...marketsData);
        const maxPredictions = Math.max(...predictionsData);
        const maxValue = Math.max(maxMarkets, maxPredictions);
        const yScale = chartHeight / (maxValue * 1.1); // Add 10% padding at top
        
        // Draw axes
        context.beginPath();
        context.strokeStyle = '#e2e8f0'; // Tailwind gray-200
        context.lineWidth = 1;
        
        // Y-axis
        context.moveTo(padding.left, padding.top);
        context.lineTo(padding.left, height - padding.bottom);
        
        // X-axis
        context.moveTo(padding.left, height - padding.bottom);
        context.lineTo(width - padding.right, height - padding.bottom);
        context.stroke();
        
        // Draw Y-axis labels
        context.textAlign = 'right';
        context.textBaseline = 'middle';
        context.fillStyle = '#64748b'; // Tailwind slate-500
        context.font = '10px Inter, system-ui, sans-serif';
        
        // Draw 5 evenly spaced y-axis labels
        for (let i = 0; i <= 5; i++) {
            const yValue = Math.round((maxValue * i) / 5);
            const yPos = height - padding.bottom - yValue * yScale;
            
            context.fillText(yValue.toString(), padding.left - 5, yPos);
            
            // Draw horizontal grid line
            context.beginPath();
            context.strokeStyle = '#f1f5f9'; // Tailwind slate-100
            context.moveTo(padding.left, yPos);
            context.lineTo(width - padding.right, yPos);
            context.stroke();
        }
        
        // Draw X-axis labels (show fewer labels if there are many)
        context.textAlign = 'center';
        context.textBaseline = 'top';
        
        const skipFactor = labels.length > 15 ? 3 : 1; // Skip labels if too many
        
        labels.forEach((label, i) => {
            if (i % skipFactor === 0 || i === labels.length - 1) {
                const xPos = padding.left + (i * chartWidth) / (labels.length - 1);
                context.fillText(label, xPos, height - padding.bottom + 5);
            }
        });
        
        // Draw Markets line (indigo)
        context.beginPath();
        context.strokeStyle = '#6366f1'; // Tailwind indigo-500
        context.lineWidth = 2;
        
        marketsData.forEach((value, i) => {
            const xPos = padding.left + (i * chartWidth) / (marketsData.length - 1);
            const yPos = height - padding.bottom - value * yScale;
            
            if (i === 0) {
                context.moveTo(xPos, yPos);
            } else {
                context.lineTo(xPos, yPos);
            }
        });
        context.stroke();
        
        // Draw data points for Markets
        marketsData.forEach((value, i) => {
            const xPos = padding.left + (i * chartWidth) / (marketsData.length - 1);
            const yPos = height - padding.bottom - value * yScale;
            
            context.beginPath();
            context.fillStyle = '#6366f1'; // Tailwind indigo-500
            context.arc(xPos, yPos, 3, 0, Math.PI * 2);
            context.fill();
        });
        
        // Draw Predictions line (emerald)
        context.beginPath();
        context.strokeStyle = '#10b981'; // Tailwind emerald-500
        context.lineWidth = 2;
        
        predictionsData.forEach((value, i) => {
            const xPos = padding.left + (i * chartWidth) / (predictionsData.length - 1);
            const yPos = height - padding.bottom - value * yScale;
            
            if (i === 0) {
                context.moveTo(xPos, yPos);
            } else {
                context.lineTo(xPos, yPos);
            }
        });
        context.stroke();
        
        // Draw data points for Predictions
        predictionsData.forEach((value, i) => {
            const xPos = padding.left + (i * chartWidth) / (predictionsData.length - 1);
            const yPos = height - padding.bottom - value * yScale;
            
            context.beginPath();
            context.fillStyle = '#10b981'; // Tailwind emerald-500
            context.arc(xPos, yPos, 3, 0, Math.PI * 2);
            context.fill();
        });
    }
    
    // Handle time range change
    function handleTimeRangeChange(range: '7d' | '30d') {
        timeRange = range;
        setTimeout(drawChart, 0);
    }
    
    // Initialize the chart when the component mounts
    onMount(() => {
        // Draw chart after the DOM is fully rendered
        setTimeout(drawChart, 0);
        
        // Redraw on window resize
        const handleResize = () => {
            if (canvas) {
                // Set canvas dimensions to match container
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                drawChart();
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial sizing
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });
    
    // Function to set canvas reference
    function setCanvas(el: HTMLCanvasElement) {
        canvas = el;
    }
</script>

<div class="relative h-full w-full">
    <!-- Time range selector buttons -->
    <div class="absolute right-0 top-0 flex space-x-2 z-10">
        <button
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors {timeRange === '7d' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}"
            onclick={() => handleTimeRangeChange('7d')}
        >
            Last 7d
        </button>
        <button
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors {timeRange === '30d' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}"
            onclick={() => handleTimeRangeChange('30d')}
        >
            Last 30d
        </button>
    </div>
    
    <!-- Canvas for chart rendering -->
    <canvas use:setCanvas class="h-full w-full"></canvas>
    
    {#if isLoading}
        <div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
            <div class="flex items-center">
                <div class="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                <p class="text-sm text-gray-500">Loading chart data...</p>
            </div>
        </div>
    {/if}
</div>

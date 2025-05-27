<script lang="ts">
    import { onMount } from 'svelte';
    import { Spinner } from 'flowbite-svelte';
    import type { Market } from '$lib/services/market/marketService';
    import { 
        getHistoricalPriceData, 
        getCoinIdFromAssetPair 
    } from '$lib/services/price/coinGeckoService';
    
    interface Props {
        market: Market;
    }
    
    interface ChartState {
        isLoading: boolean;
        error: string | null;
        dateLabels: string[];
        priceData: number[];
        maxPrice: number;
        minPrice: number;
    }
    
    interface TimeRangeOption {
        days: number;
        label: string;
    }
    
    interface ChartData {
        labels: string[];
        data: number[];
    }
    
    let { market }: Props = $props();
    
    let canvas = $state<HTMLCanvasElement | undefined>();
    let ctx = $state<CanvasRenderingContext2D | null>(null);
    let timeRange = $state(30);
    
    let chartState = $state<ChartState>({
        isLoading: false,
        error: null,
        dateLabels: [],
        priceData: [],
        maxPrice: 0,
        minPrice: 0
    });
    
    const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
        { days: 1, label: '24h' },
        { days: 7, label: '7d' },
        { days: 30, label: '30d' }
    ] as const;
    
    const CHART_CONFIG = {
        gridLines: 5,
        labelStep: 5,
        pricePadding: 0.1,
        lineWidth: 2,
        thresholdLineWidth: 1,
        canvas: {
            width: 800,
            height: 300
        }
    } as const;
    
    const COLORS = {
        background: '#f8fafc',
        grid: '#e2e8f0',
        text: '#64748b',
        threshold: '#ef4444',
        price: '#6366f1',
        gradientStart: 'rgba(99, 102, 241, 0.2)',
        gradientEnd: 'rgba(99, 102, 241, 0.0)'
    } as const;
    
    const UI_TEXT = {
        title: 'Price History',
        loading: 'Loading chart data...',
        tryAgain: 'Try Again',
        noData: 'No price data available',
        noAssetPair: 'No asset pair specified',
        fetchFailed: 'Failed to fetch price data',
        threshold: 'Threshold:'
    } as const;
    
    function formatCurrency(value: string | number): string {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
        return `${num.toFixed(2)}`;
    }
    
    function generatePriceData(threshold: number, days = 30): ChartData {
        const now = new Date();
        const labels: string[] = [];
        const data: number[] = [];
        const basePrice = threshold * 0.9;
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            const variance = threshold * 0.3;
            const randomFactor = Math.random() * variance - (variance / 2);
            const price = basePrice + (i * threshold * 0.01) + randomFactor;
            data.push(Math.max(0, price));
        }
        
        return { labels, data };
    }
    
    function formatPriceDataForChart(priceData: any): ChartData {
        if (!priceData?.prices || !Array.isArray(priceData.prices)) {
            return { labels: [], data: [] };
        }
        
        const labels: string[] = [];
        const data: number[] = [];
        
        priceData.prices.forEach((item: [number, number]) => {
            const [timestamp, price] = item;
            const date = new Date(timestamp);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(price);
        });
        
        return { labels, data };
    }
    
    function drawChart(): void {
        if (!canvas) return;
        
        ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const { width, height } = CHART_CONFIG.canvas;
        const { priceData, dateLabels } = chartState;
        
        ctx.clearRect(0, 0, width, height);
        
        const pricePadding = (chartState.maxPrice - chartState.minPrice) * CHART_CONFIG.pricePadding;
        const effectiveMax = chartState.maxPrice + pricePadding;
        const effectiveMin = Math.max(0, chartState.minPrice - pricePadding);
        
        drawBackground(ctx, width, height);
        drawGrid(ctx, width, height, effectiveMin, effectiveMax);
        drawDateLabels(ctx, width, height, dateLabels);
        drawThresholdLine(ctx, width, height, effectiveMin, effectiveMax);
        drawPriceLine(ctx, width, height, priceData, effectiveMin, effectiveMax);
    }
    
    function drawBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
        context.fillStyle = COLORS.background;
        context.fillRect(0, 0, width, height);
    }
    
    function drawGrid(
        context: CanvasRenderingContext2D, 
        width: number, 
        height: number, 
        effectiveMin: number, 
        effectiveMax: number
    ): void {
        context.strokeStyle = COLORS.grid;
        context.lineWidth = 1;
        
        for (let i = 0; i <= CHART_CONFIG.gridLines; i++) {
            const y = height - (i / CHART_CONFIG.gridLines) * height;
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(width, y);
            context.stroke();
            
            const price = effectiveMin + (i / CHART_CONFIG.gridLines) * (effectiveMax - effectiveMin);
            context.fillStyle = COLORS.text;
            context.font = '10px sans-serif';
            context.textAlign = 'right';
            context.fillText(formatCurrency(price), width - 5, y - 5);
        }
    }
    
    function drawDateLabels(
        context: CanvasRenderingContext2D, 
        width: number, 
        height: number, 
        dateLabels: string[]
    ): void {
        context.fillStyle = COLORS.text;
        context.font = '10px sans-serif';
        context.textAlign = 'center';
        
        const labelStep = Math.ceil(dateLabels.length / CHART_CONFIG.labelStep);
        for (let i = 0; i < dateLabels.length; i += labelStep) {
            const x = (i / (dateLabels.length - 1)) * width;
            context.fillText(dateLabels[i], x, height - 5);
        }
    }
    
    function drawThresholdLine(
        context: CanvasRenderingContext2D, 
        width: number, 
        height: number, 
        effectiveMin: number, 
        effectiveMax: number
    ): void {
        if (!market?.priceThreshold) return;
        
        const thresholdY = height - ((market.priceThreshold - effectiveMin) / (effectiveMax - effectiveMin)) * height;
        
        context.beginPath();
        context.strokeStyle = COLORS.threshold;
        context.setLineDash([5, 3]);
        context.lineWidth = CHART_CONFIG.thresholdLineWidth;
        context.moveTo(0, thresholdY);
        context.lineTo(width, thresholdY);
        context.stroke();
        context.setLineDash([]);
        
        context.fillStyle = COLORS.threshold;
        context.textAlign = 'left';
        context.fillText(`${UI_TEXT.threshold} ${formatCurrency(market.priceThreshold)}`, 5, thresholdY - 5);
    }
    
    function drawPriceLine(
        context: CanvasRenderingContext2D, 
        width: number, 
        height: number, 
        priceData: number[], 
        effectiveMin: number, 
        effectiveMax: number
    ): void {
        if (priceData.length === 0) return;
        
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, COLORS.gradientStart);
        gradient.addColorStop(1, COLORS.gradientEnd);
        
        context.beginPath();
        for (let i = 0; i < priceData.length; i++) {
            const x = (i / (priceData.length - 1)) * width;
            const y = height - ((priceData[i] - effectiveMin) / (effectiveMax - effectiveMin)) * height;
            
            if (i === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        }
        
        context.lineTo(width, height);
        context.lineTo(0, height);
        context.closePath();
        context.fillStyle = gradient;
        context.fill();
        
        context.beginPath();
        for (let i = 0; i < priceData.length; i++) {
            const x = (i / (priceData.length - 1)) * width;
            const y = height - ((priceData[i] - effectiveMin) / (effectiveMax - effectiveMin)) * height;
            
            if (i === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        }
        context.strokeStyle = COLORS.price;
        context.lineWidth = CHART_CONFIG.lineWidth;
        context.stroke();
    }
    
    async function fetchPriceData(days = 30): Promise<void> {
        if (!market?.assetPair) {
            chartState.error = UI_TEXT.noAssetPair;
            return;
        }
        
        chartState.isLoading = true;
        chartState.error = null;
        
        try {
            const coinId = await getCoinIdFromAssetPair(market.assetPair);
            
            let chartData: ChartData;
            if (!coinId) {
                chartData = generatePriceData(market.priceThreshold, days);
            } else {
                const geckoData = await getHistoricalPriceData(coinId, 'usd', days);
                chartData = formatPriceDataForChart(geckoData);
            }
            
            chartState.dateLabels = chartData.labels;
            chartState.priceData = chartData.data;
            chartState.maxPrice = Math.max(...chartData.data);
            chartState.minPrice = Math.min(...chartData.data);
        } catch (err) {
            chartState.error = err instanceof Error ? err.message : UI_TEXT.fetchFailed;
            
            const fallbackData = generatePriceData(market.priceThreshold, days);
            chartState.dateLabels = fallbackData.labels;
            chartState.priceData = fallbackData.data;
            chartState.maxPrice = Math.max(...fallbackData.data);
            chartState.minPrice = Math.min(...fallbackData.data);
        } finally {
            chartState.isLoading = false;
            setTimeout(drawChart, 0);
        }
    }
    
    function setTimeRange(days: number): void {
        timeRange = days;
        fetchPriceData(days);
    }
    
    function handleRetry(): void {
        fetchPriceData(timeRange);
    }
    
    onMount(() => {
        fetchPriceData(timeRange);
    });
    </script>
    
    <div class="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
            <h4 class="text-lg font-semibold text-gray-700">{UI_TEXT.title}</h4>
            
            <div class="flex space-x-2">
                {#each TIME_RANGE_OPTIONS as option}
                    <button 
                        class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                        class:bg-indigo-100={timeRange === option.days}
                        class:text-indigo-800={timeRange === option.days}
                        class:text-gray-600={timeRange !== option.days}
                        onclick={() => setTimeRange(option.days)}
                    >
                        {option.label}
                    </button>
                {/each}
            </div>
        </div>
        
        <div class="relative h-64 w-full">
            {#if chartState.isLoading}
                <div class="flex h-full w-full items-center justify-center">
                    <Spinner size="6" />
                    <p class="ml-2 text-gray-500">{UI_TEXT.loading}</p>
                </div>
            {:else if chartState.error}
                <div class="flex h-full w-full flex-col items-center justify-center">
                    <p class="text-red-500">{chartState.error}</p>
                    <button 
                        class="mt-2 rounded-md bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200"
                        onclick={handleRetry}
                    >
                        {UI_TEXT.tryAgain}
                    </button>
                </div>
            {:else if chartState.priceData.length > 0}
                <canvas 
                    bind:this={canvas} 
                    width={CHART_CONFIG.canvas.width}
                    height={CHART_CONFIG.canvas.height}
                    class="h-full w-full"
                ></canvas>
            {:else}
                <div class="flex h-full w-full items-center justify-center">
                    <p class="text-gray-500">{UI_TEXT.noData}</p>
                </div>
            {/if}
        </div>
    </div>
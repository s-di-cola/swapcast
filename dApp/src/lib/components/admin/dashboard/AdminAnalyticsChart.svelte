<script lang="ts">
	import { onMount } from 'svelte';
	import { executeQuery } from '$lib/services/subgraph';
	import { GET_ANALYTICS_DATA } from '$lib/services/subgraph/queries'

	interface Props {
		timeRange?: '7d' | '30d';
	}

	interface DataPoint {
		date: string;
		markets: number;
		predictions: number;
	}

	interface ChartData {
		labels: string[];
		marketsData: number[];
		predictionsData: number[];
	}

	interface ChartDimensions {
		width: number;
		height: number;
		padding: {
			top: number;
			right: number;
			bottom: number;
			left: number;
		};
		chartWidth: number;
		chartHeight: number;
	}

	let { timeRange = '7d' }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let isLoading = $state(false);

	const COLORS = {
		markets: '#6366f1',
		predictions: '#10b981',
		axis: '#e2e8f0',
		grid: '#f1f5f9',
		text: '#64748b'
	} as const;

	const CHART_CONFIG = {
		lineWidth: 2,
		pointRadius: 3,
		yPadding: 1.1,
		gridLines: 5,
		skipFactor: 15
	} as const;

	interface AnalyticsResponse {
		markets: Array<{
			id: string;
			marketId: string;
			creationTimestamp: string;
			isResolved: boolean;
		}>;
		predictions: Array<{
			id: string;
			timestamp: string;
			market: {
				id: string;
			};
		}>;
	}

	let error = $state<string | null>(null);

	async function fetchData(days: number): Promise<ChartData | null> {
		try {
			error = null;

			// Calculate start and end timestamps
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			const startTimestamp = Math.floor(startDate.getTime() / 1000).toString();
			const endTimestamp = Math.floor(endDate.getTime() / 1000).toString();

			// Fetch data from subgraph
			const response = await executeQuery<AnalyticsResponse>(GET_ANALYTICS_DATA, {
				startTimestamp,
				endTimestamp
			});

			if (!response || !response.markets) {
				throw new Error('Failed to fetch analytics data');
			}

			// Process data into daily buckets
			const markets = response.markets || [];
			const predictions = response.predictions || [];
			const data: DataPoint[] = [];

			for (let i = 0; i <= days; i++) {
				const currentDate = new Date(startDate);
				currentDate.setDate(currentDate.getDate() + i);

				const nextDate = new Date(currentDate);
				nextDate.setDate(nextDate.getDate() + 1);

				const currentDayStart = Math.floor(currentDate.getTime() / 1000);
				const currentDayEnd = Math.floor(nextDate.getTime() / 1000);

				// Count markets and predictions for this day
				const marketsCreatedToday = markets.filter((market) => {
					const timestamp = parseInt(market.creationTimestamp);
					return timestamp >= currentDayStart && timestamp < currentDayEnd;
				}).length;

				const predictionsCreatedToday = predictions.filter((prediction) => {
					const timestamp = parseInt(prediction.timestamp);
					return timestamp >= currentDayStart && timestamp < currentDayEnd;
				}).length;

				const dateStr = currentDate.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric'
				});

				data.push({
					date: dateStr,
					markets: marketsCreatedToday,
					predictions: predictionsCreatedToday
				});
			}

			return {
				labels: data.map((d) => d.date),
				marketsData: data.map((d) => d.markets),
				predictionsData: data.map((d) => d.predictions)
			};
		} catch (error) {
			console.error('Error fetching analytics data:', error);
			// Set error message to display to user
			error = 'Failed to load analytics data. Please check your connection to the subgraph.';
			return null;
		}
	}

	function getChartDimensions(canvas: HTMLCanvasElement): ChartDimensions {
		const padding = { top: 20, right: 20, bottom: 30, left: 40 };

		return {
			width: canvas.width,
			height: canvas.height,
			padding,
			chartWidth: canvas.width - padding.left - padding.right,
			chartHeight: canvas.height - padding.top - padding.bottom
		};
	}

	function drawAxes(context: CanvasRenderingContext2D, dimensions: ChartDimensions): void {
		const { width, height, padding } = dimensions;

		context.beginPath();
		context.strokeStyle = COLORS.axis;
		context.lineWidth = 1;

		context.moveTo(padding.left, padding.top);
		context.lineTo(padding.left, height - padding.bottom);
		context.moveTo(padding.left, height - padding.bottom);
		context.lineTo(width - padding.right, height - padding.bottom);
		context.stroke();
	}

	function drawYAxisLabels(
		context: CanvasRenderingContext2D,
		dimensions: ChartDimensions,
		maxValue: number,
		yScale: number
	): void {
		const { height, padding, chartHeight } = dimensions;

		context.textAlign = 'right';
		context.textBaseline = 'middle';
		context.fillStyle = COLORS.text;
		context.font = '10px Inter, system-ui, sans-serif';

		for (let i = 0; i <= CHART_CONFIG.gridLines; i++) {
			const yValue = Math.round((maxValue * i) / CHART_CONFIG.gridLines);
			const yPos = height - padding.bottom - yValue * yScale;

			context.fillText(yValue.toString(), padding.left - 5, yPos);

			context.beginPath();
			context.strokeStyle = COLORS.grid;
			context.moveTo(padding.left, yPos);
			context.lineTo(dimensions.width - padding.right, yPos);
			context.stroke();
		}
	}

	function drawXAxisLabels(
		context: CanvasRenderingContext2D,
		dimensions: ChartDimensions,
		labels: string[]
	): void {
		const { height, padding, chartWidth } = dimensions;

		context.textAlign = 'center';
		context.textBaseline = 'top';
		context.fillStyle = COLORS.text;

		const skipFactor = labels.length > CHART_CONFIG.skipFactor ? 3 : 1;

		labels.forEach((label, i) => {
			if (i % skipFactor === 0 || i === labels.length - 1) {
				const xPos = padding.left + (i * chartWidth) / (labels.length - 1);
				context.fillText(label, xPos, height - padding.bottom + 5);
			}
		});
	}

	function drawLine(
		context: CanvasRenderingContext2D,
		dimensions: ChartDimensions,
		data: number[],
		color: string,
		yScale: number
	): void {
		const { padding, chartWidth } = dimensions;

		context.beginPath();
		context.strokeStyle = color;
		context.lineWidth = CHART_CONFIG.lineWidth;

		data.forEach((value, i) => {
			const xPos = padding.left + (i * chartWidth) / (data.length - 1);
			const yPos = dimensions.height - padding.bottom - value * yScale;

			if (i === 0) {
				context.moveTo(xPos, yPos);
			} else {
				context.lineTo(xPos, yPos);
			}
		});
		context.stroke();

		data.forEach((value, i) => {
			const xPos = padding.left + (i * chartWidth) / (data.length - 1);
			const yPos = dimensions.height - padding.bottom - value * yScale;

			context.beginPath();
			context.fillStyle = color;
			context.arc(xPos, yPos, CHART_CONFIG.pointRadius, 0, Math.PI * 2);
			context.fill();
		});
	}

	async function drawChart(): Promise<void> {
		if (!canvas) return;

		ctx = canvas.getContext('2d');
		if (!ctx) return;

		const context = ctx;
		const dimensions = getChartDimensions(canvas);

		context.clearRect(0, 0, canvas.width, canvas.height);

		// Show loading state
		isLoading = true;

		const days = timeRange === '7d' ? 7 : 30;
		// Fetch data from subgraph
		const data = await fetchData(days);

		// Hide loading state
		isLoading = false;

		// If we have an error, don't try to draw the chart
		if (!data || error) return;

		const maxValue = Math.max(Math.max(...data.marketsData), Math.max(...data.predictionsData));
		const yScale = dimensions.chartHeight / (maxValue * CHART_CONFIG.yPadding);

		drawAxes(context, dimensions);
		drawYAxisLabels(context, dimensions, maxValue, yScale);
		drawXAxisLabels(context, dimensions, data.labels);
		drawLine(context, dimensions, data.marketsData, COLORS.markets, yScale);
		drawLine(context, dimensions, data.predictionsData, COLORS.predictions, yScale);
	}

	async function handleTimeRangeChange(range: '7d' | '30d'): Promise<void> {
		timeRange = range;
		await drawChart();
	}

	async function handleResize(): Promise<void> {
		if (canvas) {
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
			await drawChart();
		}
	}

	onMount(() => {
		// Initial chart draw
		drawChart().catch((err) => console.error('Error drawing initial chart:', err));

		// Handle window resize
		const resizeHandler = () => {
			if (canvas) {
				canvas.width = canvas.offsetWidth;
				canvas.height = canvas.offsetHeight;
				drawChart().catch((err) => console.error('Error redrawing chart:', err));
			}
		};

		window.addEventListener('resize', resizeHandler);

		// Initial resize
		if (canvas) {
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
		}

		return () => {
			window.removeEventListener('resize', resizeHandler);
		};
	});
</script>

<div class="relative h-full w-full">
	<div class="absolute right-0 top-0 z-10 flex space-x-2">
		<button
			class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
			class:bg-emerald-100={timeRange === '7d'}
			class:text-emerald-600={timeRange === '7d'}
			class:bg-gray-100={timeRange !== '7d'}
			class:text-gray-600={timeRange !== '7d'}
			onclick={() => handleTimeRangeChange('7d')}
		>
			Last 7d
		</button>
		<button
			class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
			class:bg-emerald-100={timeRange === '30d'}
			class:text-emerald-600={timeRange === '30d'}
			class:bg-gray-100={timeRange !== '30d'}
			class:text-gray-600={timeRange !== '30d'}
			onclick={() => handleTimeRangeChange('30d')}
		>
			Last 30d
		</button>
	</div>

	<canvas bind:this={canvas} class="h-full w-full"></canvas>

	{#if isLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
			<div class="flex items-center">
				<div
					class="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
				></div>
				<p class="text-sm text-gray-500">Loading chart data...</p>
			</div>
		</div>
	{:else if error}
		<div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
			<div class="max-w-md rounded-md bg-red-50 p-4 text-center">
				<div class="flex items-center justify-center">
					<svg class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<h3 class="ml-2 text-sm font-medium text-red-800">Error</h3>
				</div>
				<div class="mt-2 text-sm text-red-700">
					{error}
				</div>
				<div class="mt-4">
					<button
						class="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
						onclick={() => {
							error = null;
							drawChart();
						}}
					>
						Try Again
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

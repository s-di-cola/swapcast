<script lang="ts">
	import { onMount } from 'svelte';
	import { executeQuery } from '$lib/services/subgraph';
	import { GET_ANALYTICS_DATA } from '$lib/services/subgraph/queries';
	import { processDailyAnalytics, getLastNDaysData, getDateRangeForAnalytics } from '$lib/utils/analytics';

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

	let { timeRange = '7d' }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const COLORS = {
		markets: '#6366f1', // Indigo
		predictions: '#10b981', // Emerald
		axis: '#e2e8f0',
		grid: '#f1f5f9',
		text: '#64748b'
	} as const;

	const CHART_CONFIG = {
		lineWidth: 3, // Increased line width for better visibility
		pointRadius: 5, // Increased point radius for better visibility
		yPadding: 1.2, // Increased padding to give more space at the top
		gridLines: 5,
		skipFactor: 15
	} as const;

	async function fetchData(days: number): Promise<ChartData | null> {
		try {
			error = null;

			// Get date range for query using utility function
			const { startTimestamp, endTimestamp } = getDateRangeForAnalytics(days);

			// Fetch data from subgraph
			const response = await executeQuery<AnalyticsResponse>(GET_ANALYTICS_DATA, {
				startTimestamp,
				endTimestamp
			});

			if (!response || !response.markets) {
				throw new Error('Failed to fetch analytics data');
			}

			// Log raw data for debugging
			console.log('Raw subgraph data:', response);
			
			// Process data using our utility function
			const processedData = processDailyAnalytics(response);
			
			// Get only the last N days of data
			let filteredData = getLastNDaysData(processedData, days);
			console.log('Filtered data:', filteredData);
			
			// Debug the data for today specifically
			const todayStr = new Date().toISOString().split('T')[0];
			const todayData = filteredData.find(item => item.date === todayStr);
			console.log('Today\'s data:', todayData);

			// Log raw data details to debug
			console.log('Raw markets data:', response.markets.length, 'markets');
			console.log('Raw predictions data:', response.predictions.length, 'predictions');
			console.log('First market timestamp:', response.markets[0]?.creationTimestamp);
			
			// Check if we have any real data from the subgraph
			const hasRealData = response.markets.length > 0 || response.predictions.length > 0;
			console.log('Has real data?', hasRealData, 'Markets:', response.markets.length, 'Predictions:', response.predictions.length, 'Filtered data items:', filteredData.length);
			
			// Debug each day's data
			filteredData.forEach((item, index) => {
				console.log(`Day ${index} (${item.date}):`, {
					marketsCreated: item.marketsCreated,
					predictions: item.predictions,
					stakeAmount: item.stakeAmount
				});
			});
			
			// Create mock data only if no real data is available
			if (!hasRealData) {
				console.log('No real data found, creating mock data for visualization');
				// Create mock data for the last N days
				const mockData = [];
				const today = new Date();
				
				for (let i = 0; i < days; i++) {
					const date = new Date(today);
					date.setDate(date.getDate() - (days - i - 1));
					const dateStr = date.toISOString().split('T')[0];
					
					mockData.push({
						date: dateStr,
						marketsCreated: Math.floor(Math.random() * 3), // 0-2 markets per day
						predictions: Math.floor(Math.random() * 10), // 0-9 predictions per day
						stakeAmount: Math.random() * 5, // Random ETH amount
						stakeOutcome0: Math.random() * 2.5, // Random bearish stake
						stakeOutcome1: Math.random() * 2.5 // Random bullish stake
					});
				}
				
				console.log('Created mock data:', mockData);
				// Replace filtered data with mock data instead of appending
				filteredData = mockData;
			} else {
				console.log('Using real data for visualization');
			}

			// Format data for the chart
			const chartData: DataPoint[] = filteredData.map(item => {
				console.log(`Processing item for chart: date=${item.date}, markets=${item.marketsCreated}, predictions=${item.predictions}`);
				return {
					date: new Date(item.date).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric'
					}),
					markets: item.marketsCreated,
					predictions: item.predictions
				};
			});

			console.log('Final chart data:', chartData);
			console.log('Markets data array:', chartData.map(d => d.markets));
			console.log('Predictions data array:', chartData.map(d => d.predictions));

			const result = {
				labels: chartData.map((d) => d.date),
				marketsData: chartData.map((d) => d.markets),
				predictionsData: chartData.map((d) => d.predictions)
			};
			
			console.log('Returning chart data:', result);
			return result;
		} catch (err) {
			console.error('Error fetching analytics data:', err);
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
		maxMarkets: number,
		maxPredictions: number,
		yScaleMarkets: number,
		yScalePredictions: number
	): void {
		const { height, width, padding } = dimensions;

		// Draw left y-axis labels (Markets)
		context.textAlign = 'right';
		context.textBaseline = 'middle';
		context.fillStyle = COLORS.markets;
		context.font = '10px Inter, system-ui, sans-serif';

		for (let i = 0; i <= CHART_CONFIG.gridLines; i++) {
			const yValue = Math.round((maxMarkets * i) / CHART_CONFIG.gridLines);
			const yPos = height - padding.bottom - yValue * yScaleMarkets;

			context.fillText(yValue.toString(), padding.left - 5, yPos);

			// Draw grid lines
			context.beginPath();
			context.strokeStyle = COLORS.grid;
			context.moveTo(padding.left, yPos);
			context.lineTo(width - padding.right, yPos);
			context.stroke();
		}

		// Draw right y-axis labels (Predictions)
		context.textAlign = 'left';
		context.fillStyle = COLORS.predictions;

		for (let i = 0; i <= CHART_CONFIG.gridLines; i++) {
			const yValue = Math.round((maxPredictions * i) / CHART_CONFIG.gridLines);
			const yPos = height - padding.bottom - yValue * yScalePredictions;

			context.fillText(yValue.toString(), width - padding.right + 5, yPos);
		}

		// Add axis titles
		context.save();
		context.translate(padding.left - 25, height / 2);
		context.rotate(-Math.PI / 2);
		context.textAlign = 'center';
		context.fillStyle = COLORS.markets;
		context.fillText('Markets', 0, 0);
		context.restore();

		context.save();
		context.translate(width - padding.right + 25, height / 2);
		context.rotate(Math.PI / 2);
		context.textAlign = 'center';
		context.fillStyle = COLORS.predictions;
		context.fillText('Predictions', 0, 0);
		context.restore();
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

		// Calculate separate max values for markets and predictions
		const maxMarkets = Math.max(...data.marketsData, 1); // Ensure at least 1 to avoid division by zero
		const maxPredictions = Math.max(...data.predictionsData, 10); // Ensure at least 10 to avoid division by zero
		
		console.log('Chart data:', data);
		console.log('Max markets:', maxMarkets);
		console.log('Max predictions:', maxPredictions);
		console.log('Markets data array for drawing:', data.marketsData);
		console.log('Predictions data array for drawing:', data.predictionsData);
		
		// Calculate separate scales for markets and predictions
		const yScaleMarkets = dimensions.chartHeight / (maxMarkets * CHART_CONFIG.yPadding || 1);
		const yScalePredictions = dimensions.chartHeight / (maxPredictions * CHART_CONFIG.yPadding || 1);
		
		console.log('Y-scale for markets:', yScaleMarkets);
		console.log('Y-scale for predictions:', yScalePredictions);

		drawAxes(context, dimensions);
		drawYAxisLabels(context, dimensions, maxMarkets, maxPredictions, yScaleMarkets, yScalePredictions);
		drawXAxisLabels(context, dimensions, data.labels);
		
		// Draw predictions line first (so markets line appears on top)
		drawLine(context, dimensions, data.predictionsData, COLORS.predictions, yScalePredictions);
		
		// Draw markets line using left y-axis scale with increased visibility
		context.lineWidth = CHART_CONFIG.lineWidth + 1; // Make markets line thicker
		drawLine(context, dimensions, data.marketsData, COLORS.markets, yScaleMarkets);
		
		// Draw points again for markets to make them more visible
		data.marketsData.forEach((value, i) => {
			const xPos = dimensions.padding.left + (i * dimensions.chartWidth) / (data.marketsData.length - 1);
			const yPos = dimensions.height - dimensions.padding.bottom - value * yScaleMarkets;

			context.beginPath();
			context.fillStyle = COLORS.markets;
			context.arc(xPos, yPos, CHART_CONFIG.pointRadius + 1, 0, Math.PI * 2);
			context.fill();
			
			// Add a white border around market points for better visibility
			context.beginPath();
			context.strokeStyle = 'white';
			context.lineWidth = 1.5;
			context.arc(xPos, yPos, CHART_CONFIG.pointRadius + 1, 0, Math.PI * 2);
			context.stroke();
		});
	}

	async function handleTimeRangeChange(range: '7d' | '30d'): Promise<void> {
		timeRange = range;
		await drawChart();
	}

	function handleResize(): void {
		if (canvas) {
			canvas.width = canvas.offsetWidth || 300;
			canvas.height = canvas.offsetHeight || 200;
			drawChart().catch((err) => console.error('Error redrawing chart:', err));
		}
	}

	onMount(() => {
		// Set a small timeout to ensure the canvas is properly mounted and sized
		setTimeout(() => {
			if (canvas) {
				canvas.width = canvas.offsetWidth || 300;
				canvas.height = canvas.offsetHeight || 200;
				drawChart().catch((err) => console.error('Error drawing initial chart:', err));
			}
		}, 50);

		// Handle window resize
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
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

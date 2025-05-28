<script lang="ts">
	import { onMount } from 'svelte';

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

	function generateMockData(days: number): ChartData {
		const data: DataPoint[] = [];
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		for (let i = 0; i <= days; i++) {
			const date = new Date(startDate);
			date.setDate(date.getDate() + i);

			const marketBase = 5 + Math.floor(i * (8 / days));
			const marketRandom = Math.floor(Math.random() * 2);
			const markets = marketBase + marketRandom;

			const predictionBase = 2 + Math.floor(i * (5 / days));
			const predictionRandom = Math.floor(Math.random() * 3) - 1;
			const predictions = Math.max(1, predictionBase + predictionRandom);

			const dateStr = date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric'
			});

			data.push({ date: dateStr, markets, predictions });
		}

		return {
			labels: data.map((d) => d.date),
			marketsData: data.map((d) => d.markets),
			predictionsData: data.map((d) => d.predictions)
		};
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

	function drawChart(): void {
		if (!canvas) return;

		ctx = canvas.getContext('2d');
		if (!ctx) return;

		const context = ctx;
		const dimensions = getChartDimensions(canvas);

		context.clearRect(0, 0, canvas.width, canvas.height);

		const days = timeRange === '7d' ? 7 : 30;
		const { labels, marketsData, predictionsData } = generateMockData(days);

		const maxValue = Math.max(Math.max(...marketsData), Math.max(...predictionsData));
		const yScale = dimensions.chartHeight / (maxValue * CHART_CONFIG.yPadding);

		drawAxes(context, dimensions);
		drawYAxisLabels(context, dimensions, maxValue, yScale);
		drawXAxisLabels(context, dimensions, labels);
		drawLine(context, dimensions, marketsData, COLORS.markets, yScale);
		drawLine(context, dimensions, predictionsData, COLORS.predictions, yScale);
	}

	function handleTimeRangeChange(range: '7d' | '30d'): void {
		timeRange = range;
		setTimeout(drawChart, 0);
	}

	function handleResize(): void {
		if (canvas) {
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
			drawChart();
		}
	}

	onMount(() => {
		setTimeout(drawChart, 0);

		window.addEventListener('resize', handleResize);
		handleResize();

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="relative h-full w-full">
	<div class="absolute top-0 right-0 z-10 flex space-x-2">
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
		<div class="bg-opacity-80 absolute inset-0 flex items-center justify-center bg-white">
			<div class="flex items-center">
				<div
					class="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
				></div>
				<p class="text-sm text-gray-500">Loading chart data...</p>
			</div>
		</div>
	{/if}
</div>

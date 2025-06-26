<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApexOptions } from 'apexcharts';
	import { Chart } from 'flowbite-svelte';
	import { executeQuery } from '$lib/services/subgraph';
	import { GET_ANALYTICS_DATA } from '$lib/services/subgraph/queries';
	import {
		processDailyAnalytics,
		getLastNDaysData,
		getDateRangeForAnalytics
	} from '$lib/utils/analytics';

	interface Props {
		timeRange?: '7d' | '30d';
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

	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Chart options using ApexCharts
	let options = $state<ApexOptions>({
		chart: {
			height: '100%',
			type: 'line',
			fontFamily: 'Inter, sans-serif',
			dropShadow: {
				enabled: false
			},
			toolbar: {
				show: false
			}
		},
		tooltip: {
			enabled: true,
			x: {
				show: false
			}
		},
		dataLabels: {
			enabled: false
		},
		stroke: {
			width: 3,
			curve: 'smooth'
		},
		grid: {
			show: true,
			strokeDashArray: 4,
			padding: {
				left: 2,
				right: 2,
				top: 0
			}
		},
		series: [
			{
				name: 'Markets',
				data: [],
				color: '#6366f1' // Indigo
			},
			{
				name: 'Predictions',
				data: [],
				color: '#10b981' // Emerald
			}
		],
		legend: {
			show: false
		},
		xaxis: {
			categories: [],
			labels: {
				show: true,
				style: {
					fontFamily: 'Inter, sans-serif',
					cssClass: 'text-xs font-normal fill-gray-500 dark:fill-gray-400'
				}
			},
			axisBorder: {
				show: false
			},
			axisTicks: {
				show: false
			}
		},
		yaxis: [
			{
				title: {
					text: 'Markets',
					style: {
						color: '#6366f1',
						fontFamily: 'Inter, sans-serif'
					}
				},
				labels: {
					style: {
						colors: '#6366f1',
						fontFamily: 'Inter, sans-serif'
					}
				}
			},
			{
				opposite: true,
				title: {
					text: 'Predictions',
					style: {
						color: '#10b981',
						fontFamily: 'Inter, sans-serif'
					}
				},
				labels: {
					style: {
						colors: '#10b981',
						fontFamily: 'Inter, sans-serif'
					}
				}
			}
		]
	});

	async function fetchData(days: number): Promise<void> {
		try {
			error = null;
			isLoading = true;

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

			// Process data using our utility function
			const processedData = processDailyAnalytics(response);

			// Get only the last N days of data
			let filteredData = getLastNDaysData(processedData, days);

			// Check if we have any real data from the subgraph
			const hasRealData = response.markets.length > 0 || response.predictions.length > 0;

			// Create mock data only if no real data is available
			if (!hasRealData) {
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

				// Replace filtered data with mock data instead of appending
				filteredData = mockData;
			}

			// Format data for the chart
			const chartLabels = filteredData.map((item) => {
				return new Date(item.date).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric'
				});
			});

			const marketsData = filteredData.map((item) => item.marketsCreated);
			const predictionsData = filteredData.map((item) => item.predictions);

			// Update options with new data
			options = {
				...options,
				series: [
					{
						name: 'Markets',
						data: marketsData,
						color: '#6366f1'
					},
					{
						name: 'Predictions',
						data: predictionsData,
						color: '#10b981'
					}
				],
				xaxis: {
					...options.xaxis,
					categories: chartLabels
				}
			};

		} catch (err) {
			console.error('Error fetching analytics data:', err);
			// Set error message to display to user
			error = 'Failed to load analytics data. Please check your connection to the subgraph.';
		} finally {
			isLoading = false;
		}
	}

	async function handleTimeRangeChange(range: '7d' | '30d'): Promise<void> {
		timeRange = range;
		const days = timeRange === '7d' ? 7 : 30;
		await fetchData(days);
	}

	onMount(() => {
		const days = timeRange === '7d' ? 7 : 30;
		fetchData(days);
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

	{#if isLoading}
		<div class="bg-opacity-80 absolute inset-0 flex items-center justify-center bg-white">
			<div class="flex items-center">
				<div
					class="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
				></div>
				<p class="text-sm text-gray-500">Loading chart data...</p>
			</div>
		</div>
	{:else if error}
		<div class="bg-opacity-80 absolute inset-0 flex items-center justify-center bg-white">
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
						class="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
						onclick={() => {
							error = null;
							const days = timeRange === '7d' ? 7 : 30;
							fetchData(days);
						}}
					>
						Try Again
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="h-full w-full pt-8 pb-4">
			<Chart {options} class="h-full w-full" />
		</div>
	{/if}
</div>
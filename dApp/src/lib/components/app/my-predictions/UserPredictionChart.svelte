<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart } from 'flowbite-svelte';
  import type { ApexOptions } from 'apexcharts';
  import { fetchUserPredictions } from '$lib/services/prediction';
  import { appKit } from '$lib/configs/wallet.config';

  const { userId } = $props<{ userId: string }>();

  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let timeRange = $state<'7d' | '30d'>('7d');
  
  // Chart data
  let chartData = $state<{
    dates: string[];
    predictions: number[];
    winRate: number[];
  }>({ dates: [], predictions: [], winRate: [] });

  // Chart options
  const options = $derived<ApexOptions>({
    chart: {
      height: '100%',
      type: 'line',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true },
      background: '#ffffff',
      foreColor: '#1f2937'
    },
    grid: {
      show: true,
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
      position: 'back',
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    stroke: { 
      width: 3, 
      curve: 'smooth' 
    },
    colors: ['#6366f1', '#10b981'], // Indigo, Emerald
    tooltip: {
      enabled: true,
      shared: true,
      intersect: false,
      theme: 'light',
      style: { 
        fontSize: '12px', 
        fontFamily: 'Inter, sans-serif' 
      },
      custom: function ({ series, seriesIndex, dataPointIndex, w }) {
        const date = w.globals.categoryLabels[dataPointIndex];
        const predictions = series[0][dataPointIndex];
        const winRate = series[1][dataPointIndex];

        return `
          <div class="p-2 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div class="text-xs font-medium text-gray-500">${date}</div>
            <div class="mt-1 flex items-center">
              <div class="h-2 w-2 rounded-full bg-indigo-500 mr-2"></div>
              <div class="text-sm">Predictions: <span class="font-medium">${predictions}</span></div>
            </div>
            <div class="mt-1 flex items-center">
              <div class="h-2 w-2 rounded-full bg-emerald-500 mr-2"></div>
              <div class="text-sm">Win Rate: <span class="font-medium">${winRate}%</span></div>
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        name: 'Predictions',
        type: 'column',
        data: chartData.predictions
      },
      {
        name: 'Win Rate %',
        type: 'line',
        data: chartData.winRate
      }
    ],
    xaxis: {
      categories: chartData.dates,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '11px',
          fontFamily: 'Inter, sans-serif'
        },
        datetimeUTC: false
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: [
      {
        title: {
          text: 'Predictions',
          style: {
            color: '#6366f1',
            fontSize: '12px'
          }
        },
        labels: {
          style: { 
            colors: '#6366f1', 
            fontSize: '11px' 
          },
          formatter: (val: number) => Math.round(val).toString()
        },
        min: 0,
        forceNiceScale: true
      },
      {
        opposite: true,
        title: {
          text: 'Win Rate %',
          style: {
            color: '#10b981',
            fontSize: '12px'
          }
        },
        labels: {
          style: { 
            colors: '#10b981', 
            fontSize: '11px' 
          },
          formatter: (val: number) => `${Math.round(val)}%`
        },
        min: 0,
        max: 100
      }
    ],
    grid: {
      show: true,
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
      position: 'back',
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 10, right: 10, top: 0, bottom: 0 }
    },
    markers: {
      size: 4,
      strokeWidth: 2,
      strokeColors: '#ffffff',
      hover: { size: 6 }
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '12px',
      fontFamily: 'Inter, sans-serif',
      offsetX: 10,
      offsetY: -5,
      itemMargin: {
        horizontal: 16,
        vertical: 4
      }
    }
  });

  /**
   * Fetches user prediction data and updates the chart
   */
  async function fetchData() {
    if (!appKit?.getAccount()?.address) return;
    
    isLoading = true;
    error = null;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (timeRange === '7d' ? 7 : 30));

      // Fetch user predictions
      const predictions = await fetchUserPredictions(
        appKit.getAccount()?.address || '',
        Math.floor(startDate.getTime() / 1000)
      );

      // Process data for the chart
      updateChartData(predictions, startDate, endDate);
    } catch (err) {
      console.error('Error fetching prediction data:', err);
      error = 'Failed to load prediction data. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  /**
   * Processes prediction data and updates the chart
   */
  function updateChartData(
    predictions: any[],
    startDate: Date,
    endDate: Date
  ) {
    // Group by date and calculate metrics
    const dailyData: Record<string, { predictions: number; wins: number }> = {};
    
    // Initialize dates in range
    const dates: Date[] = [];
    const currDate = new Date(startDate);
    while (currDate <= endDate) {
      const dateStr = currDate.toISOString().split('T')[0];
      dates.push(new Date(currDate));
      dailyData[dateStr] = { predictions: 0, wins: 0 };
      currDate.setDate(currDate.getDate() + 1);
    }

    // Process predictions
    predictions.forEach(prediction => {
      if (!prediction.timestamp) return;
      
      const date = new Date(prediction.timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { predictions: 0, wins: 0 };
      }
      
      dailyData[dateStr].predictions++;
      if (prediction.isWinning) {
        dailyData[dateStr].wins++;
      }
    });

    // Prepare chart data
    const datesSorted = dates.map(d => d.toISOString().split('T')[0]);
    const predictionsData = datesSorted.map(date => dailyData[date]?.predictions || 0);
    const winRateData = datesSorted.map(date => {
      const data = dailyData[date];
      return data && data.predictions > 0 
        ? Math.round((data.wins / data.predictions) * 100) 
        : 0;
    });

    // Format dates for display (e.g., "Jun 24")
    const formattedDates = dates.map(date => 
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    chartData = {
      dates: formattedDates,
      predictions: predictionsData,
      winRate: winRateData
    };
  }

  /**
   * Handles time range change
   */
  function handleTimeRangeChange(range: '7d' | '30d') {
    timeRange = range;
    fetchData();
  }

  // Initial data fetch
  onMount(() => {
    fetchData();
  });
</script>

<div class="w-full h-full flex flex-col">
  <!-- Time range selector -->
  <div class="flex justify-end mr-4 mt-5">
    <div class="flex space-x-1 rounded-lg bg-gray-100 p-1">
      <button
        class={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          timeRange === '7d' 
            ? 'bg-white shadow-sm text-gray-900' 
            : 'text-gray-500 hover:bg-gray-200/50'
        }`}
        onclick={() => handleTimeRangeChange('7d')}
      >
        7d
      </button>
      <button
        class={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          timeRange === '30d' 
            ? 'bg-white shadow-sm text-gray-900' 
            : 'text-gray-500 hover:bg-gray-200/50'
        }`}
        onclick={() => handleTimeRangeChange('30d')}
      >
        30d
      </button>
    </div>
  </div>

  <!-- Chart container -->
  <div class="relative flex-1 min-h-[300px]">
    {#if isLoading}
      <div class="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
        <div class="flex flex-col items-center">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p class="mt-2 text-sm text-gray-500">Loading chart data...</p>
        </div>
      </div>
    {:else if error}
      <div class="flex h-full flex-col items-center justify-center space-y-4 p-4 text-center">
        <p class="text-sm text-red-600">{error}</p>
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onclick={fetchData}
        >
          Retry
        </button>
      </div>
    {:else}
      <Chart 
        {options} 
        class="w-full"
      />
    {/if}
  </div>
</div>

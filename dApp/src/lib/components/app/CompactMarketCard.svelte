<script lang="ts">
	import type { Market } from '$lib/services/market/types';
	import { formatNumber } from '$lib/helpers/formatters';
	import { onMount } from 'svelte';
	import { ChevronLeft, RefreshCw } from 'lucide-svelte';

	// Props
	const { market, onChangeMarket = () => {} } = $props<{
		market: Market;
		onChangeMarket?: () => void;
	}>();

	// State for current price (will be fetched from price service)
	let currentPrice = $state<number | undefined>(undefined);
	let priceLoading = $state(true);

	// Derived values from the Market type
	const bullishStake = Number(market.totalStake1) / 1e18; // Convert from wei to ETH
	const bearishStake = Number(market.totalStake0) / 1e18; // Convert from wei to ETH
	const totalStake = bullishStake + bearishStake;
	const bullishPercentage = totalStake > 0 ? (bullishStake / totalStake) * 100 : 0;
	const bearishPercentage = totalStake > 0 ? (bearishStake / totalStake) * 100 : 0;

	// Mock price fetching (replace with actual price service call)
	onMount(async () => {
		try {
			// TODO: Replace with actual price service call
			// const price = await priceService.getCurrentPrice(market.assetSymbol);

			// Mock prices for now
			const mockPrices: Record<string, number> = {
				ETH: 2400.0,
				BTC: 44500.0,
				USDC: 1.0
			};

			currentPrice = mockPrices[market.assetSymbol] || market.priceThreshold;
			priceLoading = false;
		} catch (error) {
			console.error('Failed to fetch price:', error);
			currentPrice = market.priceThreshold; // Fallback to threshold
			priceLoading = false;
		}
	});
</script>

<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
	<!-- Header with market name and change button -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center space-x-3">
			<h3 class="text-lg font-semibold text-gray-900">{market.name}</h3>
			<span
				class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
			>
				{market.status}
			</span>
		</div>
		<button
			onclick={onChangeMarket}
			class="flex items-center space-x-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
		>
			<RefreshCw size={16} />
			<span>Change Market</span>
		</button>
	</div>

	<!-- Price information in a compact row -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center space-x-6">
			<div>
				<p class="text-xs text-gray-500">Current Price</p>
				<p class="text-lg font-semibold text-gray-900">
					{priceLoading ? '...' : `$${formatNumber(currentPrice)}`}
				</p>
			</div>
			<div>
				<p class="text-xs text-gray-500">Threshold</p>
				<p class="text-lg font-semibold text-gray-900">${formatNumber(market.priceThreshold)}</p>
			</div>
			<div>
				<p class="text-xs text-gray-500">Total Volume</p>
				<p class="text-lg font-semibold text-gray-900">{formatNumber(totalStake)} ETH</p>
			</div>
		</div>
		<div class="text-right">
			<p class="text-xs text-gray-500">Expires</p>
			<p class="text-sm font-medium text-gray-700">{market.expirationDisplay}</p>
		</div>
	</div>

	<!-- Conviction bar with percentages -->
	<div class="space-y-2">
		<div class="flex items-center justify-between text-sm">
			<span class="font-medium text-green-700">
				↑ Bullish {formatNumber(bullishPercentage, 1)}%
			</span>
			<span class="font-medium text-red-700">
				↓ Bearish {formatNumber(bearishPercentage, 1)}%
			</span>
		</div>

		<!-- Conviction bar -->
		<div class="h-2 overflow-hidden rounded-full bg-gray-200">
			<div
				class="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
				style="width: {bullishPercentage}%"
			></div>
		</div>
	</div>
</div>

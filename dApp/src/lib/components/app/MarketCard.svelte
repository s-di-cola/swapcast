<script lang="ts">
	import type { Market } from '$lib/services/market/types';
	import { formatNumber } from '$lib/helpers/formatters';
	import { onMount } from 'svelte';

	// Use SvelteKit 5 syntax for props
	const { 
		market, 
		onSelect = (id: string) => {}, 
		onViewDetails = (id: string) => {},
		selectButtonText = "Select Market"
	} = $props<{
		market: Market;
		onSelect?: (marketId: string) => void;
		onViewDetails?: (marketId: string) => void;
		selectButtonText?: string;
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
				'ETH': 2400.00,
				'BTC': 44500.00,
				'USDC': 1.00
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

<!-- Remove the clickable wrapper and events -->
<div class="market-card-wrapper">
	<div class="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-indigo-200 p-5">
		<!-- Market header with pair name and status -->
		<div class="flex justify-between items-center mb-3">
			<p class="text-sm text-gray-600 font-medium">{market.name} Market</p>
			<div class="flex items-center space-x-2">
				<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
					<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					{market.expirationDisplay}
				</span>
				{#if totalStake > 0}
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
						{formatNumber(totalStake)} ETH
					</span>
				{/if}
				<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
					{market.status}
				</span>
			</div>
		</div>

		<!-- Price information -->
		<div class="flex justify-between mb-5">
			<div>
				<p class="text-xs text-gray-500">Current Price</p>
				<p class="text-lg font-semibold text-gray-800">{priceLoading ? '...' : `$${formatNumber(currentPrice)}`}</p>
			</div>
			<div class="text-right">
				<p class="text-xs text-gray-500">Threshold</p>
				<p class="text-lg font-semibold text-gray-800">${formatNumber(market.priceThreshold)}</p>
			</div>
		</div>
		
		<!-- Above/Below threshold boxes -->
		<div class="flex space-x-2 mb-3">
			<div class="w-1/2 rounded-lg p-3" style="background-color: #ecfdf5">
				<div class="flex items-center justify-between mb-2">
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
						</svg>
						Above
					</span>
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
						{formatNumber(bullishStake)} ETH
					</span>
				</div>
				<div class="text-center text-sm font-bold text-green-800">{formatNumber(bullishPercentage, 1)}% conviction</div>
			</div>
			<div class="w-1/2 rounded-lg p-3" style="background-color: #fef2f2">
				<div class="flex items-center justify-between mb-2">
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
						</svg>
						Below
					</span>
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
						{formatNumber(bearishStake)} ETH
					</span>
				</div>
				<div class="text-center text-sm font-bold text-red-800">{formatNumber(bearishPercentage, 1)}% conviction</div>
			</div>
		</div>
		
		<!-- Sentiment bar -->
		<div class="h-1.5 rounded-full bg-gray-200 mb-2 overflow-hidden">
			<div class="h-full bg-indigo-600 rounded-full" style="width: {bullishPercentage}%"></div>
		</div>
		
		<!-- Footer with labels -->
		<div class="flex justify-between items-center text-xs mb-4">
			<div class="text-indigo-600 font-medium">Bullish</div>
			<div class="text-gray-500">Bearish</div>
		</div>
		
		<!-- Action buttons - side by side -->
		<div class="flex space-x-3">
			<!-- View Details button -->
			<button 
				class="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors border border-gray-300"
				onclick={() => onViewDetails(market.id)}
			>
				<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
				</svg>
				View Details
			</button>
			
			<!-- Select/Change Market button -->
			<button 
				class="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
				onclick={() => onSelect(market.id)}
			>
				<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={selectButtonText === 'Change Market' ? 'M11 17l-5-5m0 0l5-5m-5 5h12' : 'M13 7l5 5m0 0l-5 5m5-5H6'}></path>
				</svg>
				{selectButtonText}
			</button>
		</div>
	</div>
</div>
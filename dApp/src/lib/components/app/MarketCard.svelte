<script lang="ts">
	// Define formatNumber function directly in the component
	function formatNumber(value: number | undefined, decimals: number = 2): string {
		if (value === undefined || value === null) return '0';
		return value.toLocaleString('en-US', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}
	
	export let market: {
		id: string;
		description: string;
		currentPrice?: number;
		bullishStake?: number;
		bearishStake?: number;
		bullishPercentage: number;
		bearishPercentage: number;
		expirationDate?: string;
		isActive?: boolean;
	};
	
	export let onSelect: (marketId: string) => void;
	
	// Calculate total staked ETH
	$: totalStaked = (market.bullishStake || 0) + (market.bearishStake || 0);
	
	// Format expiration date - already formatted from the parent component
	$: formattedDate = market.expirationDate || '';
</script>

<div class="market-card-wrapper">
	<div class="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md transition-all duration-300 hover:shadow-lg p-5">
		<!-- Market header with pair name and status -->
		<div class="flex justify-between items-center mb-3">
			<p class="text-sm text-gray-600 font-medium">{market.description} Market</p>
			<div class="flex items-center space-x-2">
				{#if market.expirationDate}
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						{formattedDate}
					</span>
				{/if}
				{#if totalStaked > 0}
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
						<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
						{formatNumber(totalStaked)} ETH
					</span>
				{/if}
				{#if market.isActive}
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
						Active
					</span>
				{/if}
			</div>
		</div>

		<!-- Price information -->
		<div class="flex justify-between mb-5">
			<div>
				<p class="text-xs text-gray-500">Current Price</p>
				<p class="text-lg font-semibold text-gray-800">${market.currentPrice?.toFixed(2)}</p>
			</div>
			<div class="text-right">
				<p class="text-xs text-gray-500">Threshold</p>
				<p class="text-lg font-semibold text-gray-800">$2,400.00</p>
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
						{formatNumber(market.bullishStake || 0)} ETH
					</span>
				</div>
				<div class="text-center text-sm font-bold text-green-800">{market.bullishPercentage}% conviction</div>
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
						{formatNumber(market.bearishStake || 0)} ETH
					</span>
				</div>
				<div class="text-center text-sm font-bold text-red-800">{market.bearishPercentage}% conviction</div>
			</div>
		</div>
		
		<!-- Sentiment bar -->
		<div class="h-1.5 rounded-full bg-gray-200 mb-2 overflow-hidden">
			<div class="h-full bg-indigo-600 rounded-full" style="width: {market.bullishPercentage}%"></div>
		</div>
		
		<!-- Footer with labels -->
		<div class="flex justify-between items-center text-xs mb-4">
			<div class="text-indigo-600 font-medium">Bullish</div>
			<div class="text-gray-500">Bearish</div>
		</div>
		
		<!-- Select button -->
		<button 
			class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
			on:click={() => onSelect(market.id)}
		>
			Select Market
		</button>
	</div>
</div>

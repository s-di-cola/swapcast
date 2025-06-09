<script lang="ts">
	import { page } from '$app/stores';
	
	// Get the market ID from the URL
	$: marketId = $page.params.id;
</script>

<div class="max-w-6xl mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">Market Details</h1>
		<p class="text-gray-600">Market ID: {marketId}</p>
	</div>

	<!-- Placeholder for future components -->
	<div class="space-y-6">
		<!-- Market Status Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-4">
			<h2 class="text-lg font-semibold mb-2">Market Status</h2>
			<p class="text-gray-500">Coming soon...</p>
		</div>

		<!-- Opposition Summary Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-4">
			<h2 class="text-lg font-semibold mb-2">Opposition Summary</h2>
			<p class="text-gray-500">Bullish vs Bearish data will appear here...</p>
		</div>

		<!-- Your Positions Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-4">
			<h2 class="text-lg font-semibold mb-2">Your Positions</h2>
			<p class="text-gray-500">Your bets in this market will appear here...</p>
		</div>

		<!-- Transaction History Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-4">
			<h2 class="text-lg font-semibold mb-2">Transaction History</h2>
			<p class="text-gray-500">Transaction history will appear here...</p>
		</div>

		<!-- Claim Rewards Section -->
		<div class="bg-white rounded-lg border border-gray-200 p-4">
			<h2 class="text-lg font-semibold mb-2">Claim Rewards</h2>
			<p class="text-gray-500">Claimable rewards will appear here...</p>
		</div>
	</div>
</div> 
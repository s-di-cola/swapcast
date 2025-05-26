<script lang="ts">
    import {Button, Modal, Spinner} from 'flowbite-svelte';
    import {ChartPieSolid, ClockSolid, ExclamationCircleSolid, XSolid} from 'flowbite-svelte-icons';
    import {getMarketDetails, type Market} from '$lib/services/market/marketService';

    export let showModal = false;
	export let marketId: string | null = null;
	export let onClose: () => void;

	let marketToDisplay: Market | null = null;
	let isLoading = true;
	let errorMsg = '';

	// Format currency values
	function formatCurrency(value: string | number): string {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (num >= 1_000_000) {
			return `$${(num / 1_000_000).toFixed(2)}M`;
		} else if (num >= 1_000) {
			return `$${(num / 1_000).toFixed(2)}K`;
		} else {
			return `$${num.toFixed(2)}`;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'Open':
				return 'bg-emerald-100 text-emerald-800';
			case 'Expired':
				return 'bg-yellow-100 text-yellow-800';
			case 'Resolved':
				return 'bg-gray-100 text-gray-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	// Helper function to get Etherscan link
	function getEtherscanLink(address: string) {
		return `https://etherscan.io/address/${address}`;
	}

	// Fetch market data
	async function fetchMarketData() {
		if (!marketId) {
			errorMsg = 'Market ID is missing.';
			isLoading = false;
			return;
		}

		try {
			isLoading = true;
			errorMsg = '';
			const data = await getMarketDetails(marketId);

			if (data && data.exists) {
				marketToDisplay = data;
			} else {
				errorMsg = 'Market not found or data is invalid.';
			}
		} catch (err) {
			console.error(`Error fetching market details for ID ${marketId}:`, err);
			errorMsg = 'Failed to load market details. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	// Watch for changes to marketId and showModal
	$: if (showModal && marketId) {
		fetchMarketData();
	}
</script>

<Modal bind:open={showModal} size="xl" autoclose={false} class="w-full max-w-4xl" outsideclose>
	<div class="mb-4 flex items-center justify-between border-b pb-4">
		<h3 class="text-xl font-semibold text-gray-900">
			{#if isLoading}
				Loading Market Details...
			{:else if marketToDisplay}
				{marketToDisplay.name || `Market #${marketToDisplay.id}`}
			{:else}
				Market Details
			{/if}
		</h3>
		<Button
			class="ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900"
			on:click={() => onClose()}
		>
			<XSolid class="h-5 w-5" />
		</Button>
	</div>

	{#if isLoading}
		<div class="flex flex-col items-center justify-center py-12">
			<Spinner size="12" />
			<p class="mt-4 text-gray-600">Loading market details...</p>
		</div>
	{:else if errorMsg}
		<div
			class="flex items-center rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700"
		>
			<ExclamationCircleSolid class="mr-3 h-6 w-6 text-red-600" />
			<div>
				<h3 class="text-lg font-semibold">Error Loading Market</h3>
				<p>{errorMsg}</p>
			</div>
		</div>
	{:else if marketToDisplay}
		<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- Market Summary -->
			<div class="rounded-lg bg-gray-50 p-4">
				<div class="mb-3 flex items-center">
					<ChartPieSolid class="mr-2 h-5 w-5 text-gray-600" />
					<h4 class="text-lg font-semibold text-gray-700">Market Summary</h4>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="text-gray-600">Asset Pair:</span>
						<span class="font-semibold">{marketToDisplay.assetPair}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Status:</span>
						<span
							class="rounded-full px-2.5 py-0.5 text-xs font-semibold {getStatusColor(
								marketToDisplay.status
							)}"
						>
							{marketToDisplay.status}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Price Threshold:</span>
						<span class="font-semibold">${formatCurrency(marketToDisplay.priceThreshold)}</span>
					</div>
				</div>
			</div>

			<!-- Financial Details -->
			<div class="rounded-lg bg-gray-50 p-4">
				<div class="mb-3 flex items-center">
					<div class="mr-2 flex h-5 w-5 items-center justify-center text-gray-600">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h4 class="text-lg font-semibold text-gray-700">Financial Details</h4>
				</div>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="text-gray-600">Total Stake:</span>
						<span class="font-semibold">{formatCurrency(marketToDisplay.totalStake)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Market Resolved:</span>
						<span class="font-semibold">{marketToDisplay.resolved ? 'Yes' : 'No'}</span>
					</div>
					{#if marketToDisplay.resolved && marketToDisplay.winningOutcome !== undefined}
						<div class="flex justify-between">
							<span class="text-gray-600">Winning Outcome:</span>
							<span class="font-semibold"
								>{marketToDisplay.winningOutcome === 0 ? 'Below/Equal' : 'Above'}</span
							>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Time Information -->
		<div class="mb-6 rounded-lg bg-gray-50 p-4">
			<div class="mb-3 flex items-center">
				<ClockSolid class="mr-2 h-5 w-5 text-gray-600" />
				<h4 class="text-lg font-semibold text-gray-700">Time Information</h4>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between">
					<span class="text-gray-600">Expires In:</span>
					<span class="font-semibold">{marketToDisplay.expirationDisplay}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-600">Expiration Time:</span>
					<span class="font-semibold"
						>{new Date(marketToDisplay.expirationTime * 1000).toLocaleString()}</span
					>
				</div>
			</div>
		</div>

		<!-- Price Aggregator -->
		<div class="rounded-lg bg-gray-50 p-4">
			<div class="mb-3 flex items-center">
				<h4 class="text-lg font-semibold text-gray-700">Price Aggregator</h4>
			</div>
			<div class="overflow-hidden">
				<a
					href={getEtherscanLink(marketToDisplay.priceAggregator)}
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm break-all text-blue-600 transition-colors hover:text-blue-800"
				>
					{marketToDisplay.priceAggregator}
				</a>
			</div>
		</div>

		<!-- Chart Visualization -->
		<div class="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h4 class="text-lg font-semibold text-gray-700">Price Chart</h4>
				<div class="flex space-x-2">
					<button class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600"
						>24h</button
					>
					<button class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
						>7d</button
					>
					<button class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
						>30d</button
					>
				</div>
			</div>
			<div class="relative h-64">
				<!-- SVG Chart Visualization -->
				<svg class="h-full w-full" viewBox="0 0 800 300" preserveAspectRatio="none">
					<!-- Grid Lines -->
					<g class="grid-lines">
						<line x1="0" y1="0" x2="800" y2="0" stroke="#f3f4f6" stroke-width="1" />
						<line x1="0" y1="75" x2="800" y2="75" stroke="#f3f4f6" stroke-width="1" />
						<line x1="0" y1="150" x2="800" y2="150" stroke="#f3f4f6" stroke-width="1" />
						<line x1="0" y1="225" x2="800" y2="225" stroke="#f3f4f6" stroke-width="1" />
						<line x1="0" y1="300" x2="800" y2="300" stroke="#f3f4f6" stroke-width="1" />
					</g>

					<!-- Price Threshold Line -->
					<line
						x1="0"
						y1="150"
						x2="800"
						y2="150"
						stroke="#ef4444"
						stroke-width="2"
						stroke-dasharray="5,5"
					/>

					<!-- Price Chart Line -->
					<path
						d="M0,200 C50,180 100,220 150,190 C200,160 250,140 300,120 C350,100 400,80 450,90 C500,100 550,130 600,110 C650,90 700,70 750,60 L800,40"
						fill="none"
						stroke="#6366f1"
						stroke-width="3"
						stroke-linejoin="round"
					/>

					<!-- Area under the line -->
					<path
						d="M0,200 C50,180 100,220 150,190 C200,160 250,140 300,120 C350,100 400,80 450,90 C500,100 550,130 600,110 C650,90 700,70 750,60 L800,40 L800,300 L0,300 Z"
						fill="url(#gradient)"
						opacity="0.2"
					/>

					<!-- Gradient definition -->
					<defs>
						<linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#6366f1" stop-opacity="0.8" />
							<stop offset="100%" stop-color="#6366f1" stop-opacity="0.1" />
						</linearGradient>
					</defs>
				</svg>

				<!-- Price Labels -->
				<div
					class="absolute top-0 right-0 flex h-full flex-col justify-between py-2 pr-2 text-xs text-gray-500"
				>
					<div>$2,500</div>
					<div>$2,000</div>
					<div>$1,500</div>
					<div>$1,000</div>
					<div>$500</div>
				</div>

				<!-- Threshold Label -->
				<div
					class="absolute top-1/2 left-2 -translate-y-1/2 transform text-xs font-medium text-red-500"
				>
					Threshold: ${marketToDisplay?.priceThreshold || '0'}
				</div>
			</div>

			<div class="mt-2 flex justify-between text-xs text-gray-500">
				<span>May 6</span>
				<span>May 9</span>
				<span>May 12</span>
				<span>May 13</span>
			</div>
		</div>

		<!-- Transaction History Table -->
		<div class="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
			<h4 class="mb-4 text-lg font-semibold text-gray-700">Transaction History</h4>

			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-100">
					<thead>
						<tr>
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Transaction</th
							>
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>User</th
							>
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Prediction</th
							>
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Amount</th
							>
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Time</th
							>
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>Status</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 bg-white">
						<!-- Sample transaction data (would be replaced with real data) -->
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-sm whitespace-nowrap text-blue-600 hover:text-blue-800">
								<a
									href="https://etherscan.io/tx/0x1234..."
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center"
								>
									0x1234...5678
									<svg
										class="ml-1 h-3 w-3"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										></path>
									</svg>
								</a>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">0xabcd...ef12</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span class="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
									>Bullish</span
								>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">0.5 ETH</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-500">13 May 2025, 14:32</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span
									class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
									>Confirmed</span
								>
							</td>
						</tr>
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-sm whitespace-nowrap text-blue-600 hover:text-blue-800">
								<a
									href="https://etherscan.io/tx/0x5678..."
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center"
								>
									0x5678...9abc
									<svg
										class="ml-1 h-3 w-3"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										></path>
									</svg>
								</a>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">0xdef0...1234</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span class="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
									>Bearish</span
								>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">0.25 ETH</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-500">13 May 2025, 14:28</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span
									class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
									>Confirmed</span
								>
							</td>
						</tr>
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-sm whitespace-nowrap text-blue-600 hover:text-blue-800">
								<a
									href="https://etherscan.io/tx/0x9abc..."
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center"
								>
									0x9abc...def0
									<svg
										class="ml-1 h-3 w-3"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										></path>
									</svg>
								</a>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">0x5678...9abc</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span class="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
									>Bullish</span
								>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">1.0 ETH</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-500">13 May 2025, 14:15</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span
									class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
									>Confirmed</span
								>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="mt-4 flex items-center justify-between">
				<div class="text-sm text-gray-500">Showing 3 of 24 transactions</div>
				<div class="flex space-x-2">
					<button
						class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
					>
						Previous
					</button>
					<button
						class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
					>
						Next
					</button>
				</div>
			</div>
		</div>
	{/if}

	<svelte:fragment slot="footer">
		<Button color="alternative" on:click={() => onClose()}>Close</Button>
		{#if marketToDisplay}
			<Button color="blue" on:click={() => fetchMarketData()}>Refresh Data</Button>
		{/if}
	</svelte:fragment>
</Modal>

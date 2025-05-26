<script lang="ts">
    import {onMount} from 'svelte';

    interface Token {
		name: string;
		address: string;
		symbol: string;
		decimals: number;
		chainId: number;
		logoURI?: string;
	}

	// Admin page logic for creating markets
	let marketName: string = '';
	let tokenA_address: string = '';
	let tokenB_address: string = '';
	let predictionMarketType: 'price_binary' | 'price_range' = 'price_binary'; // Example type
	let targetPrice: number | null = null;
	let lowerBoundPrice: number | null = null;
	let upperBoundPrice: number | null = null;
	let durationHours: number = 24;
	let resolutionSource: string = ''; // e.g., API endpoint, oracle address

	let tokenList: Token[] = [];
	let isLoadingTokens: boolean = true;
	let errorLoadingTokens: string | null = null;

	onMount(async () => {
		try {
			const response = await fetch(
				'https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/mainnet.json'
			);
			if (!response.ok) {
				throw new Error(`Failed to fetch token list: ${response.statusText}`);
			}
			const data = await response.json();
			// Assuming the data is an array of tokens. Adjust if the structure is different (e.g. data.tokens)
			tokenList = data.filter((token: Token) => token.chainId === 1); // Filter for mainnet if not already filtered
		} catch (err: any) {
			console.error('Error fetching token list:', err);
			errorLoadingTokens = err.message || 'Could not load token list.';
		}
		isLoadingTokens = false;
	});

	let isSubmitting = false;
	let submissionError: string | null = null;
	let submissionSuccess = false;
	let createdMarketId: string | null = null;

	async function handleSubmit() {
		// Validate form data
		if (!marketName || !tokenA_address || !tokenB_address || !durationHours || !resolutionSource) {
			submissionError = 'Please fill in all required fields';
			return;
		}

		if (predictionMarketType === 'price_binary' && !targetPrice) {
			submissionError = 'Please enter a target price for binary markets';
			return;
		}

		if (predictionMarketType === 'price_range' && (!lowerBoundPrice || !upperBoundPrice)) {
			submissionError = 'Please enter both lower and upper bound prices for range markets';
			return;
		}

		// Reset submission state
		isSubmitting = true;
		submissionSuccess = false;
		submissionError = null;

		try {
			// Prepare the request payload
			const payload: any = {
				marketName,
				tokenA_address,
				tokenB_address,
				predictionMarketType,
				durationHours: parseInt(durationHours.toString()),
				resolutionSource
			};

			// Add market type specific fields
			if (predictionMarketType === 'price_binary' && targetPrice !== null) {
				payload.targetPrice = parseFloat(targetPrice.toString());
			} else if (
				predictionMarketType === 'price_range' &&
				lowerBoundPrice !== null &&
				upperBoundPrice !== null
			) {
				payload.lowerBoundPrice = parseFloat(lowerBoundPrice.toString());
				payload.upperBoundPrice = parseFloat(upperBoundPrice.toString());
			}

			console.log('Submitting market creation request:', payload);

			// Send the request to the API
			const response = await fetch('/api/markets', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.details || result.error || 'Failed to create market');
			}

			// Handle successful response
			submissionSuccess = true;
			createdMarketId = result.marketId;
			console.log('Market created successfully:', result);

			// Optional: Reset form fields after successful submission
			// resetForm();
		} catch (error: any) {
			console.error('Error creating market:', error);
			submissionError = error.message || 'An unexpected error occurred';
		} finally {
			isSubmitting = false;
		}
	}

	// Reset form fields
	function resetForm() {
		marketName = '';
		tokenA_address = '';
		tokenB_address = '';
		predictionMarketType = 'price_binary';
		targetPrice = null;
		lowerBoundPrice = null;
		upperBoundPrice = null;
		durationHours = 24;
		resolutionSource = '';
	}

	// Update form fields based on market type
	$: {
		if (predictionMarketType === 'price_binary') {
			lowerBoundPrice = null;
			upperBoundPrice = null;
		} else if (predictionMarketType === 'price_range') {
			targetPrice = null;
		}
	}
</script>

<div
	class="mx-auto min-h-screen max-w-3xl bg-gray-50 p-6 md:p-10"
	style="background-color: #f9fafb;"
>
	<header class="mb-10">
		<a href="/" class="text-emerald-600 hover:text-emerald-700">&larr; Back to Main Site</a>
		<h1 class="mt-4 text-4xl font-bold text-gray-800">Create New Prediction Market</h1>
		<p class="text-sm text-gray-500">
			Fill in the details below to launch a new market. This panel is for creation only.
		</p>
	</header>

	<form
		on:submit|preventDefault={handleSubmit}
		class="space-y-8 rounded-xl border border-gray-200 bg-white p-8 shadow-xl"
	>
		<div>
			<label for="marketName" class="mb-1 block text-sm font-semibold text-gray-700"
				>Market Name / Question</label
			>
			<input
				type="text"
				id="marketName"
				bind:value={marketName}
				required
				class="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
				placeholder="e.g., Will ETH/USDC price be above $2500 in 24h?"
			/>
			<p class="mt-1 text-xs text-gray-500">A clear, unambiguous question for the market.</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label for="tokenA" class="mb-1 block text-sm font-semibold text-gray-700"
					>Token A (Base)</label
				>
				{#if isLoadingTokens}
					<p class="text-sm text-gray-500">Loading token list...</p>
				{:else if errorLoadingTokens}
					<p class="text-sm text-red-500">Error: {errorLoadingTokens}</p>
					<p class="mt-1 text-xs text-gray-500">
						Please ensure you are connected to the internet. You may need to manually enter
						addresses.
					</p>
				{:else}
					<select
						id="tokenA"
						bind:value={tokenA_address}
						required
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
					>
						<option value="" disabled>Select Token A</option>
						{#each tokenList as token (token.address)}
							<option value={token.address}>{token.symbol} ({token.name})</option>
						{/each}
					</select>
				{/if}
				<p class="mt-1 text-xs text-gray-500">Select the first token of the pair.</p>
			</div>
			<div>
				<label for="tokenB" class="mb-1 block text-sm font-semibold text-gray-700"
					>Token B (Quote)</label
				>
				{#if isLoadingTokens}
					<p class="text-sm text-gray-500">Loading token list...</p>
				{:else if errorLoadingTokens}
					<!-- Error message handled with Token A -->
					<p class="text-sm text-gray-500">Token list status reflected above.</p>
				{:else}
					<select
						id="tokenB"
						bind:value={tokenB_address}
						required
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
					>
						<option value="" disabled>Select Token B</option>
						{#each tokenList as token (token.address)}
							{#if token.address !== tokenA_address}
								<!-- Prevent selecting the same token -->
								<option value={token.address}>{token.symbol} ({token.name})</option>
							{/if}
						{/each}
					</select>
				{/if}
				<p class="mt-1 text-xs text-gray-500">
					Select the second token of the pair. Cannot be the same as Token A.
				</p>
			</div>
		</div>

		<div>
			<label for="predictionMarketType" class="mb-1 block text-sm font-semibold text-gray-700"
				>Market Type</label
			>
			<select
				id="predictionMarketType"
				bind:value={predictionMarketType}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
			>
				<option value="price_binary">Binary Price Prediction (Above/Below Target)</option>
				<option value="price_range">Price Range Prediction (Within Range Yes/No)</option>
				<!-- Add other market types as needed -->
			</select>
			<p class="mt-1 text-xs text-gray-500">Choose the structure of the prediction market.</p>
		</div>

		{#if predictionMarketType === 'price_binary'}
			<div>
				<label for="targetPrice" class="mb-1 block text-sm font-semibold text-gray-700"
					>Target Price</label
				>
				<input
					type="number"
					id="targetPrice"
					bind:value={targetPrice}
					required
					step="any"
					class="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
					placeholder="e.g., 2500"
				/>
				<p class="mt-1 text-xs text-gray-500">
					The price point for the binary prediction (e.g., will price be above/below this value?).
				</p>
			</div>
		{/if}

		{#if predictionMarketType === 'price_range'}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div>
					<label for="lowerBoundPrice" class="mb-1 block text-sm font-semibold text-gray-700"
						>Lower Bound Price</label
					>
					<input
						type="number"
						id="lowerBoundPrice"
						bind:value={lowerBoundPrice}
						required
						step="any"
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
						placeholder="e.g., 2400"
					/>
					<p class="mt-1 text-xs text-gray-500">The lower end of the price range.</p>
				</div>
				<div>
					<label for="upperBoundPrice" class="mb-1 block text-sm font-semibold text-gray-700"
						>Upper Bound Price</label
					>
					<input
						type="number"
						id="upperBoundPrice"
						bind:value={upperBoundPrice}
						required
						step="any"
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
						placeholder="e.g., 2600"
					/>
					<p class="mt-1 text-xs text-gray-500">The upper end of the price range.</p>
				</div>
			</div>
		{/if}

		<div>
			<label for="durationHours" class="mb-1 block text-sm font-semibold text-gray-700"
				>Prediction Duration (Hours from Creation)</label
			>
			<input
				type="number"
				id="durationHours"
				bind:value={durationHours}
				required
				min="1"
				class="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
				placeholder="24"
			/>
			<p class="mt-1 text-xs text-gray-500">
				How long the market will be open for predictions and when it resolves.
			</p>
		</div>

		<div>
			<label for="resolutionSource" class="mb-1 block text-sm font-semibold text-gray-700"
				>Resolution Source / Oracle Details</label
			>
			<input
				type="text"
				id="resolutionSource"
				bind:value={resolutionSource}
				required
				class="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm transition-shadow focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
				placeholder="e.g., Chainlink ETH/USD price feed address, or specific API endpoint"
			/>
			<p class="mt-1 text-xs text-gray-500">
				How the market outcome will be definitively determined.
			</p>
		</div>

		<!-- Consider adding fields for: target price (for binary), price range (for range), initial liquidity, fees, etc. -->

		<!-- Success/Error Messages -->
		{#if submissionSuccess}
			<div class="mt-4 rounded-lg border border-green-400 bg-green-100 p-4 text-green-700">
				<p class="font-medium">Market created successfully!</p>
				<p class="mt-1 text-sm">Market ID: <span class="font-mono">{createdMarketId}</span></p>
			</div>
		{/if}

		{#if submissionError}
			<div class="mt-4 rounded-lg border border-red-400 bg-red-100 p-4 text-red-700">
				<p class="font-medium">Error creating market</p>
				<p class="mt-1 text-sm">{submissionError}</p>
			</div>
		{/if}

		<div class="pt-4">
			<button
				type="submit"
				class="text-md flex w-full justify-center rounded-lg border border-transparent bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3.5 font-medium text-white shadow-lg transition-all hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:outline-none"
				disabled={isSubmitting}
			>
				{#if isSubmitting}
					<span class="mr-2 inline-block animate-spin">↻</span> Creating Market...
				{:else}
					Create New Market
				{/if}
			</button>
		</div>
	</form>
</div>

<style>
	/* Scoped styles for the admin page can go here if needed */
</style>

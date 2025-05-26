<script lang="ts">
	import {onMount, createEventDispatcher} from 'svelte';
	import {Button, Helper, Input, Label, Modal, Select, Spinner} from 'flowbite-svelte';
	import {toastStore} from '$lib/stores/toastStore';
	import {createMarket, getOrCreateMarketPool} from '$lib/services/market/marketService';
	import type {Address} from 'viem';
	import {PUBLIC_SWAPCASTHOOK_ADDRESS} from "$env/static/public";
	import {getTickSpacing} from "$lib/services/market/helpers";
	import {sortTokens} from "$lib/services/market/poolService";
	import {appKit} from "$lib/configs/wallet.config";
	
	// Setup event dispatcher
	const dispatch = createEventDispatcher<{
		marketCreated: { marketId: string, name: string };
		marketCreationFailed: { error: string };
	}>();

	export let showModal = false;
	export let onClose: () => void;

	interface Token {
		name: string;
		address: Address;
		symbol: string;
		decimals: number;
		chainId: number;
		logoURI?: string;
	}

	let marketName: string = '';
	let tokenA_address: string = '';
	let tokenB_address: string = '';
	let feeTier: number = 3000;
	let predictionMarketType: 'price_binary' = 'price_binary';
	let targetPriceStr: string = '';
	let expirationDay: string = "";
	let expirationTime: string = '17:00'; // Default to 5 PM

	let tokenList: Token[] = [];
	let isLoadingTokens: boolean = true;
	let errorLoadingTokens: string | null = null;

	// Toast notifications are now handled by the global toast store

	let isSubmitting = false;

	let modalElement: HTMLElement | null = null;
	let minExpirationDate: Date | undefined;

	onMount(async () => {
		try {
			const response = await fetch(
				'https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/mainnet.json'
			);
			if (!response.ok) {
				throw new Error(`Failed to fetch token list: ${response.statusText}`);
			}
			const data = await response.json();
			tokenList = data.filter((token: Token) => token.chainId === 1);
		} catch (err: any) {
			console.error('Error fetching token list:', err);
			errorLoadingTokens = err.message || 'Could not load token list.';
		} finally {
			isLoadingTokens = false;
		}

		// Initialize the minimum expiration date
		try {
			const today = new Date();
			minExpirationDate = new Date(today);
			minExpirationDate.setDate(today.getDate() + 1);
			minExpirationDate.setHours(0, 0, 0, 0); // Start of tomorrow

			// Set a default expiration day
			if (!expirationDay) {
				expirationDay = minExpirationDate.toISOString().split('T')[0];
			}
		} catch (err) {
			console.error('Error initializing dates:', err);
		}
	});

	function openTimePicker() {
		const timeInput = document.getElementById('expirationTime') as HTMLInputElement | null;
		if (timeInput && typeof timeInput.showPicker === 'function') {
			try {
				timeInput.showPicker();
			} catch (error) {
				console.error('Failed to execute showPicker():', error);
				// Fallback to focus if showPicker fails or is not supported
				timeInput.focus();
			}
		} else if (timeInput) {
			timeInput.focus(); // Fallback for browsers not supporting showPicker
		}
	}

	async function handleSubmit(event: Event) {
		// In the handleSubmit function of CreateMarketModal.svelte
		try {
			const { tokenA, tokenB } = getValidatedTokens();
			if (!tokenA || !tokenB) return;

			const priceFeedKey = `${tokenA.symbol}/${tokenB.symbol}`;
			const expirationDateTime = calculateExpirationDateTime();
			
			// If expirationDateTime is null, validation failed
			if (expirationDateTime === null) {
				return;
			}

			// Step 1: Create or verify pool exists
			console.log('[DEBUG] Creating/checking pool with:', {
				tokenA: tokenA.address,
				tokenB: tokenB.address,
				feeTier,
			});

			const poolResult = await getOrCreateMarketPool(
					tokenA.address,
					tokenB.address,
					feeTier,
			);

			console.log('Pool result:', poolResult);
			if (!poolResult.poolExists && !poolResult.poolCreated) {
				showToast('error', poolResult.error || 'Failed to create or find the required pool.');
				return;
			}

			// Step 2: Create the market
			console.log('Proceeding to create market');

			// Get the required parameters for createMarket
			const tokens = sortTokens(tokenA.address, tokenB.address, Number(appKit.getChainId()));
			const tickSpacing = getTickSpacing(feeTier);

			// Prepare the pool key
			const poolKey = {
				currency0: tokens[0].address as `0x${string}`,
				currency1: tokens[1].address as `0x${string}`,
				fee: feeTier,
				tickSpacing: tickSpacing,
				hooks: PUBLIC_SWAPCASTHOOK_ADDRESS as `0x${string}`
			};

			const marketResult = await createMarket(
					marketName,
					priceFeedKey,
					expirationDateTime,
					targetPriceStr,
					poolKey
			);

			console.log('Market result:', marketResult);
			if (!marketResult.success) {
				showToast('error', marketResult.message);
				return;
			}

			showToast('success', 'Market and pool created successfully!');
			
			// Dispatch success event with market details
			dispatch('marketCreated', {
				marketId: marketResult.marketId || '0',
				name: marketName
			});
			
			resetForm();
			showModal = false;

		} catch (error: any) {
			console.error('Error creating market:', error);
			const errorMessage = `Failed to create market: ${error.message || 'Unknown error'}`;
			showToast('error', errorMessage);
			
			// Dispatch error event
			dispatch('marketCreationFailed', { error: errorMessage });
		} finally {
			isSubmitting = false;
		}
	}

	// Helper functions to simplify the main function
	function validateForm() {
		if (!targetPriceStr || !tokenA_address || !tokenB_address || !marketName || !feeTier || !expirationDay) {
			showToast('error', 'Please fill in all required fields, including the expiration date.');
			return false;
		}

		const selectedExpirationDate = new Date(expirationDay +1);
		selectedExpirationDate.setHours(0, 0, 0, 0);

		if (selectedExpirationDate < minExpirationDate!) {
			showToast('error', 'Expiration date must be tomorrow or later.');
			return false;
		}

		return true;
	}

	function getValidatedTokens() {
		const tokenA = tokenList.find((t) => t.address === tokenA_address);
		const tokenB = tokenList.find((t) => t.address === tokenB_address);

		if (!tokenA || !tokenB || !tokenA.address || !tokenB.address) {
			showToast('error', 'Please select valid tokens for both Token A and Token B.');
			isSubmitting = false;
			return {};
		}

		// Additional check: addresses must look like 0x... and not be empty
		if (!/^0x[a-fA-F0-9]{40}$/.test(tokenA.address) || !/^0x[a-fA-F0-9]{40}$/.test(tokenB.address)) {
			showToast('error', 'Token addresses are invalid.');
			isSubmitting = false;
			return {};
		}

		return { tokenA, tokenB };
	}

	function calculateExpirationDateTime() {
		const selectedExpirationDate = new Date(expirationDay);
		selectedExpirationDate.setHours(0, 0, 0, 0);

		const [hoursStr, minutesStr] = expirationTime.split(':');
		const hours = parseInt(hoursStr, 10);
		const minutes = parseInt(minutesStr, 10);

		selectedExpirationDate.setHours(hours, minutes, 0, 0);

		// Ensure the expiration date is in the future
		if (selectedExpirationDate.getTime() <= Date.now()) {
			showToast('error', 'Expiration time must be in the future.');
			isSubmitting = false;
			return null;
		}

		// Return Unix timestamp in seconds
		return Math.floor(selectedExpirationDate.getTime() / 1000);
	}

	function showToast(type: 'success' | 'error', message: string) {
		if (type === 'success') {
			toastStore.success(message);
		} else {
			toastStore.error(message);
			isSubmitting = false;
		}
	}

	// No longer needed with the global toast store
	function resetToastState() {
		// Toast state is now managed by the toast store
	}

	function resetForm() {
		marketName = '';
		tokenA_address = '';
		tokenB_address = '';
		targetPriceStr = '';
		expirationDay = "";
		expirationTime = '17:00';
		feeTier = 3000;
	}

	function handleClose() {
		resetForm();
		if (onClose) onClose();
	}

	function handleCancelClick() {
		showModal = false;
		if (onClose) onClose();
	}
</script>

<!-- Toast notifications are now handled by the global ToastContainer component in the layout -->

<Modal
	title="Create New Prediction Market"
	bind:open={showModal}
	onclose={handleClose}
	autoclose={false}
	size="lg"
>
	<form onsubmit={handleSubmit} autocomplete="off" class="max-h-[80vh] space-y-4 overflow-y-auto">
		<!-- Section 1: Market Definition -->
		<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Market Definition</h3>
			<div>
				<Label for="marketName" class="mb-2 block">Market Name / Question</Label>
				<Input
					type="text"
					id="marketName"
					bind:value={marketName}
					required
					placeholder="e.g., Will ETH/USDC price be above $2500 in 24h?"
				/>
				<Helper class="mt-1">A clear, unambiguous question for the market.</Helper>
			</div>
		</div>

		<!-- Section 2: Token & Pool Setup -->
		<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Token & Pool Setup</h3>
			<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<Label for="tokenA" class="mb-2 block">Token A (Base)</Label>
					{#if isLoadingTokens}
						<Input disabled placeholder="Loading tokens..." />
					{:else if errorLoadingTokens}
						<Input disabled placeholder="Error loading tokens" />
						<Helper color="red" class="mt-1">{errorLoadingTokens}</Helper>
					{:else}
						<Select
							id="tokenA"
							bind:value={tokenA_address}
							required
							class="bg-white dark:bg-gray-800"
						>
							<option value="" disabled>Select Token A</option>
							{#each tokenList as token (token.address)}
								<option value={token.address}>{token.symbol} ({token.name})</option>
							{/each}
						</Select>
					{/if}
					<Helper class="mt-1">Select the first token of the pair.</Helper>
				</div>
				<div>
					<Label for="tokenB" class="mb-2 block">Token B (Quote)</Label>
					{#if isLoadingTokens}
						<Input disabled placeholder="Loading tokens..." />
					{:else if errorLoadingTokens}
						<Input disabled placeholder="Error loading tokens" />
						<Helper color="red" class="mt-1">{errorLoadingTokens}</Helper>
					{:else}
						<Select
							id="tokenB"
							bind:value={tokenB_address}
							required
							class="bg-white dark:bg-gray-800"
						>
							<option value="" disabled>Select Token B</option>
							{#each tokenList as token (token.address)}
								<option value={token.address}>{token.symbol} ({token.name})</option>
							{/each}
						</Select>
					{/if}
					<Helper class="mt-1">Select the second token (price is relative to this token).</Helper>
				</div>
			</div>

			<div>
				<Label for="feeTier" class="mb-2 block">Fee Tier</Label>
				<Select id="feeTier" bind:value={feeTier} required class="bg-white dark:bg-gray-800">
					<option value="" disabled>Select Fee Tier</option>
					<option value={100}>0.01%</option>
					<option value={500}>0.05%</option>
					<option value={3000}>0.30%</option>
					<option value={10000}>1.00%</option>
				</Select>
				<Helper class="mt-1">Select the fee tier for the Uniswap v4 pool.</Helper>
			</div>
		</div>

		<!-- Section 3: Prediction Details -->
		<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Prediction Details</h3>
			<div>
				<Label for="targetPrice" class="mb-2 block">Target Price (in Token B)</Label>
				<Input
					type="number"
					id="targetPrice"
					bind:value={targetPriceStr}
					required
					placeholder="e.g., 2500"
					step="any"
				/>
				<Helper class="mt-1">The price threshold for the prediction.</Helper>
			</div>
		</div>

		<!-- Section 4: Market Timing -->
		<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Market Timing</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<Label for="expirationDate" class="mb-2 block">Expiration Date</Label>
					<Input
						type="date"
						id="expirationDate"
						bind:value={expirationDay}
						class="w-full bg-gray-50 dark:bg-gray-700 p-2.5 text-sm"
						min={minExpirationDate ? minExpirationDate.toISOString().split('T')[0] : ''}
						required
						onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
					/>
					<Helper class="mt-1">Select the market's expiration date (your local timezone).</Helper>
				</div>
				<div>
					<Label for="expirationTime" class="mb-2 block">Expiration Time</Label>
					<div
						onclick={openTimePicker}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') openTimePicker();
						}}
						class="w-full cursor-pointer"
						role="button"
						aria-label="Set expiration time"
						tabindex="0"
					>
						<Input type="time" id="expirationTime" bind:value={expirationTime} required onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
					</div>
					<Helper class="mt-1">Set the market's expiration time (your local timezone).</Helper>
				</div>
			</div>
		</div>

		<div class="mt-6 flex justify-end border-t pt-4 dark:border-gray-700">
			<Button type="button" color="alternative" onclick={handleCancelClick} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button type="submit" color="green" class="ml-3" disabled={isSubmitting}>
				{#if isSubmitting}
					<Spinner class="mr-2" size="4" color="red" /> Creating...
				{:else}
					Create Market
				{/if}
			</Button>
		</div>
	</form>
</Modal>

<style>
	@keyframes slideDown {
		from {
			transform: translateY(-100%) translateX(-50%);
			opacity: 0;
		}
		to {
			transform: translateY(0) translateX(-50%);
			opacity: 1;
		}
	}

	@keyframes progress {
		from { width: 0%; }
		to { width: 100%; }
	}

	:global(.animate-slide-down) {
		animation: slideDown 0.2s ease-out;
	}

	:global(.shadow-stripe) {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
	}

	:global(.progress-bar) {
		animation: progress 5s linear forwards;
		width: 0%;
	}
</style>

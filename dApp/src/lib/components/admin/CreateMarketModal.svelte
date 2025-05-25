<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Modal,
		Button,
		Input,
		Label,
		Select,
		Helper,
		Spinner,
		Toast,
		Datepicker
	} from 'flowbite-svelte';
	import { CheckCircleSolid, CloseCircleSolid } from 'flowbite-svelte-icons';
	import { createMarket, getOrCreateMarketPool } from '$lib/services/market/marketService';
	import { walletStore } from '$lib/stores/wallet';
	import type { Address } from 'viem';

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
	let expirationDay: Date | undefined = undefined;
	let expirationTime: string = '17:00'; // Default to 5 PM

	let tokenList: Token[] = [];
	let isLoadingTokens: boolean = true;
	let errorLoadingTokens: string | null = null;

	let showSuccessToast = false;
	let showErrorToast = false;
	let toastMessage = '';

	let isSubmitting = false;

	let modalElement: HTMLElement | null = null;
	let minExpirationDate: Date;

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

		const today = new Date();
		minExpirationDate = new Date(today);
		minExpirationDate.setDate(today.getDate() + 1);
		minExpirationDate.setHours(0, 0, 0, 0); // Start of tomorrow
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
		event.preventDefault();
		console.log('Create Market form submitted');

		if (
			!targetPriceStr ||
			!tokenA_address ||
			!tokenB_address ||
			!marketName ||
			!feeTier ||
			!expirationDay
		) {
			showErrorToast = true;
			toastMessage = 'Please fill in all required fields, including the expiration date.';
			setTimeout(() => (showErrorToast = false), 5000);
			return;
		}

		const selectedExpirationDate = new Date(expirationDay);
		selectedExpirationDate.setHours(0, 0, 0, 0);

		if (selectedExpirationDate < minExpirationDate) {
			showErrorToast = true;
			toastMessage = 'Expiration date must be tomorrow or later.';
			setTimeout(() => (showErrorToast = false), 5000);
			return;
		}

		isSubmitting = true;
		showSuccessToast = false;
		showErrorToast = false;

		try {
			const tokenA = tokenList.find((t) => t.address === tokenA_address);
			const tokenB = tokenList.find((t) => t.address === tokenB_address);

			if (!tokenA || !tokenB || !tokenA.address || !tokenB.address) {
				showErrorToast = true;
				toastMessage = 'Please select valid tokens for both Token A and Token B.';
				setTimeout(() => (showErrorToast = false), 5000);
				isSubmitting = false;
				return;
			}

			// Additional check: addresses must look like 0x... and not be empty
			if (!/^0x[a-fA-F0-9]{40}$/.test(tokenA.address) || !/^0x[a-fA-F0-9]{40}$/.test(tokenB.address)) {
				showErrorToast = true;
				toastMessage = 'Token addresses are invalid.';
				setTimeout(() => (showErrorToast = false), 5000);
				isSubmitting = false;
				return;
			}

			const priceFeedKey = `${tokenA.symbol}/${tokenB.symbol}`;
			const [hoursStr, minutesStr] = expirationTime.split(':');
			const hours = parseInt(hoursStr, 10);
			const minutes = parseInt(minutesStr, 10);
			const localExpirationDateTime = new Date(selectedExpirationDate);
			localExpirationDateTime.setHours(hours, minutes, 0, 0);

			// Get the current user's address from walletStore
			let userAddress: Address | undefined = undefined;
			const unsubscribe = walletStore.subscribe((w: { address: string | null }) => {
				userAddress = w.address as Address | undefined;
			});
			unsubscribe();

			console.log('[DEBUG] Creating/checking pool with:', {
				tokenA: tokenA.address,
				tokenB: tokenB.address,
				feeTier,
				userAddress
			});

			// 1. Ensure the pool exists before creating the market
			const poolResult = await getOrCreateMarketPool(
				tokenA.address,
				tokenB.address,
				feeTier,
				userAddress
			);
			console.log('Pool result:', poolResult);
			if (!poolResult.poolExists && !poolResult.poolCreated) {
				showErrorToast = true;
				toastMessage = poolResult.error || 'Failed to create or find the required pool.';
				setTimeout(() => (showErrorToast = false), 5000);
				isSubmitting = false;
				return;
			}

			console.log('Proceeding to create market');
			// 2. Create the market via the service
			const marketResult = await createMarket(
				marketName,
				priceFeedKey,
				localExpirationDateTime,
				targetPriceStr,
				'0.01', // minStake
				userAddress
			);
			console.log('Market result:', marketResult);

			if (!marketResult.success) {
				showErrorToast = true;
				toastMessage = marketResult.message;
				setTimeout(() => (showErrorToast = false), 5000);
				isSubmitting = false;
				return;
			}

			showSuccessToast = true;
			toastMessage = 'Market and pool created successfully!';
			setTimeout(() => (showSuccessToast = false), 5000);
			resetForm();
			showModal = false;
		} catch (error: any) {
			console.error('Error creating market:', error);
			toastMessage = `Failed to create market: ${error.message || 'Unknown error'}`;
			showErrorToast = true;
			setTimeout(() => (showErrorToast = false), 5000);
		} finally {
			isSubmitting = false;
		}
	}

	function resetForm() {
		marketName = '';
		tokenA_address = '';
		tokenB_address = '';
		targetPriceStr = '';
		expirationDay = undefined;
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

{#if showSuccessToast}
	<Toast color="green" class="fixed top-5 right-5 z-50" dismissable={false}>
		<svelte:fragment slot="icon">
			<div>
				<CheckCircleSolid class="h-5 w-5" />
				<span class="sr-only">Check icon</span>
			</div>
		</svelte:fragment>
		{toastMessage}
	</Toast>
{/if}

{#if showErrorToast}
	<Toast color="red" class="fixed top-5 right-5 z-50" dismissable={false}>
		<svelte:fragment slot="icon">
			<div>
				<CloseCircleSolid class="h-5 w-5" />
				<span class="sr-only">Error icon</span>
			</div>
		</svelte:fragment>
		{toastMessage}
	</Toast>
{/if}

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
					<Datepicker
						id="expirationDate"
						bind:value={expirationDay}
						title="Market Expiration Date"
						class="w-full"
						inputClass="bg-gray-50 dark:bg-gray-700 w-full p-2.5 text-sm"
						on:keydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
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
						<Input type="time" id="expirationTime" bind:value={expirationTime} required on:keydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
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

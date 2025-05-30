<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Helper, Input, Label, Modal, Spinner } from 'flowbite-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { createMarket, getOrCreateMarketPool } from '$lib/services/market';
	import { PUBLIC_SWAPCASTHOOK_ADDRESS } from '$env/static/public';
	import { getTickSpacing } from '$lib/services/market/helpers';
	import { sortTokens } from '$lib/services/market/poolService';
	import { appKit } from '$lib/configs/wallet.config';
	import TokenSelector from './TokenSelector.svelte';
	import type { Token, MarketFormData, MarketCreationProps } from './types.js';

	let { showModal = false, onClose, onMarketCreated = () => {}, onMarketCreationFailed = () => {} }: MarketCreationProps = $props();

	// State
	let formData = $state<MarketFormData>({
		marketName: '',
		tokenA_address: '',
		tokenB_address: '',
		feeTier: 3000,
		targetPriceStr: '',
		expirationDay: '',
		expirationTime: '17:00'
	});

	let tokenList = $state<Token[]>([]);
	let tokenASearch = $state('');
	let tokenBSearch = $state('');
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isSubmitting = $state(false);
	let dateError = $state<string | null>(null);

	// Constants
	const FEE_TIERS = [
		{ value: 100, label: '0.01%' },
		{ value: 500, label: '0.05%' },
		{ value: 3000, label: '0.30%' },
		{ value: 10000, label: '1.00%' }
	];

	// Computed
	const tomorrowDate = $derived(() => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow.toISOString().split('T')[0];
	});

	const selectedTokenA = $derived(tokenList.find(t => t.address === formData.tokenA_address));
	const selectedTokenB = $derived(tokenList.find(t => t.address === formData.tokenB_address));

	// Initialize
	onMount(async () => {
		await loadTokens();
		if (!formData.expirationDay) {
			formData.expirationDay = tomorrowDate();
		}
	});

	async function loadTokens() {
		try {
			const response = await fetch('https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/mainnet.json');
			const data = await response.json();
			tokenList = data.filter((token: Token) => token.chainId === 1);
		} catch (err: any) {
			error = 'Failed to load tokens';
		} finally {
			isLoading = false;
		}
	}

	function validate() {
		const { marketName, tokenA_address, tokenB_address, targetPriceStr, expirationDay } = formData;
		
		if (!marketName || !tokenA_address || !tokenB_address || !targetPriceStr || !expirationDay) {
			return 'Please fill in all required fields';
		}

		const expiration = new Date(expirationDay + 'T' + formData.expirationTime);
		if (expiration.getTime() <= Date.now()) {
			return 'Expiration must be in the future';
		}

		return null;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (isSubmitting) return;

		const validationError = validate();
		if (validationError) {
			toastStore.error(validationError);
			return;
		}

		isSubmitting = true;

		try {
			const tokenA = selectedTokenA!;
			const tokenB = selectedTokenB!;
			const expirationDateTime = Math.floor(new Date(formData.expirationDay + 'T' + formData.expirationTime).getTime() / 1000);

			// Create pool
			const poolResult = await getOrCreateMarketPool(tokenA.address, tokenB.address, formData.feeTier);
			if (!poolResult.poolExists && !poolResult.poolCreated) {
				throw new Error('Failed to create pool');
			}

			// Create market
			const tokens = sortTokens(tokenA.address, tokenB.address, Number(appKit.getChainId()));
			const poolKey = {
				currency0: tokens[0].address as `0x${string}`,
				currency1: tokens[1].address as `0x${string}`,
				fee: formData.feeTier,
				tickSpacing: getTickSpacing(formData.feeTier),
				hooks: PUBLIC_SWAPCASTHOOK_ADDRESS as `0x${string}`
			};

			const result = await createMarket(
				formData.marketName,
				`${tokenA.symbol}/${tokenB.symbol}`,
				expirationDateTime,
				formData.targetPriceStr,
				poolKey
			);

			if (result.success) {
				toastStore.success('Market created successfully!');
				onMarketCreated(result.marketId || '0', formData.marketName);
				resetForm();
				showModal = false;
			} else {
				throw new Error(result.message);
			}
		} catch (err: any) {
			const message = err.message || 'Failed to create market';
			toastStore.error(message);
			onMarketCreationFailed(message);
		} finally {
			isSubmitting = false;
		}
	}

	function resetForm() {
		formData = {
			marketName: '',
			tokenA_address: '',
			tokenB_address: '',
			feeTier: 3000,
			targetPriceStr: '',
			expirationDay: tomorrowDate(),
			expirationTime: '17:00'
		};
		tokenASearch = '';
		tokenBSearch = '';
		dateError = null;
	}

	function handleDateChange(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const selectedDate = new Date(target.value);
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		
		if (selectedDate < tomorrow) {
			dateError = 'Date must be tomorrow or later';
			toastStore.error('Date must be tomorrow or later');
			formData.expirationDay = tomorrowDate();
		} else {
			dateError = null;
		}
	}

	function openTimePicker() {
		const timeInput = document.getElementById('expirationTime') as HTMLInputElement;
		timeInput?.showPicker?.() || timeInput?.focus();
	}
</script>

<Modal title="Create New Prediction Market" bind:open={showModal} onclose={onClose} size="xl">
	<form onsubmit={handleSubmit} class="space-y-6 max-h-[80vh] overflow-y-auto p-2">
		
		<!-- Market Definition -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold flex items-center">
				<span class="inline-flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-indigo-100 text-indigo-800">1</span>
				Market Definition
			</h3>
			<div>
				<Label for="marketName" class="mb-2">Market Name / Question</Label>
				<Input
					id="marketName"
					bind:value={formData.marketName}
					placeholder="e.g., Will ETH/USDC price be above $2500 in 24h?"
					required
					class="text-lg py-3"
				/>
				<Helper class="mt-2">A clear, unambiguous question for the market.</Helper>
			</div>
		</div>

		<!-- Token & Pool Setup -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold flex items-center">
				<span class="inline-flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-indigo-100 text-indigo-800">2</span>
				Token & Pool Setup
			</h3>
			
			<div class="space-y-6">
				<!-- Token A -->
				<TokenSelector
					tokens={tokenList}
					selectedAddress={formData.tokenA_address}
					searchTerm={tokenASearch}
					isLoading={isLoading}
					error={error}
					label="Token A (Base)"
					helper="Select the first token of the pair."
					filter={(t) => !['USDC', 'USDT', 'DAI'].includes(t.symbol)}
					onSelect={(addr) => formData.tokenA_address = addr}
					onSearch={(term) => tokenASearch = term}
				/>

				<!-- Token B -->
				<TokenSelector
					tokens={tokenList}
					selectedAddress={formData.tokenB_address}
					searchTerm={tokenBSearch}
					isLoading={isLoading}
					error={error}
					label="Token B (Quote)"
					helper="Select a stablecoin as the quote currency."
					filter={(t) => ['USDC', 'USDT', 'DAI'].includes(t.symbol)}
					onSelect={(addr) => formData.tokenB_address = addr}
					onSearch={(term) => tokenBSearch = term}
				/>

				<!-- Fee Tier -->
				<div>
					<Label class="mb-2">Fee Tier</Label>
					<div class="grid grid-cols-4 gap-3">
						{#each FEE_TIERS as tier}
							<button
								type="button"
								class="p-3 text-center border rounded-lg transition-colors
									{formData.feeTier === tier.value ? 'bg-indigo-100 border-indigo-300' : 'hover:bg-gray-50'}"
								onclick={() => formData.feeTier = tier.value}
							>
								<div class="font-semibold">{tier.label}</div>
								<div class="text-xs text-gray-500">{tier.value} bps</div>
							</button>
						{/each}
					</div>
					<Helper class="mt-2">Select the fee tier for the Uniswap v4 pool.</Helper>
				</div>
			</div>
		</div>

		<!-- Prediction Details -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold flex items-center">
				<span class="inline-flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-indigo-100 text-indigo-800">3</span>
				Prediction Details
			</h3>
			
			<div class="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
				<p class="text-sm text-indigo-800">
					The price threshold determines the market outcome. For example, if you set $2,500 for ETH/USDC, 
					the market resolves based on whether ETH reaches this exact price.
				</p>
			</div>
			
			<div>
				<Label for="targetPrice" class="mb-2">Target Price (in Token B)</Label>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
					<Input
						id="targetPrice"
						type="number"
						class="pl-7"
						bind:value={formData.targetPriceStr}
						placeholder="2500"
						step="any"
						required
					/>
				</div>
				<Helper class="mt-2">The price threshold for the prediction.</Helper>
			</div>
		</div>

		<!-- Market Timing -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold flex items-center">
				<span class="inline-flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-indigo-100 text-indigo-800">4</span>
				Market Timing
			</h3>
			
			<div class="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
				<p class="text-sm text-indigo-800">
					Set when this market will expire. At expiration, the market will be resolved based on the actual price.
				</p>
			</div>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<Label for="expirationDate" class="mb-2">Expiration Date</Label>
					<div class="relative">
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
						</svg>
						<Input
							type="date"
							id="expirationDate"
							class="pl-10 {dateError ? 'border-red-500' : ''}"
							bind:value={formData.expirationDay}
							min={tomorrowDate()}
							required
							onchange={handleDateChange}
						/>
					</div>
					{#if dateError}
						<p class="mt-1 text-sm text-red-600">{dateError}</p>
					{/if}
					<Helper class="mt-2">Select the market's expiration date.</Helper>
				</div>
				
				<div>
					<Label for="expirationTime" class="mb-2">Expiration Time</Label>
					<div class="relative cursor-pointer" onclick={openTimePicker}>
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
						</svg>
						<Input
							type="time"
							id="expirationTime"
							class="pl-10"
							bind:value={formData.expirationTime}
							required
						/>
					</div>
					<Helper class="mt-2">Set the market's expiration time.</Helper>
				</div>
			</div>
		</div>

		<!-- Summary -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold flex items-center">
				<span class="inline-flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-indigo-100 text-indigo-800">5</span>
				Review & Create
			</h3>
			
			<div class="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
				<p class="text-sm text-indigo-800">
					Review your market details before creating. Once created, the market will be available for predictions.
				</p>
			</div>
			
			{#if formData.marketName && selectedTokenA && selectedTokenB}
				<div class="bg-white p-4 rounded-lg border shadow-sm mb-6">
					<h4 class="font-medium mb-2">Market Summary</h4>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
						<div>
							<span class="text-gray-500">Market:</span>
							<div class="font-medium">{formData.marketName}</div>
						</div>
						<div>
							<span class="text-gray-500">Pair:</span>
							<div class="font-medium">{selectedTokenA.symbol}/{selectedTokenB.symbol}</div>
						</div>
						<div>
							<span class="text-gray-500">Target:</span>
							<div class="font-medium">${formData.targetPriceStr}</div>
						</div>
						<div>
							<span class="text-gray-500">Expires:</span>
							<div class="font-medium">{formData.expirationDay} at {formData.expirationTime}</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
					<p class="text-sm text-yellow-700">⚠️ Complete all fields to see the market summary.</p>
				</div>
			{/if}
			
			<div class="flex justify-between border-t pt-6">
				<Button color="alternative" onclick={onClose} disabled={isSubmitting}>Cancel</Button>
				<Button type="submit" disabled={isSubmitting} color="green">
					{#if isSubmitting}
						<Spinner class="mr-2" size="4" />
					{/if}
					Create Market
				</Button>
			</div>
		</div>
	</form>
</Modal>
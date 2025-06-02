<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Helper, Input, Label, Modal, Select, Spinner } from 'flowbite-svelte';
	import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { toastStore } from '$lib/stores/toastStore';
	import { createMarket, getOrCreateMarketPool } from '$lib/services/market';
	import type { Address } from 'viem';
	import { PUBLIC_SWAPCASTHOOK_ADDRESS } from '$env/static/public';
	import { getTickSpacing } from '$lib/services/market/helpers';
	import { sortTokens } from '$lib/services/market/poolService';
	import { appKit } from '$lib/configs/wallet.config';

	interface Props {
		showModal?: boolean;
		onClose: () => void;
		onMarketCreated?: (marketId: string, name: string) => void;
		onMarketCreationFailed?: (error: string) => void;
	}

	interface Token {
		name: string;
		address: Address;
		symbol: string;
		decimals: number;
		chainId: number;
		logoURI?: string;
	}

	interface MarketFormData {
		marketName: string;
		tokenA_address: string;
		tokenB_address: string;
		feeTier: number;
		targetPriceStr: string;
		expirationDay: string;
		expirationTime: string;
	}

	interface ValidationResult {
		isValid: boolean;
		error?: string;
	}

	let {
		showModal = false,
		onClose,
		onMarketCreated = () => {},
		onMarketCreationFailed = () => {}
	}: Props = $props();

	let tokenASearchTerm = $state('');
	let tokenBSearchTerm = $state('');

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
	let isLoadingTokens = $state(true);
	let errorLoadingTokens = $state<string | null>(null);
	let isSubmitting = $state(false);
	let minExpirationDate = $state<Date | undefined>();

	const FEE_TIERS = [
		{ value: 100, label: '0.01%' },
		{ value: 500, label: '0.05%' },
		{ value: 3000, label: '0.30%' },
		{ value: 10000, label: '1.00%' }
	] as const;

	const FORM_SECTIONS = {
		definition: 'Market Definition',
		tokens: 'Token & Pool Setup',
		prediction: 'Prediction Details',
		timing: 'Market Timing'
	} as const;

	const UI_TEXT = {
		title: 'Create New Prediction Market',
		marketName: 'Market Name / Question',
		marketNamePlaceholder: 'e.g., Will ETH/USDC price be above $2500 in 24h?',
		marketNameHelper: 'A clear, unambiguous question for the market.',
		tokenA: 'Token A (Base)',
		tokenB: 'Token B (Quote)',
		selectTokenA: 'Select Token A',
		selectTokenB: 'Select Token B',
		tokenAHelper: 'Select the first token of the pair.',
		tokenBHelper: 'Select the second token (price is relative to this token).',
		feeTier: 'Fee Tier',
		selectFeeTier: 'Select Fee Tier',
		feeTierHelper: 'Select the fee tier for the Uniswap v4 pool.',
		targetPrice: 'Target Price (in Token B)',
		targetPriceHelper: 'The price threshold for the prediction.',
		expirationDate: 'Expiration Date',
		expirationTime: 'Expiration Time',
		expirationDateHelper: "Select the market's expiration date (your local timezone).",
		expirationTimeHelper: "Set the market's expiration time (your local timezone).",
		loadingTokens: 'Loading tokens...',
		errorLoadingTokens: 'Error loading tokens',
		cancel: 'Cancel',
		createMarket: 'Create Market'
	} as const;

	const VALIDATION_MESSAGES = {
		fillAllFields: 'Please fill in all required fields, including the expiration date.',
		expirationTooEarly: 'Expiration date must be tomorrow or later.',
		selectValidTokens: 'Please select valid tokens for both Token A and Token B.',
		invalidTokenAddresses: 'Token addresses are invalid.',
		expirationInFuture: 'Expiration time must be in the future.'
	} as const;

	onMount(async () => {
		await loadTokenList();
		initializeMinExpirationDate();
	});

	async function loadTokenList(): Promise<void> {
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
	}

	function initializeMinExpirationDate(): void {
		try {
			const today = new Date();
			minExpirationDate = new Date(today);
			minExpirationDate.setDate(today.getDate() + 1);
			minExpirationDate.setHours(0, 0, 0, 0);

			if (!formData.expirationDay) {
				formData.expirationDay = minExpirationDate.toISOString().split('T')[0];
			}
		} catch (err) {
			console.error('Error initializing dates:', err);
		}
	}

	function openTimePicker(): void {
		const timeInput = document.getElementById('expirationTime') as HTMLInputElement | null;
		if (timeInput?.showPicker) {
			try {
				timeInput.showPicker();
			} catch (error) {
				console.error('Failed to execute showPicker():', error);
				timeInput.focus();
			}
		} else {
			timeInput?.focus();
		}
	}

	async function handleSubmit(event: Event): Promise<void> {
		event.preventDefault();

		if (isSubmitting) return;
		isSubmitting = true;

		try {
			const validation = validateForm();
			if (!validation.isValid) {
				showToast('error', validation.error!);
				return;
			}

			const { tokenA, tokenB } = getValidatedTokens();
			if (!tokenA || !tokenB) return;

			const expirationDateTime = calculateExpirationDateTime();
			if (expirationDateTime === null) return;

			await createMarketWithPool(tokenA, tokenB, expirationDateTime);
		} catch (error: any) {
			console.error('Error creating market:', error);
			const errorMessage = `Failed to create market: ${error.message || 'Unknown error'}`;
			showToast('error', errorMessage);
			onMarketCreationFailed(errorMessage);
		} finally {
			isSubmitting = false;
		}
	}

	async function createMarketWithPool(
		tokenA: Token,
		tokenB: Token,
		expirationDateTime: number
	): Promise<void> {
		const priceFeedKey = `${tokenA.symbol}/${tokenB.symbol}`;

		// Create or verify pool exists
		const poolResult = await getOrCreateMarketPool(
			tokenA.address,
			tokenB.address,
			formData.feeTier
		);

		if (!poolResult.poolExists && !poolResult.poolCreated) {
			showToast('error', poolResult.error || 'Failed to create or find the required pool.');
			return;
		}

		// Create the market
		const tokens = sortTokens(tokenA.address, tokenB.address, Number(appKit.getChainId()));
		const tickSpacing = getTickSpacing(formData.feeTier);

		const poolKey = {
			currency0: tokens[0].address as `0x${string}`,
			currency1: tokens[1].address as `0x${string}`,
			fee: formData.feeTier,
			tickSpacing: tickSpacing,
			hooks: PUBLIC_SWAPCASTHOOK_ADDRESS as `0x${string}`
		};

		const marketResult = await createMarket(
			formData.marketName,
			priceFeedKey,
			expirationDateTime,
			formData.targetPriceStr,
			poolKey
		);

		if (!marketResult.success) {
			showToast('error', marketResult.message);
			return;
		}

		showToast('success', 'Market and pool created successfully!');
		onMarketCreated(marketResult.marketId || '0', formData.marketName);

		resetForm();
		showModal = false;
	}

	function validateForm(): ValidationResult {
		const { marketName, tokenA_address, tokenB_address, feeTier, expirationDay, targetPriceStr } =
			formData;

		if (
			!targetPriceStr ||
			!tokenA_address ||
			!tokenB_address ||
			!marketName ||
			!feeTier ||
			!expirationDay
		) {
			return { isValid: false, error: VALIDATION_MESSAGES.fillAllFields };
		}

		const selectedExpirationDate = new Date(expirationDay);
		selectedExpirationDate.setHours(0, 0, 0, 0);

		if (selectedExpirationDate < minExpirationDate!) {
			return { isValid: false, error: VALIDATION_MESSAGES.expirationTooEarly };
		}

		return { isValid: true };
	}

	function getValidatedTokens(): { tokenA?: Token; tokenB?: Token } {
		const tokenA = tokenList.find((t) => t.address === formData.tokenA_address);
		const tokenB = tokenList.find((t) => t.address === formData.tokenB_address);

		if (!tokenA || !tokenB) {
			showToast('error', VALIDATION_MESSAGES.selectValidTokens);
			return {};
		}

		if (
			!/^0x[a-fA-F0-9]{40}$/.test(tokenA.address) ||
			!/^0x[a-fA-F0-9]{40}$/.test(tokenB.address)
		) {
			showToast('error', VALIDATION_MESSAGES.invalidTokenAddresses);
			return {};
		}

		return { tokenA, tokenB };
	}

	function calculateExpirationDateTime(): number | null {
		const selectedExpirationDate = new Date(formData.expirationDay);
		selectedExpirationDate.setHours(0, 0, 0, 0);

		const [hoursStr, minutesStr] = formData.expirationTime.split(':');
		const hours = parseInt(hoursStr, 10);
		const minutes = parseInt(minutesStr, 10);

		selectedExpirationDate.setHours(hours, minutes, 0, 0);

		if (selectedExpirationDate.getTime() <= Date.now()) {
			showToast('error', VALIDATION_MESSAGES.expirationInFuture);
			return null;
		}

		return Math.floor(selectedExpirationDate.getTime() / 1000);
	}

	function showToast(type: 'success' | 'error', message: string): void {
		if (type === 'success') {
			toastStore.success(message);
		} else {
			toastStore.error(message);
		}
	}

	function resetForm(): void {
		formData = {
			marketName: '',
			tokenA_address: '',
			tokenB_address: '',
			feeTier: 3000,
			targetPriceStr: '',
			expirationDay: '',
			expirationTime: '17:00'
		};
	}

	function handleClose(): void {
		resetForm();
		onClose();
	}

	function handleCancelClick(): void {
		showModal = false;
		onClose();
	}
</script>

<Modal
	title={UI_TEXT.title}
	bind:open={showModal}
	onclose={handleClose}
	autoclose={false}
	size="xl"
>
	<form
		onsubmit={handleSubmit}
		autocomplete="off"
		class="max-h-[80vh] space-y-6 overflow-y-auto p-2"
	>
		<!-- Market Definition Section -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<span
					class="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
					>1</span
				>
				{FORM_SECTIONS.definition}
			</h3>
			<div class="mb-4">
				<Label for="marketName" class="mb-2 block font-medium">{UI_TEXT.marketName}</Label>
				<Input
					type="text"
					id="marketName"
					bind:value={formData.marketName}
					required
					class="py-3 text-lg"
					placeholder={UI_TEXT.marketNamePlaceholder}
				/>
				<Helper class="mt-2 text-sm">{UI_TEXT.marketNameHelper}</Helper>
			</div>
		</div>

		<!-- Token & Pool Setup Section -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<span
					class="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
					>2</span
				>
				{FORM_SECTIONS.tokens}
			</h3>
			<div class="space-y-6">
				<!-- Token A Selection -->
				<div>
					<Label for="tokenA" class="mb-2 block font-medium">{UI_TEXT.tokenA}</Label>
					{#if isLoadingTokens}
						<div class="flex items-center space-x-3 py-3">
							<Spinner size="6" class="text-indigo-600" />
							<span>{UI_TEXT.loadingTokens}</span>
						</div>
					{:else if errorLoadingTokens}
						<div class="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
							<p class="flex items-center">
								<ExclamationCircleSolid class="mr-2 h-5 w-5" />
								{errorLoadingTokens}
							</p>
						</div>
					{:else}
						<!-- Search box for Token A -->
						<div class="relative mb-4">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<svg
									class="h-4 w-4 text-gray-500 dark:text-gray-400"
									aria-hidden="true"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 20 20"
								>
									<path
										stroke="currentColor"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
									/>
								</svg>
							</div>
							<Input
								type="search"
								class="pl-10"
								placeholder="Search tokens..."
								bind:value={tokenASearchTerm}
							/>
						</div>

						<div class="mb-4 grid max-h-60 grid-cols-3 gap-3 overflow-y-auto">
							{#each tokenList.filter((t) => !['USDC', 'USDT', 'DAI'].includes(t.symbol) && (tokenASearchTerm === '' || t.symbol
											.toLowerCase()
											.includes(tokenASearchTerm.toLowerCase()) || t.name
											.toLowerCase()
											.includes(tokenASearchTerm.toLowerCase()))) as token (token.address)}
								<button
									type="button"
									class="flex items-center justify-between rounded-lg border p-3 transition-colors
										{formData.tokenA_address === token.address
										? 'border-indigo-300 bg-indigo-100 text-indigo-800'
										: 'border-gray-200 bg-white hover:bg-gray-50'}"
									onclick={() => (formData.tokenA_address = token.address)}
								>
									<div class="flex items-center">
										{#if token.logoURI}
											<img
												src={token.logoURI}
												alt={token.symbol}
												class="mr-2 h-6 w-6 rounded-full"
											/>
										{:else}
											<div
												class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold"
											>
												{token.symbol.charAt(0)}
											</div>
										{/if}
										<span class="font-medium">{token.symbol}</span>
									</div>
									{#if formData.tokenA_address === token.address}
										<div class="flex-shrink-0 text-indigo-600">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clip-rule="evenodd"
												/>
											</svg>
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
					<Helper class="mt-2 text-sm">{UI_TEXT.tokenAHelper}</Helper>
				</div>

				<!-- Token B Selection (Stablecoins Only) -->
				<div>
					<Label for="tokenB" class="mb-2 block font-medium">{UI_TEXT.tokenB}</Label>
					{#if isLoadingTokens}
						<div class="flex items-center space-x-3 py-3">
							<Spinner size="6" class="text-indigo-600" />
							<span>{UI_TEXT.loadingTokens}</span>
						</div>
					{:else if errorLoadingTokens}
						<div class="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
							<p class="flex items-center">
								<ExclamationCircleSolid class="mr-2 h-5 w-5" />
								{errorLoadingTokens}
							</p>
						</div>
					{:else}
						<!-- Search box for Token B -->
						<div class="relative mb-4">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<svg
									class="h-4 w-4 text-gray-500 dark:text-gray-400"
									aria-hidden="true"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 20 20"
								>
									<path
										stroke="currentColor"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
									/>
								</svg>
							</div>
							<Input
								type="search"
								class="pl-10"
								placeholder="Search stablecoins..."
								bind:value={tokenBSearchTerm}
							/>
						</div>

						<div class="mb-4 grid max-h-60 grid-cols-3 gap-3 overflow-y-auto">
							{#each tokenList.filter((t) => ['USDC', 'USDT', 'DAI'].includes(t.symbol) && (tokenBSearchTerm === '' || t.symbol
											.toLowerCase()
											.includes(tokenBSearchTerm.toLowerCase()) || t.name
											.toLowerCase()
											.includes(tokenBSearchTerm.toLowerCase()))) as token (token.address)}
								<button
									type="button"
									class="flex items-center justify-between rounded-lg border p-3 transition-colors
										{formData.tokenB_address === token.address
										? 'border-indigo-300 bg-indigo-100 text-indigo-800'
										: 'border-gray-200 bg-white hover:bg-gray-50'}"
									onclick={() => (formData.tokenB_address = token.address)}
								>
									<div class="flex items-center">
										{#if token.logoURI}
											<img
												src={token.logoURI}
												alt={token.symbol}
												class="mr-2 h-6 w-6 rounded-full"
											/>
										{:else}
											<div
												class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold"
											>
												{token.symbol.charAt(0)}
											</div>
										{/if}
										<span class="font-medium">{token.symbol}</span>
									</div>
									{#if formData.tokenB_address === token.address}
										<div class="flex-shrink-0 text-indigo-600">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clip-rule="evenodd"
												/>
											</svg>
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
					<Helper class="mt-2 text-sm">Select a stablecoin as the quote currency.</Helper>
				</div>
			</div>

			<div>
				<Label for="feeTier" class="mb-2 block pt-4 font-medium">{UI_TEXT.feeTier}</Label>
				<div class="mb-4 grid grid-cols-4 gap-3">
					{#each FEE_TIERS as tier}
						<button
							type="button"
							class="flex flex-col items-center justify-center rounded-lg border p-3 transition-colors
								{formData.feeTier === tier.value
								? 'border-indigo-300 bg-indigo-100 text-indigo-800'
								: 'border-gray-200 bg-white hover:bg-gray-50'}"
							onclick={() => (formData.feeTier = tier.value)}
						>
							<span class="text-lg font-semibold">{tier.label}</span>
							<span class="mt-1 text-xs text-gray-500">{tier.value} bps</span>
							{#if formData.feeTier === tier.value}
								<div class="mt-2 text-indigo-600">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							{/if}
						</button>
					{/each}
				</div>
				<Helper class="mt-2 text-sm">{UI_TEXT.feeTierHelper}</Helper>
			</div>
		</div>

		<!-- Prediction Details Section -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<span
					class="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
					>3</span
				>
				{FORM_SECTIONS.prediction}
			</h3>

			<div class="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
				<p class="text-sm text-indigo-800">
					The price threshold is an absolute value (not a percentage) that determines the market
					outcome. For example, if you set $2,500 for ETH/USDC, the market resolves based on whether
					ETH reaches this exact price.
				</p>
			</div>

			<div class="space-y-4">
				<div>
					<Label for="targetPrice" class="mb-2 block font-medium">{UI_TEXT.targetPrice}</Label>
					<div class="relative">
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<span class="text-gray-500">$</span>
						</div>
						<Input
							type="number"
							id="targetPrice"
							class="pl-7"
							bind:value={formData.targetPriceStr}
							required
							placeholder="e.g., 2500"
							step="any"
						/>
					</div>
					<Helper class="mt-2 text-sm">{UI_TEXT.targetPriceHelper}</Helper>
				</div>
			</div>
		</div>

		<!-- Market Timing Section -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<span
					class="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
					>4</span
				>
				{FORM_SECTIONS.timing}
			</h3>

			<div class="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
				<p class="text-sm text-indigo-800">
					Set when this market will expire. At expiration, the market will be resolved based on the
					actual price compared to your target price threshold.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div>
					<Label for="expirationDate" class="mb-2 block font-medium">{UI_TEXT.expirationDate}</Label
					>
					<div class="relative">
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-gray-500"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<Input
							type="date"
							id="expirationDate"
							class="border-gray-300 bg-white pl-10 focus:border-indigo-500 focus:ring-indigo-500"
							bind:value={formData.expirationDay}
							min={minExpirationDate ? minExpirationDate.toISOString().split('T')[0] : ''}
							required
							onkeydown={(e) => {
								if (e.key === 'Enter') e.preventDefault();
							}}
						/>
					</div>
					<Helper class="mt-2 text-sm">{UI_TEXT.expirationDateHelper}</Helper>
				</div>
				<div>
					<Label for="expirationTime" class="mb-2 block font-medium">{UI_TEXT.expirationTime}</Label
					>
					<div
						onclick={openTimePicker}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') openTimePicker();
						}}
						class="relative cursor-pointer"
						role="button"
						aria-label="Set expiration time"
						tabindex="0"
					>
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-gray-500"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<Input
							type="time"
							id="expirationTime"
							class="border-gray-300 bg-white pl-10 focus:border-indigo-500 focus:ring-indigo-500"
							bind:value={formData.expirationTime}
							required
							onkeydown={(e) => {
								if (e.key === 'Enter') e.preventDefault();
							}}
						/>
					</div>
					<Helper class="mt-1">{UI_TEXT.expirationTimeHelper}</Helper>
				</div>
			</div>
		</div>

		<!-- Summary Section -->
		<div class="rounded-lg bg-gray-50 p-6 shadow-sm dark:bg-gray-800">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
				<span
					class="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
					>5</span
				>
				Review & Create
			</h3>

			<div class="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
				<p class="text-sm text-indigo-800">
					Review your market details before creating. Once created, the market will be available for
					users to place predictions.
				</p>
			</div>

			<div class="mb-6 space-y-4">
				{#if formData.marketName && formData.tokenA_address && formData.tokenB_address}
					<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
						<h4 class="mb-2 font-medium text-gray-900">Market Summary</h4>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<p class="text-sm text-gray-500">Market Name</p>
								<p class="font-medium">{formData.marketName}</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Token Pair</p>
								<p class="font-medium">
									{tokenList.find((t) => t.address === formData.tokenA_address)?.symbol ||
										'Token A'} /
									{tokenList.find((t) => t.address === formData.tokenB_address)?.symbol ||
										'Token B'}
								</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Price Threshold</p>
								<p class="font-medium">${formData.targetPriceStr || '0.00'}</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Expiration</p>
								<p class="font-medium">{formData.expirationDay} at {formData.expirationTime}</p>
							</div>
						</div>
					</div>
				{:else}
					<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
						<p class="flex items-center text-sm text-yellow-700">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="mr-2 h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								/>
							</svg>
							Please complete all required fields to see the market summary.
						</p>
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between border-t pt-6 dark:border-gray-700">
				<Button
					type="button"
					color="alternative"
					onclick={handleCancelClick}
					disabled={isSubmitting}
					class="px-6"
				>
					{UI_TEXT.cancel}
				</Button>
				<Button
					type="button"
					color="indigo"
					class="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					disabled={isSubmitting}
					onclick={handleSubmit}
				>
					{#if isSubmitting}
						<Spinner class="mr-2" size="4" color="gray" />
					{/if}
					{UI_TEXT.createMarket}
				</Button>
			</div>
		</div>
	</form>
</Modal>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Helper, Input, Label, Modal, Select, Spinner } from 'flowbite-svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import { createMarket, getOrCreateMarketPool } from '$lib/services/market/marketService';
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
	
	async function createMarketWithPool(tokenA: Token, tokenB: Token, expirationDateTime: number): Promise<void> {
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
		const { marketName, tokenA_address, tokenB_address, feeTier, expirationDay, targetPriceStr } = formData;
		
		if (!targetPriceStr || !tokenA_address || !tokenB_address || !marketName || !feeTier || !expirationDay) {
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
	
		if (!/^0x[a-fA-F0-9]{40}$/.test(tokenA.address) || !/^0x[a-fA-F0-9]{40}$/.test(tokenB.address)) {
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
		size="lg"
	>
		<form onsubmit={handleSubmit} autocomplete="off" class="max-h-[80vh] space-y-4 overflow-y-auto">
			<!-- Market Definition Section -->
			<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
					{FORM_SECTIONS.definition}
				</h3>
				<div>
					<Label for="marketName" class="mb-2 block">{UI_TEXT.marketName}</Label>
					<Input
						type="text"
						id="marketName"
						bind:value={formData.marketName}
						required
						placeholder={UI_TEXT.marketNamePlaceholder}
					/>
					<Helper class="mt-1">{UI_TEXT.marketNameHelper}</Helper>
				</div>
			</div>
	
			<!-- Token & Pool Setup Section -->
			<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
					{FORM_SECTIONS.tokens}
				</h3>
				<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<Label for="tokenA" class="mb-2 block">{UI_TEXT.tokenA}</Label>
						{#if isLoadingTokens}
							<Input disabled placeholder={UI_TEXT.loadingTokens} />
						{:else if errorLoadingTokens}
							<Input disabled placeholder={UI_TEXT.errorLoadingTokens} />
							<Helper color="red" class="mt-1">{errorLoadingTokens}</Helper>
						{:else}
							<Select
								id="tokenA"
								bind:value={formData.tokenA_address}
								required
								class="bg-white dark:bg-gray-800"
							>
								<option value="" disabled>{UI_TEXT.selectTokenA}</option>
								{#each tokenList as token (token.address)}
									<option value={token.address}>{token.symbol} ({token.name})</option>
								{/each}
							</Select>
						{/if}
						<Helper class="mt-1">{UI_TEXT.tokenAHelper}</Helper>
					</div>
					<div>
						<Label for="tokenB" class="mb-2 block">{UI_TEXT.tokenB}</Label>
						{#if isLoadingTokens}
							<Input disabled placeholder={UI_TEXT.loadingTokens} />
						{:else if errorLoadingTokens}
							<Input disabled placeholder={UI_TEXT.errorLoadingTokens} />
							<Helper color="red" class="mt-1">{errorLoadingTokens}</Helper>
						{:else}
							<Select
								id="tokenB"
								bind:value={formData.tokenB_address}
								required
								class="bg-white dark:bg-gray-800"
							>
								<option value="" disabled>{UI_TEXT.selectTokenB}</option>
								{#each tokenList as token (token.address)}
									<option value={token.address}>{token.symbol} ({token.name})</option>
								{/each}
							</Select>
						{/if}
						<Helper class="mt-1">{UI_TEXT.tokenBHelper}</Helper>
					</div>
				</div>
	
				<div>
					<Label for="feeTier" class="mb-2 block">{UI_TEXT.feeTier}</Label>
					<Select id="feeTier" bind:value={formData.feeTier} required class="bg-white dark:bg-gray-800">
						<option value="" disabled>{UI_TEXT.selectFeeTier}</option>
						{#each FEE_TIERS as tier}
							<option value={tier.value}>{tier.label}</option>
						{/each}
					</Select>
					<Helper class="mt-1">{UI_TEXT.feeTierHelper}</Helper>
				</div>
			</div>
	
			<!-- Prediction Details Section -->
			<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
					{FORM_SECTIONS.prediction}
				</h3>
				<div>
					<Label for="targetPrice" class="mb-2 block">{UI_TEXT.targetPrice}</Label>
					<Input
						type="number"
						id="targetPrice"
						bind:value={formData.targetPriceStr}
						required
						placeholder="e.g., 2500"
						step="any"
					/>
					<Helper class="mt-1">{UI_TEXT.targetPriceHelper}</Helper>
				</div>
			</div>
	
			<!-- Market Timing Section -->
			<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
					{FORM_SECTIONS.timing}
				</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<Label for="expirationDate" class="mb-2 block">{UI_TEXT.expirationDate}</Label>
						<Input
							type="date"
							id="expirationDate"
							bind:value={formData.expirationDay}
							class="w-full bg-gray-50 dark:bg-gray-700 p-2.5 text-sm"
							min={minExpirationDate ? minExpirationDate.toISOString().split('T')[0] : ''}
							required
							onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
						/>
						<Helper class="mt-1">{UI_TEXT.expirationDateHelper}</Helper>
					</div>
					<div>
						<Label for="expirationTime" class="mb-2 block">{UI_TEXT.expirationTime}</Label>
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
							<Input 
								type="time" 
								id="expirationTime" 
								bind:value={formData.expirationTime} 
								required 
								onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} 
							/>
						</div>
						<Helper class="mt-1">{UI_TEXT.expirationTimeHelper}</Helper>
					</div>
				</div>
			</div>
	
			<div class="mt-6 flex justify-end border-t pt-4 dark:border-gray-700">
				<Button type="button" color="alternative" onclick={handleCancelClick} disabled={isSubmitting}>
					{UI_TEXT.cancel}
				</Button>
				<Button 
					type="submit" 
					color="indigo" 
					class="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" 
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						<Spinner class="mr-2" size="4" color="gray" />
					{/if}
					{UI_TEXT.createMarket}
				</Button>
			</div>
		</form>
	</Modal>
<script lang="ts">
	import type { Token } from '$lib/types';
	import { RefreshCw } from 'lucide-svelte';

	interface Props {
		label: string;
		amount: number;
		token: Token | null;
		balance?: number;
		readOnly?: boolean;
		disabled?: boolean;
		showMax?: boolean;
		placeholder?: string;
		showAvailableBalance?: boolean;
		validationError?: string | null;
		onAmountChange?: (value: number) => void;
		showBalance?: boolean;
		isLoadingBalance?: boolean;
		onRefreshBalance?: () => void;
		ethPrice?: number;
		showExchangeRate?: boolean;
		exchangeRate?: string;
		fromTokenSymbol?: string;
		toTokenSymbol?: string;
	}

	let {
		label,
		amount = $bindable(0),
		token,
		balance = 0,
		readOnly = false,
		disabled = false,
		showMax = true,
		placeholder = '0',
		showAvailableBalance = true,
		validationError = null,
		onAmountChange = () => {},
		showBalance = showAvailableBalance,
		isLoadingBalance = false,
		onRefreshBalance = undefined,
		ethPrice = 0,
		showExchangeRate = false,
		exchangeRate = '0.00',
		fromTokenSymbol = '',
		toTokenSymbol = ''
	}: Props = $props();

	// State for error message
	let errorMessage = $state('');
	let hasExceededBalance = $state(false);

	// FIXED: Only validate for "You pay" inputs, not "You receive"
	$effect(() => {
		// Skip validation if component is read-only, disabled, or is a receive input
		if (readOnly || disabled || label.toLowerCase().includes('receive')) {
			errorMessage = '';
			hasExceededBalance = false;
			return;
		}

		// Reset validation state
		errorMessage = '';
		hasExceededBalance = false;

		// Skip validation if amount is 0 or no token
		if (amount === 0 || !token?.symbol) return;

		// Only validate balance for "pay" inputs
		if (showBalance && token?.symbol && label.toLowerCase().includes('pay')) {
			if (token.balance === 0 || token.balance === undefined) {
				errorMessage = `You have no ${token.symbol} balance`;
				hasExceededBalance = true;
				return;
			}

			// Check if the value exceeds available balance
			if (amount > token.balance) {
				errorMessage = `Exceeds available balance `;
				hasExceededBalance = true;
				return;
			}
		}
	});

	/**
	 * Handles input changes and validates against available balance
	 * @param event - The input event
	 */
	function handleInput(event: Event): void {
		if (readOnly) return;
		const target = event.target as HTMLInputElement;

		// Clear previous error state
		errorMessage = '';
		hasExceededBalance = false;

		// If the input is empty, set to 0
		if (!target.value) {
			onAmountChange(0);
			return;
		}

		// Parse the input value
		const value = parseFloat(target.value);

		// Only validate for "pay" inputs, not "receive"
		if (showBalance && token?.symbol && label.toLowerCase().includes('pay')) {
			if (token.balance === 0 || token.balance === undefined) {
				errorMessage = `You have no ${token.symbol} balance`;
				hasExceededBalance = true;
				onAmountChange(value || 0);
				return;
			}

			// Check if the value exceeds available balance
			if (value > token.balance) {
				// Show error but don't cap the value automatically
				errorMessage = `Exceeds available balance`;
				hasExceededBalance = true;
				onAmountChange(value || 0);
				return;
			}
		}

		// If we get here, the input is valid
		onAmountChange(value || 0);
	}

	/**
	 * Sets the input value to the maximum available balance
	 */
	function handleMax(): void {
		if (readOnly || !token?.balance) return;
		onAmountChange(token.balance);
	}

	// FIXED: Format balance to floor to 6 decimals instead of rounding
	let formattedBalance = $derived(() => {
		if (!token?.balance) return '0.000000';
		return (Math.floor(token.balance * 1000000) / 1000000).toFixed(6);
	});
</script>

<div class="space-y-2">
	<label for="token-amount-input" class="text-sm font-medium text-gray-700">{label}</label>
	<!-- FIXED: Remove the expanding red border animation and keep consistent sizing -->
	<div class="group relative rounded-xl border {hasExceededBalance ? 'border-red-300' : 'border-gray-200'} {hasExceededBalance ? 'bg-red-50/50' : 'bg-gray-50/50'} p-4 transition-colors focus-within:{hasExceededBalance ? 'border-red-500' : 'border-blue-500'} focus-within:bg-white focus-within:shadow-sm hover:{hasExceededBalance ? 'border-red-300' : 'border-gray-300'}">
		<!-- FIXED: Remove the expanding animated overlay -->
		<div class="flex items-center justify-between">
			<input
					id="token-amount-input"
					type="number"
					bind:value={amount}
					oninput={handleInput}
					onfocus={(e) => {
						if (amount === 0 && e.target instanceof HTMLInputElement) {
							e.target.value = '';
						}
					}}
					onblur={(e) => {
						if (e.target instanceof HTMLInputElement && !e.target.value) {
							amount = 0;
						}
					}}
					class="flex-1 border-0 bg-transparent text-2xl font-semibold text-gray-900 placeholder-gray-400 focus:ring-0 focus:outline-none"
					placeholder="0.00"
					min="0"
					step="0.000001"
					readonly={readOnly}
					{disabled}
					max={token?.balance || Infinity}
			/>
			<div class="ml-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm">
				{#if token}
					{#if token.logoURI || token.logo}
						<img src={token.logoURI || token.logo} alt={token.symbol} class="mr-2 h-6 w-6 rounded-full" />
					{:else}
						<div class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700">
							{token.symbol.charAt(0)}
						</div>
					{/if}
					<span>{token.symbol}</span>
				{:else}
					<span>Select</span>
				{/if}
			</div>
		</div>

		<div class="mt-2 flex flex-col gap-1">
			<!-- Error message if balance exceeded - only show for pay inputs -->
			{#if errorMessage && label.toLowerCase().includes('pay')}
				<div class="flex items-center gap-1 text-sm font-medium text-red-600">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					{errorMessage}
				</div>
			{/if}

			<div class="flex justify-between text-xs text-gray-500">
				{#if showBalance}
					{#if isLoadingBalance}
						<span>Loading...</span>
					{:else}
						<div class="flex items-center">
							<!-- FIXED: Only show "Available" for pay inputs, show different text for receive -->
							<button
									type="button"
									onclick={handleMax}
									class="text-blue-600 hover:text-blue-700 hover:underline mr-2 {hasExceededBalance ? 'font-medium' : ''}"
									disabled={disabled || !token?.balance || label.toLowerCase().includes('receive')}
							>
								{#if label.toLowerCase().includes('receive')}
									Available: {formattedBalance()} {token?.symbol || ''}
								{:else}
									Available: {formattedBalance()} {token?.symbol || ''}
								{/if}
							</button>
							{#if onRefreshBalance}
								<button
										type="button"
										onclick={() => onRefreshBalance?.()}
										class="text-gray-400 hover:text-gray-600"
										title="Refresh balance"
								>
									<RefreshCw size={12} />
								</button>
							{/if}
						</div>
					{/if}
					<span>~${(amount * ethPrice).toFixed(2)}</span>
				{:else if showExchangeRate}
					<span>1 {fromTokenSymbol} = {exchangeRate} {toTokenSymbol}</span>
					<span>Fee: 0.3%</span>
				{/if}
			</div>
		</div>
	</div>
</div>

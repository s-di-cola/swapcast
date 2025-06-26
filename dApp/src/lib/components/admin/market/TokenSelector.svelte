<script lang="ts">
	import { Input, Helper, Spinner } from 'flowbite-svelte';
	import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import type { Token } from './types.js';

	interface Props {
		tokens: Token[];
		selectedAddress: string;
		searchTerm: string;
		isLoading: boolean;
		error: string | null;
		label: string;
		helper: string;
		filter: (token: Token) => boolean;
		onSelect: (address: string) => void;
		onSearch: (term: string) => void;
		id: string;
	}

	let {
		tokens,
		selectedAddress,
		searchTerm,
		isLoading,
		error,
		label,
		helper,
		filter,
		onSelect,
		onSearch,
		id
	}: Props = $props();

	// Track failed image loads to prevent infinite loops
	let failedImages = $state(new Set<string>());

	const filteredTokens = $derived(
		tokens.filter(
			(t) =>
				filter(t) &&
				(searchTerm === '' ||
					t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
					t.name.toLowerCase().includes(searchTerm.toLowerCase()))
		)
	);

	// Check if a logo URL is valid (not IPFS or other problematic URLs)
	function isValidLogoUrl(url: string): boolean {
		if (!url) return false;
		// Skip IPFS URLs and other problematic schemes
		if (url.startsWith('ipfs://') || url.startsWith('data:')) {
			return false;
		}
		return true;
	}

	// Handle image load errors
	function handleImageError(event: Event, tokenAddress: string): void {
		failedImages.add(tokenAddress);
		// Prevent the default error behavior
		event.preventDefault();
	}
</script>

<div>
	<label for="token-search-{id}" class="mb-2 block font-medium">{label}</label>
	{#if isLoading}
		<div class="flex items-center space-x-3 py-3">
			<Spinner size="6" class="text-indigo-600" />
			<span>Loading tokens...</span>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
			<p class="flex items-center">
				<ExclamationCircleSolid class="mr-2 h-5 w-5" />
				{error}
			</p>
		</div>
	{:else}
		<div class="relative mb-4">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 20 20">
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
				id="token-search-{id}"
				type="search"
				class="pl-10"
				placeholder="Search tokens..."
				value={searchTerm}
				oninput={(e) => onSearch(e.currentTarget.value)}
			/>
		</div>

		<div class="mb-4 grid max-h-60 grid-cols-3 gap-3 overflow-y-auto">
			{#each filteredTokens as token (token.address)}
				<button
					type="button"
					class="flex items-center justify-between rounded-lg border p-3 transition-colors
						{selectedAddress === token.address
						? 'border-indigo-300 bg-indigo-100 text-indigo-800'
						: 'border-gray-200 bg-white hover:bg-gray-50'}"
					onclick={() => onSelect(token.address)}
				>
					<div class="flex items-center">
						{#if token.logoURI && isValidLogoUrl(token.logoURI) && !failedImages.has(token.address)}
							<img 
								src={token.logoURI} 
								alt={token.symbol} 
								class="mr-2 h-6 w-6 rounded-full" 
								onerror={(e) => handleImageError(e, token.address)}
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
					{#if selectedAddress === token.address}
						<div class="flex-shrink-0 text-indigo-600">✓</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
	<Helper class="mt-2 text-sm">{helper}</Helper>
</div>

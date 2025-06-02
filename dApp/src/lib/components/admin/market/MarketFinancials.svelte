<script lang="ts">
	import { ClockSolid } from 'flowbite-svelte-icons';
	import { formatCurrency, formatEther, formatDate, formatRelativeTime } from '$lib/helpers/formatters';
	import type { Market } from '$lib/services/market';

	interface Props {
		market: Market;
	}

	interface FinancialItem {
		label: string;
		value: string;
	}

	let { market }: Props = $props();

	const UI_TEXT = {
		title: 'Financial Details',
		totalStake: 'Total Stake:',
		bullishStake: 'Bullish Stake:',
		bearishStake: 'Bearish Stake:',
		expirationTime: 'Expiration Time:',
		timeRemaining: 'Time Remaining:',
		expired: 'Expired'
	} as const;

	// We'll use actual stake values from the contract instead of arbitrary ratios

	const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	} as const;

	function formatTimeRemaining(expirationTime: number): string {
		const now = Math.floor(Date.now() / 1000);
		const diff = expirationTime - now;

		if (diff <= 0) return UI_TEXT.expired;

		// Use relative time formatting for future dates
		return formatRelativeTime(expirationTime);
	}

	function formatExpirationDate(expirationTime: number): string {
		return formatDate(expirationTime, true);
	}

	const financialItems: FinancialItem[] = $derived([
		{
			label: UI_TEXT.totalStake,
			value: `$${formatCurrency(market.totalStake)}`
		},
		{
			label: UI_TEXT.bullishStake,
			value: formatEther(market.totalStake1)
		},
		{
			label: UI_TEXT.bearishStake,
			value: formatEther(market.totalStake0)
		},
		{
			label: UI_TEXT.expirationTime,
			value: formatExpirationDate(market.expirationTime)
		},
		{
			label: UI_TEXT.timeRemaining,
			value: formatTimeRemaining(market.expirationTime)
		}
	]);
</script>

<div class="rounded-lg bg-gray-50 p-4">
	<div class="mb-3 flex items-center">
		<ClockSolid class="mr-2 h-5 w-5 text-gray-600" />
		<h4 class="text-lg font-semibold text-gray-700">{UI_TEXT.title}</h4>
	</div>
	<div class="space-y-2">
		{#each financialItems as item}
			<div class="flex justify-between">
				<span class="text-gray-600">{item.label}</span>
				<span class="font-semibold">{item.value}</span>
			</div>
		{/each}
	</div>
</div>

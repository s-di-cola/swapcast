<script lang="ts">
	import { ClockSolid } from 'flowbite-svelte-icons';
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

	const STAKE_RATIOS = {
		bullish: 0.6,
		bearish: 0.4
	} as const;

	const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	} as const;

	function formatCurrency(value: string | number): string {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
		if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
		return `${num.toFixed(2)}`;
	}

	function formatTimeRemaining(expirationTime: number): string {
		const now = Math.floor(Date.now() / 1000);
		const diff = expirationTime - now;

		if (diff <= 0) return UI_TEXT.expired;

		const days = Math.floor(diff / (60 * 60 * 24));
		const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
		const minutes = Math.floor((diff % (60 * 60)) / 60);

		return `${days}d ${hours}h ${minutes}m`;
	}

	function formatExpirationDate(expirationTime: number): string {
		return new Date(expirationTime * 1000).toLocaleString(undefined, DATE_FORMAT_OPTIONS);
	}

	function calculateStakeValue(totalStake: string | number, ratio: number): string {
		const total = typeof totalStake === 'string' ? parseFloat(totalStake) : totalStake;
		return formatCurrency(total * ratio);
	}

	const financialItems: FinancialItem[] = $derived([
		{
			label: UI_TEXT.totalStake,
			value: `$${formatCurrency(market.totalStake)}`
		},
		{
			label: UI_TEXT.bullishStake,
			value: `$${calculateStakeValue(market.totalStake, STAKE_RATIOS.bullish)}`
		},
		{
			label: UI_TEXT.bearishStake,
			value: `$${calculateStakeValue(market.totalStake, STAKE_RATIOS.bearish)}`
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

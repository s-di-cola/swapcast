<script lang="ts">
	import { ChartPieSolid } from 'flowbite-svelte-icons';
	import { formatCurrency } from '$lib/helpers/formatters';
	import type { Market } from '$lib/services/market';

	interface Props {
		market: Market;
	}

	interface SummaryItem {
		label: string;
		value: string;
		isStatus?: boolean;
	}

	interface StatusStyle {
		bg: string;
		text: string;
	}

	let { market }: Props = $props();

	const STATUS_STYLES: Record<string, StatusStyle> = {
		Open: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
		Expired: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
		Resolved: { bg: 'bg-gray-100', text: 'text-gray-800' }
	} as const;

	const UI_TEXT = {
		title: 'Market Summary',
		assetPair: 'Asset Pair:',
		status: 'Status:',
		priceThreshold: 'Price Threshold:'
	} as const;

	function getStatusStyles(status: string): StatusStyle {
		return STATUS_STYLES[status] || STATUS_STYLES.Resolved;
	}

	const summaryItems: SummaryItem[] = $derived([
		{
			label: UI_TEXT.assetPair,
			value: market.assetPair
		},
		{
			label: UI_TEXT.status,
			value: market.status,
			isStatus: true
		},
		{
			label: UI_TEXT.priceThreshold,
			value: `${formatCurrency(market.priceThreshold)}`
		}
	]);
</script>

<div class="rounded-lg bg-gray-50 p-4">
	<div class="mb-3 flex items-center">
		<ChartPieSolid class="mr-2 h-5 w-5 text-gray-600" />
		<h4 class="text-lg font-semibold text-gray-700">{UI_TEXT.title}</h4>
	</div>
	<div class="space-y-2">
		{#each summaryItems as item}
			<div class="flex justify-between">
				<span class="text-gray-600">{item.label}</span>
				{#if item.isStatus}
					{@const statusStyles = getStatusStyles(item.value)}
					<span
						class="rounded-full px-2.5 py-0.5 text-xs font-semibold {statusStyles.bg} {statusStyles.text}"
					>
						{item.value}
					</span>
				{:else}
					<span class="font-semibold">{item.value}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

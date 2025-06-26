<script lang="ts">
	import type { Market } from '$lib/services/market';
	import { formatCurrency } from '$lib/helpers/formatters';

	interface Props {
		market: Market;
	}

	let { market }: Props = $props();

	const STATUS_STYLES = {
		Open: { bg: 'bg-green-100', text: 'text-green-800' },
		Expired: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
		Resolved: { bg: 'bg-gray-100', text: 'text-gray-800' }
	} as const;

	function getStatusStyles(status: string) {
		return STATUS_STYLES[status as keyof typeof STATUS_STYLES] || STATUS_STYLES.Resolved;
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<!-- Market Status -->
	<div class="rounded-lg bg-white p-4 shadow-sm">
		<h3 class="text-sm font-medium text-gray-500">Status</h3>
		{#if market.status}
			{@const statusStyles = getStatusStyles(market.status)}
			<span class="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold {statusStyles.bg} {statusStyles.text}">
				{market.status}
			</span>
		{/if}
	</div>

	<!-- Expiration Time -->
	<div class="rounded-lg bg-white p-4 shadow-sm">
		<h3 class="text-sm font-medium text-gray-500">Expiration</h3>
		<p class="mt-1 text-lg font-semibold text-gray-900">{market.expirationDisplay}</p>
	</div>

	<!-- Price Threshold -->
	<div class="rounded-lg bg-white p-4 shadow-sm">
		<h3 class="text-sm font-medium text-gray-500">Price Threshold</h3>
		<p class="mt-1 text-lg font-semibold text-gray-900">${formatCurrency(market.priceThreshold)}</p>
	</div>

	<!-- Total Stake -->
	<div class="rounded-lg bg-white p-4 shadow-sm">
		<h3 class="text-sm font-medium text-gray-500">Total Stake</h3>
		<p class="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(market.totalStake)} ETH</p>
	</div>
</div> 
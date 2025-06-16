<script lang="ts">
	import { formatCurrency, formatEther, formatAddress } from '$lib/helpers/formatters';
	import type { Market } from '$lib/services/market';

	interface Props {
		market: Market;
	}

	let { market }: Props = $props();

	interface MockTransaction {
		id: string;
		timestamp: number;
		user: {
			address: string;
		};
		outcome: 0 | 1;
		amount: string;
	}

	// Mock data for transactions
	const mockTransactions: MockTransaction[] = [
		{
			id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
			timestamp: Date.now() - 3600000, // 1 hour ago
			user: {
				address: '0x1234567890abcdef1234567890abcdef12345678'
			},
			outcome: 1, // Bullish
			amount: '1000000000000000000' // 1 ETH
		},
		{
			id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
			timestamp: Date.now() - 7200000, // 2 hours ago
			user: {
				address: '0xabcdef1234567890abcdef1234567890abcdef12'
			},
			outcome: 0, // Bearish
			amount: '2000000000000000000' // 2 ETH
		},
		{
			id: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
			timestamp: Date.now() - 10800000, // 3 hours ago
			user: {
				address: '0x7890abcdef1234567890abcdef1234567890abcd'
			},
			outcome: 1, // Bullish
			amount: '1500000000000000000' // 1.5 ETH
		}
	];

	const TABLE_COLUMNS = [
		{ key: 'transaction', label: 'Transaction' },
		{ key: 'time', label: 'Time' },
		{ key: 'user', label: 'User' },
		{ key: 'position', label: 'Position' },
		{ key: 'amount', label: 'Amount' }
	] as const;

	const OUTCOME_STYLES = {
		1: { bg: 'bg-green-100', text: 'text-green-800' },
		0: { bg: 'bg-red-100', text: 'text-red-800' }
	} as const;

	const UI_TEXT = {
		title: 'Transaction History',
		noTransactions: 'No transactions found for this market.',
		showing: 'Showing',
		transactions: 'transactions'
	} as const;

	const ETHERSCAN_BASE_URL = 'https://etherscan.io/address/';

	function getEtherscanLink(address: string): string {
		return `${ETHERSCAN_BASE_URL}${address}`;
	}

	function formatTransactionHash(hash: string): string {
		return formatAddress(hash);
	}

	function formatUserAddress(address: string): string {
		return formatAddress(address);
	}

	function formatAmount(amount: string): string {
		return formatEther(amount);
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	function formatPredictionOutcome(outcome: number): string {
		return outcome === 1 ? 'Bullish' : 'Bearish';
	}

	function getOutcomeStyles(outcome: 0 | 1) {
		return OUTCOME_STYLES[outcome];
	}

	const hasTransactions = $derived(mockTransactions.length > 0);
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<h3 class="mb-4 text-lg font-semibold text-gray-800">{UI_TEXT.title}</h3>

	{#if !hasTransactions}
		<div class="py-8 text-center text-gray-500">
			<p>{UI_TEXT.noTransactions}</p>
		</div>
	{:else}
		<div class="relative overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-100">
				<thead>
					<tr>
						{#each TABLE_COLUMNS as column}
							<th
								class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>
								{column.label}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each mockTransactions as tx}
						{@const outcomeStyles = getOutcomeStyles(tx.outcome)}
						<tr class="transition-colors hover:bg-gray-50">
							<td class="px-4 py-3 text-sm whitespace-nowrap text-blue-600 hover:text-blue-800">
								<a
									href={getEtherscanLink(tx.id)}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-block max-w-[150px] truncate align-bottom"
								>
									{formatTransactionHash(tx.id)}
								</a>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
								{formatTimestamp(tx.timestamp)}
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
								<a
									href={getEtherscanLink(tx.user.address)}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-block max-w-[100px] truncate align-bottom text-blue-600 hover:text-blue-800"
								>
									{formatUserAddress(tx.user.address)}
								</a>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap">
								<span
									class="rounded-full px-2.5 py-0.5 text-xs font-medium {outcomeStyles.bg} {outcomeStyles.text}"
								>
									{formatPredictionOutcome(tx.outcome)}
								</span>
							</td>
							<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
								{formatAmount(tx.amount)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="mt-4 flex items-center justify-between">
			<div class="text-sm text-gray-500">
				{UI_TEXT.showing} {mockTransactions.length} {UI_TEXT.transactions}
			</div>
		</div>
	{/if}
</div> 
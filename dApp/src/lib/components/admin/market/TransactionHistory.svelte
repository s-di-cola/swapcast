<script lang="ts">
	import {formatAddress, formatEther} from '$lib/helpers/formatters';
	import type {Market} from '$lib/services/market';
	import {
		formatPredictionOutcome,
		formatTimestamp,
		getMarketPredictions,
		type SubgraphPrediction
	} from '$lib/services/subgraph';

	interface Props {
		market: Market;
	}

	interface TransactionState {
		data: SubgraphPrediction[];
		isLoading: boolean;
		error: string | null;
		page: number;
		pageSize: number;
	}

	interface TableColumn {
		key: string;
		label: string;
		className?: string;
	}

	interface OutcomeStyle {
		bg: string;
		text: string;
	}

	let { market }: Props = $props();

	let transactionState = $state<TransactionState>({
		data: [],
		isLoading: false,
		error: null,
		page: 1,
		pageSize: 10
	});

	const TABLE_COLUMNS: TableColumn[] = [
		{ key: 'transaction', label: 'Transaction' },
		{ key: 'time', label: 'Time' },
		{ key: 'user', label: 'User' },
		{ key: 'position', label: 'Position' },
		{ key: 'amount', label: 'Amount' }
	] as const;

	const OUTCOME_STYLES: Record<number, OutcomeStyle> = {
		1: { bg: 'bg-green-100', text: 'text-green-800' },
		0: { bg: 'bg-red-100', text: 'text-red-800' }
	} as const;

	const UI_TEXT = {
		title: 'Transaction History',
		loading: 'Loading transactions...',
		noTransactions: 'No transactions found for this market.',
		showing: 'Showing',
		transactions: 'transactions',
		previous: 'Previous',
		next: 'Next',
		retry: 'Retry',
		error: 'Error:'
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

	function getOutcomeStyles(outcome: number): OutcomeStyle {
		return OUTCOME_STYLES[outcome] || OUTCOME_STYLES[0];
	}

	async function fetchTransactions(): Promise<void> {
		if (!market?.id) return;

		transactionState.isLoading = true;
		transactionState.error = null;

		try {
			const data = await getMarketPredictions(
				market.id.toString(),
				transactionState.pageSize,
				transactionState.page
			);
			transactionState.data = data;
		} catch (err) {
			console.error('Failed to fetch transactions:', err);
			transactionState.error =
				err instanceof Error ? err.message : 'Failed to fetch transaction data';
		} finally {
			transactionState.isLoading = false;
		}
	}

	async function fetchMoreTransactions(direction: 'next' | 'prev'): Promise<void> {
		if (transactionState.isLoading || !market?.id) return;

		const canGoPrev = direction === 'prev' && transactionState.page > 1;
		const canGoNext =
			direction === 'next' && transactionState.data.length === transactionState.pageSize;

		if (!canGoPrev && !canGoNext) return;

		const previousPage = transactionState.page;

		if (direction === 'prev') {
			transactionState.page--;
		} else {
			transactionState.page++;
		}

		transactionState.isLoading = true;
		transactionState.error = null;

		try {
			transactionState.data = await getMarketPredictions(
				market.id.toString(),
				transactionState.pageSize,
				transactionState.page
			);
		} catch (err) {
			transactionState.page = previousPage;
			transactionState.error =
				err instanceof Error ? err.message : 'Failed to fetch transaction data';
		} finally {
			transactionState.isLoading = false;
		}
	}

	function handleRetry(): void {
		fetchTransactions();
	}

	function handlePrevious(): void {
		fetchMoreTransactions('prev');
	}

	function handleNext(): void {
		fetchMoreTransactions('next');
	}

	const canGoPrevious = $derived(transactionState.page > 1);
	const canGoNext = $derived(transactionState.data.length === transactionState.pageSize);
	const hasTransactions = $derived(transactionState.data.length > 0);
	const isInitialLoading = $derived(
		transactionState.isLoading && transactionState.data.length === 0
	);
	const isPaginating = $derived(transactionState.isLoading && transactionState.data.length > 0);

	$effect(() => {
		if (market?.id) {
			transactionState.page = 1;
			fetchTransactions();
		}
	});
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<h3 class="mb-4 text-lg font-semibold text-gray-800">{UI_TEXT.title}</h3>

	{#if isInitialLoading}
		<div class="flex items-center justify-center py-8">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
			></div>
			<span class="ml-2 text-gray-600">{UI_TEXT.loading}</span>
		</div>
	{:else if transactionState.error}
		<div class="rounded-md bg-red-50 p-4 text-sm text-red-800">
			<p>{UI_TEXT.error} {transactionState.error}</p>
			<button
				class="mt-2 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-800 transition-colors hover:bg-red-200"
				onclick={handleRetry}
			>
				{UI_TEXT.retry}
			</button>
		</div>
	{:else if !hasTransactions}
		<div class="py-8 text-center text-gray-500">
			<p>{UI_TEXT.noTransactions}</p>
		</div>
	{:else}
		<div class="relative overflow-x-auto">
			{#if isPaginating}
				<div class="bg-opacity-70 absolute inset-0 z-10 flex items-center justify-center bg-white">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
					></div>
				</div>
			{/if}

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
					{#each transactionState.data as tx}
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
	{/if}

	{#if hasTransactions}
		<div class="mt-4 flex items-center justify-between">
			<div class="text-sm text-gray-500">
				{UI_TEXT.showing}
				{transactionState.data.length}
				{UI_TEXT.transactions}
			</div>
			<div class="flex space-x-2">
				<button
					class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handlePrevious}
					disabled={transactionState.isLoading || !canGoPrevious}
				>
					{UI_TEXT.previous}
				</button>
				<button
					class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleNext}
					disabled={transactionState.isLoading || !canGoNext}
				>
					{UI_TEXT.next}
				</button>
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
	import { Card } from 'flowbite-svelte';
	
	interface Position {
		market: string;
		side: string;
		amount: string;
		status: string;
		date: string;
	}
	
	interface Props {
		positions?: Position[];
	}
	
	let { positions = [] }: Props = $props();
	
	let searchTerm = $state('');
	
	function getStatusClasses(status: string): string {
		switch (status) {
			case 'Open':
			case 'Win':
				return 'bg-emerald-100 text-emerald-700';
			case 'Pending':
				return 'bg-amber-100 text-amber-700';
			default:
				return 'bg-rose-100 text-rose-700';
		}
	}
	
	const filteredPositions = $derived(
		positions.filter(pos => 
			pos.market.toLowerCase().includes(searchTerm.toLowerCase()) ||
			pos.side.toLowerCase().includes(searchTerm.toLowerCase()) ||
			pos.status.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);
	</script>
	
	<Card class="w-full rounded-3xl border-0 bg-white/95 p-6 shadow-2xl">
		<div class="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<h3 class="mb-2 text-lg font-semibold md:mb-0">Your Positions</h3>
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search positions..."
				class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 focus:outline-none md:w-64"
			/>
		</div>
		
		<div class="overflow-x-auto">
			<table class="min-w-full align-middle text-sm">
				<thead>
					<tr class="border-b text-gray-500">
						<th class="px-2 py-2 text-left">Market</th>
						<th class="px-2 py-2 text-left">Position</th>
						<th class="px-2 py-2 text-left">Amount</th>
						<th class="px-2 py-2 text-left">Status</th>
						<th class="px-2 py-2 text-left">Date</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredPositions as pos}
						<tr class="border-b transition hover:bg-emerald-50">
							<td class="px-2 py-2">{pos.market}</td>
							<td class="px-2 py-2">{pos.side}</td>
							<td class="px-2 py-2">{pos.amount}</td>
							<td class="px-2 py-2">
								<span class="rounded-full px-2 py-1 {getStatusClasses(pos.status)}">
									{pos.status}
								</span>
							</td>
							<td class="px-2 py-2">{pos.date}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
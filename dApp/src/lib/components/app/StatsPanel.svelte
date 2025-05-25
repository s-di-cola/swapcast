<script lang="ts">
	export let marketConsensus: number;
	export let accuracy: number;
	export let rank: number;
	import { Card } from 'flowbite-svelte';
</script>

<div class="flex h-full flex-col gap-8">
	<Card class="flex h-full flex-col gap-4 rounded-3xl border-0 bg-white/95 p-6 shadow-2xl">
		<h3 class="mb-2 font-semibold">Market Predictions</h3>
		<div class="flex h-20 items-center justify-center">
			<span class="text-base text-gray-700"
				>Market consensus: <span class="font-bold text-emerald-600"
					>${marketConsensus} (bullish)</span
				></span
			>
		</div>
	</Card>
	<Card class="flex h-full flex-col gap-4 rounded-3xl border-0 bg-white/95 p-6 shadow-2xl">
		<h3 class="mb-2 font-semibold">Your Performance</h3>
		<div class="flex flex-col items-center justify-center gap-2">
			<span class="text-sm text-gray-500">Accuracy</span>
			<span class="text-2xl font-bold text-emerald-500">{accuracy}%</span>
			<span class="text-sm text-gray-500">Rank</span>
			<span class="text-2xl font-bold text-amber-500">#{rank}</span>
		</div>
	</Card>
</div>

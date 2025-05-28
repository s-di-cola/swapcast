<script lang="ts">
	export let price: number;
	export let symbol: string = 'ETH/USDC';
    import {Card} from 'flowbite-svelte';
</script>

<Card class="flex flex-col items-center gap-3 rounded-2xl border-0 bg-white/95 p-5 shadow-xl">
	<span class="mb-1 text-xs font-semibold text-gray-500">Current Price</span>
	<span class="text-3xl font-extrabold text-gray-900"
		>${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span
	>
	<span class="mb-2 text-sm text-gray-400">{symbol}</span>
	<svg width="100%" height="48" viewBox="0 0 120 48" fill="none" xmlns="http://www.w3.org/2000/svg">
		<polyline
			fill="none"
			stroke="#34d399"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			points="0,38 20,28 40,32 60,14 80,22 100,10 120,38"
		/>
		<circle cx="100" cy="10" r="3" fill="#f59e42" />
	</svg>
</Card>

<script lang="ts">
  export let price: number;
  export let symbol: string = 'ETH/USDC';
  // TradingView widget integration can go here later
  import { Card } from 'flowbite-svelte';
</script>

<Card class="bg-white/95 shadow-xl rounded-2xl p-5 border-0 flex flex-col gap-3 items-center">
  <span class="text-xs text-gray-500 font-semibold mb-1">Current Price</span>
  <span class="text-3xl font-extrabold text-gray-900">${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
  <span class="text-sm text-gray-400 mb-2">{symbol}</span>
  <svg width="100%" height="48" viewBox="0 0 120 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="0,38 20,28 40,32 60,14 80,22 100,10 120,38" />
    <circle cx="100" cy="10" r="3" fill="#f59e42" />
  </svg>
</Card>

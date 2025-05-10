<script lang="ts">
  export let marketConsensus: number;
  export let accuracy: number;
  export let rank: number;
  import { Card } from 'flowbite-svelte';
</script>
<div class="flex flex-col gap-8 h-full">
  <Card class="bg-white/95 shadow-2xl rounded-3xl p-6 border-0 flex flex-col gap-4 h-full">
    <h3 class="font-semibold mb-2">Market Predictions</h3>
    <div class="h-20 flex items-center justify-center">
      <span class="text-base text-gray-700">Market consensus: <span class="text-emerald-600 font-bold">${marketConsensus} (bullish)</span></span>
    </div>
  </Card>
  <Card class="bg-white/95 shadow-2xl rounded-3xl p-6 border-0 flex flex-col gap-4 h-full">
    <h3 class="font-semibold mb-2">Your Performance</h3>
    <div class="flex flex-col gap-2 items-center justify-center">
      <span class="text-gray-500 text-sm">Accuracy</span>
      <span class="text-2xl font-bold text-emerald-500">{accuracy}%</span>
      <span class="text-gray-500 text-sm">Rank</span>
      <span class="text-2xl font-bold text-amber-500">#{rank}</span>
    </div>
  </Card>
</div>

<script lang="ts">
  import { Card } from 'flowbite-svelte';
</script>
<Card class="bg-white/95 shadow-2xl rounded-2xl p-5 border-0 flex flex-col gap-3 items-center">
  <span class="text-xs text-gray-500 font-semibold mb-1">Prediction Market</span>
  <svg width="100%" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Bullish bar -->
    <rect x="18" y="20" width="28" height="30" rx="4" fill="#34d399" />
    <text x="32" y="18" text-anchor="middle" font-size="10" fill="#34d399">Bullish</text>
    <!-- Bearish bar -->
    <rect x="74" y="38" width="28" height="12" rx="4" fill="#f59e42" />
    <text x="88" y="36" text-anchor="middle" font-size="10" fill="#f59e42">Bearish</text>
  </svg>
</Card>

<script lang="ts">
  export let payAmount: number;
  export let payToken: string;
  export let receiveAmount: number;
  export let receiveToken: string;
  export let ethPrice: number;
  export let networkFee: number;
  export let predictionSide: string;
  export let onPredictionSelect: (side: string) => void;
  import { ArrowRightOutline } from 'flowbite-svelte-icons';
  import { Card } from 'flowbite-svelte';
</script>


  <h2 class="text-2xl font-extrabold mb-2 tracking-tight">Swap</h2>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-4">
      <input type="number" min="0" step="any" class="flex-1 text-3xl font-bold bg-transparent outline-none px-0 py-2" bind:value={payAmount} />
      <button class="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold text-lg shadow transition">
        <img src="https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=026" alt="ETH" class="w-5 h-5 rounded-full bg-white" />
        {payToken}
      </button>
    </div>
    <div class="flex justify-center my-2">
      <span class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 shadow-lg animate-bounce">
        <ArrowRightOutline class="w-8 h-8 text-emerald-500" />
      </span>
    </div>
    <div class="flex items-center gap-4">
      <input type="number" min="0" step="any" class="flex-1 text-3xl font-bold bg-transparent outline-none px-0 py-2" value={receiveAmount} readonly />
      <button class="flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 hover:bg-pink-200 text-pink-700 font-bold text-lg shadow transition">
        <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=026" alt="USDC" class="w-5 h-5 rounded-full bg-white" />
        {receiveToken}
      </button>
    </div>
    <div class="flex justify-between text-xs text-gray-400 mt-2">
      <span>Rate: 1 ETH ≈ {ethPrice} USDC</span>
      <span>Fee: ≈ ${networkFee}</span>
    </div>
    <div class="mt-4 bg-emerald-50/80 rounded-xl px-4 py-3 flex flex-col gap-3 border border-emerald-100">
      <div class="flex items-center gap-4">
        <span class="font-semibold text-gray-700">Prediction (1% of swap):</span>
        <span class="text-emerald-700 font-mono">{(payAmount * 0.01).toFixed(4)} {payToken}</span>
      </div>
      <div class="flex gap-4 mt-2">
        <button class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-lg font-bold transition border-2 border-emerald-400 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus:bg-emerald-300 focus:outline-none {predictionSide === 'bullish' ? 'ring-2 ring-emerald-400' : ''}" on:click={() => onPredictionSelect('bullish')}>
          <ArrowRightOutline class="w-5 h-5 rotate-45" /> Bullish
        </button>
        <button class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-lg font-bold transition border-2 border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:bg-rose-200 focus:outline-none {predictionSide === 'bearish' ? 'ring-2 ring-rose-400' : ''}" on:click={() => onPredictionSelect('bearish')}>
          <ArrowRightOutline class="w-5 h-5 -rotate-45" /> Bearish
        </button>
      </div>
      <div class="text-xs text-gray-500 mt-2">
        You are predicting <span class="font-bold text-emerald-600">{predictionSide === 'bullish' ? 'Bullish' : 'Bearish'}</span> with <span class="font-mono">{(payAmount * 0.01).toFixed(4)} {payToken}</span> (auto-allocated from your swap).
      </div>
    </div>
    <button class="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 via-emerald-400 to-emerald-500 text-white font-bold text-lg shadow-lg hover:scale-[1.02] transition mt-4">SWAP & PREDICT</button>
  </div>


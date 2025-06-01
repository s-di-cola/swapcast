<script lang="ts">
  import type { Token } from '../../../types';

  let {
    label,
    amount = $bindable(0),
    token,
    onAmountChange,
    readOnly = false,
    disabled = false,
    showBalance = false,
    ethPrice = 0,
    showExchangeRate = false,
    exchangeRate = '0.00',
    fromTokenSymbol = '',
    toTokenSymbol = ''
  }: {
    label: string;
    amount: number;
    token: Token;
    onAmountChange: (value: number) => void;
    readOnly?: boolean;
    disabled?: boolean;
    showBalance?: boolean;
    ethPrice?: number;
    showExchangeRate?: boolean;
    exchangeRate?: string;
    fromTokenSymbol?: string;
    toTokenSymbol?: string;
  } = $props();

  function handleInput(event: Event): void {
    if (readOnly) return;
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value) || 0;
    onAmountChange(value);
  }

  function handleMax(): void {
    if (readOnly || !token?.balance) return;
    onAmountChange(token.balance);
  }
</script>

<div class="space-y-2">
  <label class="text-sm font-medium text-gray-700">{label}</label>
  <div class="group relative rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-all hover:border-gray-300 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-sm">
    <div class="flex items-center justify-between">
      <input
        type="number"
        bind:value={amount}
        oninput={handleInput}
        class="flex-1 border-0 bg-transparent text-2xl font-semibold text-gray-900 placeholder-gray-400 focus:ring-0 focus:outline-none"
        placeholder="0.00"
        min="0"
        step="0.000001"
        {readOnly}
        {disabled}
      />
      <button
        type="button"
        class="ml-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-50"
        disabled={disabled || !token}
      >
        {#if token}
          <div class="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
          <span>{token.symbol}</span>
        {:else}
          <span>Select</span>
        {/if}
      </button>
    </div>
    
    <div class="mt-2 flex justify-between text-xs text-gray-500">
      {#if showBalance}
        <button 
          type="button" 
          onclick={handleMax}
          class="text-blue-600 hover:text-blue-700 hover:underline"
          disabled={disabled || !token?.balance}
        >
          Available: {token?.balance?.toFixed(6) || '0.0'} {token?.symbol || ''}
        </button>
        <span>~${(amount * ethPrice).toFixed(2)}</span>
      {:else if showExchangeRate}
        <span>1 {fromTokenSymbol} = {exchangeRate} {toTokenSymbol}</span>
        <span>Fee: 0.3%</span>
      {/if}
    </div>
  </div>
</div>

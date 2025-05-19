<script lang="ts">
  import { goto } from '$app/navigation';
  import WalletConnection from '$lib/components/common/WalletConnection.svelte';
  
  let { variant = 'landing' } = $props<{
    variant?: 'landing' | 'app';
  }>();
  
  function goToApp() {
    goto('/app');
  }
</script>

<header class="fixed top-0 left-0 w-full bg-white bg-opacity-90 backdrop-blur-sm z-50 border-b border-gray-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center">
        <a href={variant === 'app' ? '/app' : '/'} 
           class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent hover:from-indigo-500 hover:to-sky-400 transition-colors">
          SwapCast
        </a>
      </div>
      
      {#if variant === 'landing'}
        <nav class="hidden md:flex space-x-8">
          <a href="#features" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Features</a>
          <a href="#how-it-works" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">How it works</a>
          <a href="#developers" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Developers</a>
        </nav>
      {:else}
        <nav class="hidden md:flex space-x-8">
          <a href="/app" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Dashboard</a>
          <a href="/app/markets" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Markets</a>
          <a href="/app/portfolio" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Portfolio</a>
        </nav>
      {/if}
      
      <div>
        <WalletConnection />
      </div>
    </div>
  </div>
</header>

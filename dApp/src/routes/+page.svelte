<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Button, Card } from 'flowbite-svelte';
  import { ArrowRightOutline, ChartPieOutline, AwardOutline, TicketOutline, CogOutline, LinkOutline } from 'flowbite-svelte-icons';

  // Wallet connection state
  let walletConnected = false;
  let walletConnecting = false;
  
  // Connect wallet function
  async function connectWallet() {
    try {
      walletConnecting = true;
      // Here you would add your actual wallet connection logic
      // For now, we'll simulate a connection after a brief delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      walletConnected = true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      walletConnecting = false;
    }
  }
  
  // Navigate to app after wallet connection
  function goToApp() {
    goto('/app');
  }
</script>

<section class="relative min-h-screen bg-slate-50 flex flex-col justify-center overflow-hidden">
  <!-- Animated SVG background -->
  <svg class="absolute -top-32 -left-32 w-[48rem] h-[48rem] opacity-30 blur-2xl animate-spin-slow pointer-events-none z-0" viewBox="0 0 700 700" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="a" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop stop-color="#0EA5E9"/>
        <stop offset="1" stop-color="#14B8A6"/>
      </radialGradient>
    </defs>
    <circle cx="350" cy="350" r="320" fill="url(#a)" />
  </svg>
  
  <!-- Hero Section -->
  <div class="flex-1 flex flex-col items-center justify-center py-24 px-4">
    <div class="max-w-2xl w-full text-center animate-fade-in-up">
      <!-- Logo/Icon -->
      <div class="flex justify-center mb-4">
        <span class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg ring-2 ring-sky-200">
          <ChartPieOutline class="w-12 h-12 text-sky-500" />
        </span>
      </div>
      <h1 class="text-5xl md:text-6xl font-extrabold mb-2 text-gray-900">
        <span class="bg-gradient-to-r from-sky-600 to-teal-500 bg-clip-text text-transparent">SwapCast</span>
      </h1>
      <p class="mt-2 text-xl md:text-2xl text-gray-600 font-medium">
        Swap, Predict, Earn. Seamlessly integrate market predictions into your Uniswap trades and get rewarded for your foresight.
      </p>
      <div class="flex justify-center mb-4 mt-4">
        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 shadow-sm animate-bounce-slow">
          <AwardOutline class="w-4 h-4 text-sky-500" /> Live on Ethereum
        </span>
      </div>
      <div class="mt-8 flex flex-col items-center gap-4">
        {#if walletConnecting}
          <Button color="primary" size="xl" class="px-8 py-3 text-lg font-semibold shadow-lg bg-gradient-to-r from-sky-500 to-teal-500 hover:from-teal-500 hover:to-sky-500 transition-all duration-300 flex items-center gap-2" disabled>
            <div class="animate-spin h-5 w-5 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
            Connecting...
          </Button>
        {:else if walletConnected}
          <div>
            <button on:click={goToApp} class="px-8 py-3 text-lg font-semibold shadow-lg bg-gradient-to-r from-sky-500 to-teal-500 hover:from-teal-500 hover:to-sky-500 transition-all duration-300 flex items-center gap-2 text-white rounded-lg">
              <ArrowRightOutline class="w-5 h-5" /> Enter App
            </button>
          </div>
        {:else}
          <div>
            <button on:click={connectWallet} class="px-8 py-3 text-lg font-semibold shadow-lg bg-gradient-to-r from-sky-500 to-teal-500 hover:from-teal-500 hover:to-sky-500 transition-all duration-300 animate-pulse-on-hover flex items-center gap-2 text-white rounded-lg">
              <ArrowRightOutline class="w-5 h-5" /> Connect Wallet
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div class="bg-white bg-opacity-80 py-12 px-4 border-t border-slate-200">
    <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
      <Card class="text-center shadow-none border-0 bg-transparent transition-transform hover:-translate-y-2 hover:shadow-xl group">
        <div class="flex justify-center mb-2">
          <AwardOutline class="w-8 h-8 text-sky-500 group-hover:scale-110 transition-transform" />
        </div>
        <div class="font-semibold text-gray-800">Predict While You Swap</div>
        <div class="text-gray-500 text-sm mt-1">Turn every Uniswap v4 trade into a strategic play. Express your market conviction (bullish or bearish) on the asset pair directly during your swap.</div>
      </Card>
      <Card class="text-center shadow-none border-0 bg-transparent transition-transform hover:-translate-y-2 hover:shadow-xl group">
        <div class="flex justify-center mb-2">
          <TicketOutline class="w-8 h-8 text-teal-500 group-hover:scale-110 transition-transform" />
        </div>
        <div class="font-semibold text-gray-800">NFT Positions</div>
        <div class="text-gray-500 text-sm mt-1">Your prediction, your asset. Every stance you take is minted as a unique SwapCast NFT, representing your position and potential rewards. Tradeable, transferable, verifiable.</div>
      </Card>
      <Card class="text-center shadow-none border-0 bg-transparent transition-transform hover:-translate-y-2 hover:shadow-xl group">
        <div class="flex justify-center mb-2">
          <CogOutline class="w-8 h-8 text-teal-500 group-hover:scale-110 transition-transform" />
        </div>
        <div class="font-semibold text-gray-800">Automated Rewards</div>
        <div class="text-gray-500 text-sm mt-1">Fair, transparent, and automated. We leverage Chainlink's industry-standard oracles for accurate market resolution and smart contracts to distribute rewards efficiently to winning predictions.</div>
      </Card>
      <Card class="text-center shadow-none border-0 bg-transparent transition-transform hover:-translate-y-2 hover:shadow-xl group">
        <div class="flex justify-center mb-2">
          <LinkOutline class="w-8 h-8 text-sky-400 group-hover:scale-110 transition-transform" />
        </div>
        <div class="font-semibold text-gray-800">Powered by Uniswap & Chainlink</div>
        <div class="text-gray-500 text-sm mt-1">Harnessing the power of DeFi's titans. SwapCast integrates deeply with Uniswap v4 hooks and Chainlink's decentralized services to provide a robust and cutting-edge prediction market experience.</div>
      </Card>
    </div>
  </div>

  <footer class="text-center py-6 text-gray-400 text-xs flex flex-col items-center gap-2">
    <div>&copy; {new Date().getFullYear()} SwapCast. All rights reserved.</div>
  </footer>

<style>
  .animate-fade-in-up {
    animation: fadeInUp 1s cubic-bezier(0.39, 0.575, 0.565, 1) both;
  }
  .animate-fade-in {
    animation: fadeIn 1.2s cubic-bezier(0.39, 0.575, 0.565, 1) both;
  }
  @keyframes fadeInUp {
    0% {
      opacity: 0;
      transform: translateY(40px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  .animate-bounce-slow {
    animation: bounce 2.5s infinite;
  }
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  .animate-pulse-on-hover:hover {
    animation: pulse 1s;
  }
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
    }
    70% {
      box-shadow: 0 0 0 16px rgba(16, 185, 129, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }
</style>
</section>
<script lang="ts">
  import { Button, Card } from 'flowbite-svelte';
  import { AwardSolid, TicketOutline, ArrowRightOutline, CogOutline, LinkOutline, ChartPieOutline } from 'flowbite-svelte-icons';
  import { onMount } from 'svelte';
  // If you have a wallet connect component, import it here
  // import WalletConnect from '$lib/components/WalletConnect.svelte';

  // Placeholder for wallet connection logic
  let walletConnected = false;
  function connectWallet() {
    // TODO: integrate AppKit or your wallet connect logic
    walletConnected = true;
  }
  // Social links
  const socials = [
    { href: 'https://x.com/', label: 'Twitter/X', icon: 'M12 2C6.48 2 2 6.48 2 12c0 4.84 3.68 8.84 8.36 9.72.61.11.84-.26.84-.58v-2.01c-3.4.74-4.12-1.64-4.12-1.64-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.74.08-.74 1.21.09 1.85 1.25 1.85 1.25 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.71-.31-5.57-1.36-5.57-6.05 0-1.34.48-2.44 1.26-3.3-.13-.31-.55-1.56.12-3.25 0 0 1.02-.33 3.34 1.26a11.5 11.5 0 0 1 3.04-.41c1.03.01 2.07.14 3.04.41 2.32-1.59 3.34-1.26 3.34-1.26.67 1.69.25 2.94.12 3.25.78.86 1.26 1.96 1.26 3.3 0 4.7-2.87 5.74-5.6 6.04.43.37.81 1.09.81 2.2v3.27c0 .32.23.7.85.58C20.32 20.84 24 16.84 24 12c0-5.52-4.48-10-10-10z' },
    { href: 'https://discord.com/', label: 'Discord', icon: 'M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.0371A19.7363 19.7363 0 0 0 3.677 4.3698a.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.1047 1.5476 4.1356 2.4894 6.1287 3.1042a.0777.0777 0 0 0 .0842-.0276c.4722-.6491.8931-1.3406 1.2482-2.0757a.076.076 0 0 0-.0416-.1047c-.6528-.2476-1.2743-.549-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2917a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.0994.246.1974.3728.2917a.077.077 0 0 1-.0066.1277c-.598.3432-1.2206.6447-1.8734.8923a.0766.0766 0 0 0-.0407.1057c.3604.7351.7812 1.4266 1.2472 2.0757a.076.076 0 0 0 .0843.0286c1.993-.6148 4.0239-1.5566 6.1286-3.1042a.077.077 0 0 0 .0313-.0551c.5004-5.177-.8382-9.6739-3.5485-13.6603a.061.061 0 0 0-.0312-.0286z' },
    { href: 'https://github.com/', label: 'GitHub', icon: 'M12 2C6.48 2 2 6.48 2 12c0 4.84 3.68 8.84 8.36 9.72.61.11.84-.26.84-.58v-2.01c-3.4.74-4.12-1.64-4.12-1.64-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.74.08-.74 1.21.09 1.85 1.25 1.85 1.25 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.71-.31-5.57-1.36-5.57-6.05 0-1.34.48-2.44 1.26-3.3-.13-.31-.55-1.56.12-3.25 0 0 1.02-.33 3.34 1.26a11.5 11.5 0 0 1 3.04-.41c1.03.01 2.07.14 3.04.41 2.32-1.59 3.34-1.26 3.34-1.26.67 1.69.25 2.94.12 3.25.78.86 1.26 1.96 1.26 3.3 0 4.7-2.87 5.74-5.6 6.04.43.37.81 1.09.81 2.2v3.27c0 .32.23.7.85.58C20.32 20.84 24 16.84 24 12c0-5.52-4.48-10-10-10z' }
  ];
</script>

<section class="relative min-h-screen bg-slate-50 flex flex-col justify-between overflow-hidden">
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
        Swap, Predict, Earn. Seamlessly integrate market predictions into your Uniswap trades and get rewarded for your foresight. Your conviction, your NFT.
      </p>
      <div class="flex justify-center mb-4">
        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 shadow-sm animate-bounce-slow">
          <AwardSolid class="w-4 h-4 text-sky-500" /> Live on Ethereum
        </span>
      </div>
      <div class="mt-8 flex flex-col items-center gap-4">
        {#if !walletConnected}
          <Button color="primary" size="xl" class="px-8 py-3 text-lg font-semibold shadow-lg bg-gradient-to-r from-sky-500 to-teal-500 hover:from-teal-500 hover:to-sky-500 transition-all duration-300 animate-pulse-on-hover flex items-center gap-2" on:click={connectWallet}>
            <ArrowRightOutline class="w-5 h-5" /> Connect Wallet
          </Button>
        {:else}
          <Button color="green" size="xl" class="px-8 py-3 text-lg font-semibold shadow-lg flex items-center gap-2" disabled>
            Wallet Connected
          </Button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Highlights Section -->
  <div class="bg-white bg-opacity-80 py-12 px-4 border-t border-slate-200">
    <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
      <Card class="text-center shadow-none border-0 bg-transparent transition-transform hover:-translate-y-2 hover:shadow-xl group">
        <div class="flex justify-center mb-2">
          <AwardSolid class="w-8 h-8 text-sky-500 group-hover:scale-110 transition-transform" />
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
    <div class="flex gap-4 justify-center mb-1">
      {#each socials as social}
        <a href={social.href} target="_blank" rel="noopener" aria-label={social.label} class="hover:text-sky-500 transition-colors">
          <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
            <path d={social.icon}></path>
          </svg>
        </a>
      {/each}
    </div>
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
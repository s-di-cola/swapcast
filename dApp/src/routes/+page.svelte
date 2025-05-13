<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card } from 'flowbite-svelte';
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

<div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
  <!-- Header/Navigation -->
  <header class="fixed top-0 left-0 w-full bg-white bg-opacity-90 backdrop-blur-sm z-50 border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <span class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">SwapCast</span>
        </div>
        <nav class="hidden md:flex space-x-8">
          <a href="#features" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Features</a>
          <a href="#how-it-works" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">How it works</a>
          <a href="#developers" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Developers</a>
        </nav>
        <div>
          {#if walletConnected}
            <button on:click={goToApp} class="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Go to App
            </button>
          {:else}
            <button on:click={connectWallet} class="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              {#if walletConnecting}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              {:else}
                Connect Wallet
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </header>
  
  <!-- Hero Section -->
  <section class="pt-32 pb-20 md:pt-40 md:pb-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <!-- Left column: Text content -->
        <div class="space-y-8">
          <div>
            <span class="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Live on Ethereum Mainnet
            </span>
          </div>
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
            <span class="block">Predict markets.</span>
            <span class="block text-indigo-600">Earn rewards.</span>
          </h1>
          <p class="text-lg md:text-xl text-gray-500 max-w-2xl">
            SwapCast seamlessly integrates market predictions into your Uniswap trades. Express your conviction, mint your position as an NFT, and get rewarded for your foresight.
          </p>
          <div class="flex flex-wrap gap-4">
            {#if walletConnecting}
              <button disabled class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 opacity-75">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </button>
            {:else if walletConnected}
              <button on:click={goToApp} class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                Enter App
                <svg class="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            {:else}
              <button on:click={connectWallet} class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                Connect Wallet
              </button>
            {/if}
            <a href="#how-it-works" class="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
              Learn more
            </a>
          </div>
        </div>
        
        <!-- Right column: Illustration -->
        <div class="hidden md:block relative">
          <div class="absolute inset-0 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-2xl transform rotate-3 scale-105"></div>
          <div class="relative bg-white p-6 rounded-xl shadow-xl border border-gray-100 overflow-hidden">
            <div class="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 bg-indigo-600 rounded-full opacity-25"></div>
            <div class="absolute bottom-0 left-0 -mb-4 -ml-4 h-16 w-16 bg-blue-600 rounded-full opacity-25"></div>
            
            <!-- Mockup of prediction interface -->
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-sm font-medium text-gray-500">ETH/USDC Market</span>
                <span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
              </div>
              <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <div>
                  <p class="text-xs text-gray-500">Current Price</p>
                  <p class="text-xl font-bold">$2,389.42</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Threshold</p>
                  <p class="text-xl font-bold">$2,400.00</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 border border-green-200 bg-green-50 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors">
                  <p class="text-sm font-medium text-green-800">Above</p>
                  <p class="text-xs text-green-600 mt-1">75% conviction</p>
                </div>
                <div class="p-3 border border-red-200 bg-red-50 rounded-lg text-center cursor-pointer hover:bg-red-100 transition-colors">
                  <p class="text-sm font-medium text-red-800">Below</p>
                  <p class="text-xs text-red-600 mt-1">25% conviction</p>
                </div>
              </div>
              <div class="pt-2">
                <div class="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-indigo-600 rounded-full" style="width: 75%"></div>
                </div>
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Bullish</span>
                  <span>Bearish</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-24 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Key Features</h2>
        <p class="mt-4 max-w-2xl mx-auto text-xl text-gray-500">A seamless integration of predictions with your trading experience.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <!-- Feature 1 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div class="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-5">
            <AwardOutline class="w-6 h-6 text-indigo-600" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Predict While You Swap</h3>
          <p class="text-gray-500">Turn every Uniswap v4 trade into a strategic play. Express your market conviction (bullish or bearish) on the asset pair directly during your swap.</p>
        </div>
        
        <!-- Feature 2 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div class="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-5">
            <TicketOutline class="w-6 h-6 text-indigo-600" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">NFT Positions</h3>
          <p class="text-gray-500">Your prediction, your asset. Every stance you take is minted as a unique SwapCast NFT, representing your position and potential rewards.</p>
        </div>
        
        <!-- Feature 3 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div class="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-5">
            <CogOutline class="w-6 h-6 text-indigo-600" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Automated Rewards</h3>
          <p class="text-gray-500">Fair, transparent, and automated. We leverage Chainlink's industry-standard oracles for accurate market resolution and distribute rewards efficiently.</p>
        </div>
        
        <!-- Feature 4 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div class="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-5">
            <LinkOutline class="w-6 h-6 text-indigo-600" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Powered by Uniswap & Chainlink</h3>
          <p class="text-gray-500">Harnessing the power of DeFi's titans. SwapCast integrates deeply with Uniswap v4 hooks and Chainlink's decentralized services.</p>
        </div>
      </div>
    </div>
  </section>
  
  <!-- How it Works Section -->
  <section id="how-it-works" class="py-24 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">How SwapCast Works</h2>
        <p class="mt-4 max-w-2xl mx-auto text-xl text-gray-500">Simple steps to start predicting and earning.</p>
      </div>
      
      <div class="relative">
        <!-- Connection line -->
        <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-indigo-100"></div>
        
        <!-- Steps -->
        <div class="space-y-16">
          <!-- Step 1 -->
          <div class="relative">
            <div class="flex flex-col md:flex-row items-center">
              <div class="md:w-1/2 flex justify-end pr-8 pb-8 md:pb-0">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-md">
                  <div class="flex items-center mb-4">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <span class="text-indigo-600 font-bold">1</span>
                    </div>
                    <h3 class="text-xl font-medium text-gray-900">Connect Your Wallet</h3>
                  </div>
                  <p class="text-gray-500">Start by connecting your Ethereum wallet to the SwapCast platform. We support MetaMask, WalletConnect, and other popular wallets.</p>
                </div>
              </div>
              <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 -translate-y-1/4">
                <div class="h-8 w-8 rounded-full border-4 border-white bg-indigo-500"></div>
              </div>
              <div class="md:w-1/2 pl-8 md:pt-16">
                <div class="bg-indigo-50 p-4 rounded-lg max-w-xs">
                  <p class="text-sm text-indigo-700 italic">"Connecting your wallet is secure and only requires a signature, not a transaction."</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 2 -->
          <div class="relative">
            <div class="flex flex-col md:flex-row items-center">
              <div class="md:w-1/2 flex justify-end pr-8 md:order-2 pb-8 md:pb-0">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-md">
                  <div class="flex items-center mb-4">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <span class="text-indigo-600 font-bold">2</span>
                    </div>
                    <h3 class="text-xl font-medium text-gray-900">Select a Market</h3>
                  </div>
                  <p class="text-gray-500">Browse available markets or create a new one. Each market represents an asset pair with a price threshold and expiration time.</p>
                </div>
              </div>
              <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 -translate-y-1/4">
                <div class="h-8 w-8 rounded-full border-4 border-white bg-indigo-500"></div>
              </div>
              <div class="md:w-1/2 pl-8 md:order-1 md:pt-16">
                <div class="bg-indigo-50 p-4 rounded-lg max-w-xs ml-auto">
                  <p class="text-sm text-indigo-700 italic">"Markets are powered by Chainlink price feeds for reliable and tamper-proof price data."</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 3 -->
          <div class="relative">
            <div class="flex flex-col md:flex-row items-center">
              <div class="md:w-1/2 flex justify-end pr-8 pb-8 md:pb-0">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-md">
                  <div class="flex items-center mb-4">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <span class="text-indigo-600 font-bold">3</span>
                    </div>
                    <h3 class="text-xl font-medium text-gray-900">Make Your Prediction</h3>
                  </div>
                  <p class="text-gray-500">Express your conviction on whether the asset's price will be above or below the threshold at expiration. Stake your tokens to back your prediction.</p>
                </div>
              </div>
              <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 -translate-y-1/4">
                <div class="h-8 w-8 rounded-full border-4 border-white bg-indigo-500"></div>
              </div>
              <div class="md:w-1/2 pl-8 md:pt-16">
                <div class="bg-indigo-50 p-4 rounded-lg max-w-xs">
                  <p class="text-sm text-indigo-700 italic">"Your prediction is minted as an NFT, which you can hold, transfer, or sell on any NFT marketplace."</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 4 -->
          <div class="relative">
            <div class="flex flex-col md:flex-row items-center">
              <div class="md:w-1/2 flex justify-end pr-8 md:order-2">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-md">
                  <div class="flex items-center mb-4">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <span class="text-indigo-600 font-bold">4</span>
                    </div>
                    <h3 class="text-xl font-medium text-gray-900">Collect Rewards</h3>
                  </div>
                  <p class="text-gray-500">When the market expires, if your prediction was correct, you'll receive rewards proportional to your stake and the total conviction distribution.</p>
                </div>
              </div>
              <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 -translate-y-1/4">
                <div class="h-8 w-8 rounded-full border-4 border-white bg-indigo-500"></div>
              </div>
              <div class="md:w-1/2 pl-8 md:order-1 md:pt-16">
                <div class="bg-indigo-50 p-4 rounded-lg max-w-xs ml-auto">
                  <p class="text-sm text-indigo-700 italic">"Rewards are automatically distributed to winners through smart contracts, with no manual intervention required."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-white border-t border-gray-200">
    <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h3 class="text-sm font-semibold text-gray-400 tracking-wider uppercase">Product</h3>
          <ul class="mt-4 space-y-4">
            <li><a href="#features" class="text-base text-gray-500 hover:text-gray-900">Features</a></li>
            <li><a href="#how-it-works" class="text-base text-gray-500 hover:text-gray-900">How it Works</a></li>
            <li><a href="/app" class="text-base text-gray-500 hover:text-gray-900">Dashboard</a></li>
            <li><a href="/docs" class="text-base text-gray-500 hover:text-gray-900">Documentation</a></li>
          </ul>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-400 tracking-wider uppercase">Technology</h3>
          <ul class="mt-4 space-y-4">
            <li><a href="https://uniswap.org" class="text-base text-gray-500 hover:text-gray-900">Uniswap</a></li>
            <li><a href="https://chain.link" class="text-base text-gray-500 hover:text-gray-900">Chainlink</a></li>
            <li><a href="https://ethereum.org" class="text-base text-gray-500 hover:text-gray-900">Ethereum</a></li>
            <li><a href="https://docs.uniswap.org/contracts/v4/overview" class="text-base text-gray-500 hover:text-gray-900">Uniswap v4 Hooks</a></li>
          </ul>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-400 tracking-wider uppercase">Resources</h3>
          <ul class="mt-4 space-y-4">
            <li><a href="/faq" class="text-base text-gray-500 hover:text-gray-900">FAQ</a></li>
            <li><a href="/support" class="text-base text-gray-500 hover:text-gray-900">Support</a></li>
            <li><a href="https://github.com/s-di-cola/swapcast" class="text-base text-gray-500 hover:text-gray-900">GitHub</a></li>
            <li><a href="/status" class="text-base text-gray-500 hover:text-gray-900">Status</a></li>
          </ul>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
          <ul class="mt-4 space-y-4">
            <li><a href="/privacy" class="text-base text-gray-500 hover:text-gray-900">Privacy Policy</a></li>
            <li><a href="/terms" class="text-base text-gray-500 hover:text-gray-900">Terms of Service</a></li>
            <li><a href="/cookies" class="text-base text-gray-500 hover:text-gray-900">Cookie Policy</a></li>
          </ul>
        </div>
      </div>
      <div class="mt-12 pt-8 border-t border-gray-200">
        <p class="text-base text-gray-400 text-center">&copy; {new Date().getFullYear()} SwapCast. All rights reserved.</p>
      </div>
    </div>
  </footer>
</div>
    
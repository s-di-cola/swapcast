<script lang="ts">
  export let walletConnected = false;
  export let walletConnecting = false;
  export let connectWallet = () => {};
  export let goToApp = () => {};
</script>

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

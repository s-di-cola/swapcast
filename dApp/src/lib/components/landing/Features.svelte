<script lang="ts">
  import { AwardOutline, TicketOutline, CogOutline, LinkOutline } from 'flowbite-svelte-icons';
</script>

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

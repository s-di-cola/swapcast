<script lang="ts">
	import { AwardOutline, TicketOutline, CogOutline, LinkOutline } from 'flowbite-svelte-icons';
</script>

<section id="features" class="bg-gray-50 py-24">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-16 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Key Features</h2>
			<p class="mx-auto mt-4 max-w-2xl text-xl text-gray-500">
				A seamless integration of predictions with your trading experience.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
			<!-- Feature 1 -->
			<div
				class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
			>
				<div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
					<AwardOutline class="h-6 w-6 text-indigo-600" />
				</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">Predict While You Swap</h3>
				<p class="text-gray-500">
					Turn every Uniswap v4 trade into a strategic play. Express your market conviction (bullish
					or bearish) on the asset pair directly during your swap.
				</p>
			</div>

			<!-- Feature 2 -->
			<div
				class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
			>
				<div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
					<TicketOutline class="h-6 w-6 text-indigo-600" />
				</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">NFT Positions</h3>
				<p class="text-gray-500">
					Your prediction, your asset. Every stance you take is minted as a unique SwapCast NFT,
					representing your position and potential rewards.
				</p>
			</div>

			<!-- Feature 3 -->
			<div
				class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
			>
				<div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
					<CogOutline class="h-6 w-6 text-indigo-600" />
				</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">Automated Rewards</h3>
				<p class="text-gray-500">
					Fair, transparent, and automated. We leverage Chainlink's industry-standard oracles for
					accurate market resolution and distribute rewards efficiently.
				</p>
			</div>

			<!-- Feature 4 -->
			<div
				class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
			>
				<div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
					<LinkOutline class="h-6 w-6 text-indigo-600" />
				</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">Powered by Uniswap & Chainlink</h3>
				<p class="text-gray-500">
					Harnessing the power of DeFi's titans. SwapCast integrates deeply with Uniswap v4 hooks
					and Chainlink's decentralized services.
				</p>
			</div>
		</div>
	</div>
</section>

<script lang="ts">
	import WalletConnection from '../common/WalletConnection.svelte';

	const HERO_CONTENT = {
		badge: 'Live on Ink',
		title: {
			main: 'Predict markets.',
			highlight: 'Earn rewards.'
		},
		description:
			'SwapCast seamlessly integrates market predictions into your Uniswap trades. Express your conviction, mint your position as an NFT, and get rewarded for your foresight.',
		learnMoreLink: '#how-it-works',
		learnMoreText: 'Learn more'
	} as const;

	const MOCKUP_DATA = {
		market: 'ETH/USDC Market',
		status: 'Active',
		currentPrice: '$2,389.42',
		threshold: '$2,400.00',
		above: { conviction: '75% conviction', percentage: 75 },
		below: { conviction: '25% conviction', percentage: 25 }
	} as const;
</script>

<section class="pt-32 pb-20 md:pt-40 md:pb-24">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
			<!-- Left column: Text content -->
			<div class="space-y-8">
				<div>
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800"
					>
						<span class="relative flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
						</span>
						{HERO_CONTENT.badge}
					</span>
				</div>

				<h1 class="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
					<span class="block">{HERO_CONTENT.title.main}</span>
					<span class="block text-indigo-600">{HERO_CONTENT.title.highlight}</span>
				</h1>

				<p class="max-w-2xl text-lg text-gray-500 md:text-xl">
					{HERO_CONTENT.description}
				</p>

				<div class="flex flex-wrap gap-4">
					<WalletConnection />
					<a
						href={HERO_CONTENT.learnMoreLink}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
					>
						{HERO_CONTENT.learnMoreText}
					</a>
				</div>
			</div>

			<!-- Right column: Illustration -->
			<div class="relative hidden md:block">
				<div
					class="absolute inset-0 scale-105 rotate-3 transform rounded-2xl bg-gradient-to-r from-indigo-100 to-blue-100"
				></div>
				<div
					class="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-xl"
				>
					<div
						class="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-indigo-600 opacity-25"
					></div>
					<div
						class="absolute bottom-0 left-0 -mb-4 -ml-4 h-16 w-16 rounded-full bg-blue-600 opacity-25"
					></div>

					<!-- Mockup of prediction interface -->
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-gray-500">{MOCKUP_DATA.market}</span>
							<span class="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
								{MOCKUP_DATA.status}
							</span>
						</div>

						<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
							<div>
								<p class="text-xs text-gray-500">Current Price</p>
								<p class="text-xl font-bold">{MOCKUP_DATA.currentPrice}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500">Threshold</p>
								<p class="text-xl font-bold">{MOCKUP_DATA.threshold}</p>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div
								class="cursor-pointer rounded-lg border border-green-200 bg-green-50 p-3 text-center transition-colors hover:bg-green-100"
							>
								<p class="text-sm font-medium text-green-800">Above</p>
								<p class="mt-1 text-xs text-green-600">{MOCKUP_DATA.above.conviction}</p>
							</div>
							<div
								class="cursor-pointer rounded-lg border border-red-200 bg-red-50 p-3 text-center transition-colors hover:bg-red-100"
							>
								<p class="text-sm font-medium text-red-800">Below</p>
								<p class="mt-1 text-xs text-red-600">{MOCKUP_DATA.below.conviction}</p>
							</div>
						</div>

						<div class="pt-2">
							<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
								<div
									class="h-full rounded-full bg-indigo-600"
									style="width: {MOCKUP_DATA.above.percentage}%"
								></div>
							</div>
							<div class="mt-1 flex justify-between text-xs text-gray-500">
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

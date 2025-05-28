<script lang="ts">
	interface Step {
		number: number;
		title: string;
		description: string;
		note: string;
		isReversed: boolean;
	}

	const SECTION_CONTENT = {
		title: 'How SwapCast Works',
		subtitle: 'Simple steps to start predicting and earning.'
	} as const;

	const steps: Step[] = [
		{
			number: 1,
			title: 'Connect Your Wallet',
			description:
				'Start by connecting your Ethereum wallet to the SwapCast platform. We support MetaMask, WalletConnect, and other popular wallets.',
			note: 'Connecting your wallet is secure and only requires a signature, not a transaction.',
			isReversed: false
		},
		{
			number: 2,
			title: 'Select a Market',
			description:
				'Browse available markets or create a new one. Each market represents an asset pair with a price threshold and expiration time.',
			note: 'Markets are powered by Chainlink price feeds for reliable and tamper-proof price data.',
			isReversed: true
		},
		{
			number: 3,
			title: 'Make Your Prediction',
			description:
				"Express your conviction on whether the asset's price will be above or below the threshold at expiration. Stake your tokens to back your prediction.",
			note: 'Your prediction is minted as an NFT, which you can hold, transfer, or sell on any NFT marketplace.',
			isReversed: false
		},
		{
			number: 4,
			title: 'Collect Rewards',
			description:
				"When the market expires, if your prediction was correct, you'll receive rewards proportional to your stake and the total conviction distribution.",
			note: 'Rewards are automatically distributed to winners through smart contracts, with no manual intervention required.',
			isReversed: true
		}
	] as const;
</script>

<section id="how-it-works" class="bg-white py-24">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-16 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
				{SECTION_CONTENT.title}
			</h2>
			<p class="mx-auto mt-4 max-w-2xl text-xl text-gray-500">
				{SECTION_CONTENT.subtitle}
			</p>
		</div>

		<div class="relative">
			<!-- Connection line -->
			<div
				class="absolute left-1/2 hidden h-full w-0.5 -translate-x-1/2 transform bg-indigo-100 md:block"
			></div>

			<!-- Steps -->
			<div class="space-y-16">
				{#each steps as step}
					<div class="relative">
						<div class="flex flex-col items-center md:flex-row">
							<!-- Main content card -->
							<div
								class="flex justify-end pr-8 pb-8 {step.isReversed
									? 'md:order-2'
									: ''} md:w-1/2 md:pb-0"
							>
								<div class="max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
									<div class="mb-4 flex items-center">
										<div
											class="mr-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100"
										>
											<span class="font-bold text-indigo-600">{step.number}</span>
										</div>
										<h3 class="text-xl font-medium text-gray-900">{step.title}</h3>
									</div>
									<p class="text-gray-500">{step.description}</p>
								</div>
							</div>

							<!-- Timeline dot -->
							<div
								class="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/4 transform md:block"
							>
								<div class="h-8 w-8 rounded-full border-4 border-white bg-indigo-500"></div>
							</div>

							<!-- Side note -->
							<div class="pl-8 {step.isReversed ? 'md:order-1' : ''} md:w-1/2 md:pt-16">
								<div
									class="max-w-xs rounded-lg bg-indigo-50 p-4 {step.isReversed ? 'ml-auto' : ''}"
								>
									<p class="text-sm text-indigo-700 italic">"{step.note}"</p>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

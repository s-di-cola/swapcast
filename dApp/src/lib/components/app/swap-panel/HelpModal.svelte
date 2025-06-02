<script lang="ts">
	import { Modal } from 'flowbite-svelte';

	let {
		open = $bindable(false),
		onClose,
		ethPrice = 0,
		payTokenSymbol = ''
	}: {
		open?: boolean;
		onClose: () => void;
		ethPrice?: number;
		payTokenSymbol?: string;
	} = $props();

	// Example calculations based on actual contract logic
	let exampleStake = $derived(() => 0.1); // 0.1 ETH stake
	let exampleTotalBull = $derived(() => 1.0); // 1 ETH total bull predictions
	let exampleTotalBear = $derived(() => 3.0); // 3 ETH total bear predictions

	// Calculate reward based on actual contract logic
	let exampleReward = $derived(() => {
		// First, get original stake back
		let reward = exampleStake();

		// Then, get share of losing pool (assuming BULL wins)
		// From contract: rewardAmount += (userStake * totalBearWeight) / totalBullWeight
		reward += (exampleStake() * exampleTotalBear()) / exampleTotalBull();

		return reward;
	});

	// Calculate ROI
	let exampleROI = $derived(() => {
		const profit = exampleReward() - exampleStake();
		return (profit / exampleStake()) * 100;
	});

	let exampleStakeInUsd = $derived(() => (exampleStake() * ethPrice).toFixed(2));
	let exampleRewardInUsd = $derived(() => (exampleReward() * ethPrice).toFixed(2));
</script>

<Modal bind:open autoclose={true} class="w-full max-w-2xl overflow-hidden p-0">
	<div class="relative">
		<div class="space-y-6 p-6">
			<div class="text-center">
				<h3 class="text-2xl font-bold text-gray-900">How SwapCast Works</h3>
				<p class="mt-2 text-gray-600">
					Dual-purpose infrastructure: efficient swaps + market intelligence through incentivized
					predictions
				</p>
			</div>

			<div class="space-y-6">
				<div class="space-y-4">
					<h4 class="text-lg font-semibold text-gray-900">1. Swap + Predict</h4>
					<p class="text-gray-700">
						SwapCast transforms Uniswap v4 pools into dual-purpose infrastructure. You can execute
						your normal token swaps while simultaneously making market predictions with ETH stakes.
					</p>
					<div class="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
						<p class="font-medium">Key Innovation:</p>
						<p>
							Your transaction value serves as conviction weight, creating on-chain
							"wisdom-of-crowds" backed by genuine financial commitment.
						</p>
					</div>
				</div>

				<div class="space-y-4">
					<h4 class="text-lg font-semibold text-gray-900">2. ETH Staking Mechanism</h4>
					<p class="text-gray-700">
						Predictions are staked using <span class="font-semibold">ETH</span>. Your stake amount
						determines your market influence and potential rewards.
					</p>
					<div class="rounded-lg bg-amber-50 p-4 text-sm">
						<p class="font-medium text-amber-800">How your stake is calculated:</p>
						<div class="mt-3 space-y-3">
							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white"
								>
									1
								</div>
								<div>
									<p class="font-medium text-amber-800">
										1% of your swap amount becomes your ETH stake
									</p>
									<p class="mt-1 text-xs text-amber-700">
										This is automatic - we call this your "conviction factor"
									</p>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white"
								>
									2
								</div>
								<div>
									<p class="font-medium text-amber-800">Example:</p>
									<p class="mt-1 text-xs text-amber-700">
										If you swap 1000 USDC, your ETH stake will be worth 10 USDC (1% of 1000)
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-4">
					<h4 class="text-lg font-semibold text-gray-900">3. Reward System</h4>
					<p class="text-gray-700">
						When you win a prediction, you get rewarded based on how much you contributed to the
						winning side.
					</p>
					<div class="rounded-lg bg-purple-50 p-4 text-sm">
						<p class="font-medium text-purple-800">What you get when you win:</p>
						<div class="mt-3 space-y-3">
							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white"
								>
									1
								</div>
								<div>
									<p class="font-medium text-purple-800">Your original stake back</p>
									<p class="mt-1 text-xs text-purple-700">
										Whatever ETH amount you put in, you get it back when you win
									</p>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white"
								>
									2
								</div>
								<div>
									<p class="font-medium text-purple-800">A share of the losing side's pool</p>
									<p class="mt-1 text-xs text-purple-700">
										Example: If you contributed 10% of the winning side's total, you get 10% of the
										losing side's pool
									</p>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white"
								>
									3
								</div>
								<div>
									<p class="font-medium text-purple-800">
										The bigger the losing side, the more you win
									</p>
									<p class="mt-1 text-xs text-purple-700">
										If many people bet against you and lose, your reward will be larger
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-4">
					<h4 class="text-lg font-semibold text-gray-900">4. Example Calculation</h4>
					<p class="text-gray-700">Let's see how this works with a real example.</p>
					<div class="rounded-lg bg-green-50 p-4 text-sm">
						<p class="font-medium text-green-800">Example scenario:</p>
						<div class="mt-3 space-y-3">
							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white"
								>
									A
								</div>
								<div>
									<p class="font-medium text-green-800">The market</p>
									<div class="mt-1 space-y-1 text-xs text-green-700">
										<p>• Total Bull side: {exampleTotalBull()} ETH</p>
										<p>• Total Bear side: {exampleTotalBear()} ETH</p>
									</div>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white"
								>
									B
								</div>
								<div>
									<p class="font-medium text-green-800">Your position</p>
									<div class="mt-1 text-xs text-green-700">
										<p>• You bet {exampleStake()} ETH on Bull (${exampleStakeInUsd()})</p>
										<p>
											• This is {((exampleStake() / exampleTotalBull()) * 100).toFixed(1)}% of the
											Bull side
										</p>
									</div>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white"
								>
									C
								</div>
								<div>
									<p class="font-medium text-green-800">If Bull wins, you get:</p>
									<div class="mt-1 space-y-1 text-xs text-green-700">
										<p>• Your original stake: {exampleStake()} ETH</p>
										<p>
											• Your share of Bear pool: {(
												(exampleStake() * exampleTotalBear()) /
												exampleTotalBull()
											).toFixed(3)} ETH
										</p>
										<p class="font-medium text-green-800">
											• Total reward: {exampleReward().toFixed(3)} ETH (${exampleRewardInUsd()})
										</p>
										<p class="font-medium text-green-800">• ROI: +{exampleROI().toFixed(1)}%</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-4">
					<h4 class="text-lg font-semibold text-gray-900">5. Automated Resolution</h4>
					<p class="text-gray-700">
						Once the market expires, your prediction is automatically resolved and you can claim
						your rewards if you won.
					</p>
					<div class="rounded-lg bg-blue-50 p-4 text-sm">
						<p class="font-medium text-blue-800">How it works:</p>
						<div class="mt-3 space-y-3">
							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
								>
									1
								</div>
								<div>
									<p class="font-medium text-blue-800">
										Chainlink price feeds determine the winner
									</p>
									<p class="mt-1 text-xs text-blue-700">
										We use trusted oracle data to check if the price went up or down
									</p>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
								>
									2
								</div>
								<div>
									<p class="font-medium text-blue-800">You receive an NFT for your position</p>
									<p class="mt-1 text-xs text-blue-700">
										This NFT represents your prediction and is used to claim rewards
									</p>
								</div>
							</div>

							<div class="flex items-start gap-2">
								<div
									class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
								>
									3
								</div>
								<div>
									<p class="font-medium text-blue-800">Winners claim rewards with one click</p>
									<p class="mt-1 text-xs text-blue-700">
										If you won, just click to claim your ETH rewards
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
					<p class="font-medium text-gray-900">💡 Key Features</p>
					<ul class="mt-2 list-disc space-y-1 pl-5">
						<li>Seamless integration with Uniswap v4 swaps</li>
						<li>Conviction weighting based on transaction value</li>
						<li>Dual-sided markets with balanced odds ratios</li>
						<li>Position NFTs as proof of prediction positions</li>
						<li>Trustless resolution via Chainlink Automation</li>
					</ul>
				</div>
			</div>

			<button
				onclick={onClose}
				class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
			>
				Got it, let's predict!
			</button>
		</div>
	</div>
</Modal>

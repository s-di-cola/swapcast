<script lang="ts">
  import { Modal } from "flowbite-svelte";

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

<Modal
  bind:open
  autoclose={true}
  class="max-w-2xl w-full p-0 overflow-hidden"
>
  <div class="relative">

    <div class="space-y-6 p-6">
      <div class="text-center">
        <h3 class="text-2xl font-bold text-gray-900">How SwapCast Works</h3>
        <p class="mt-2 text-gray-600">
          Dual-purpose infrastructure: efficient swaps + market intelligence through incentivized predictions
        </p>
      </div>

      <div class="space-y-6">
        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-900">1. Swap + Predict</h4>
          <p class="text-gray-700">
            SwapCast transforms Uniswap v4 pools into dual-purpose infrastructure. You can execute your normal token swaps while simultaneously making market predictions with ETH stakes.
          </p>
          <div class="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <p class="font-medium">Key Innovation:</p>
            <p>Your transaction value serves as conviction weight, creating on-chain "wisdom-of-crowds" backed by genuine financial commitment.</p>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-900">2. ETH Staking Mechanism</h4>
          <p class="text-gray-700">
            Predictions are staked using <span class="font-semibold">ETH</span> as a universal medium of conviction. Your stake amount determines your market influence and potential rewards.
          </p>
          <div class="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            <p class="font-medium">Conviction Weight Formula:</p>
            <p class="font-mono text-xs">convictionWeight = swapAmount × convictionFactor</p>
            <p class="mt-1">Where convictionFactor is typically 0.01 (1%)</p>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-900">3. Pari-Mutuel Rewards</h4>
          <div class="space-y-3">
            <p class="text-gray-700">
              Rewards follow a pari-mutuel betting model where winners share the losing side's stake:
            </p>
            <div class="rounded-lg border border-purple-100 bg-purple-50 p-4 text-sm">
              <p class="font-medium text-purple-800">Reward Calculation:</p>
              <div class="mt-2 space-y-1 font-mono text-xs text-purple-700">
                <p>// First, you get your original stake back</p>
                <p>rewardAmount = yourStake</p>
                <p>&nbsp;</p>
                <p>// Then, you get a portion of the losing side's pool</p>
                <p>if (winningOutcome == BEAR) &#123;</p>
                <p>  rewardAmount += (yourStake * totalBullWeight) / totalBearWeight</p>
                <p>&#125; else &#123; // BULL wins</p>
                <p>  rewardAmount += (yourStake * totalBearWeight) / totalBullWeight</p>
                <p>&#125;</p>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-900">4. Example Calculation</h4>
          <div class="rounded-lg bg-green-50 p-4 text-sm text-green-800">
            <p class="font-medium">Scenario:</p>
            <div class="mt-2 space-y-1">
              <p>• Total Bull Predictions: {exampleTotalBull()} ETH</p>
              <p>• Total Bear Predictions: {exampleTotalBear()} ETH</p>
              <p>• Your Bull Position: {exampleStake()} ETH (${exampleStakeInUsd()})</p>
            </div>
            <div class="mt-3 border-t border-green-200 pt-2">
              <p class="font-medium">If Bull outcome wins:</p>
              <p>• Your original stake: {exampleStake()} ETH</p>
              <p>• Your share of Bear pool: {(exampleStake() * exampleTotalBear() / exampleTotalBull()).toFixed(3)} ETH</p>
              <p>• Total reward: {exampleReward().toFixed(3)} ETH (${exampleRewardInUsd()})</p>
              <p>• ROI: {exampleROI().toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-900">5. Automated Resolution</h4>
          <p class="text-gray-700">
            Predictions are resolved automatically using Chainlink Automation. Winners can claim their rewards through a pull-based mechanism, and you receive unique SwapCast NFTs as proof of your positions.
          </p>
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
        class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Got it, let's predict!
      </button>
    </div>
  </div>
</Modal>

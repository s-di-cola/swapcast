<script lang="ts">
    import { formatAmount } from '$lib/services/prediction';

    interface Props {
        claimableAmount: number;
        onClaimAll: () => void;
    }

    let { claimableAmount, onClaimAll }: Props = $props();
</script>

{#if claimableAmount > 0}
    <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div class="flex flex-col items-start justify-between md:flex-row md:items-center">
            <div class="mb-3 md:mb-0">
                <h3 class="text-base font-medium text-blue-800">You have rewards to claim! 🎉</h3>
                <p class="text-sm text-blue-700">{formatAmount(claimableAmount)} ETH available to claim</p>
            </div>
            <button
                    onclick={onClaimAll}
                    class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
                Claim All Rewards
            </button>
        </div>
    </div>
{/if}

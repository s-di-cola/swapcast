<script lang="ts">
    /**
     * TransactionHistory Component
     * 
     * Displays a list of transactions related to a specific market.
     * Shows transaction details including hash, timestamp, sender, type, and amount.
     */
    import type { Market } from '$lib/services/market/marketService';

    export let market: Market;

    /**
     * Formats currency values for display with appropriate suffixes
     * 
     * @param value - The numeric value to format
     * @returns Formatted string with $ symbol and K/M suffix for large numbers
     */
    function formatCurrency(value: string | number): string {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (num >= 1_000_000) {
            return `$${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) {
            return `$${(num / 1_000).toFixed(2)}K`;
        } else {
            return `$${num.toFixed(2)}`;
        }
    }

    /**
     * Generates an Etherscan URL for a given address
     * 
     * @param address - Ethereum address to link to
     * @returns Etherscan URL for the address
     */
    function getEtherscanLink(address: string) {
        return `https://etherscan.io/address/${address}`;
    }

    // Sample transaction data for demonstration purposes
    const transactions = [
        {
            txHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
            timestamp: Date.now() - 3600000 * 2,
            from: '0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
            type: 'Bullish',
            amount: 0.5
        },
        {
            txHash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
            timestamp: Date.now() - 3600000 * 5,
            from: '0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1',
            type: 'Bearish',
            amount: 0.25
        },
        {
            txHash: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
            timestamp: Date.now() - 3600000 * 12,
            from: '0xC3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2',
            type: 'Bullish',
            amount: 0.75
        }
    ];
</script>

<div class="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
    <h4 class="mb-4 text-lg font-semibold text-gray-700">Transaction History</h4>

    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-100">
            <thead>
                <tr>
                    <th
                        class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                        Transaction
                    </th>
                    <th
                        class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                        Time
                    </th>
                    <th
                        class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                        From
                    </th>
                    <th
                        class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                        Type
                    </th>
                    <th
                        class="bg-gray-50 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                        Amount
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
                {#each transactions as tx}
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm whitespace-nowrap text-blue-600 hover:text-blue-800">
                            <a
                                href={getEtherscanLink(tx.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="truncate max-w-[150px] inline-block align-bottom"
                            >
                                {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 8)}
                            </a>
                        </td>
                        <td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                            {new Date(tx.timestamp).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            })}
                        </td>
                        <td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                            <a
                                href={getEtherscanLink(tx.from)}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="truncate max-w-[100px] inline-block align-bottom text-blue-600 hover:text-blue-800"
                            >
                                {tx.from.substring(0, 6)}...{tx.from.substring(tx.from.length - 4)}
                            </a>
                        </td>
                        <td class="px-4 py-3 text-sm whitespace-nowrap">
                            <span
                                class="rounded-full px-2.5 py-0.5 text-xs font-medium {tx.type === 'Bullish'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'}"
                            >
                                {tx.type}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm whitespace-nowrap text-gray-700">
                            {formatCurrency(tx.amount)} ETH
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <div class="mt-4 flex items-center justify-between">
        <div class="text-sm text-gray-500">Showing {transactions.length} transactions</div>
        <div class="flex space-x-2">
            <button
                class="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
                Previous
            </button>
            <button
                class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
                Next
            </button>
        </div>
    </div>
</div>

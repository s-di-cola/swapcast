<script lang="ts">
  export let positions: Array<{market: string; side: string; amount: string; status: string; date: string}> = [];
  import { Card } from 'flowbite-svelte';
</script>
<Card class="bg-white/95 shadow-2xl rounded-3xl p-6 border-0 w-full">
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
    <h3 class="font-semibold text-lg mb-2 md:mb-0">Your Positions</h3>
    <input type="text" placeholder="Search positions..." class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white w-full md:w-64" />
  </div>
  <div class="overflow-x-auto">
    <table class="min-w-full text-sm align-middle">
      <thead>
        <tr class="text-gray-500 border-b">
          <th class="text-left py-2 px-2">Market</th>
          <th class="text-left py-2 px-2">Position</th>
          <th class="text-left py-2 px-2">Amount</th>
          <th class="text-left py-2 px-2">Status</th>
          <th class="text-left py-2 px-2">Date</th>
        </tr>
      </thead>
      <tbody>
        {#each positions as pos}
        <tr class="border-b hover:bg-emerald-50 transition">
          <td class="py-2 px-2">{pos.market}</td>
          <td class="py-2 px-2">{pos.side}</td>
          <td class="py-2 px-2">{pos.amount}</td>
          <td class="py-2 px-2">
            <span class="px-2 py-1 rounded-full {pos.status === 'Open' ? 'bg-emerald-100 text-emerald-700' : pos.status === 'Pending' ? 'bg-amber-100 text-amber-700' : pos.status === 'Win' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">{pos.status}</span>
          </td>
          <td class="py-2 px-2">{pos.date}</td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Card>

<script lang="ts">
	import { modal } from '$lib/configs/wallet.config';
	import { walletStore } from '$lib/stores/wallet';
	import { onMount } from 'svelte';
	import type { UseAppKitAccountReturn } from '@reown/appkit';

	onMount(() => {
		modal.subscribeAccount((newAccount: UseAppKitAccountReturn) => {
			walletStore.set({
				isConnected: !!newAccount.address,
				address: newAccount.address?.toLowerCase() ?? null
			});
		});
	});
</script>

<appkit-button> </appkit-button>

<script lang="ts">
	import { modal } from '$lib/configs/wallet.config';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type { UseAppKitAccountReturn } from '@reown/appkit';
	import { isConnected } from '$lib/stores/wallet';
	// Track connection status
	onMount(() => {
		// Subscribe to account changes (address, connection status)
		modal.subscribeAccount((newAccount: UseAppKitAccountReturn) => {
			isConnected.set(!!newAccount.address);
		});
	});
</script>

<appkit-button balance="hide"></appkit-button>


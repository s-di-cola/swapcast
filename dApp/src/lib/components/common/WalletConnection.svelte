<script lang="ts">
    import {modal} from '$lib/configs/wallet.config';
    import {walletStore} from '$lib/stores/wallet';
    import {onMount} from 'svelte';
    import type {UseAppKitAccountReturn} from '@reown/appkit';

    onMount(() => {
		// Initial wallet info check
		try {
			modal.getWalletInfo().then(walletInfo => {
				console.log('Initial wallet info:', walletInfo);
				if (walletInfo && typeof walletInfo.address === 'string') {
					walletStore.set({
						isConnected: true,
						address: walletInfo.address.toLowerCase(),
						chain: walletInfo.chain,
						rpcUrl: typeof walletInfo.rpcUrl === 'string' ? walletInfo.rpcUrl : undefined,
						rawWalletInfo: walletInfo
					});
				}
			}).catch(error => {
				console.error('Error getting initial wallet info:', error);
			});
		} catch (error) {
			console.error('Error in wallet initialization:', error);
		}

		// Subscribe to account changes
		let unsubscribe: (() => void) | undefined;
		try {
			unsubscribe = modal.subscribeAccount((newAccount: UseAppKitAccountReturn) => {
				console.log('Account update received:', newAccount);

				// When account changes, get full wallet info
				if (newAccount && typeof newAccount.address === 'string') {
					try {
						modal.getWalletInfo().then(walletInfo => {
							console.log('Updated wallet info:', walletInfo);
							walletStore.set({
								isConnected: true,
								address: newAccount.address.toLowerCase(),
								chain: walletInfo?.chain,
								rpcUrl: typeof walletInfo?.rpcUrl === 'string' ? walletInfo.rpcUrl : undefined,
								rawWalletInfo: walletInfo
							});
						}).catch(error => {
							console.error('Error getting updated wallet info:', error);
							walletStore.set({
								isConnected: true,
								address: newAccount.address.toLowerCase()
							});
						});
					} catch (error) {
						console.error('Error in wallet update:', error);
						walletStore.set({
							isConnected: true,
							address: newAccount.address.toLowerCase()
						});
					}
				} else {
					walletStore.set({
						isConnected: false,
						address: null,
						chain: undefined,
						rpcUrl: undefined,
						rawWalletInfo: undefined
					});
				}
			});
		} catch (error) {
			console.error('Error subscribing to account changes:', error);
		}

		// Handle cleanup
		return () => {
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
		};
	});
</script>

<appkit-button> </appkit-button>

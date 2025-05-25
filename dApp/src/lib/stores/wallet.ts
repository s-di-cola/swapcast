import { writable, derived, get } from 'svelte/store';

import { PUBLIC_ADMIN_ADDRESS } from '$env/static/public';
// Use PUBLIC_ADMIN_ADDRESS directly throughout this file.

interface WalletBaseState {
	isConnected: boolean;
	address: string | null;
}

const createWalletStore = () => {
	const { subscribe, set } = writable<WalletBaseState>({
		isConnected: false,
		address: null
	});

	const store = derived({ subscribe }, ($state) => ({
		...$state,
		isAdmin:
			$state.isConnected && $state.address && PUBLIC_ADMIN_ADDRESS
				? $state.address.toLowerCase() === PUBLIC_ADMIN_ADDRESS.toLowerCase()
				: false
	}));

	return {
		subscribe: store.subscribe,
		set,
		update: (updater: (state: WalletBaseState) => WalletBaseState) => set(updater(get(store)))
	};
};

export const walletStore = createWalletStore();

export type WalletState = ReturnType<typeof createWalletStore>;

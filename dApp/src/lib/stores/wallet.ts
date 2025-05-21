import { writable, type Writable } from 'svelte/store';

export interface WalletState {
	isConnected: boolean;
	address: string | null;
}

const initialWalletState: WalletState = {
	isConnected: false,
	address: null,
};

export const walletStore: Writable<WalletState> = writable(initialWalletState);
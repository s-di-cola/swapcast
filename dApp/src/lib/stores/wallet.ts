import { writable, derived, get } from 'svelte/store';

const ADMIN_ADDRESS = import.meta.env.VITE_ADMIN_ADDRESS?.toLowerCase();

interface WalletBaseState {
  isConnected: boolean;
  address: string | null;
}

const createWalletStore = () => {
  const { subscribe, set } = writable<WalletBaseState>({
    isConnected: false,
    address: null,
  });

  const store = derived(
    { subscribe },
    ($state) => ({
      ...$state,
      isAdmin: $state.isConnected && 
               $state.address && 
               ADMIN_ADDRESS
               ? $state.address.toLowerCase() === ADMIN_ADDRESS
               : false
    })
  );

  return {
    subscribe: store.subscribe,
    set,
    update: (updater: (state: WalletBaseState) => WalletBaseState) => 
      set(updater(get(store)))
  };
};

export const walletStore = createWalletStore();

export type WalletState = ReturnType<typeof createWalletStore>;
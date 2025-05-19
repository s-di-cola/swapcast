import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { modal } from '$lib/configs/wallet.config';
import type { UseAppKitAccountReturn } from '@reown/appkit';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isConnecting?: boolean;
}

const initialState: WalletState = {
  isConnected: false,
  address: null,
  chainId: null,
  isConnecting: false
};

export const walletState = writable<WalletState>(initialState);

// Function to update wallet state based on current AppKit state
export function updateWalletState() {
  if (!browser) return;
  
  try {
    const account = modal.getAccount();
    const address = account?.address || null;
    const isConnected = !!address;
    const chainId = modal.getChainId() as number || null;
    
    walletState.set({
      isConnected,
      address,
      chainId,
      isConnecting: false
    });
    
    console.log('Wallet state updated:', { isConnected, address, chainId });
  } catch (error) {
    console.error('Error updating wallet state:', error);
    walletState.set({
      ...initialState,
      isConnecting: false
    });
  }
}

// Set connecting state
export function setConnecting(isConnecting: boolean) {
  walletState.update(state => ({ ...state, isConnecting }));
}

// Initialize wallet state and event listeners
if (browser) {
  // Listen for connection events
  window.addEventListener('appkit:connect', ((event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('AppKit connect event:', customEvent.detail);
    updateWalletState();
  }) as EventListener);

  // Listen for disconnection events
  window.addEventListener('appkit:disconnect', () => {
    console.log('AppKit disconnect event');
    walletState.set(initialState);
  });
  
  // Listen for chain change events
  window.addEventListener('appkit:chainChanged', ((event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Chain changed:', customEvent.detail);
    updateWalletState();
  }) as EventListener);

  // Subscribe to account changes via AppKit API
  try {
    modal.subscribeAccount((newAccount: UseAppKitAccountReturn) => {
      console.log('Account subscription update:', newAccount);
      updateWalletState();
    });
  } catch (error) {
    console.error('Error subscribing to account changes:', error);
  }

  // Initialize with current connection state
  updateWalletState();
}

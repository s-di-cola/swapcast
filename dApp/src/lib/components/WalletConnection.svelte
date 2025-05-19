<script lang="ts">
  import { walletState, setConnecting, updateWalletState } from '$lib/stores/wallet';
  import { modal } from '$lib/configs/wallet.config';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  // Track connection status
  const isConnected = $derived($walletState.isConnected);
  
  // Log connection status changes
  $effect(() => {
    if (browser) {
      console.log('WalletConnection: Connection status changed:', { 
        isConnected,
        address: $walletState.address 
      });
    }
  });

  // Handle connection events
  function handleConnect() {
    console.log('AppKit connect event detected in WalletConnection');
    updateWalletState();
    
    // Check if we need to redirect
    if (browser && window.location.pathname === '/') {
      console.log('Redirecting to app from WalletConnection');
      goto('/app');
    }
  }

  // Handle disconnection events
  function handleDisconnect() {
    console.log('AppKit disconnect event detected in WalletConnection');
    updateWalletState();
    
    // Check if we need to redirect
    if (browser && window.location.pathname.startsWith('/app')) {
      console.log('Redirecting to landing page from WalletConnection');
      goto('/');
    }
  }

  // Handle button click events
  function handleButtonClick() {
    console.log('AppKit button clicked');
    if (!isConnected) {
      setConnecting(true);
    }
  }

  // Initialize component
  onMount(() => {
    // Make sure wallet state is updated with current connection status
    updateWalletState();
    
    // Add event listeners
    if (browser) {
      window.addEventListener('appkit:connect', handleConnect);
      window.addEventListener('appkit:disconnect', handleDisconnect);
    }
  });
  
  // Clean up event listeners
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('appkit:connect', handleConnect);
      window.removeEventListener('appkit:disconnect', handleDisconnect);
    }
  });
</script>

<!-- The AppKit button will handle connect/disconnect automatically -->
<appkit-button 
  onclick={handleButtonClick} 
  onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleButtonClick()}
  role="button"
  tabindex="0"
></appkit-button>


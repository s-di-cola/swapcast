<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { walletState, updateWalletState } from '$lib/stores/wallet';
  import Header from '$lib/components/common/Header.svelte';
  import Footer from '$lib/components/landing/Footer.svelte';
  import '../app.css';
  
  let { children } = $props<{ children: any }>();
  
  // Create a derived state for the current path
  const currentPath = $derived(browser ? window.location.pathname : '');
  
  // Create a derived state for the wallet connection status
  const isWalletConnected = $derived($walletState.isConnected);
  
  // Determine header and footer variants based on the current path
  const isAppRoute = $derived(currentPath.startsWith('/app'));
  const headerVariant = $derived(isAppRoute ? 'app' : 'landing');
  
  // Log wallet state changes for debugging
  $effect(() => {
    if (!browser) return;
    
    console.log('Layout: Wallet state changed:', {
      isConnected: $walletState.isConnected,
      address: $walletState.address,
      chainId: $walletState.chainId,
      path: currentPath
    });
    
    // Handle redirections based on wallet state
    if ($walletState.isConnected) {
      if (currentPath === '/') {
        console.log('Wallet connected, redirecting to /app');
        goto('/app');
      }
    } else {
      if (currentPath.startsWith('/app')) {
        console.log('Wallet disconnected, redirecting to landing page');
        goto('/');
      }
    }
  });
  
  // Initialize wallet state and listen for events
  onMount(() => {
    if (!browser) return;
    
    // Make sure wallet state is initialized properly
    console.log('Initializing wallet state...');
    updateWalletState();
    
    // Add additional event listeners for wallet connection events
    const handleConnect = () => {
      console.log('AppKit connect event detected in layout');
      updateWalletState();
      
      // Force redirect if needed
      if (window.location.pathname === '/') {
        console.log('Forcing redirect to /app after connection');
        goto('/app');
      }
    };
    
    const handleDisconnect = () => {
      console.log('AppKit disconnect event detected in layout');
      updateWalletState();
      
      // Force redirect if needed
      if (window.location.pathname.startsWith('/app')) {
        console.log('Forcing redirect to landing page after disconnection');
        goto('/');
      }
    };
    
    // Handle browser navigation
    const handlePopState = () => {
      const path = window.location.pathname;
      updateWalletState(); // Refresh wallet state on navigation
      
      if ($walletState.isConnected && path === '/') {
        // If connected and landed on root, redirect to /app
        goto('/app', { replaceState: true });
      } else if (!$walletState.isConnected && path.startsWith('/app')) {
        // If disconnected and landed on /app, redirect to root
        goto('/', { replaceState: true });
      }
    };
    
    // Add event listeners
    window.addEventListener('appkit:connect', handleConnect);
    window.addEventListener('appkit:disconnect', handleDisconnect);
    window.addEventListener('popstate', handlePopState);
    
    // Cleanup event listeners
    return () => {
      window.removeEventListener('appkit:connect', handleConnect);
      window.removeEventListener('appkit:disconnect', handleDisconnect);
      window.removeEventListener('popstate', handlePopState);
    };
  });
</script>

<Header variant={headerVariant} />

<main class="min-h-screen pt-16" class:bg-gray-50={isAppRoute}>
  {@render children()}
</main>

<!-- Conditional Footer -->
{#if isAppRoute}
  <!-- Simple footer for app pages -->
  <footer class="text-center py-8 text-gray-500 text-sm bg-white border-t border-gray-100">
    &copy; {new Date().getFullYear()} SwapCast. All rights reserved.
  </footer>
{:else}
  <!-- Full footer for landing page -->
  <Footer />
{/if}

<svelte:head>
  <title>SwapCast - Decentralized Prediction Markets</title>
  <meta name="description" content="Trade on the future of crypto with SwapCast's decentralized prediction markets" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Header from '$lib/components/common/Header.svelte';
  import Footer from '$lib/components/landing/Footer.svelte';
  import '../app.css';
  import { isConnected } from '$lib/stores/wallet';
  let { children } = $props<{ children: any }>();
  
  // Create a derived state for the current path
  const currentPath = $derived(browser ? window.location.pathname : '');
  
  // Determine header and footer variants based on the current path
  const isAppRoute = $derived(currentPath.startsWith('/app'));
  const headerVariant = $derived(isAppRoute ? 'app' : 'landing');

  // Redirect to home if not connected
  $effect(() => {
    if (browser && !$isConnected) {
      goto('/');
    }
    if (browser && $isConnected) {
      goto('/app');
    }
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

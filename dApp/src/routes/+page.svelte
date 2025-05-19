<script lang="ts">
  import { walletState } from '$lib/stores/wallet';
  import Hero from '$lib/components/landing/Hero.svelte';
  import Header from '$lib/components/landing/Header.svelte';
  import Features from '$lib/components/landing/Features.svelte';
  import HowItWorks from '$lib/components/landing/HowItWorks.svelte';

  
  // Track store state
  let store = $walletState;
  
  // Track if we need to show the wallet connection button
  let showWalletButton = $state(false);
  

</script>

    <Header />
    <Hero />
    <Features />
    <HowItWorks />


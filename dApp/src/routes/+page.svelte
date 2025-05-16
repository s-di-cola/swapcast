<script lang="ts">
  import { goto } from '$app/navigation';
  import { Header, Hero, Features, HowItWorks, Footer } from '$lib/components/landing';
  
  // Wallet connection state
  let walletConnected = false;
  let walletConnecting = false;
  
  // Connect wallet function
  async function connectWallet() {
    try {
      walletConnecting = true;
      // Here you would add your actual wallet connection logic
      // For now, we'll simulate a connection after a brief delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      walletConnected = true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      walletConnecting = false;
    }
  }
  
  // Navigate to app after wallet connection
  function goToApp() {
    goto('/app');
  }
</script>

<div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
  <Header 
    {walletConnected}
    {walletConnecting}
    {connectWallet}
    {goToApp}
  />
  
  <Hero 
    {walletConnected}
    {walletConnecting}
    {connectWallet}
    {goToApp}
  />
  
  <Features />
  
  <HowItWorks />
  
  <Footer />
</div>
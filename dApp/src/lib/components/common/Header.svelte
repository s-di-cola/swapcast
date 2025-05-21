<script lang="ts">
  import { page } from '$app/state'; 
  import { walletStore } from '$lib/stores/wallet';
  import WalletConnection from '$lib/components/common/WalletConnection.svelte';

  let { variant = 'landing' }: { variant?: 'landing' | 'app' } = $props();

  const adminAddressFromEnv = import.meta.env.VITE_ADMIN_ADDRESS as string | undefined;
  console.log('[Header.svelte Initial] VITE_ADMIN_ADDRESS:', adminAddressFromEnv);

  // isAdmin should be a reactive derived state
  let isAdmin = $derived.by(() => {
    console.log('[Header.svelte] isAdmin derived state computed');
    const connected = $walletStore.isConnected;
    const currentAddress = $walletStore.address;
    const result = !!(connected && adminAddressFromEnv && currentAddress && currentAddress.toLowerCase() === adminAddressFromEnv.toLowerCase());
    return result;
  });

  console.log('[Header.svelte] isAdmin:', isAdmin);

  // Navigation items
  const commonNavItems = [
    { href: '/app/markets', text: 'Markets' },
    { href: '/app/portfolio', text: 'Portfolio' },
  ];

  const adminNavItem = { href: '/admin', text: 'Admin Panel' };

  // Reactive navigation items based on isAdmin status
  let navItems = $derived([
    ...commonNavItems,
    ...(isAdmin ? [adminNavItem] : [])
  ]);

</script>

<header data-testid="app-header" class="fixed top-0 left-0 w-full bg-white bg-opacity-90 backdrop-blur-sm z-50 border-b border-gray-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center">
        <a href={'/'} 
           class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent hover:from-indigo-500 hover:to-sky-400 transition-colors">
          SwapCast
        </a>
      </div>
      
      {#if variant === 'landing'}
        <nav class="hidden md:flex space-x-8">
          <a href="#features" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Features</a>
          <a href="#how-it-works" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">How it works</a>
          <a href="#developers" class="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Developers</a>
        </nav>
      {:else}
        <nav class="hidden md:flex space-x-8">
          {#each navItems as item}
            <a
              href={item.href}
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 {page.url.pathname === item.href
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-background-secondary hover:text-primary'}"
            >
              {item.text}
            </a>
          {/each}
        </nav>
      {/if}
      
      <div>
        <WalletConnection />
      </div>
    </div>
  </div>
</header>

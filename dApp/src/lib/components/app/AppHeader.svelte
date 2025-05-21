<script lang="ts">
  import { page } from '$app/state'; 
  import { walletStore } from '$lib/stores/wallet';
  import WalletConnection from '$lib/components/common/WalletConnection.svelte';

  const adminAddressFromEnv = import.meta.env.VITE_ADMIN_ADDRESS as string | undefined;

  // isAdmin should be a reactive derived state
  let isAdmin = $derived.by(() => {
    const connected = $walletStore.isConnected;
    const currentAddress = $walletStore.address;
    return !!(connected && adminAddressFromEnv && currentAddress && 
             currentAddress.toLowerCase() === adminAddressFromEnv.toLowerCase());
  });

  // Navigation items
  const commonNavItems = [
    { href: '/app/markets', text: 'Markets' },
    { href: '/app/portfolio', text: 'Portfolio' },
  ];

  const adminNavItem = { href: '/admin', text: 'Admin Panel' };

  // Reactive navigation items based on isAdmin status
  let navItems = $derived.by(() => 
    isAdmin 
      ? [...commonNavItems, adminNavItem]
      : commonNavItems
  );
</script>

<header data-testid="app-header" class="fixed top-0 left-0 w-full bg-white bg-opacity-90 backdrop-blur-sm z-50 border-b border-gray-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center">
        <a href="/" class="text-xl font-bold bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent hover:from-indigo-500 hover:to-sky-400 transition-colors">
          SwapCast
        </a>
      </div>
      
      <nav class="hidden md:flex space-x-8">
        {#each navItems as item}
          <a
            href={item.href}
            class="px-3 py-2 text-sm font-medium transition-colors {page.url.pathname === item.href
              ? 'text-gray-900 font-semibold'
              : 'text-gray-500 hover:text-gray-900'} {item.text === 'Admin Panel' ? 'font-bold text-red-600' : ''}"
          >
            {item.text}
          </a>
        {/each}
      </nav>

      <div class="flex items-center">
        <WalletConnection />
      </div>
    </div>
  </div>
</header>

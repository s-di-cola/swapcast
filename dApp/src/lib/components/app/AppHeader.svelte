<script lang="ts">
    import {page} from '$app/state';
    import {walletStore} from '$lib/stores/wallet';
    import WalletConnection from '$lib/components/common/WalletConnection.svelte';

    // Navigation items
	const commonNavItems = [
		{ href: '/app/markets', text: 'Markets' },
		{ href: '/app/portfolio', text: 'Portfolio' }
	];

	// Only show navigation items for non-admin users
	$: navItems = $walletStore.isAdmin ? [] : commonNavItems;
</script>

<header
	data-testid="app-header"
	class="bg-opacity-90 fixed top-0 left-0 z-50 w-full border-b border-gray-100 bg-white backdrop-blur-sm"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center">
				<a
					href="/"
					class="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-xl font-bold text-transparent transition-colors hover:from-indigo-500 hover:to-sky-400"
				>
					SwapCast
				</a>
			</div>

			{#if !$walletStore.isAdmin}
				<nav class="hidden space-x-8 md:flex">
					{#each navItems as item}
						<a
							href={item.href}
							class="px-3 py-2 text-sm font-medium transition-colors {page.url.pathname ===
							item.href
								? 'font-semibold text-gray-900'
								: 'text-gray-500 hover:text-gray-900'}"
						>
							{item.text}
						</a>
					{/each}
				</nav>
			{/if}

			<div class="flex items-center">
				<WalletConnection />
			</div>
		</div>
	</div>
</header>

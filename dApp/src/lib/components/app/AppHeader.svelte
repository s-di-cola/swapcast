<script lang="ts">
	import { page } from '$app/state';
	import { WalletConnection } from '$lib/components/common';
	import { isAdmin } from '$lib/utils/admin';

	interface NavItem {
		href: string;
		text: string;
	}

	const NAVIGATION_CONFIG = {
		brand: {
			name: 'SwapCast',
			href: '/'
		},
		items: [
			{ href: '/app/markets', text: 'Markets' },
			{ href: '/app/portfolio', text: 'Portfolio' }
		]
	} as const;

	const STYLES = {
		header:
			'bg-opacity-90 fixed top-0 left-0 z-50 w-full border-b border-gray-100 bg-white backdrop-blur-sm',
		container: 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
		content: 'flex h-16 items-center justify-between',
		brand:
			'bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-xl font-bold text-transparent transition-colors hover:from-indigo-500 hover:to-sky-400',
		nav: 'hidden space-x-8 md:flex',
		navItem: {
			base: 'px-3 py-2 text-sm font-medium transition-colors',
			active: 'font-semibold text-gray-900',
			inactive: 'text-gray-500 hover:text-gray-900'
		},
		actions: 'flex items-center'
	} as const;

	const navItems = $derived<readonly NavItem[]>(isAdmin() ? [] : NAVIGATION_CONFIG.items);

	function getNavItemStyles(href: string): string {
		const baseStyles = STYLES.navItem.base;
		const isActive = page.url.pathname === href;
		const stateStyles = isActive ? STYLES.navItem.active : STYLES.navItem.inactive;
		return `${baseStyles} ${stateStyles}`;
	}
</script>

<header data-testid="app-header" class={STYLES.header}>
	<div class={STYLES.container}>
		<div class={STYLES.content}>
			<div class="flex items-center">
				<a href={NAVIGATION_CONFIG.brand.href} class={STYLES.brand}>
					{NAVIGATION_CONFIG.brand.name}
				</a>
			</div>

			{#if !isAdmin()}
				<nav class={STYLES.nav}>
					{#each navItems as item}
						<a href={item.href} class={getNavItemStyles(item.href)}>
							{item.text}
						</a>
					{/each}
				</nav>
			{/if}

			<div class={STYLES.actions}>
				<WalletConnection />
			</div>
		</div>
	</div>
</header>

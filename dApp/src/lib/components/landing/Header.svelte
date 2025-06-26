<script lang="ts">
	import WalletConnection from '../common/WalletConnection.svelte';

	interface NavItem {
		href: string;
		text: string;
	}

	let {
		showLandingLinks = true,
		showAppLinks = false,
		showAdminLinks = false,
		title = 'SwapCast'
	} = $props();

	const BRAND = {
		name: title,
		href: '/'
	} as const;

	const LANDING_NAV_ITEMS: NavItem[] = [
		{ href: '#features', text: 'Features' },
		{ href: '#how-it-works', text: 'How it works' },
		{ href: '#developers', text: 'Developers' }
	] as const;

	const APP_NAV_ITEMS: NavItem[] = [
		{ href: '/markets', text: 'Markets' },
		{ href: '/markets/my-predictions', text: 'My Predictions' },
	] as const;

	const ADMIN_NAV_ITEMS: NavItem[] = [
		{ href: '/admin', text: 'Admin' }
	] as const;

	const STYLES = {
		header:
			'bg-opacity-90 fixed top-0 left-0 z-50 w-full border-b border-gray-100 bg-white backdrop-blur-sm',
		container: 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
		content: 'flex h-16 items-center justify-between',
		brand:
			'bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-xl font-bold text-transparent transition-colors hover:from-indigo-500 hover:to-sky-400',
		nav: 'hidden space-x-8 md:flex',
		navLink: 'px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900',
		adminLink: 'px-3 py-2 text-sm font-bold text-red-600 hover:text-red-800'
	} as const;
</script>

<header class={STYLES.header}>
	<div class={STYLES.container}>
		<div class={STYLES.content}>
			<div class="flex items-center">
				<a href={BRAND.href} class={STYLES.brand}>
					{BRAND.name}
				</a>
			</div>

			<nav class={STYLES.nav}>
				{#if showLandingLinks}
					{#each LANDING_NAV_ITEMS as item}
						<a href={item.href} class={STYLES.navLink}>
							{item.text}
						</a>
					{/each}
				{:else if showAppLinks || showAdminLinks}
					{#each APP_NAV_ITEMS as item}
						<a href={item.href} class={STYLES.navLink}>
							{item.text}
						</a>
					{/each}
					
					{#if showAdminLinks}
						{#each ADMIN_NAV_ITEMS as item}
							<a href={item.href} class={STYLES.adminLink}>
								{item.text}
							</a>
						{/each}
					{/if}
				{/if}
			</nav>

			<div>
				<WalletConnection />
			</div>
		</div>
	</div>
</header>

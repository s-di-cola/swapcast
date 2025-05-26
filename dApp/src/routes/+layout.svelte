<script lang="ts">
    import {page} from '$app/state';
    import {walletStore} from '$lib/stores/wallet';
    import AppHeader from '$lib/components/app/AppHeader.svelte';
    import LandingHeader from '$lib/components/landing/LandingHeader.svelte';
    import Footer from '$lib/components/common/Footer.svelte';
    import {goto} from '$app/navigation';
    import {browser} from '$app/environment';
    import '../app.css';

    let { children } = $props<{ children: any }>();

	// Determine route types
	const isAppRoute = $derived(page.url.pathname.startsWith('/app'));
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const isProtectedRoute = $derived(isAppRoute || isAdminRoute);
	const pathname = $derived(page.url.pathname);

	// Handle route protection and redirects
	$effect(() => {
		if (!browser) return;

		const { isConnected, isAdmin, address } = $walletStore;


		// If user is not connected and trying to access protected routes
		if (!isConnected && isProtectedRoute) {
			goto('/');
			return;
		}

		// If user is connected and on root, redirect to appropriate route
		if (isConnected && pathname === '/') {
			goto(isAdmin ? '/admin' : '/app');
			return;
		}

		// If non-admin tries to access admin routes
		if (isConnected && isAdminRoute && !isAdmin) {
			goto('/app');
		}
	});
</script>

<svelte:head>
	<title>SwapCast - Decentralized Prediction Markets</title>
	<meta
		name="description"
		content="Trade on the future of crypto with SwapCast's decentralized prediction markets"
	/>
</svelte:head>

<div class="flex min-h-screen flex-col">
	{#if isAppRoute || isAdminRoute}
		<AppHeader />
	{:else}
		<LandingHeader />
	{/if}

	<main class="min-h-screen pt-16" class:bg-gray-50={isAppRoute}>
		{@render children()}
	</main>

	<Footer />
</div>

<script lang="ts">
	import { page } from '$app/state';
	import { Footer, ToastContainer } from '$lib/components/common';
	import { Header } from '$lib/components/landing';
	import AppHeader from '$lib/components/app/AppHeader.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import '../app.css';
	import { appKit } from '$lib/configs/wallet.config';
	import { isAdmin } from '$lib/utils/admin';


	let { children } = $props<{ children: any }>();

	// Determine route types
	const isAppRoute = $derived(page.url.pathname.startsWith('/app'));
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const isProtectedRoute = $derived(isAppRoute || isAdminRoute);
	const pathname = $derived(page.url.pathname);
	let isConnected = $state(false);
	let userAddress = $state<string | null>(null);
	let isMounted = $state(false);

	onMount(() => {
		isMounted = true;
		return () => {
			isMounted = false;
		};
	});

	$effect(() => {
		if (!browser || !isMounted) return;

		try {
			// Initial state
			const initialState = appKit.getIsConnectedState?.();
			isConnected = !!initialState;
			userAddress = appKit.getAccount?.()?.address || null;

			// Subscribe to wallet state changes if appKit is available
			if (typeof appKit.subscribeState === 'function') {
				const unsubscribe = appKit.subscribeState((state: any) => {
					if (!isMounted) return;

					try {
						const newIsConnected = state?.open || appKit.getIsConnectedState?.() || false;
						const newAddress = appKit.getAccount?.()?.address || null;

						// Only update if there's an actual change
						if (isConnected !== newIsConnected || userAddress !== newAddress) {
							isConnected = newIsConnected;
							userAddress = newAddress;

							// Trigger route handling on connection state change
							handleRouteBasedOnConnectionState();
						}
					} catch (e) {
						console.error('Error in wallet state subscription:', e);
					}
				});

				return () => {
					if (typeof unsubscribe === 'function') {
						unsubscribe();
					}
				};
			}
		} catch (e) {
			console.error('Error initializing wallet state:', e);
		}

		// Add global event listener to prevent page refreshes
		const handleClick = (e: MouseEvent) => {
			// Prevent default for buttons in the admin section
			if (
				isAdminRoute &&
				e.target instanceof Element &&
				e.target.closest('button, th[role="button"], tr[role="button"]')
			) {
				e.preventDefault();
			}
		};

		document.addEventListener('click', handleClick, true);

		return () => {
			document.removeEventListener('click', handleClick, true);
		};
	});

	/**
	 * Handles route protection and redirects based on user authentication status and role
	 */
	$effect(() => {
		if (!browser) return;

		// Initial route handling when the page loads
		handleRouteBasedOnConnectionState();
	});

	/**
	 * Central function to handle all routing logic based on connection state
	 */
	function handleRouteBasedOnConnectionState() {
		// Temporarily disabled for debugging
		console.log('Wallet connection check bypassed for debugging');
		// if (isConnected) {
		// 	handleAuthenticatedRoutes();
		// } else {
		// 	handleUnauthenticatedAccess();
		// }
	}

	/**
	 * Redirects unauthenticated users away from protected routes
	 */
	function handleUnauthenticatedAccess() {
		if (!isConnected && isProtectedRoute) {
			goto('/');
		}
	}

	/**
	 * Handles routing for authenticated users
	 */
	function handleAuthenticatedRoutes() {
		// First check if user is on a page they shouldn't be on when authenticated
		const isHomePage = pathname === '/';
		const isLoginPage = pathname.includes('/login') || pathname.includes('/connect');

		if (isHomePage || isLoginPage) {
			// Redirect to appropriate dashboard
			const userDashboard = isAdmin() ? '/admin' : '/app';
			goto(userDashboard);
			return;
		}

		// Then check if admin user is trying to access non-admin routes
		if (isAdmin() && isAppRoute) {
			goto('/admin');
			return;
		}

		// Finally check if non-admin user is trying to access admin routes
		if (!isAdmin() && isAdminRoute) {
			goto('/app');
			return;
		}
	}

	/**
	 * Prevents non-admin users from accessing admin routes
	 */
	function handleUnauthorizedAdminAccess() {
		const userIsAdmin = isAdmin();

		if (isConnected && isAdminRoute && !userIsAdmin) {
			goto('/app');
		}
	}
</script>

<svelte:head>
	<title>SwapCast - Decentralized Prediction Markets</title>
	<meta
		name="description"
		content="Trade on the future of crypto with SwapCast's decentralized prediction markets"
	/>
</svelte:head>

{#if isMounted}
	<div class="flex min-h-screen flex-col bg-white">
		<!-- Show AppHeader for app routes, otherwise show landing header -->
		{#if isAppRoute}
			<AppHeader />
		{:else}
			<Header
				showLandingLinks={!isConnected || !isAdminRoute}
				isConnected={isConnected}
				userAddress={userAddress}
				isAppRoute={isAppRoute}
				isAdminRoute={isAdminRoute}
				isProtectedRoute={isProtectedRoute}
				{pathname}
			/>
		{/if}

		<main class="flex-1">
			{@render children()}
		</main>

		{#if !isAdminRoute}
			<Footer />
		{/if}

		<ToastContainer />
	</div>
{/if}

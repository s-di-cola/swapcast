<script lang="ts">
    import {page} from '$app/state';
    import AppHeader from '$lib/components/app/AppHeader.svelte';
    import LandingHeader from '$lib/components/landing/LandingHeader.svelte';
    import Footer from '$lib/components/common/Footer.svelte';
    import {goto} from '$app/navigation';
    import {browser} from '$app/environment';
    import '../app.css';
    import {appKit} from '$lib/configs/wallet.config';
    import {isAdmin} from "$lib/utils/admin";

    let {children} = $props<{ children: any }>();

    // Determine route types
    const isAppRoute = $derived(page.url.pathname.startsWith('/app'));
    const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
    const isProtectedRoute = $derived(isAppRoute || isAdminRoute);
    const pathname = $derived(page.url.pathname);

    /**
     * Handles route protection and redirects based on user authentication status and role
     */
    $effect(() => {
        if (!browser) return;

        handleUnauthenticatedAccess();
        handleAuthenticatedHomeRedirect();
        handleUnauthorizedAdminAccess();
    });

    /**
     * Redirects unauthenticated users away from protected routes
     */
    function handleUnauthenticatedAccess() {
        const isAuthenticated = appKit.getIsConnectedState();
        if (!isAuthenticated && isProtectedRoute) {
            goto('/');
        }
    }

    /**
     * Redirects authenticated users from the home page to their appropriate dashboard
     */
    function handleAuthenticatedHomeRedirect() {
        const isAuthenticated = appKit.getIsConnectedState();
        const isHomePage = pathname === '/';

        if (isAuthenticated && isHomePage) {
            const userDashboard = isAdmin() ? '/admin' : '/app';
            goto(userDashboard);
        }
    }

    /**
     * Prevents non-admin users from accessing admin routes
     */
    function handleUnauthorizedAdminAccess() {
        const isAuthenticated = appKit.getIsConnectedState();
        const userIsAdmin = isAdmin();

        if (isAuthenticated && isAdminRoute && !userIsAdmin) {
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

<div class="flex min-h-screen flex-col">
    {#if isAppRoute || isAdminRoute}
        <AppHeader/>
    {:else}
        <LandingHeader/>
    {/if}

    <main class="min-h-screen pt-16" class:bg-gray-50={isAppRoute}>
        {@render children()}
    </main>

    <Footer/>
</div>

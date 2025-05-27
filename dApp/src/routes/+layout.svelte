<script lang="ts">
    import {page} from '$app/state';
    import Footer from '$lib/components/common/Footer.svelte';
    import ToastContainer from '$lib/components/common/ToastContainer.svelte';
    import Header from '$lib/components/common/Header.svelte';
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
    let isConnected = $state(appKit.getIsConnectedState());

    $effect(() => {
        if (!browser) return;
        const unsubscribe = appKit.subscribeState((state) => {
            isConnected = state.open || appKit.getIsConnectedState();
        });
        isConnected = appKit.getIsConnectedState();
        return unsubscribe;
    });




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
        if (!isConnected && isProtectedRoute) {
            goto('/');
        }
    }

    /**
     * Redirects authenticated users from the home page to their appropriate dashboard
     */
    function handleAuthenticatedHomeRedirect() {
        const isHomePage = pathname === '/';

        if (isConnected && isHomePage) {
            const userDashboard = isAdmin() ? '/admin' : '/app';
            goto(userDashboard);
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

<div class="flex min-h-screen flex-col bg-white">
    <!-- Unified header with different props based on route -->
    <Header 
        showLandingLinks={!isConnected || (!isAppRoute && !isAdminRoute)}
        showAppLinks={isConnected && isAppRoute}
        showAdminLinks={isConnected && isAdminRoute}
        title={isAdminRoute ? "SwapCast Admin" : "SwapCast"}
    />
    
    <main class="flex-1">
        {@render children()}
    </main>
    
    {#if !isAdminRoute}
        <Footer />
    {/if}
    
    <ToastContainer />
</div>

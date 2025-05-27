<script lang="ts">
    import { appKit } from '$lib/configs/wallet.config';
    import WalletConnection from './WalletConnection.svelte';
    import { isAdmin } from '$lib/utils/admin';
    import { goto } from '$app/navigation';
    import { headerStore } from '$lib/stores/headerStore';

    // Props to control what links to display
    export let showLandingLinks = false;
    export let showAppLinks = false;
    export let showAdminLinks = false;
    export let title = "SwapCast";

    // Navigation links for different user types
    const landingLinks = [
        { name: 'Features', href: '/#features' },
        { name: 'How it works', href: '/#how-it-works' },
        { name: 'Developers', href: '/#developers' }
    ];

    const appLinks = [
        { name: 'Markets', href: '/app' },
        { name: 'My Positions', href: '/app/positions' },
        { name: 'History', href: '/app/history' }
    ];

    // Subscribe to the header store
    let onCreateMarketClick: (() => void) | null = null;
    headerStore.subscribe(state => {
        onCreateMarketClick = state.onCreateMarketClick;
    });

    // Handle navigation
    function navigateTo(href: string) {
        goto(href);
    }
</script>

<header class="bg-white border-b border-gray-200">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 justify-between">
            <!-- Logo and Navigation Links -->
            <div class="flex">
                <!-- Logo -->
                <div class="flex flex-shrink-0 items-center">
                    <a href="/" class="text-2xl font-bold text-indigo-600 hover:text-indigo-700">
                        {title}
                    </a>
                </div>

                <!-- Navigation Links -->
                {#if showLandingLinks}
                    <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                        {#each landingLinks as link}
                            <a 
                                href={link.href}
                                class="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            >
                                {link.name}
                            </a>
                        {/each}
                    </div>
                {/if}

                {#if showAppLinks}
                    <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                        {#each appLinks as link}
                            <a 
                                href={link.href}
                                class="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            >
                                {link.name}
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Right side: Admin button and/or Wallet -->
            <div class="flex items-center">
                {#if showAdminLinks && onCreateMarketClick}
                    <button
                        type="button"
                        onclick={onCreateMarketClick}
                        class="mr-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        <svg
                            class="-ml-0.5 mr-2 h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                clip-rule="evenodd"
                            ></path>
                        </svg>
                        Create New Market
                    </button>
                {/if}

                <!-- Wallet Connection -->
                <WalletConnection />
            </div>
        </div>
    </div>
</header>

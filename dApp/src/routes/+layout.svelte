<script lang="ts">
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/app/AppHeader.svelte';
	import LandingHeader from '$lib/components/landing/LandingHeader.svelte';
	import Footer from '$lib/components/common/Footer.svelte';
	import '../app.css';

	let { children } = $props<{ children: any }>();

	// Create a derived state for the current path
	const currentPath = $derived(browser ? window.location.pathname : '');

	// Determine if we're on an app route
	const isAppRoute = $derived(currentPath.startsWith('/app') || currentPath.startsWith('/admin'));
</script>

{#if isAppRoute}
	<AppHeader />
{:else}
	<LandingHeader />
{/if}

<main class="min-h-screen pt-16" class:bg-gray-50={isAppRoute}>
	{@render children()}
</main>

<!-- Common Footer -->
<Footer />

<svelte:head>
	<title>SwapCast - Decentralized Prediction Markets</title>
	<meta
		name="description"
		content="Trade on the future of crypto with SwapCast's decentralized prediction markets"
	/>
</svelte:head>

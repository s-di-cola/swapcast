<script lang="ts">
	import { browser } from '$app/environment';
	import Header from '$lib/components/common/Header.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';
	import '../app.css';

	let { children } = $props<{ children: any }>();

	// Create a derived state for the current path
	const currentPath = $derived(browser ? window.location.pathname : '');

	// Determine header and footer variants based on the current path
	const isAppRoute = $derived(currentPath.startsWith('/app') || currentPath.startsWith('/admin'));
	const headerVariant = $derived(isAppRoute ? 'app' : 'landing');
</script>

<Header variant={headerVariant} />

<main class="min-h-screen pt-16" class:bg-gray-50={isAppRoute}>
	{@render children()}
</main>

<!-- Conditional Footer -->
{#if isAppRoute}
	<!-- Simple footer for app pages -->
	<footer class="border-t border-gray-100 bg-white py-8 text-center text-sm text-gray-500">
		&copy; {new Date().getFullYear()} SwapCast. All rights reserved.
	</footer>
{:else}
	<!-- Full footer for landing page -->
	<Footer />
{/if}

<svelte:head>
	<title>SwapCast - Decentralized Prediction Markets</title>
	<meta
		name="description"
		content="Trade on the future of crypto with SwapCast's decentralized prediction markets"
	/>
</svelte:head>

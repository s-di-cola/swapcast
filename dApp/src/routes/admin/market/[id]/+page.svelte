<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// Extract the market ID from the URL parameters
	const marketId = page.params.id;

	// Redirect to admin dashboard and open modal via URL parameter
	onMount(() => {
		if (browser) {
			goto(`/admin?marketId=${marketId}`, { replaceState: true });
		}
	});
</script>

<div class="flex h-screen items-center justify-center">
	<p>Redirecting to dashboard...</p>
</div>

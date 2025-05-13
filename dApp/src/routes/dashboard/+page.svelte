<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  // Redirect to the new /app route
  onMount(() => {
    if (browser) {
      goto('/app', { replaceState: true });
    }
  });
</script>

<svelte:head>
  <title>Redirecting to SwapCast App</title>
  <meta name="description" content="SwapCast Decentralized Prediction Market" />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-2xl font-bold text-gray-800 mb-2">Redirecting to SwapCast App...</h1>
    <p class="text-gray-600">If you are not redirected automatically, <a href="/app" class="text-indigo-600 hover:text-indigo-800">click here</a>.</p>
  </div>
</div>

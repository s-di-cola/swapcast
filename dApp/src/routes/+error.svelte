<script lang="ts">
  import { page } from '$app/stores';
  
  // Using Svelte 5 runes for state management
  let status = $state(404);
  let message = $state('Page not found');
  
  // Reactive statement to update state when page store changes
  $effect(() => {
    if ($page.status) {
      status = $page.status;
      message = $page.error?.message || 'An error occurred';
    }
  });

  /**
   * Navigate back to the previous page
   */
  function goBack() {
    window.history.back();
  }

  /**
   * Navigate to the home page
   */
  function goHome() {
    window.location.href = '/';
  }
</script>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-6">
  <div class="max-w-2xl w-full text-center">
    <div class="text-9xl font-bold text-blue-500 mb-2">{status}</div>
    <h1 class="text-4xl font-bold text-gray-900 mb-6">
      {#if status === 404}
        Page not found
      {:else}
        Oops! Something went wrong
      {/if}
    </h1>
    
    <p class="text-xl text-gray-600 mb-8">
      {#if status === 404}
        The page you're looking for doesn't exist or has been moved.
      {:else}
        {message}
      {/if}
    </p>
    
    <div class="flex flex-col sm:flex-row justify-center gap-4">
      <button
        onclick={goBack}
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Go Back
      </button>
      <button
        onclick={goHome}
        class="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Return Home
      </button>
    </div>
    
    <div class="mt-12 text-sm text-gray-500">
      <p>If you think this is a mistake, please contact support.</p>
    </div>
  </div>
  
  <style>
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }
    
    .floating {
      animation: float 6s ease-in-out infinite;
    }
  </style>
  
  <div class="mt-16 opacity-20 floating">
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  </div>
</div>

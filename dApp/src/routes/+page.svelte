<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { Button } from 'flowbite-svelte';
  import { ArrowRightOutline } from 'flowbite-svelte-icons';

  // Redirect to the new /app route
  onMount(() => {
    if (browser) {
      // We'll use a small delay to allow users to see the landing page briefly
      setTimeout(() => {
        goto('/app');
      }, 1500);
    }
  });
  // No additional data needed for redirect
</script>

<section class="relative min-h-screen bg-slate-50 flex flex-col justify-center overflow-hidden">
  <!-- Animated SVG background -->
  <svg class="absolute -top-32 -left-32 w-[48rem] h-[48rem] opacity-30 blur-2xl animate-spin-slow pointer-events-none z-0" viewBox="0 0 700 700" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="a" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop stop-color="#0EA5E9"/>
        <stop offset="1" stop-color="#14B8A6"/>
      </radialGradient>
    </defs>
    <circle cx="350" cy="350" r="320" fill="url(#a)" />
  </svg>
  
  <!-- Hero Section -->
  <div class="flex-1 flex flex-col items-center justify-center py-24 px-4">
    <div class="max-w-2xl w-full text-center animate-fade-in-up">
      <!-- Logo/Icon -->
      <div class="flex justify-center mb-4">
        <span class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg ring-2 ring-sky-200">
          <svg class="w-12 h-12 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 2.05v3.02a7 7 0 1 0 6.71 10.98l2.59 1.5A9.96 9.96 0 0 1 12 22a10 10 0 1 1 10-10c0 1.8-.47 3.5-1.3 4.95l-2.59-1.5A7 7 0 0 0 19 12a7 7 0 0 0-7-7V2.05z"></path>
          </svg>
        </span>
      </div>
      <h1 class="text-5xl md:text-6xl font-extrabold mb-2 text-gray-900">
        <span class="bg-gradient-to-r from-sky-600 to-teal-500 bg-clip-text text-transparent">SwapCast</span>
      </h1>
      <p class="mt-2 text-xl md:text-2xl text-gray-600 font-medium">
        Redirecting you to our new app experience...
      </p>
      <div class="flex justify-center mb-4 mt-4">
        <div class="animate-pulse flex space-x-4">
          <div class="h-3 w-3 bg-sky-500 rounded-full"></div>
          <div class="h-3 w-3 bg-sky-400 rounded-full"></div>
          <div class="h-3 w-3 bg-teal-400 rounded-full"></div>
        </div>
      </div>
      <div class="mt-8 flex flex-col items-center gap-4">
        <Button href="/app" color="primary" size="xl" class="px-8 py-3 text-lg font-semibold shadow-lg bg-gradient-to-r from-sky-500 to-teal-500 hover:from-teal-500 hover:to-sky-500 transition-all duration-300 animate-pulse-on-hover flex items-center gap-2">
          <ArrowRightOutline class="w-5 h-5" /> Go to App Now
        </Button>
      </div>
    </div>
  </div>

  <footer class="text-center py-6 text-gray-400 text-xs flex flex-col items-center gap-2">
    <div>&copy; {new Date().getFullYear()} SwapCast. All rights reserved.</div>
  </footer>

<style>
  .animate-fade-in-up {
    animation: fadeInUp 1s cubic-bezier(0.39, 0.575, 0.565, 1) both;
  }
  .animate-fade-in {
    animation: fadeIn 1.2s cubic-bezier(0.39, 0.575, 0.565, 1) both;
  }
  @keyframes fadeInUp {
    0% {
      opacity: 0;
      transform: translateY(40px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  .animate-bounce-slow {
    animation: bounce 2.5s infinite;
  }
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  .animate-pulse-on-hover:hover {
    animation: pulse 1s;
  }
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
    }
    70% {
      box-shadow: 0 0 0 16px rgba(16, 185, 129, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }
</style>
</section>
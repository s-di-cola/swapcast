<script lang="ts">
    import WalletConnection from '../common/WalletConnection.svelte';
    import {goto} from '$app/navigation';

    function goToApp() {
		goto('/app');
	}
</script>

<header
	class="bg-opacity-90 fixed top-0 left-0 z-50 w-full border-b border-gray-100 bg-white backdrop-blur-sm"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center">
				<a
					href="/"
					class="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-xl font-bold text-transparent transition-colors hover:from-indigo-500 hover:to-sky-400"
					>SwapCast</a
				>
			</div>
			<nav class="hidden space-x-8 md:flex">
				<a href="#features" class="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900"
					>Features</a
				>
				<a
					href="#how-it-works"
					class="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">How it works</a
				>
				<a
					href="#developers"
					class="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">Developers</a
				>
			</nav>
			<div>
				<WalletConnection />
			</div>
		</div>
	</div>
</header>

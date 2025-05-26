<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ToastType, ToastPosition } from '$lib/stores/toastStore';

	// Toast properties
	export let type: ToastType = 'success';
	export let message: string = '';
	export let duration: number = 5000;
	export let show: boolean = false;
	export let position: ToastPosition = 'top-center';
	export let dismissible: boolean = true;
	export let onClose: () => void = () => {};

	// Make sure the show property is properly tracked in Svelte 5
	$: isVisible = show;

	// Internal state
	let timer: ReturnType<typeof setTimeout> | null = null;

	// Computed properties for styling based on type
	$: iconColor = getIconColor(type);
	$: progressBarColor = getProgressBarColor(type);
	$: iconPath = getIconPath(type);

	// Helper functions for dynamic styling
	function getIconPath(type: ToastType): string {
		switch (type) {
			case 'success':
				return "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z";
			case 'error':
				return "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z";
			case 'info':
				return "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z";
			case 'warning':
				return "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z";
			default:
				return "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z";
		}
	}
	
	function getIconColor(type: ToastType): string {
		switch (type) {
			case 'success': return 'text-emerald-500';
			case 'error': return 'text-red-500';
			case 'info': return 'text-blue-500';
			case 'warning': return 'text-amber-500';
			default: return 'text-blue-500';
		}
	}
	
	function getProgressBarColor(type: ToastType): string {
		switch (type) {
			case 'success': return 'bg-emerald-500';
			case 'error': return 'bg-red-500';
			case 'info': return 'bg-blue-500';
			case 'warning': return 'bg-amber-500';
			default: return 'bg-blue-500';
		}
	}
	
	// Watch for changes to isVisible and duration using a reactive statement
	$: {
		if (isVisible && duration > 0) {
			// Clear any existing timer first
			if (timer) clearTimeout(timer);
			
			// Set new timer
			timer = setTimeout(() => {
				onClose();
			}, duration);
		}
	}
	
	// Clean up on component destruction
	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});
	
	function handleClose() {
		onClose();
	}
</script>

{#if isVisible}
	<div class="toast-wrapper toast-{position}">
		<div class="flex w-96 items-center rounded-md bg-white py-4 px-5 shadow-stripe">
			<div class="mr-3 {iconColor}">
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d={iconPath} clip-rule="evenodd" />
				</svg>
			</div>
			<div class="flex-1 text-sm font-medium text-gray-900">
				{message}
			</div>
			{#if dismissible}
				<button 
					type="button" 
					class="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none"
					on:click={handleClose}
					aria-label="Close"
				>
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			{/if}
			{#if duration > 0}
				<div class="absolute bottom-0 left-0 h-1 {progressBarColor} progress-bar" style="animation-duration: {duration}ms;"></div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Base toast wrapper positioning */
	.toast-wrapper {
		position: fixed;
		z-index: 9999;
		display: flex;
		justify-content: center;
	}

	/* Position-specific styles */
	:global(.toast-top-center) {
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		animation: slideDown 0.2s ease-out;
	}

	:global(.toast-top-right) {
		top: 1rem;
		right: 1rem;
		animation: slideLeft 0.2s ease-out;
	}

	:global(.toast-bottom-right) {
		bottom: 1rem;
		right: 1rem;
		animation: slideUp 0.2s ease-out;
	}

	:global(.toast-bottom-center) {
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		animation: slideUp 0.2s ease-out;
	}

	/* Animation keyframes */
	@keyframes slideDown {
		from {
			transform: translateY(-100%) translateX(-50%);
			opacity: 0;
		}
		to {
			transform: translateY(0) translateX(-50%);
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%) translateX(-50%);
			opacity: 0;
		}
		to {
			transform: translateY(0) translateX(-50%);
			opacity: 1;
		}
	}

	@keyframes slideLeft {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes progress {
		from { width: 0%; }
		to { width: 100%; }
	}

	.shadow-stripe {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
	}

	.progress-bar {
		animation-name: progress;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
		width: 0%;
	}
</style>

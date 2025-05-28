<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { ToastType, ToastPosition } from '$lib/stores/toastStore';
	
	interface Props {
		type?: ToastType;
		message?: string;
		duration?: number;
		show?: boolean;
		position?: ToastPosition;
		dismissible?: boolean;
		onClose?: () => void;
	}
	
	let {
		type = 'success',
		message = '',
		duration = 5000,
		show = false,
		position = 'top-center',
		dismissible = true,
		onClose = () => {}
	}: Props = $props();
	
	let timer = $state<ReturnType<typeof setTimeout> | null>(null);
	
	const TOAST_ICONS = {
		success: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
		error: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
		info: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z",
		warning: "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
	} as const;
	
	const TOAST_COLORS = {
		success: { icon: 'text-emerald-500', progress: 'bg-emerald-500' },
		error: { icon: 'text-red-500', progress: 'bg-red-500' },
		info: { icon: 'text-blue-500', progress: 'bg-blue-500' },
		warning: { icon: 'text-amber-500', progress: 'bg-amber-500' }
	} as const;
	
	const iconPath = $derived(TOAST_ICONS[type] || TOAST_ICONS.info);
	const colors = $derived(TOAST_COLORS[type] || TOAST_COLORS.info);
	
	function handleClose(): void {
		onClose();
	}
	
	$effect(() => {
		if (show && duration > 0) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			
			timer = setTimeout(() => {
				onClose();
			}, duration);
		}
		
		return () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		};
	});
	
	onDestroy(() => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	});
	</script>
	
	{#if show}
		<div class="toast-wrapper toast-{position}">
			<div class="flex w-96 items-center rounded-md bg-white py-4 px-5 shadow-stripe">
				<div class="mr-3 {colors.icon}">
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
						onclick={handleClose}
						aria-label="Close"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
						</svg>
					</button>
				{/if}
				{#if duration > 0}
					<div class="absolute bottom-0 left-0 h-1 {colors.progress} progress-bar" style="animation-duration: {duration}ms;"></div>
				{/if}
			</div>
		</div>
	{/if}
	
	<style>
		.toast-wrapper {
			position: fixed;
			z-index: 10001;
			display: flex;
			justify-content: center;
			isolation: isolate;
		}
	
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
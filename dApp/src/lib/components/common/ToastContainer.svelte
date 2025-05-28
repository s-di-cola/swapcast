<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toastStore';
	import ToastComponent from './Toast.svelte';
	import type { ToastPosition } from '$lib/stores/toastStore';
	
	const TOAST_POSITIONS: ToastPosition[] = [
		'top-center',
		'top-right', 
		'bottom-right',
		'bottom-center'
	] as const;
	
	function groupToastsByPosition(toasts: Toast[]): Record<ToastPosition, Toast[]> {
		const groups = TOAST_POSITIONS.reduce((acc, position) => {
			acc[position] = [];
			return acc;
		}, {} as Record<ToastPosition, Toast[]>);
	
		toasts.forEach(toast => {
			const position = toast.position || 'top-center';
			groups[position].push(toast);
		});
	
		return groups;
	}
	
	function handleToastClose(toastId: string): void {
		toastStore.removeToast(toastId);
	}
	
	const toastsByPosition = $derived(groupToastsByPosition($toastStore));
	</script>
	
	{#each Object.entries(toastsByPosition) as [position, toasts]}
		{#if toasts.length > 0}
			<div class="toast-container toast-container-{position}">
				{#each toasts as toast (toast.id)}
					<ToastComponent 
						type={toast.type} 
						message={toast.message} 
						duration={toast.duration}
						position={toast.position || 'top-center'}
						dismissible={toast.dismissible !== false}
						show={true}
						onClose={() => handleToastClose(toast.id)}
					/>
				{/each}
			</div>
		{/if}
	{/each}
	
	<style>
		.toast-container {
			position: fixed;
			z-index: 10000;
			display: flex;
			flex-direction: column;
			pointer-events: none;
			isolation: isolate;
		}
	
		.toast-container-top-center {
			top: 0;
			left: 0;
			right: 0;
			align-items: center;
		}
	
		.toast-container-top-right {
			top: 0;
			right: 0;
			align-items: flex-end;
		}
	
		.toast-container-bottom-right {
			bottom: 0;
			right: 0;
			align-items: flex-end;
		}
	
		.toast-container-bottom-center {
			bottom: 0;
			left: 0;
			right: 0;
			align-items: center;
		}
		
		.toast-container :global(> *) {
			pointer-events: auto;
			margin: 1rem;
		}
	</style>
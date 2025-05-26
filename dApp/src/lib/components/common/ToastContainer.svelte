<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toastStore';
	import ToastComponent from './Toast.svelte';

	// Group toasts by position
	$: toastsByPosition = groupToastsByPosition($toastStore);

	function groupToastsByPosition(toasts: Toast[]) {
		const groups: Record<string, Toast[]> = {
			'top-center': [],
			'top-right': [],
			'bottom-right': [],
			'bottom-center': []
		};

		toasts.forEach(toast => {
			const position = toast.position || 'top-center';
			groups[position].push(toast);
		});

		return groups;
	}
</script>

<!-- Render toasts grouped by position -->
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
					onClose={() => toastStore.removeToast(toast.id)}
				/>
			{/each}
		</div>
	{/if}
{/each}

<style>
	/* Base container styles */
	.toast-container {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		pointer-events: none;
	}

	/* Position-specific container styles */
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

import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastPosition = 'top-center' | 'top-right' | 'bottom-right' | 'bottom-center';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration: number;
	position?: ToastPosition;
	dismissible?: boolean;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	interface ToastOptions {
		duration?: number;
		position?: ToastPosition;
		dismissible?: boolean;
	}

	const defaultOptions: ToastOptions = {
		duration: 5000,
		position: 'top-center',
		dismissible: true
	};

	function addToast(type: ToastType, message: string, options: ToastOptions = {}) {
		const id = Date.now().toString();
		const toastOptions = { ...defaultOptions, ...options };

		const toast: Toast = {
			id,
			type,
			message,
			duration: toastOptions.duration!,
			position: toastOptions.position,
			dismissible: toastOptions.dismissible
		};

		update((toasts) => {
			const newToasts = [...toasts, toast];
			return newToasts;
		});

		// Auto-remove toast after duration
		if (toast.duration > 0) {
			setTimeout(() => {
				removeToast(id);
			}, toast.duration);
		}

		return id;
	}

	function removeToast(id: string) {
		update((toasts) => toasts.filter((toast) => toast.id !== id));
	}

	function success(message: string, options: ToastOptions = {}) {
		return addToast('success', message, options);
	}

	function error(message: string, options: ToastOptions = {}) {
		return addToast('error', message, options);
	}

	function info(message: string, options: ToastOptions = {}) {
		return addToast('info', message, options);
	}

	function warning(message: string, options: ToastOptions = {}) {
		return addToast('warning', message, options);
	}

	function clear() {
		update(() => []);
	}

	return {
		subscribe,
		addToast,
		removeToast,
		success,
		error,
		info,
		warning,
		clear
	};
}

export const toastStore = createToastStore();

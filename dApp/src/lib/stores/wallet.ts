import { writable } from 'svelte/store';

// true = connected, false = not connected
export const isConnected = writable(false);
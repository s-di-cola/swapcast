import { writable } from 'svelte/store';

// Store for header actions
type HeaderStore = {
  onCreateMarketClick: (() => void) | null;
};

// Initialize with default values
const initialState: HeaderStore = {
  onCreateMarketClick: null
};

// Create the store
export const headerStore = writable<HeaderStore>(initialState);

// Helper functions
export function setCreateMarketAction(callback: () => void) {
  headerStore.update(state => ({ ...state, onCreateMarketClick: callback }));
}

export function clearCreateMarketAction() {
  headerStore.update(state => ({ ...state, onCreateMarketClick: null }));
}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  // AppKit web component types
  interface AppKitConnectElement extends HTMLElement {
    // Whether the wallet is connected
    isConnected: boolean;
    // The connected wallet address, or null if not connected
    address: string | null;
    // The current chain ID, or null if not connected
    chainId: string | null;
    // Open the wallet connection modal
    openModal(): void;
    // Disconnect the wallet
    disconnect(): void;
  }

  // Add the custom element to the global JSX namespace
  interface HTMLElementTagNameMap {
    'appkit-connect': AppKitConnectElement;
  }

  // Add the custom element to the Document interface
  interface Document {
    createElement(tagName: 'appkit-connect'): AppKitConnectElement;
    querySelector(selectors: 'appkit-connect'): AppKitConnectElement | null;
  }

  // Extend Window interface for global appkit object
  interface Window {
    appkit?: {
      open: (options: { view: string }) => void;
      disconnect: () => void;
    };
  }

  // Declare the custom events
  interface WindowEventMap {
    'appkit:connect': CustomEvent<{ isConnected: boolean; address?: string }>;
    'appkit:disconnect': CustomEvent<{ isConnected: boolean; address?: string }>;
  }

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};

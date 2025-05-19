// Type definitions for Reown AppKit
declare global {
  interface Window {
    appkit?: {
      isConnected: () => boolean;
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      on: (event: string, callback: (data: any) => void) => void;
      off: (event: string, callback: (data: any) => void) => void;
    };
  }
}

export {}; // This file needs to be a module

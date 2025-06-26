import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { anvil, ink_sepolia } from '$lib/configs/networks';
// @ts-ignore
import { PUBLIC_REOWN_PROJECT_ID } from '$env/static/public';

export const networks = [anvil, ink_sepolia];
export const wagmiAdapter = new WagmiAdapter({
	projectId: PUBLIC_REOWN_PROJECT_ID,
	networks
});

/**
 * Determine the current app URL based on environment
 * This helps avoid WalletConnect metadata URL mismatch warnings
 */
const getAppUrl = () => {
	// Check if we're in a browser environment
	if (typeof window !== 'undefined') {
		// Use the current origin (protocol + hostname + port)
		return window.location.origin;
	}
	// Fallback for SSR or non-browser environments
	return 'https://swapcast.io';
};

export const appKit = createAppKit({
	adapters: [wagmiAdapter],
	networks: [anvil, ink_sepolia],
	metadata: {
		name: 'SwapCast',
		description: 'SwapCast Prediction Market',
		url: getAppUrl(),
		icons: [`${getAppUrl()}/favicon.ico`]
	},
	projectId: PUBLIC_REOWN_PROJECT_ID,
	features: {
		analytics: false // Disabled to prevent telemetry errors
	}
});

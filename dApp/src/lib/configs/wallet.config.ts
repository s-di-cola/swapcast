import {createAppKit} from '@reown/appkit';
import {WagmiAdapter} from '@reown/appkit-adapter-wagmi';
import {anvil} from '$lib/configs/networks';
import {PUBLIC_REOWN_PROJECT_ID} from '$env/static/public';

export const networks = [anvil];
export const wagmiAdapter = new WagmiAdapter({
	projectId: PUBLIC_REOWN_PROJECT_ID,
	networks
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const modal = createAppKit({
	adapters: [wagmiAdapter],
	networks: [anvil],
	metadata: {
		name: 'SwapCast',
		description: 'SwapCast Prediction Market',
		url: 'https://swapcast.io',
		icons: ['https://swapcast.io/favicon.ico']
	},
	projectId: PUBLIC_REOWN_PROJECT_ID,
	features: {
		analytics: true
	}
});

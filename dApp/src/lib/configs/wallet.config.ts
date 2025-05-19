import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { anvil } from "$lib/configs/networks";
import { PUBLIC_REOWN_PROJECT_ID } from '$env/static/public';

const projectId = PUBLIC_REOWN_PROJECT_ID;
export const networks = [anvil];

export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks
});

export const modal = createAppKit({
    adapters: [wagmiAdapter],
    networks: [anvil],
    metadata: {
        name: 'SwapCast',
        description: 'SwapCast Prediction Market',
        url: 'https://swapcast.io',
        icons: ['https://swapcast.io/favicon.ico']
    },
    projectId,
    features: {
        analytics: true
    }
});
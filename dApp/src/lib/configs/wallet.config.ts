import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { virtual_mainnet } from "$lib/configs/tenderly.config";
import { PUBLIC_REOWN_PROJECT_ID } from '$env/static/public';

const projectId = PUBLIC_REOWN_PROJECT_ID;
export const networks = [virtual_mainnet];

export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks
});

export const modal = createAppKit({
    adapters: [wagmiAdapter],
    networks: [virtual_mainnet],
    metadata: {
        name: 'limit-order',
        description: 'Limit Order Demo dApp',
        url: 'https://reown.com/appkit',
        icons: ['https://assets.reown.com/reown-profile-pic.png']
    },
    projectId,
    features: {
        analytics: true
    }
});

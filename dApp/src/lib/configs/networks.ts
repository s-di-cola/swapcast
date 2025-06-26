export const anvil = {
	id: 31337,
	name: 'Anvil',
	network: 'anvil',
	nativeCurrency: {
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18
	},
	rpcUrls: {
		default: {
			http: ['http://127.0.0.1:8545']
		},
		public: {
			http: ['http://127.0.0.1:8545']
		}
	},
	testnet: true
};

export const ink_sepolia = {
    id: 763373,
    name: 'Ink Sepolia',
    network: 'ink_sepolia',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: ['https://rpc-gel-sepolia.inkonchain.com/']
        },
        public: {
            http: ['https://rpc-gel-sepolia.inkonchain.com/']
        }
    },
    testnet: true
};
export interface TokenConfig {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    coingeckoId: string;
    isStablecoin: boolean;
    category: 'crypto' | 'stablecoin' | 'altcoin';
}

export const TOKEN_CONFIGS: Record<string, TokenConfig> = {
    ETH: {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        coingeckoId: 'ethereum',
        isStablecoin: false,
        category: 'crypto'
    },
    WBTC: {
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        decimals: 8,
        coingeckoId: 'bitcoin',
        isStablecoin: false,
        category: 'crypto'
    },
    USDC: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        coingeckoId: 'usd-coin',
        isStablecoin: true,
        category: 'stablecoin'
    },
    USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        coingeckoId: 'tether',
        isStablecoin: true,
        category: 'stablecoin'
    },
    DAI: {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        decimals: 18,
        coingeckoId: 'dai',
        isStablecoin: true,
        category: 'stablecoin'
    },
    // Easy to add more tokens
    LINK: {
        address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        symbol: 'LINK',
        name: 'Chainlink',
        decimals: 18,
        coingeckoId: 'chainlink',
        isStablecoin: false,
        category: 'altcoin'
    },
    UNI: {
        address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        symbol: 'UNI',
        name: 'Uniswap',
        decimals: 18,
        coingeckoId: 'uniswap',
        isStablecoin: false,
        category: 'altcoin'
    },
    AAVE: {
        address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        symbol: 'AAVE',
        name: 'Aave',
        decimals: 18,
        coingeckoId: 'aave',
        isStablecoin: false,
        category: 'altcoin'
    }
};
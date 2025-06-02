export interface Token {
	name: string;
	address: string;
	symbol: string;
	decimals: number;
	chainId: number;
	logoURI?: string;
}

export interface MarketFormData {
	marketName: string;
	tokenA_address: string;
	tokenB_address: string;
	feeTier: number;
	targetPriceStr: string;
	expirationDay: string;
	expirationTime: string;
}

export interface MarketCreationProps {
	showModal?: boolean;
	onClose: () => void;
	onMarketCreated?: (marketId: string, name: string) => void;
	onMarketCreationFailed?: (error: string) => void;
}

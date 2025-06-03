export interface Token {
	symbol: string;
	name: string;
	balance?: number;
	balanceWei?: string;
	decimals?: number;
	contractAddress?: string;
	logo?: string;
	logoURI?: string;
}

export type PredictionSide = 'above_target' | 'below_target' | 'no_prediction' | undefined;
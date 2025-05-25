export interface Token {
	symbol: string;
	name: string;
	// Optional: Add other relevant properties like address, decimals, logoURI, etc.
	// address?: string;
	// decimals?: number;
	// logoURI?: string;
}

export type PredictionSide = 'above_target' | 'below_target' | 'no_prediction' | undefined;

// You can add other shared types here as your project grows.

/// <reference types="@sveltejs/kit" />

// Declare the $env modules
declare module '$env/static/public' {
	export const PUBLIC_ADMIN_ADDRESS: `0x${string}`;
	export const PUBLIC_PREDICTIONMANAGER_ADDRESS: `0x${string}`;
	export const PUBLIC_REOWN_PROJECT_ID: `0x${string}`;
	export const PUBLIC_SWAPCASTHOOK_ADDRESS: `0x${string}`;
	export const PUBLIC_UNIV4_POOLMANAGER_ADDRESS: `0x${string}`;
	export const PUBLIC_COINGECKO_API_URL: string;
	export const PUBLIC_RPC_URL: string;
	export const PUBLIC_UNIV4_STATEVIEW_ADDRESS: `0x${string}`;
	export const PUBLIC_UNIVERSAL_ROUTER_ADDRESS: `0x${string}`;
}

declare module '$env/static/private' {
	// Private env vars declarations if needed
}

declare module '$env/dynamic/public' {
	// Dynamic public env vars
}

declare module '$env/dynamic/private' {
	// Dynamic private env vars
}

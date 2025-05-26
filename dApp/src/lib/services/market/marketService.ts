import {type Address, type Chain, type Hash, http, parseEther} from 'viem';
import {createPool} from './poolService';
import {getPredictionManager} from '$generated/types/PredictionManager';
// @ts-ignore
import {PUBLIC_PREDICTIONMANAGER_ADDRESS} from '$env/static/public';
import {appKit} from '$lib/configs/wallet.config';
import {getCurrentNetworkConfig} from "$lib/utils/network";

// Types
type MarketStatus = 'Open' | 'Expired' | 'Resolved';

export interface Market {
    id: string;
    name: string;
    assetSymbol: string;
    exists: boolean;
    resolved: boolean;
    winningOutcome: number;
    totalStake0: bigint;
    totalStake1: bigint;
    expirationTime: number;
    priceAggregator: Address;
    priceThreshold: number;
    status: MarketStatus;
    expirationDisplay: string;
    totalStake: string;
}

// Helper Functions
const getMarketStatus = (
    resolved: boolean,
    timeRemaining: number
): { status: MarketStatus; expirationDisplay: string } => {
    if (resolved) return {status: 'Resolved', expirationDisplay: 'Resolved'};
    if (timeRemaining <= 0) return {status: 'Expired', expirationDisplay: 'Expired'};

    const days = Math.floor(timeRemaining / 86400);
    const hours = Math.floor((timeRemaining % 86400) / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);

    let expirationDisplay = `${minutes}m`;
    if (days > 0) expirationDisplay = `${days}d ${hours}h`;
    else if (hours > 0) expirationDisplay = `${hours}h ${minutes}m`;

    return {status: 'Open', expirationDisplay};
};


/**
 * Get the total number of markets
 * @returns The count of markets as a number
 */
export async function getMarketCount(): Promise<number> {
    try {
        // Get chain ID with fallback
        const {rpcUrl, chain} = getCurrentNetworkConfig();

        // Create prediction manager with correct chain format
        const predictionManager = getPredictionManager({
            address: PUBLIC_PREDICTIONMANAGER_ADDRESS,
            chain: chain,
            transport: http(rpcUrl)
        });

        // Await the async call
        const count = await predictionManager.read.getMarketCount();
        return Number(count);
    } catch (error) {
        console.error('getMarketCount error:', error);
        return 0;
    }
}


/**
 * Get all markets
 *
 * This function fetches all market IDs and then gets the details for each market in parallel
 * It filters out non-existent markets and sorts them by status (Open first, then Expired, then Resolved)
 */
export async function getAllMarkets(): Promise<Market[]> {
    try {
        // Get the total count of markets
        const count = await getMarketCount();

        if (count === 0) {
            return [];
        }

        // Create an array of market IDs from 0 to count-1
        const marketIds = Array.from({length: Number(count)}, (_, i) => BigInt(i));

        // Fetch details for all markets in parallel
        const markets = await Promise.all(marketIds.map((id) => getMarketDetails(id)));

        // Filter out non-existent markets
        const existingMarkets = markets.filter((market) => market.exists);

        // Sort markets by status: Open first, then Expired, then Resolved
        return existingMarkets.sort((a, b) => {
            const statusOrder = {Open: 0, Expired: 1, Resolved: 2};
            return statusOrder[a.status] - statusOrder[b.status];
        });
    } catch (error) {
        console.error('getAllMarkets error:', error);
        return [];
    }
}

// Define a proper interface for the contract return type
interface MarketDetailsResult {
    marketId: bigint;
    description: string;
    assetPair: string;
    exists: boolean;
    resolved: boolean;
    winningOutcome: number;
    totalConvictionBearish: bigint;
    totalConvictionBullish: bigint;
    expirationTimestamp: bigint;
    priceOracle: Address;
    priceThreshold: bigint;
}

/**
 * Creates a default market object for error cases
 */
function createDefaultMarket(id: bigint): Market {
    const timeRemaining = -1;
    const {status, expirationDisplay} = getMarketStatus(false, timeRemaining);

    return {
        id: id.toString(),
        name: 'Error loading market',
        assetSymbol: 'N/A',
        exists: false,
        resolved: false,
        winningOutcome: 0,
        totalStake0: BigInt(0),
        totalStake1: BigInt(0),
        expirationTime: 0,
        priceAggregator: '0x0000000000000000000000000000000000000000' as Address,
        priceThreshold: 0,
        status,
        expirationDisplay,
        totalStake: '0'
    };
}

/**
 * Transforms raw market details into the Market interface
 */
function transformMarketDetails(details: MarketDetailsResult): Market {
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = Number(details.expirationTimestamp) - now;
    const {status, expirationDisplay} = getMarketStatus(details.resolved, timeRemaining);
    const totalStake = (details.totalConvictionBearish + details.totalConvictionBullish).toString();

    return {
        id: details.marketId.toString(),
        name: details.description || `Market ${details.marketId}`,
        assetSymbol: details.assetPair,
        exists: details.exists,
        resolved: details.resolved,
        winningOutcome: details.winningOutcome,
        totalStake0: details.totalConvictionBearish,
        totalStake1: details.totalConvictionBullish,
        expirationTime: Number(details.expirationTimestamp),
        priceAggregator: details.priceOracle,
        priceThreshold: Number(details.priceThreshold) / 10 ** 18,
        status,
        expirationDisplay,
        totalStake
    };
}

/**
 * Fetches detailed information about a specific market
 * @param marketId - The ID of the market to fetch
 * @returns A Promise resolving to a Market object
 */
export async function getMarketDetails(marketId: string | bigint): Promise<Market> {
    const id = typeof marketId === 'string' ? BigInt(marketId) : marketId;

    try {
        const {rpcUrl, chain} = getCurrentNetworkConfig();
        const predictionManager = getPredictionManager({
            address: PUBLIC_PREDICTIONMANAGER_ADDRESS,
            chain: chain,
            transport: http(rpcUrl)
        });

        const result = await predictionManager.read.getMarketDetails([id]);

        // Convert the array result to a typed object
        const [
            _id, description, assetPair, exists, resolved, winningOutcome,
            totalConvictionBearish, totalConvictionBullish, expirationTimestamp,
            priceOracle, priceThreshold
        ] = result as readonly [
            bigint, string, string, boolean, boolean, number,
            bigint, bigint, bigint, Address, bigint
        ];

        const details: MarketDetailsResult = {
            marketId: _id,
            description,
            assetPair,
            exists,
            resolved,
            winningOutcome,
            totalConvictionBearish,
            totalConvictionBullish,
            expirationTimestamp,
            priceOracle,
            priceThreshold
        };

        console.log(`[marketService] Got market details for ID ${id}:`, details);

        return transformMarketDetails(details);
    } catch (error) {
        console.error(`Error getting market details for ID ${id}:`, error);
        return createDefaultMarket(id);
    }
}

/**
 * Create a new prediction market
 * @param marketName Name/description of the market
 * @param priceFeedKey Key for the price feed (e.g., 'ETH/USD')
 * @param expirationTime Expiration time of the market
 * @param priceThresholdStr Target price threshold for the market (as a string)
 * @param poolKey The Uniswap v4 pool key
 * @returns Object containing success status, message, and transaction hash
 */
export async function createMarket(
    marketName: string,
    priceFeedKey: string,
    expirationTime: Date,
    priceThresholdStr: string,
    poolKey: {
        currency0: Address,
        currency1: Address,
        fee: number,
        tickSpacing: number,
        hooks: Address
    }
): Promise<{ success: boolean; message: string; hash?: Hash }> {
    try {
        // Convert expiration time to Unix timestamp (seconds)
        const expirationTimestamp = BigInt(Math.floor(expirationTime.getTime() / 1000));

        // Convert price threshold to BigInt (ensure it's a string first)
        const priceThreshold = parseEther(String(priceThresholdStr));

        // For price aggregator, you'd typically use a Chainlink price feed address
        // This is just a placeholder - you would need to get the actual address for your asset pair
        const priceAggregator = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as Address; // ETH/USD price feed on mainnet

        console.log('Creating market with params:', {
            name: marketName,
            assetSymbol: priceFeedKey,
            expirationTimestamp: expirationTimestamp.toString(),
            priceAggregator,
            priceThreshold: priceThreshold.toString(),
            poolKey
        });

        // Get the prediction manager contract
        const currentNetworkConfig = getCurrentNetworkConfig();
        const predictionManager = getPredictionManager({
            address: PUBLIC_PREDICTIONMANAGER_ADDRESS,
            chain: currentNetworkConfig.chain,
            transport: http(currentNetworkConfig.rpcUrl)
        });

        // First simulate the transaction to check for errors
        await predictionManager.simulate.createMarket([
            marketName,
            priceFeedKey,
            expirationTimestamp,
            priceAggregator,
            priceThreshold,
            poolKey
        ], {
            chain: currentNetworkConfig.chain,
            account: appKit.getAccount()?.address as Address,
        });

        // Then execute the transaction
        const hash = await predictionManager.write.createMarket([
            marketName,
            priceFeedKey,
            expirationTimestamp,
            priceAggregator,
            priceThreshold,
            poolKey
        ], {
            chain: currentNetworkConfig.chain,
            account: appKit.getAccount()?.address as Address,
        });

        return {
            success: true,
            message: `Market "${marketName}" created successfully!`,
            hash
        };
    } catch (error: any) {
        console.error('Error creating market:', error);
        return {
            success: false,
            message: `Failed to create market: ${error.message || 'Unknown error'}`
        };
    }
}

/**
 * Helper function to get a wallet client connected to the user's wallet
 * Uses the same chain configuration as the publicClient
 */
/**
 * Ensures a Uniswap v4 pool exists for the given market tokens and fee.
 * If the pool does not exist, it will attempt to create it.
 * @param tokenA Address of the first token
 * @param tokenB Address of the second token
 * @param fee Fee tier (100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
 * @returns Object with pool existence, creation status, tx hash, and error if any
 */
export async function getOrCreateMarketPool(
    tokenA: Address,
    tokenB: Address,
    fee: number,
): Promise<{ poolExists: boolean; poolCreated: boolean; hash?: Hash; error?: string; info?: string }> {
    try {
        // Hackathon: always attempt to create the pool, even if it might already exist
        const result = await createPool(tokenA, tokenB, fee);
        if (result.success) {
            return {
                poolExists: false,
                poolCreated: true,
                hash: result.hash,
                error: undefined
            };
        } else if (result.message && result.message.toLowerCase().includes('already exists')) {
            // Pool already exists: report info, but allow market creation
            return {
                poolExists: true,
                poolCreated: false,
                hash: undefined,
                error: undefined,
                info: 'Pool already exists for this market. Proceeding to create the market only.'
            };
        } else {
            // Other error
            return {
                poolExists: false,
                poolCreated: false,
                hash: undefined,
                error: result.message
            };
        }
    } catch (err: any) {
        return {poolExists: false, poolCreated: false, error: err.message};
    }
}

import {type Address, type Chain, type Hash, http, parseEther} from 'viem';
import {createPool} from './poolService';
import {getPredictionManager} from '$generated/types/PredictionManager';
// @ts-ignore
import {PUBLIC_PREDICTIONMANAGER_ADDRESS} from '$env/static/public';
import {appKit} from '$lib/configs/wallet.config';
import {getCurrentNetworkConfig} from "$lib/utils/network";

// Types
type MarketStatus = 'Open' | 'Expired' | 'Resolved';

/**
 * Sort options for markets
 */
export type MarketSortField = 'id' | 'name' | 'assetPair' | 'status' | 'expirationTime' | 'priceThreshold' | 'totalStake';
export type SortDirection = 'asc' | 'desc';

/**
 * Pagination options for markets
 */
export interface MarketPaginationOptions {
    page: number;
    pageSize: number;
    sortField?: MarketSortField;
    sortDirection?: SortDirection;
}

/**
 * Paginated result for markets
 */
export interface PaginatedMarkets {
    markets: Market[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}

export interface Market {
    id: string;
    name: string;
    assetSymbol: string;
    assetPair: string; // Adding assetPair property to match UI usage
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
 * 
 * @param options Optional pagination and sorting options
 */
export async function getAllMarkets(options?: MarketPaginationOptions): Promise<PaginatedMarkets> {
    try {
        // Get the total count of markets
        const count = await getMarketCount();

        if (count === 0) {
            return {
                markets: [],
                totalCount: 0,
                totalPages: 0,
                currentPage: 1
            };
        }

        // Create an array of market IDs from 0 to count-1
        const marketIds = Array.from({length: Number(count)}, (_, i) => BigInt(i));

        // Fetch details for all markets in parallel
        const markets = await Promise.all(marketIds.map((id) => getMarketDetails(id)));

        // Filter out non-existent markets
        let existingMarkets = markets.filter((market) => market.exists);

        // Apply sorting if specified
        if (options?.sortField) {
            existingMarkets = sortMarkets(existingMarkets, options.sortField, options.sortDirection || 'asc');
        } else {
            // Default sort: Open first, then Expired, then Resolved
            existingMarkets = existingMarkets.sort((a, b) => {
                if (a.status === 'Open' && b.status !== 'Open') return -1;
                if (a.status !== 'Open' && b.status === 'Open') return 1;
                if (a.status === 'Expired' && b.status === 'Resolved') return -1;
                if (a.status === 'Resolved' && b.status === 'Expired') return 1;
                return Number(a.id) - Number(b.id);
            });
        }

        // Apply pagination if specified
        if (options?.page && options?.pageSize) {
            const startIndex = (options.page - 1) * options.pageSize;
            const endIndex = startIndex + options.pageSize;
            const paginatedMarkets = existingMarkets.slice(startIndex, endIndex);
            
            return {
                markets: paginatedMarkets,
                totalCount: existingMarkets.length,
                totalPages: Math.ceil(existingMarkets.length / options.pageSize),
                currentPage: options.page
            };
        }

        // Return all markets if no pagination
        return {
            markets: existingMarkets,
            totalCount: existingMarkets.length,
            totalPages: 1,
            currentPage: 1
        };
    } catch (error) {
        console.error('getAllMarkets error:', error);
        return {
            markets: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: 1
        };
    }
}

/**
 * Sort markets by the specified field and direction
 * 
 * @param markets The markets to sort
 * @param sortField The field to sort by
 * @param sortDirection The direction to sort (asc or desc)
 * @returns Sorted array of markets
 */
function sortMarkets(markets: Market[], sortField: MarketSortField, sortDirection: SortDirection): Market[] {
    return [...markets].sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
            case 'id':
                comparison = Number(a.id) - Number(b.id);
                break;
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'assetPair':
                comparison = a.assetPair.localeCompare(b.assetPair);
                break;
            case 'status':
                comparison = a.status.localeCompare(b.status);
                break;
            case 'expirationTime':
                comparison = a.expirationTime - b.expirationTime;
                break;
            case 'priceThreshold':
                comparison = a.priceThreshold - b.priceThreshold;
                break;
            case 'totalStake':
                comparison = parseFloat(a.totalStake) - parseFloat(b.totalStake);
                break;
            default:
                comparison = 0;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });
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
    const { status, expirationDisplay } = getMarketStatus(false, timeRemaining);
    const totalStake = '0';

    return {
        id: id.toString(),
        name: `Market ${id}`,
        assetSymbol: 'Unknown',
        assetPair: 'Unknown',
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
        totalStake
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
        assetPair: details.assetPair, // Set assetPair to match UI usage
        exists: details.exists,
        resolved: details.resolved,
        winningOutcome: details.winningOutcome,
        totalStake0: details.totalConvictionBearish,
        totalStake1: details.totalConvictionBullish,
        expirationTime: Number(details.expirationTimestamp),
        priceAggregator: details.priceOracle,
        priceThreshold: Number(details.priceThreshold) / 1e18, // Convert from wei to ETH
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

// Define interface for MarketCreated event args
export interface MarketCreatedEventArgs {
    marketId: bigint;
    poolKey: {
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address;
    };
    creator: Address;
}

/**
 * Create a new prediction market
 * @param marketName Name/description of the market
 * @param priceFeedKey Key for the price feed (e.g., 'ETH/USD')
 * @param expirationTime Expiration time of the market
 * @param priceThresholdStr Price threshold as a string (will be converted to wei)
 * @param poolKey Pool key object with token addresses, fee, etc.
 * @returns Promise with success status, message, transaction hash if successful, and market ID if created
 */
export async function createMarket(
    marketName: string,
    priceFeedKey: string,
    expirationTime: number,
    priceThresholdStr: string,
    poolKey: {
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address
    }
): Promise<{ success: boolean; message: string; hash?: Hash; marketId?: string }> {
    try {
        // expirationTime is already a Unix timestamp (seconds)
        const expirationTimestamp = BigInt(expirationTime);

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

        // Wait for transaction receipt to get the emitted events
        // Use type assertion to handle the potential missing property
        const publicClient = (appKit as any).getPublicClient ? (appKit as any).getPublicClient() : null;
        
        if (!publicClient) {
            return {
                success: true,
                message: `Market "${marketName}" created successfully, but couldn't get market ID.`,
                hash
            };
        }
        
        try {
            // Wait for transaction receipt
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            
            // Find the MarketCreated event in the logs
            const marketCreatedEvent = receipt.logs.find((log: any) => {
                // Check if this log is from the PredictionManager contract
                return log.address.toLowerCase() === PUBLIC_PREDICTIONMANAGER_ADDRESS.toLowerCase();
            });
            
            if (marketCreatedEvent) {
                // Get the market ID from the event data (first topic after the event signature is the market ID)
                const marketId = marketCreatedEvent.topics[1] ? 
                    BigInt(marketCreatedEvent.topics[1]).toString() : 
                    'unknown';
                    
                return {
                    success: true,
                    message: `Market "${marketName}" created successfully!`,
                    hash,
                    marketId
                };
            }
            
            return {
                success: true,
                message: `Market "${marketName}" created successfully!`,
                hash
            };
        } catch (error) {
            console.error('Error getting market ID from transaction receipt:', error);
            return {
                success: true,
                message: `Market "${marketName}" created successfully, but couldn't get market ID.`,
                hash
            };
        }
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

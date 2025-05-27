/**
 * Subgraph Service
 * 
 * Provides functions to interact with The Graph subgraph for fetching
 * blockchain data such as markets, predictions, and user activities.
 */
import { GraphQLClient, gql } from 'graphql-request';

// Default subgraph URL - should be configured in environment variables for production
const SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/yourusername/swapcast';

// Create a GraphQL client instance
const graphQLClient = new GraphQLClient(SUBGRAPH_URL);

/**
 * Interface for prediction/transaction data from the subgraph
 */
export interface SubgraphPrediction {
  id: string;
  market: {
    id: string;
    description: string;
  };
  user: {
    id: string;
    address: string;
  };
  outcome: number;
  amount: string;
  timestamp: string;
  claimed: boolean;
  reward: string | null;
}

/**
 * Fetches predictions (transactions) for a specific market with pagination support
 * 
 * @param marketId - ID of the market to fetch predictions for
 * @param limit - Maximum number of predictions to fetch (default: 10)
 * @param page - Page number for pagination (default: 1)
 * @returns Promise resolving to an array of predictions
 */
export async function getMarketPredictions(
  marketId: string, 
  limit: number = 10, 
  page: number = 1
): Promise<SubgraphPrediction[]> {
  // Calculate skip value for pagination
  const skip = (page - 1) * limit;
  
  const query = gql`
    query GetMarketPredictions($marketId: ID!, $limit: Int!, $skip: Int!) {
      predictions(
        where: { market: $marketId }
        orderBy: timestamp
        orderDirection: desc
        first: $limit
        skip: $skip
      ) {
        id
        market {
          id
          description
        }
        user {
          id
          address
        }
        outcome
        amount
        timestamp
        claimed
        reward
      }
    }
  `;

  try {
    const variables = {
      marketId,
      limit,
      skip
    };
    
    const result = await graphQLClient.request<{ predictions: SubgraphPrediction[] }>(query, variables);
    return result.predictions;
  } catch (error) {
    console.error(`Error fetching predictions for market ${marketId}:`, error);
    return [];
  }
}

/**
 * Fetches a specific market's details from the subgraph
 * 
 * @param marketId - ID of the market to fetch
 * @returns Promise resolving to the market details
 */
/**
 * Interface for market data from the subgraph
 */
export interface SubgraphMarket {
  id: string;
  marketId: string;
  description: string;
  creationTimestamp: string;
  expirationTimestamp: string;
  isResolved: boolean;
  winningOutcome?: number;
  finalPrice?: string;
  totalStakedOutcome0: string;
  totalStakedOutcome1: string;
  baseToken: string;
  quoteToken: string;
  priceThreshold: string;
}

/**
 * Fetches a specific market's details from the subgraph
 * 
 * @param marketId - ID of the market to fetch
 * @returns Promise resolving to the market details or null if not found
 */
export async function getMarketFromSubgraph(marketId: string): Promise<SubgraphMarket | null> {
  const query = gql`
    query GetMarket($marketId: ID!) {
      market(id: $marketId) {
        id
        marketId
        description
        creationTimestamp
        expirationTimestamp
        isResolved
        winningOutcome
        finalPrice
        totalStakedOutcome0
        totalStakedOutcome1
        baseToken
        quoteToken
        priceThreshold
      }
    }
  `;

  try {
    const result = await graphQLClient.request<{ market: SubgraphMarket | null }>(query, { marketId });
    return result.market;
  } catch (error) {
    console.error(`Error fetching market ${marketId}:`, error);
    return null;
  }
}

/**
 * Formats a prediction outcome as a human-readable string
 * 
 * @param outcome - Numeric outcome (0 = Bearish, 1 = Bullish)
 * @returns String representation of the outcome
 */
export function formatPredictionOutcome(outcome: number): string {
  return outcome === 0 ? 'Bearish' : 'Bullish';
}

/**
 * Formats a timestamp from the subgraph (seconds since epoch) to a readable date string
 * 
 * @param timestamp - Unix timestamp in seconds as a string
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

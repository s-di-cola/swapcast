/**
 * Subgraph GraphQL Client
 * 
 * Configured GraphQL client for The Graph subgraph interactions
 */

import { GraphQLClient } from 'graphql-request';
import type { QueryVariables, GraphQLResponse } from './types';

/**
 * Environment configuration
 */
const CONFIG = {
	// Default subgraph URL - should be overridden in production
	defaultUrl: 'https://api.thegraph.com/subgraphs/name/yourusername/swapcast',
	// Request timeout in milliseconds
	timeout: 10000,
	// Retry configuration
	maxRetries: 3,
	retryDelay: 1000
} as const;

/**
 * Get subgraph URL from environment or use default
 */
function getSubgraphUrl(): string {
	// Try to get from environment variables
	if (typeof process !== 'undefined' && process.env?.VITE_SUBGRAPH_URL) {
		return process.env.VITE_SUBGRAPH_URL;
	}
	
	if (typeof window !== 'undefined' && (window as any).env?.VITE_SUBGRAPH_URL) {
		return (window as any).env.VITE_SUBGRAPH_URL;
	}
	
	return CONFIG.defaultUrl;
}

/**
 * Create GraphQL client instance with configuration
 */
function createGraphQLClient(): GraphQLClient {
	const url = getSubgraphUrl();
	
	return new GraphQLClient(url, {
		timeout: CONFIG.timeout,
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'SwapCast-Frontend/1.0'
		}
	});
}

/**
 * Singleton GraphQL client instance
 */
export const graphQLClient = createGraphQLClient();

/**
 * Execute a GraphQL query with error handling and retries
 * 
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param retryCount - Current retry attempt (internal use)
 * @returns Promise resolving to query result
 */
export async function executeQuery<T>(
	query: string,
	variables?: QueryVariables,
	retryCount: number = 0
): Promise<T | null> {
	try {
		const result = await graphQLClient.request<T>(query, variables);
		return result;
	} catch (error) {
		console.error(`GraphQL query failed (attempt ${retryCount + 1}):`, error);
		
		// Retry logic for transient errors
		if (retryCount < CONFIG.maxRetries && shouldRetry(error)) {
			const delay = CONFIG.retryDelay * Math.pow(2, retryCount); // Exponential backoff
			console.log(`Retrying in ${delay}ms...`);
			
			await new Promise(resolve => setTimeout(resolve, delay));
			return executeQuery<T>(query, variables, retryCount + 1);
		}
		
		// Log final error and return null
		console.error('GraphQL query failed after all retries:', error);
		return null;
	}
}

/**
 * Determine if an error is worth retrying
 * 
 * @param error - Error object from GraphQL request
 * @returns True if the error might be transient
 */
function shouldRetry(error: any): boolean {
	// Retry on network errors or server errors (5xx)
	if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNRESET') {
		return true;
	}
	
	// Retry on HTTP 5xx errors
	if (error.response?.status >= 500) {
		return true;
	}
	
	// Retry on timeout errors
	if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
		return true;
	}
	
	// Don't retry on client errors (4xx) or GraphQL errors
	return false;
}

/**
 * Health check for the subgraph endpoint
 * 
 * @returns Promise resolving to true if subgraph is healthy
 */
export async function checkSubgraphHealth(): Promise<boolean> {
	const healthQuery = `
		query HealthCheck {
			_meta {
				block {
					number
				}
			}
		}
	`;
	
	try {
		const result = await executeQuery<{ _meta: { block: { number: number } } }>(healthQuery);
		return result !== null && result._meta?.block?.number > 0;
	} catch {
		return false;
	}
}

/**
 * Get subgraph metadata information
 * 
 * @returns Promise resolving to subgraph metadata
 */
export async function getSubgraphMeta(): Promise<{
	blockNumber: number;
	blockHash: string;
} | null> {
	const metaQuery = `
		query GetMeta {
			_meta {
				block {
					number
					hash
				}
			}
		}
	`;
	
	try {
		const result = await executeQuery<{
			_meta: {
				block: {
					number: number;
					hash: string;
				}
			}
		}>(metaQuery);
		
		if (result?._meta?.block) {
			return {
				blockNumber: result._meta.block.number,
				blockHash: result._meta.block.hash
			};
		}
		
		return null;
	} catch (error) {
		console.error('Failed to get subgraph metadata:', error);
		return null;
	}
}
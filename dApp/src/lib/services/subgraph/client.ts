/**
 * Subgraph GraphQL Client
 *
 * Configured GraphQL client for The Graph subgraph interactions
 */

import { GraphQLClient } from 'graphql-request';
import type { QueryVariables } from './types';

/**
 * Environment configuration
 */
const CONFIG = {
	// Default to local subgraph endpoint for development
	defaultUrl: 'http://localhost:8000/subgraphs/name/swapcast-subgraph',
	// Request timeout in milliseconds
	timeout: 10000,
	// Retry configuration
	maxRetries: 3,
	retryDelay: 1000
} as const;

/**
 * Get subgraph URL and auth token from environment
 */
const SUBGRAPH_URL = process.env.PUBLIC_SUBGRAPH_URL || CONFIG.defaultUrl;
const SUBGRAPH_AUTH_TOKEN = process.env.SUBGRAPH_AUTH_TOKEN;

/**
 * Create GraphQL client instance
 */
function createGraphQLClient(authToken?: string): GraphQLClient {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'User-Agent': 'SwapCast-Frontend/1.0'
	};

	if (authToken) {
		headers.authorization = `Bearer ${authToken}`;
	}

	return new GraphQLClient(SUBGRAPH_URL, { headers });
}

/**
 * Default client (no auth)
 */
export const graphQLClient = createGraphQLClient();

/**
 * Execute a GraphQL query with error handling and retries
 */
export async function executeQuery<T>(
	query: string,
	variables?: QueryVariables,
	retryCount: number = 0,
	authToken?: string
): Promise<T | null> {
	try {
		const client = authToken ? createGraphQLClient(authToken) : graphQLClient;
		const result = await client.request<T>(query, variables);
		return result;
	} catch (error) {
		console.error(`GraphQL query failed (attempt ${retryCount + 1}):`, error);

		// Retry logic for transient errors
		if (retryCount < CONFIG.maxRetries && shouldRetry(error)) {
			const delay = CONFIG.retryDelay * Math.pow(2, retryCount);

			await new Promise((resolve) => setTimeout(resolve, delay));
			return executeQuery<T>(query, variables, retryCount + 1, authToken);
		}

		console.error('GraphQL query failed after all retries:', error);
		return null;
	}
}

/**
 * Execute authenticated query (server-side only)
 */
export function executeAuthQuery<T>(
	query: string,
	variables?: QueryVariables
): Promise<T | null> {
	return executeQuery<T>(query, variables, 0, SUBGRAPH_AUTH_TOKEN);
}

/**
 * Determine if an error is worth retrying
 */
function shouldRetry(error: any): boolean {
	if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNRESET') {
		return true;
	}

	if (error.response?.status >= 500) {
		return true;
	}

	if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
		return true;
	}

	return false;
}

/**
 * Health check for the subgraph endpoint
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
		// Use auth if available (server-side), otherwise regular query
		const result = SUBGRAPH_AUTH_TOKEN
			? await executeAuthQuery<{ _meta: { block: { number: number } } }>(healthQuery)
			: await executeQuery<{ _meta: { block: { number: number } } }>(healthQuery);

		return result !== null && result._meta?.block?.number > 0;
	} catch {
		return false;
	}
}

/**
 * Get subgraph metadata information
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
		// Use auth if available (server-side), otherwise regular query
		const result = SUBGRAPH_AUTH_TOKEN
			? await executeAuthQuery<{
				_meta: {
					block: {
						number: number;
						hash: string;
					};
				};
			}>(metaQuery)
			: await executeQuery<{
				_meta: {
					block: {
						number: number;
						hash: string;
					};
				};
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

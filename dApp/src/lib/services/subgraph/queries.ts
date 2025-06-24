/**
 * GraphQL Queries for Subgraph
 *
 * Centralized GraphQL query definitions for The Graph subgraph
 */

import { gql } from 'graphql-request';

/**
 * Query to fetch predictions for a specific market
 */
export const GET_MARKET_PREDICTIONS = gql`
	query GetMarketPredictions($marketId: ID!, $limit: Int!, $skip: Int!) {
		predictions(
			where: { market: $marketId }
			orderBy: timestamp
			orderDirection: desc
			first: $limit
			skip: $skip
		) {
			id
			tokenId
			market {
				id
				name
				description: name
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

/**
 * Query to fetch a specific market's details
 */
export const GET_MARKET_DETAILS = gql`
	query GetMarket($marketId: ID!) {
		market(id: $marketId) {
			id
			marketId
			name
			assetSymbol
			description: name
			creationTimestamp
			expirationTimestamp
			priceAggregator
			priceThreshold
			isResolved
			winningOutcome
			finalPrice
			totalStakedOutcome0
			totalStakedOutcome1
		}
	}
`;

/**
 * Query to fetch user's prediction history
 */
export const GET_USER_PREDICTIONS = gql`
	query GetUserPredictions($userAddress: String!, $limit: Int!, $skip: Int!) {
		predictions(
			where: { user: $userAddress }
			orderBy: timestamp
			orderDirection: desc
			first: $limit
			skip: $skip
		) {
			id
			tokenId
			market {
				id
				name
				description: name
				isResolved
				winningOutcome
			}
			outcome
			amount
			timestamp
			claimed
			reward
		}
	}
`;

/**
 * Query to fetch market statistics
 */
export const GET_MARKET_STATS = gql`
	query GetMarketStats($marketId: ID!) {
		market(id: $marketId) {
			id
			totalStakedOutcome0
			totalStakedOutcome1
			predictions(first: 1000) {
				id
				tokenId
				user {
					id
				}
				amount
			}
		}
	}
`;

/**
 * Query to fetch recent predictions across all markets
 */
export const GET_RECENT_PREDICTIONS = gql`
	query GetRecentPredictions($limit: Int!, $skip: Int!) {
		predictions(orderBy: timestamp, orderDirection: desc, first: $limit, skip: $skip) {
			id
			tokenId
			market {
				id
				name
				description: name
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

/**
 * Query to fetch all markets with basic info
 */
export const GET_ALL_MARKETS = gql`
	query GetAllMarkets($limit: Int!, $skip: Int!) {
		markets(orderBy: creationTimestamp, orderDirection: desc, first: $limit, skip: $skip) {
			id
			marketId
			name
			assetSymbol
			description: name
			creationTimestamp
			expirationTimestamp
			priceAggregator
			priceThreshold
			isResolved
			winningOutcome
			totalStakedOutcome0
			totalStakedOutcome1
		}
	}
`;

/**
 * Query to search markets by name/description
 */
export const SEARCH_MARKETS = gql`
	query SearchMarkets($searchTerm: String!, $limit: Int!) {
		markets(
			where: { name_contains_nocase: $searchTerm }
			orderBy: creationTimestamp
			orderDirection: desc
			first: $limit
		) {
			id
			marketId
			name
			assetSymbol
			description: name
			creationTimestamp
			expirationTimestamp
			isResolved
			totalStakedOutcome0
			totalStakedOutcome1
		}
	}
`;

/**
 * Query to fetch global platform statistics
 */
export const GET_GLOBAL_STATS = gql`
	query GetGlobalStats {
		globalStat(id: "global") {
			id
			totalMarkets
			totalPredictions
			totalStaked
			totalUsers
			totalClaimed
			totalProtocolFees
		}
	}
`;

/**
 * Query to fetch analytics data for the dashboard chart
 */
export const GET_ANALYTICS_DATA = gql`
	query GetAnalyticsData($startTimestamp: String!, $endTimestamp: String!) {
		# Get markets created within the time range
		markets(
			where: { creationTimestamp_gte: $startTimestamp, creationTimestamp_lte: $endTimestamp }
			orderBy: creationTimestamp
			orderDirection: asc
		) {
			id
			marketId
			name
			description: name
			creationTimestamp
			isResolved
			totalStakedOutcome0
			totalStakedOutcome1
		}

		# Get predictions made within the time range
		predictions(
			where: { timestamp_gte: $startTimestamp, timestamp_lte: $endTimestamp }
			orderBy: timestamp
			orderDirection: asc
			first: 1000 # Increased limit to ensure we get all predictions
		) {
			id
			tokenId
			timestamp
			outcome
			amount
			market {
				id
				name
				description: name
			}
		}

		# Get global stats
		globalStats(first: 1) {
			totalMarkets
			totalPredictions
			totalStaked
		}
	}
`;

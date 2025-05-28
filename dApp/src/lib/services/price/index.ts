/**
 * CoinGecko Price Service
 * 
 * This module provides functionality for fetching cryptocurrency price data from CoinGecko.
 * It implements caching and rate limiting to stay within the free tier limits.
 * 
 * For production, it's recommended to use CoinGecko Pro with an API key.
 */

// Public API
export {
  getHistoricalPriceData,
  searchCoins,
  fetchCoinList,
  getCoinIdFromAssetPair,
  formatPriceDataForChart
} from './operations';

// Type exports
export type {
  PriceData,
  CoinInfo,
  ChartData,
  VsCurrency,
  TimePeriod
} from './types';

// Utility exports
export {
  checkApiHealth,
  getApiStatus
} from './client';

// Configuration exports
export {
  CACHE_CONFIG,
  COINGECKO_CONFIG
} from './config';

// Cache utilities
export {
  clearAllCache,
  getCacheStats,
  getCacheHitRatio
} from './cache';

// Rate limit utilities
export {
  getRateLimitStatus,
  isRateLimited
} from './rateLimit';

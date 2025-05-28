/**
 * CoinGecko Cache System
 * 
 * In-memory caching system with TTL and size limits for CoinGecko API responses
 */

import type { CacheEntry } from './types';
import { CACHE_CONFIG } from './config';

/**
 * In-memory cache storage
 */
const cache = new Map<string, CacheEntry>();

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
	hits: number;
	misses: number;
	size: number;
	maxSize: number;
}

let cacheStats: CacheStats = {
	hits: 0,
	misses: 0,
	size: 0,
	maxSize: CACHE_CONFIG.MAX_SIZE
};

/**
 * Generates a cache key from parameters
 * 
 * @param prefix - Cache key prefix (e.g., 'historical', 'search')
 * @param params - Parameters to include in the key
 * @returns Standardized cache key
 */
export function generateCacheKey(prefix: string, ...params: (string | number)[]): string {
	return `${prefix}_${params.join('_')}`.toLowerCase();
}

/**
 * Checks if a cache entry is still valid
 * 
 * @param entry - Cache entry to check
 * @param ttl - Time-to-live in milliseconds (optional, uses default)
 * @returns True if entry is valid, false if expired
 */
function isValidCacheEntry(entry: CacheEntry, ttl?: number): boolean {
	const actualTtl = ttl || CACHE_CONFIG.TTL;
	return (Date.now() - entry.timestamp) < actualTtl;
}

/**
 * Removes expired entries from cache
 */
function cleanupExpiredEntries(): void {
	const now = Date.now();
	const toDelete: string[] = [];
	
	for (const [key, entry] of cache.entries()) {
		if ((now - entry.timestamp) >= CACHE_CONFIG.TTL) {
			toDelete.push(key);
		}
	}
	
	toDelete.forEach(key => cache.delete(key));
	cacheStats.size = cache.size;
}

/**
 * Implements LRU eviction when cache is full
 */
function evictIfNecessary(): void {
	if (cache.size >= CACHE_CONFIG.MAX_SIZE) {
		// Remove oldest entry (first in Map iteration order)
		const firstKey = cache.keys().next().value;
		if (firstKey) {
			cache.delete(firstKey);
			cacheStats.size = cache.size;
		}
	}
}

/**
 * Gets data from cache if available and valid
 * 
 * @param cacheKey - Unique identifier for the cached data
 * @param ttl - Custom TTL in milliseconds (optional)
 * @returns Cached data if valid, undefined otherwise
 */
export function getFromCache<T>(cacheKey: string, ttl?: number): T | undefined {
	const entry = cache.get(cacheKey);
	
	if (!entry) {
		cacheStats.misses++;
		return undefined;
	}
	
	if (!isValidCacheEntry(entry, ttl)) {
		cache.delete(cacheKey);
		cacheStats.misses++;
		cacheStats.size = cache.size;
		return undefined;
	}
	
	// Move to end (LRU)
	cache.delete(cacheKey);
	cache.set(cacheKey, entry);
	
	cacheStats.hits++;
	return entry.data as T;
}

/**
 * Stores data in cache with timestamp
 * 
 * @param cacheKey - Unique identifier for the data
 * @param data - Data to cache
 */
export function setCache<T>(cacheKey: string, data: T): void {
	// Clean up expired entries periodically
	if (Math.random() < 0.1) { // 10% chance on each set
		cleanupExpiredEntries();
	}
	
	// Evict if necessary
	evictIfNecessary();
	
	const entry: CacheEntry<T> = {
		timestamp: Date.now(),
		data
	};
	
	cache.set(cacheKey, entry);
	cacheStats.size = cache.size;
}

/**
 * Gets data from cache or fetches fresh data using provided function
 * 
 * @param cacheKey - Unique identifier for the cached data
 * @param fetchFn - Function to call when cache miss or expired
 * @param ttl - Custom TTL in milliseconds (optional)
 * @returns Promise resolving to either cached or freshly fetched data
 */
export async function getCachedOrFetch<T>(
	cacheKey: string, 
	fetchFn: () => Promise<T>,
	ttl?: number
): Promise<T> {
	// Try to get from cache first
	const cachedData = getFromCache<T>(cacheKey, ttl);
	if (cachedData !== undefined) {
		return cachedData;
	}
	
	// Fetch fresh data
	const data = await fetchFn();
	
	// Cache the result
	setCache(cacheKey, data);
	
	return data;
}

/**
 * Clears specific cache entries by prefix
 * 
 * @param prefix - Cache key prefix to clear
 */
export function clearCacheByPrefix(prefix: string): void {
	const toDelete: string[] = [];
	
	for (const key of cache.keys()) {
		if (key.startsWith(prefix)) {
			toDelete.push(key);
		}
	}
	
	toDelete.forEach(key => cache.delete(key));
	cacheStats.size = cache.size;
}

/**
 * Clears all cache entries
 */
export function clearAllCache(): void {
	cache.clear();
	cacheStats.size = 0;
	cacheStats.hits = 0;
	cacheStats.misses = 0;
}

/**
 * Gets current cache statistics
 * 
 * @returns Cache statistics object
 */
export function getCacheStats(): CacheStats {
	return { ...cacheStats };
}

/**
 * Gets cache hit ratio as percentage
 * 
 * @returns Hit ratio (0-100)
 */
export function getCacheHitRatio(): number {
	const total = cacheStats.hits + cacheStats.misses;
	return total === 0 ? 0 : (cacheStats.hits / total) * 100;
}
/**
 * Optimized LRU caching implementation for route handlers
 * Uses Map to maintain insertion order for efficient LRU eviction
 */
import type { Handler } from "./types.ts";

/**
 * Cache entry containing handler, params and usage statistics
 */
interface CacheEntry {
  handler: Handler;
  params: Record<string, string>;
  hits: number;
  lastUsed: number;
}

/**
 * Pre-allocated empty params object to avoid GC pressure
 */
const EMPTY_PARAMS = Object.freeze({});

/**
 * Creates an optimized LRU cache with efficient eviction strategy
 * @param maxSize Maximum number of entries to store in cache
 */
export const createOptimizedCache = (maxSize = 1000) => {
  // Use Map to maintain insertion order for simple LRU implementation
  const cache = new Map<string, CacheEntry>();
  let hits = 0;
  let misses = 0;

  return {
    /**
     * Get an entry from the cache
     * Moves the entry to the end of the Map to maintain LRU order
     */
    get: (key: string): CacheEntry | undefined => {
      const entry = cache.get(key);
      if (entry) {
        // Update access stats
        entry.hits++;
        entry.lastUsed = Date.now();
        hits++;
        
        // Move to end of Map to maintain LRU order (most recently used at the end)
        cache.delete(key);
        cache.set(key, entry);
        
        return entry;
      }
      misses++;
      return undefined;
    },
    
    /**
     * Set an entry in the cache
     * Evicts oldest entry if cache is at capacity
     */
    set: (key: string, handler: Handler, params: Record<string, string>): void => {
      // Evict oldest entry if at capacity
      if (cache.size >= maxSize) {
        // With Map, the first entry is the oldest in insertion order
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      
      cache.set(key, {
        handler,
        params: params || EMPTY_PARAMS,
        hits: 1,
        lastUsed: Date.now(),
      });
    },
    
    /**
     * Clear all entries from the cache
     */
    clear: (): void => {
      cache.clear();
      hits = 0;
      misses = 0;
    },
    
    /**
     * Get cache statistics
     */
    getStats: () => ({
      size: cache.size,
      hits,
      misses,
      hitRate: hits / (hits + misses || 1), // Avoid division by zero
    }),
  };
};

// Global cache instance
export const optimizedCache = createOptimizedCache();

/**
 * Get an entry from the global cache
 */
export const getCached = (key: string): CacheEntry | undefined => optimizedCache.get(key);

/**
 * Set an entry in the global cache
 */
export const setCached = (key: string, handler: Handler, params: Record<string, string>): void =>
  optimizedCache.set(key, handler, params);

/**
 * Clear the global cache
 */
export const clearCache = (): void => optimizedCache.clear();

/**
 * Get statistics for the global cache
 */
export const getCacheStats = () => optimizedCache.getStats();

/**
 * @deprecated Use the functional API instead
 */
export class OptimizedCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 1000) {
    console.warn('OptimizedCache class is deprecated. Use createOptimizedCache() instead.');
    this.maxSize = maxSize;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.hits++;
      entry.lastUsed = Date.now();
      this.hits++;
      
      // Move to end of Map to maintain LRU order
      this.cache.delete(key);
      this.cache.set(key, entry);
      
      return entry;
    }

    this.misses++;
    return undefined;
  }

  set(key: string, handler: Handler, params: Record<string, string>): void {
    if (this.cache.size >= this.maxSize) {
      // With Map, the first entry is the oldest in insertion order
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      handler,
      params: params || EMPTY_PARAMS,
      hits: 1,
      lastUsed: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses || 1),
    };
  }
}

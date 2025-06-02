// Optimized caching with pre-allocated arrays and better eviction
// Refactored to use functional programming patterns
import type { Handler } from "./types.ts";

interface CacheEntry {
	handler: Handler;
	params: Record<string, string>;
	hits: number;
	lastUsed: number;
}

interface CacheState {
	readonly cache: Map<string, CacheEntry>;
	readonly maxSize: number;
	hits: number;
	misses: number;
}

/**
 * Create cache state
 */
const createCacheState = (maxSize = 1000): CacheState => ({
	cache: new Map<string, CacheEntry>(),
	maxSize,
	hits: 0,
	misses: 0,
});

/**
 * Get entry from cache
 */
const cacheGet = (state: CacheState, key: string): CacheEntry | undefined => {
	const entry = state.cache.get(key);
	if (entry) {
		entry.hits++;
		entry.lastUsed = Date.now();
		state.hits++;
		return entry;
	}

	state.misses++;
	return undefined;
};

/**
 * Evict least recently used entry
 */
const evictLeastRecentlyUsed = (state: CacheState): void => {
	let oldestKey = "";
	let oldestTime = Date.now();

	for (const [key, entry] of state.cache) {
		if (entry.lastUsed < oldestTime) {
			oldestTime = entry.lastUsed;
			oldestKey = key;
		}
	}

	if (oldestKey) {
		state.cache.delete(oldestKey);
	}
};

/**
 * Set entry in cache
 */
const cacheSet = (
	state: CacheState,
	key: string,
	handler: Handler,
	params: Record<string, string>,
): void => {
	if (state.cache.size >= state.maxSize) {
		evictLeastRecentlyUsed(state);
	}

	state.cache.set(key, {
		handler,
		params,
		hits: 1,
		lastUsed: Date.now(),
	});
};

/**
 * Clear cache
 */
const cacheClear = (state: CacheState): void => {
	state.cache.clear();
	state.hits = 0;
	state.misses = 0;
};

/**
 * Get cache statistics
 */
const getStateStats = (state: CacheState) => ({
	size: state.cache.size,
	hits: state.hits,
	misses: state.misses,
	hitRate: state.hits / (state.hits + state.misses),
});

/**
 * Create optimized cache
 */
export const createOptimizedCache = (maxSize = 1000) => {
	const state = createCacheState(maxSize);

	return {
		get: (key: string) => cacheGet(state, key),
		set: (key: string, handler: Handler, params: Record<string, string>) =>
			cacheSet(state, key, handler, params),
		clear: () => cacheClear(state),
		getStats: () => getStateStats(state),
	};
};

// Pre-allocated objects to avoid GC pressure
const EMPTY_PARAMS = Object.freeze({});

// Global cache instance
export const optimizedCache = createOptimizedCache();

export const getCached = (key: string): CacheEntry | undefined =>
	optimizedCache.get(key);

export const setCached = (
	key: string,
	handler: Handler,
	params: Record<string, string>,
): void => optimizedCache.set(key, handler, params || EMPTY_PARAMS);

export const clearCache = (): void => optimizedCache.clear();

export const getCacheStats = () => optimizedCache.getStats();

// Legacy class export for backward compatibility
class OptimizedCache {
	private cache = new Map<string, CacheEntry>();
	private readonly maxSize: number;
	private hits = 0;
	private misses = 0;

	constructor(maxSize = 1000) {
		this.maxSize = maxSize;
	}

	get(key: string): CacheEntry | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			entry.hits++;
			entry.lastUsed = Date.now();
			this.hits++;
			return entry;
		}

		this.misses++;
		return undefined;
	}

	set(key: string, handler: Handler, params: Record<string, string>): void {
		if (this.cache.size >= this.maxSize) {
			this.evictLeastRecentlyUsed();
		}

		this.cache.set(key, {
			handler,
			params,
			hits: 1,
			lastUsed: Date.now(),
		});
	}

	private evictLeastRecentlyUsed(): void {
		let oldestKey = "";
		let oldestTime = Date.now();

		for (const [key, entry] of this.cache) {
			if (entry.lastUsed < oldestTime) {
				oldestTime = entry.lastUsed;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
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
			hitRate: this.hits / (this.hits + this.misses),
		};
	}
}

export { OptimizedCache };

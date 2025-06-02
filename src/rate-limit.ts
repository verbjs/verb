import type { Middleware } from "./types.ts";
import { error } from "./response.ts";

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
	/** Maximum number of requests per window */
	max?: number;
	/** Time window in milliseconds */
	windowMs?: number;
	/** Rate limiting strategy */
	strategy?: "sliding-window" | "fixed-window" | "token-bucket";
	/** Key generator function for identifying clients */
	keyGenerator?: (req: Request) => string;
	/** Skip function to bypass rate limiting for certain requests */
	skip?: (req: Request) => boolean;
	/** Custom error message */
	message?: string;
	/** Status code to return when rate limited */
	statusCode?: number;
	/** Headers to include in rate limit responses */
	headers?: boolean;
	/** Store implementation */
	store?: RateLimitStore;
	/** Handler for when rate limit is exceeded */
	onLimitReached?: (req: Request, info: RateLimitInfo) => void;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
	/** Total hits for this identifier */
	totalHits: number;
	/** Time until reset (in milliseconds) */
	resetTime: number;
	/** Remaining requests in current window */
	remaining: number;
	/** Current window start time */
	windowStart: number;
}

/**
 * Rate limit store interface
 */
export interface RateLimitStore {
	/** Get current hits for a key */
	get(key: string): Promise<RateLimitInfo | null>;
	/** Increment hits for a key */
	increment(key: string, windowMs: number): Promise<RateLimitInfo>;
	/** Reset hits for a key */
	reset(key: string): Promise<void>;
	/** Clean up expired entries */
	cleanup?(): Promise<void>;
}

/**
 * Memory store state
 */
interface MemoryStoreState {
	readonly store: Map<string, RateLimitInfo>;
	readonly cleanupInterval?: Timer;
}

/**
 * Create memory store state
 */
const createMemoryStoreState = (
	cleanupIntervalMs = 60000,
): MemoryStoreState => {
	const store = new Map<string, RateLimitInfo>();

	const cleanupInterval = setInterval(() => {
		memoryStoreCleanup(store);
	}, cleanupIntervalMs);

	return { store, cleanupInterval };
};

/**
 * Memory store cleanup function
 */
const memoryStoreCleanup = (store: Map<string, RateLimitInfo>): void => {
	const now = Date.now();
	for (const [key, info] of store.entries()) {
		if (now >= info.resetTime) {
			store.delete(key);
		}
	}
};

/**
 * Memory store get function
 */
const memoryStoreGet = (
	state: MemoryStoreState,
	key: string,
): Promise<RateLimitInfo | null> => {
	return Promise.resolve(state.store.get(key) || null);
};

/**
 * Memory store increment function
 */
const memoryStoreIncrement = (
	state: MemoryStoreState,
	key: string,
	windowMs: number,
): Promise<RateLimitInfo> => {
	const now = Date.now();
	const existing = state.store.get(key);

	if (!existing) {
		const info: RateLimitInfo = {
			totalHits: 1,
			resetTime: now + windowMs,
			remaining: 0, // Will be calculated by caller
			windowStart: now,
		};
		state.store.set(key, info);
		return Promise.resolve(info);
	}

	// Check if window has expired
	if (now >= existing.resetTime) {
		const info: RateLimitInfo = {
			totalHits: 1,
			resetTime: now + windowMs,
			remaining: 0,
			windowStart: now,
		};
		state.store.set(key, info);
		return Promise.resolve(info);
	}

	// Increment within current window
	existing.totalHits++;
	return Promise.resolve(existing);
};

/**
 * Memory store reset function
 */
const memoryStoreReset = (
	state: MemoryStoreState,
	key: string,
): Promise<void> => {
	state.store.delete(key);
	return Promise.resolve();
};

/**
 * Create memory store
 */
export const createMemoryStore = (
	cleanupIntervalMs = 60000,
): RateLimitStore => {
	const state = createMemoryStoreState(cleanupIntervalMs);

	return {
		get: (key: string) => memoryStoreGet(state, key),
		increment: (key: string, windowMs: number) =>
			memoryStoreIncrement(state, key, windowMs),
		reset: (key: string) => memoryStoreReset(state, key),
		cleanup: () => {
			memoryStoreCleanup(state.store);
			return Promise.resolve();
		},
	};
};

/**
 * Sliding window store state
 */
interface SlidingWindowStoreState {
	readonly windows: Map<string, number[]>;
	readonly cleanupInterval?: Timer;
}

/**
 * Create sliding window store state
 */
const createSlidingWindowStoreState = (
	cleanupIntervalMs = 60000,
): SlidingWindowStoreState => {
	const windows = new Map<string, number[]>();

	const cleanupInterval = setInterval(() => {
		slidingWindowStoreCleanup(windows);
	}, cleanupIntervalMs);

	return { windows, cleanupInterval };
};

/**
 * Sliding window store cleanup function
 */
const slidingWindowStoreCleanup = (windows: Map<string, number[]>): void => {
	const now = Date.now();
	const maxAge = 24 * 60 * 60 * 1000; // 24 hours

	for (const [key, timestamps] of windows.entries()) {
		const filtered = timestamps.filter((timestamp) => now - timestamp < maxAge);
		if (filtered.length === 0) {
			windows.delete(key);
		} else {
			windows.set(key, filtered);
		}
	}
};

/**
 * Sliding window store get function
 */
const slidingWindowStoreGet = (
	state: SlidingWindowStoreState,
	key: string,
): Promise<RateLimitInfo | null> => {
	const timestamps = state.windows.get(key);
	if (!timestamps || timestamps.length === 0) return Promise.resolve(null);

	const now = Date.now();
	const oldestTimestamp = Math.min(...timestamps);

	return Promise.resolve({
		totalHits: timestamps.length,
		resetTime: oldestTimestamp + 24 * 60 * 60 * 1000, // Approximate
		remaining: 0,
		windowStart: oldestTimestamp,
	});
};

/**
 * Sliding window store increment function
 */
const slidingWindowStoreIncrement = (
	state: SlidingWindowStoreState,
	key: string,
	windowMs: number,
): Promise<RateLimitInfo> => {
	const now = Date.now();
	const windowStart = now - windowMs;

	let timestamps = state.windows.get(key) || [];

	// Remove timestamps outside current window
	timestamps = timestamps.filter((timestamp) => timestamp > windowStart);

	// Add current timestamp
	timestamps.push(now);

	state.windows.set(key, timestamps);

	return Promise.resolve({
		totalHits: timestamps.length,
		resetTime: Math.min(...timestamps) + windowMs,
		remaining: 0, // Will be calculated by caller
		windowStart: Math.min(...timestamps),
	});
};

/**
 * Sliding window store reset function
 */
const slidingWindowStoreReset = (
	state: SlidingWindowStoreState,
	key: string,
): Promise<void> => {
	state.windows.delete(key);
	return Promise.resolve();
};

/**
 * Create sliding window store
 */
export const createSlidingWindowStore = (
	cleanupIntervalMs = 60000,
): RateLimitStore => {
	const state = createSlidingWindowStoreState(cleanupIntervalMs);

	return {
		get: (key: string) => slidingWindowStoreGet(state, key),
		increment: (key: string, windowMs: number) =>
			slidingWindowStoreIncrement(state, key, windowMs),
		reset: (key: string) => slidingWindowStoreReset(state, key),
		cleanup: () => {
			slidingWindowStoreCleanup(state.windows);
			return Promise.resolve();
		},
	};
};

/**
 * Token bucket store state
 */
interface TokenBucketStoreState {
	readonly buckets: Map<string, { tokens: number; lastRefill: number }>;
	readonly bucketSize: number;
	readonly refillRate: number;
	readonly cleanupInterval?: Timer;
}

/**
 * Create token bucket store state
 */
const createTokenBucketStoreState = (
	bucketSize = 10,
	refillRate = 1, // tokens per second
	cleanupIntervalMs = 60000,
): TokenBucketStoreState => {
	const buckets = new Map<string, { tokens: number; lastRefill: number }>();

	const cleanupInterval = setInterval(() => {
		tokenBucketStoreCleanup(buckets);
	}, cleanupIntervalMs);

	return { buckets, bucketSize, refillRate, cleanupInterval };
};

/**
 * Token bucket store cleanup function
 */
const tokenBucketStoreCleanup = (
	buckets: Map<string, { tokens: number; lastRefill: number }>,
): void => {
	const now = Date.now();
	const maxAge = 24 * 60 * 60 * 1000; // 24 hours

	for (const [key, bucket] of buckets.entries()) {
		if (now - bucket.lastRefill > maxAge) {
			buckets.delete(key);
		}
	}
};

/**
 * Token bucket store get function
 */
const tokenBucketStoreGet = (
	state: TokenBucketStoreState,
	key: string,
): Promise<RateLimitInfo | null> => {
	const bucket = state.buckets.get(key);
	if (!bucket) return Promise.resolve(null);

	return Promise.resolve({
		totalHits: state.bucketSize - bucket.tokens,
		resetTime:
			Date.now() +
			((state.bucketSize - bucket.tokens) / state.refillRate) * 1000,
		remaining: bucket.tokens,
		windowStart: bucket.lastRefill,
	});
};

/**
 * Token bucket store increment function
 */
const tokenBucketStoreIncrement = (
	state: TokenBucketStoreState,
	key: string,
	windowMs: number,
): Promise<RateLimitInfo> => {
	const now = Date.now();
	let bucket = state.buckets.get(key);

	if (!bucket) {
		bucket = {
			tokens: state.bucketSize - 1, // Consume one token
			lastRefill: now,
		};
		state.buckets.set(key, bucket);
	} else {
		// Refill tokens based on time elapsed
		const elapsed = (now - bucket.lastRefill) / 1000; // seconds
		const tokensToAdd = Math.floor(elapsed * state.refillRate);

		if (tokensToAdd > 0) {
			bucket.tokens = Math.min(state.bucketSize, bucket.tokens + tokensToAdd);
			bucket.lastRefill = now;
		}

		// Try to consume a token
		if (bucket.tokens > 0) {
			bucket.tokens--;
		}
	}

	return Promise.resolve({
		totalHits: state.bucketSize - bucket.tokens,
		resetTime:
			now + ((state.bucketSize - bucket.tokens) / state.refillRate) * 1000,
		remaining: bucket.tokens,
		windowStart: bucket.lastRefill,
	});
};

/**
 * Token bucket store reset function
 */
const tokenBucketStoreReset = (
	state: TokenBucketStoreState,
	key: string,
): Promise<void> => {
	state.buckets.delete(key);
	return Promise.resolve();
};

/**
 * Create token bucket store
 */
export const createTokenBucketStore = (
	bucketSize = 10,
	refillRate = 1, // tokens per second
	cleanupIntervalMs = 60000,
): RateLimitStore => {
	const state = createTokenBucketStoreState(
		bucketSize,
		refillRate,
		cleanupIntervalMs,
	);

	return {
		get: (key: string) => tokenBucketStoreGet(state, key),
		increment: (key: string, windowMs: number) =>
			tokenBucketStoreIncrement(state, key, windowMs),
		reset: (key: string) => tokenBucketStoreReset(state, key),
		cleanup: () => {
			tokenBucketStoreCleanup(state.buckets);
			return Promise.resolve();
		},
	};
};

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
	// Try various headers for real IP
	const forwarded = req.headers.get("x-forwarded-for");
	const realIp = req.headers.get("x-real-ip");
	const cfConnectingIp = req.headers.get("cf-connecting-ip");

	if (cfConnectingIp) return cfConnectingIp;
	if (realIp) return realIp;
	if (forwarded) return forwarded.split(",")[0].trim();

	// Fallback to a default identifier
	return "unknown";
}

/**
 * Creates rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
	const config = {
		max: 100,
		windowMs: 15 * 60 * 1000, // 15 minutes
		strategy: "sliding-window" as const,
		keyGenerator: defaultKeyGenerator,
		skip: () => false,
		message: "Too many requests, please try again later",
		statusCode: 429,
		headers: true,
		...options,
	};

	// Create store based on strategy
	let store: RateLimitStore;
	if (config.store) {
		store = config.store;
	} else {
		switch (config.strategy) {
			case "sliding-window":
				store = createSlidingWindowStore();
				break;
			case "token-bucket":
				store = createTokenBucketStore(
					config.max,
					config.max / (config.windowMs / 1000),
				);
				break;
			case "fixed-window":
			default:
				store = createMemoryStore();
				break;
		}
	}

	return async (req: Request, next) => {
		// Skip rate limiting if specified
		if (config.skip(req)) {
			return next();
		}

		const key = config.keyGenerator(req);
		const info = await store.increment(key, config.windowMs);

		// Calculate remaining requests
		info.remaining = Math.max(0, config.max - info.totalHits);

		// Check if rate limit exceeded
		if (info.totalHits > config.max) {
			// Call onLimitReached handler if provided
			if (config.onLimitReached) {
				config.onLimitReached(req, info);
			}

			// Prepare rate limit headers
			const headers: Record<string, string> = {};
			if (config.headers) {
				headers["X-RateLimit-Limit"] = config.max.toString();
				headers["X-RateLimit-Remaining"] = "0";
				headers["X-RateLimit-Reset"] = Math.ceil(
					info.resetTime / 1000,
				).toString();
				headers["X-RateLimit-RetryAfter"] = Math.ceil(
					(info.resetTime - Date.now()) / 1000,
				).toString();
			}

			return new Response(JSON.stringify({ error: config.message }), {
				status: config.statusCode,
				headers: {
					"Content-Type": "application/json",
					...headers,
				},
			});
		}

		// Continue to next middleware/handler
		const response = await next();

		// Add rate limit headers to successful responses
		if (config.headers) {
			const headers = new Headers(response.headers);
			headers.set("X-RateLimit-Limit", config.max.toString());
			headers.set("X-RateLimit-Remaining", info.remaining.toString());
			headers.set(
				"X-RateLimit-Reset",
				Math.ceil(info.resetTime / 1000).toString(),
			);

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		}

		return response;
	};
}

/**
 * Creates IP-based rate limiting middleware
 */
export function rateLimitByIP(
	max = 100,
	windowMs = 15 * 60 * 1000,
): Middleware {
	return rateLimit({
		max,
		windowMs,
		keyGenerator: defaultKeyGenerator,
	});
}

/**
 * Creates endpoint-specific rate limiting middleware
 */
export function rateLimitByEndpoint(
	max = 50,
	windowMs = 15 * 60 * 1000,
): Middleware {
	return rateLimit({
		max,
		windowMs,
		keyGenerator: (req) => {
			const ip = defaultKeyGenerator(req);
			const url = new URL(req.url);
			return `${ip}:${req.method}:${url.pathname}`;
		},
	});
}

/**
 * Creates user-based rate limiting middleware (requires authentication)
 */
export function rateLimitByUser(
	max = 200,
	windowMs = 15 * 60 * 1000,
): Middleware {
	return rateLimit({
		max,
		windowMs,
		keyGenerator: (req) => {
			// Try to get user ID from headers or JWT
			const userId =
				req.headers.get("x-user-id") ||
				req.headers.get("authorization")?.split(" ")[1] ||
				defaultKeyGenerator(req);
			return `user:${userId}`;
		},
	});
}

/**
 * Creates strict rate limiting for sensitive endpoints
 */
export function strictRateLimit(max = 5, windowMs = 60 * 1000): Middleware {
	return rateLimit({
		max,
		windowMs,
		strategy: "fixed-window",
		message: "Too many attempts for sensitive operation",
		statusCode: 429,
	});
}

// Legacy class exports for backward compatibility
export class MemoryStore {
	private store: RateLimitStore;

	constructor(cleanupIntervalMs = 60000) {
		this.store = createMemoryStore(cleanupIntervalMs);
	}

	async get(key: string): Promise<RateLimitInfo | null> {
		return this.store.get(key);
	}

	async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
		return this.store.increment(key, windowMs);
	}

	async reset(key: string): Promise<void> {
		return this.store.reset(key);
	}

	async cleanup(): Promise<void> {
		if (this.store.cleanup) {
			return this.store.cleanup();
		}
	}

	destroy(): void {
		// For compatibility
	}
}

export class SlidingWindowStore {
	private store: RateLimitStore;

	constructor(cleanupIntervalMs = 60000) {
		this.store = createSlidingWindowStore(cleanupIntervalMs);
	}

	async get(key: string): Promise<RateLimitInfo | null> {
		return this.store.get(key);
	}

	async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
		return this.store.increment(key, windowMs);
	}

	async reset(key: string): Promise<void> {
		return this.store.reset(key);
	}

	async cleanup(): Promise<void> {
		if (this.store.cleanup) {
			return this.store.cleanup();
		}
	}

	destroy(): void {
		// For compatibility
	}
}

export class TokenBucketStore {
	private store: RateLimitStore;

	constructor(bucketSize = 10, refillRate = 1, cleanupIntervalMs = 60000) {
		this.store = createTokenBucketStore(
			bucketSize,
			refillRate,
			cleanupIntervalMs,
		);
	}

	async get(key: string): Promise<RateLimitInfo | null> {
		return this.store.get(key);
	}

	async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
		return this.store.increment(key, windowMs);
	}

	async reset(key: string): Promise<void> {
		return this.store.reset(key);
	}

	async cleanup(): Promise<void> {
		if (this.store.cleanup) {
			return this.store.cleanup();
		}
	}

	destroy(): void {
		// For compatibility
	}
}

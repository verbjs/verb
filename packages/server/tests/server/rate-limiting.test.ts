import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import {
	createServer,
	json,
	rateLimit,
	MemoryStore,
	SlidingWindowStore,
	TokenBucketStore,
	type RateLimitOptions,
} from "../../src/index.ts";

describe("Rate Limiting Stores", () => {
	test("MemoryStore should track requests correctly", async () => {
		const store = new MemoryStore();
		const windowMs = 60000;

		const info1 = await store.increment("test-key", windowMs);
		expect(info1.totalHits).toBe(1);

		const info2 = await store.increment("test-key", windowMs);
		expect(info2.totalHits).toBe(2);

		store.destroy();
	});

	test("SlidingWindowStore should filter old timestamps", async () => {
		const store = new SlidingWindowStore();
		const windowMs = 1000;

		await store.increment("test-key", windowMs);
		await store.increment("test-key", windowMs);

		// Wait for window to expire
		await new Promise((resolve) => setTimeout(resolve, 1100));

		const info = await store.increment("test-key", windowMs);
		expect(info.totalHits).toBe(1);

		store.destroy();
	});

	test("TokenBucketStore should manage tokens", async () => {
		const bucketSize = 3;
		const refillRate = 1;
		const store = new TokenBucketStore(bucketSize, refillRate);

		// Consume all tokens
		for (let i = 0; i < bucketSize; i++) {
			await store.increment("test-key", 1000);
		}

		const info = await store.get("test-key");
		expect(info?.remaining).toBe(0);

		store.destroy();
	});
});

describe("Rate Limiting Integration", () => {
	let server: any;
	let baseURL: string;

	beforeEach(() => {
		const app = createServer({ port: 0 });

		// Apply rate limiting
		app.use(
			rateLimit({
				max: 3,
				windowMs: 1000,
				message: "Rate limit exceeded",
			}),
		);

		app.get("/test", () => json({ message: "test" }));

		server = app.server;
		baseURL = `http://localhost:${server.port}`;
	});

	afterEach(() => {
		if (server) server.stop();
	});

	test("should allow requests within limit", async () => {
		const response = await fetch(`${baseURL}/test`);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.message).toBe("test");
	});

	test("should include rate limit headers", async () => {
		const response = await fetch(`${baseURL}/test`);

		expect(response.headers.get("x-ratelimit-limit")).toBe("3");
		expect(response.headers.get("x-ratelimit-remaining")).toBeDefined();
		expect(response.headers.get("x-ratelimit-reset")).toBeDefined();
	});

	test("should block requests over limit", async () => {
		// Make requests up to limit
		for (let i = 0; i < 3; i++) {
			await fetch(`${baseURL}/test`);
		}

		// This should be rate limited
		const response = await fetch(`${baseURL}/test`);
		expect(response.status).toBe(429);

		const data = await response.json();
		expect(data.error).toContain("Rate limit");
	});
});

console.log("✅ Rate Limiting Test Suite Complete");

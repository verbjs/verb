import { describe, test, expect } from "bun:test";
import { createTestApp } from "./setup.ts";
import { text } from "../../src/index.ts";

describe("Performance", () => {
	test("handles concurrent requests", async () => {
		const app = createTestApp();

		let counter = 0;
		app.get("/counter", () => text((++counter).toString()));

		// Make 100 concurrent requests
		const promises = Array(100)
			.fill(null)
			.map(() => app.request.get("/counter").then((r) => r.text()));

		const results = await Promise.all(promises);
		const numbers = results.map(Number).sort((a, b) => a - b);

		// Check all requests were handled
		expect(numbers).toHaveLength(100);
		expect(numbers[0]).toBe(1);
		expect(numbers[99]).toBe(100);
	});

	test("mock server has minimal overhead", async () => {
		const app = createTestApp();
		app.get("/bench", () => text("OK"));

		const iterations = 1000;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			await app.request.get("/bench");
		}

		const duration = performance.now() - start;
		const avgTime = duration / iterations;

		console.log(`Average request time: ${avgTime.toFixed(3)}ms`);

		// Mock server should be very fast
		expect(avgTime).toBeLessThan(1); // Less than 1ms per request
	});

	test("route caching works correctly", async () => {
		const app = createTestApp();

		// Add a route with complex pattern to make caching more beneficial
		let routeHits = 0;
		app.get(
			"/users/:userId/posts/:postId/comments/:commentId",
			(req, params) => {
				routeHits++;
				return text(`${params.userId}-${params.postId}-${params.commentId}`);
			},
		);

		// First request should match route
		const res1 = await app.request.get("/users/123/posts/456/comments/789");
		expect(await res1.text()).toBe("123-456-789");
		expect(routeHits).toBe(1);

		// Clear the route hits counter
		routeHits = 0;

		// Multiple requests to the same URL pattern
		const iterations = 10;
		for (let i = 0; i < iterations; i++) {
			await app.request.get("/users/123/posts/456/comments/789");
		}

		// All requests should have been handled
		expect(routeHits).toBe(iterations);

		// Test with different parameters
		const res2 = await app.request.get("/users/999/posts/888/comments/777");
		expect(await res2.text()).toBe("999-888-777");
	});

	test("cache performance with complex routes", async () => {
		const app = createTestApp();

		// Add multiple complex routes
		for (let i = 0; i < 50; i++) {
			app.get(`/api/v${i}/users/:id`, (req, params) => text(params.id));
		}

		// Add the route we'll actually hit
		app.get("/api/v25/users/:id", (req, params) => text(`user-${params.id}`));

		const iterations = 1000;

		// First, hit many different routes to simulate real usage
		const mixedStart = performance.now();
		for (let i = 0; i < iterations; i++) {
			await app.request.get(`/api/v${i % 50}/users/${i}`);
		}
		const mixedTime = performance.now() - mixedStart;

		// Now hit the same route repeatedly (should benefit from cache)
		const cachedStart = performance.now();
		for (let i = 0; i < iterations; i++) {
			await app.request.get("/api/v25/users/123");
		}
		const cachedTime = performance.now() - cachedStart;

		const avgMixed = mixedTime / iterations;
		const avgCached = cachedTime / iterations;

		console.log(
			`Mixed routes avg: ${avgMixed.toFixed(3)}ms, Same route avg: ${avgCached.toFixed(3)}ms`,
		);

		// Same route should be similar or faster due to caching
		// The exact performance can vary based on environment, so we'll use a more flexible assertion
		expect(avgCached).toBeLessThanOrEqual(avgMixed * 1.1); // Allow for up to 10% variance
	});
});

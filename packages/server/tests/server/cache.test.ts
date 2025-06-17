import { describe, test, expect } from "bun:test";
import { getCached, setCached, clearCache } from "../../src/cache.ts";

describe("Cache", () => {
	test("stores and retrieves cache entries", () => {
		const handler = () => new Response("test");
		const params = { id: "123" };

		setCached("GET:/test", handler, params);
		const cached = getCached("GET:/test");

		expect(cached).toBeDefined();
		expect(cached?.handler).toBe(handler);
		expect(cached?.params).toEqual(params);
		expect(cached?.hits).toBeGreaterThan(0);
		expect(cached?.lastUsed).toBeGreaterThan(0);
	});

	test("returns undefined for missing entries", () => {
		clearCache();
		expect(getCached("GET:/missing")).toBeUndefined();
	});

	test("clears cache", () => {
		const handler = () => new Response("test");
		const params = {};

		setCached("GET:/test", handler, params);
		clearCache();

		expect(getCached("GET:/test")).toBeUndefined();
	});
});

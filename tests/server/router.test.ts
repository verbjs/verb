import { describe, test, expect } from "bun:test";
import {
	createRouter,
	addRoute,
	findRoute,
	handleRequest,
} from "../../src/routers/manual.ts";
import { text } from "../../src/response.ts";

describe("Router", () => {
	test("creates router with all HTTP methods", () => {
		const router = createRouter();

		expect(router.routes.get("GET")).toEqual([]);
		expect(router.routes.get("POST")).toEqual([]);
		expect(router.routes.get("PUT")).toEqual([]);
		expect(router.middlewares).toEqual([]);
	});

	test("adds and finds simple route", () => {
		const router = createRouter();
		const handler = () => text("test");

		addRoute(router, "GET", "/test", handler);

		const match = findRoute(router, "GET", "/test");
		expect(match).toBeTruthy();
		expect(match?.params).toEqual({});
	});

	test("handles parameterized routes", () => {
		const router = createRouter();
		const handler = () => text("test");

		addRoute(router, "GET", "/users/:id", handler);

		const match = findRoute(router, "GET", "/users/123");
		expect(match).toBeTruthy();
		expect(match?.params).toEqual({ id: "123" });
	});

	test("handles multiple parameters", () => {
		const router = createRouter();
		const handler = () => text("test");

		addRoute(router, "GET", "/users/:userId/posts/:postId", handler);

		const match = findRoute(router, "GET", "/users/123/posts/456");
		expect(match?.params).toEqual({ userId: "123", postId: "456" });
	});

	test("handles wildcard routes", () => {
		const router = createRouter();
		const handler = () => text("test");

		addRoute(router, "GET", "/static/*", handler);

		expect(findRoute(router, "GET", "/static/css/main.css")).toBeTruthy();
		expect(findRoute(router, "GET", "/static/js/app.js")).toBeTruthy();
	});

	test("returns null for non-matching routes", () => {
		const router = createRouter();

		expect(findRoute(router, "GET", "/nonexistent")).toBeNull();
	});

	test("handles request with middleware", async () => {
		const router = createRouter();
		const logs: string[] = [];

		router.middlewares.push(async (req, next) => {
			logs.push("middleware1");
			const response = await next();
			logs.push("after1");
			return response;
		});

		router.middlewares.push(async (req, next) => {
			logs.push("middleware2");
			const response = await next();
			logs.push("after2");
			return response;
		});

		addRoute(router, "GET", "/test", () => {
			logs.push("handler");
			return text("success");
		});

		const req = new Request("http://localhost/test");
		const response = await handleRequest(router, req);

		expect(await response.text()).toBe("success");
		expect(logs).toEqual([
			"middleware1",
			"middleware2",
			"handler",
			"after2",
			"after1",
		]);
	});
});

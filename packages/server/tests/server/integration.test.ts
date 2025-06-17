import { describe, test, expect } from "bun:test";
import { createTestApp } from "./setup.ts";
import { json, text, parseBody } from "../../src/index.ts";
import type { MountableApp } from "../../src/index.ts";

describe("Server Integration", () => {
	test("GET /", async () => {
		const app = createTestApp();
		app.get("/", () => text("Hello World"));

		const res = await app.request.get("/");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("Hello World");
	});

	test("GET /json", async () => {
		const app = createTestApp();
		app.get("/json", () => json({ message: "test" }));

		const res = await app.request.get("/json");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ message: "test" });
	});

	test("GET /users/:id", async () => {
		const app = createTestApp();
		app.get("/users/:id", (req, params) => json({ id: params.id }));

		const res = await app.request.get("/users/123");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ id: "123" });
	});

	test("POST /echo", async () => {
		const app = createTestApp();
		app.post("/echo", async (req) => {
			const body = await parseBody(req);
			return json(body);
		});

		const data = { name: "test", value: 42 };
		const res = await app.request.post("/echo", data);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(data);
	});

	test("middleware execution", async () => {
		const app = createTestApp();
		const logs: string[] = [];

		app.use(async (req, next) => {
			logs.push("middleware1");
			const response = await next();
			response.headers.set("X-Custom", "test");
			return response;
		});

		app.get("/", () => {
			logs.push("handler");
			return text("OK");
		});

		const res = await app.request.get("/");
		expect(res.headers.get("X-Custom")).toBe("test");
		expect(logs).toEqual(["middleware1", "handler"]);
	});

	test("404 for unknown routes", async () => {
		const app = createTestApp();
		const res = await app.request.get("/unknown");
		expect(res.status).toBe(404);
	});

	test("multiple middleware chain", async () => {
		const app = createTestApp();
		const order: number[] = [];

		app.use(async (req, next) => {
			order.push(1);
			const res = await next();
			order.push(4);
			return res;
		});

		app.use(async (req, next) => {
			order.push(2);
			const res = await next();
			order.push(3);
			return res;
		});

		app.get("/test", () => text("done"));

		await app.request.get("/test");
		expect(order).toEqual([1, 2, 3, 4]);
	});

	test("error handling", async () => {
		const app = createTestApp();

		app.use(async (req, next) => {
			try {
				return await next();
			} catch (error) {
				return json({ error: "Internal Server Error" }, 500);
			}
		});

		app.get("/error", () => {
			throw new Error("Test error");
		});

		const res = await app.request.get("/error");
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: "Internal Server Error" });
	});

	test("custom headers in request", async () => {
		const app = createTestApp();

		app.get("/headers", (req) => {
			return json({
				auth: req.headers.get("authorization"),
				custom: req.headers.get("x-custom"),
			});
		});

		const res = await app.request.raw("/headers", {
			method: "GET",
			headers: {
				Authorization: "Bearer token123",
				"X-Custom": "value",
			},
		});

		const data = await res.json();
		expect(data.auth).toBe("Bearer token123");
		expect(data.custom).toBe("value");
	});

	test("query parameters", async () => {
		const app = createTestApp();
		const { getQuery } = await import("../../src/request.ts");

		app.get("/search", (req) => {
			const query = getQuery(req);
			return json(query);
		});

		const res = await app.request.get("/search?q=test&limit=10");
		expect(await res.json()).toEqual({ q: "test", limit: "10" });
	});

	test("mount basic app", async () => {
		const app = createTestApp();

		const subApp: MountableApp = {
			routes: [
				{
					method: "GET",
					path: "/",
					handler: () => text("Sub app home"),
				},
				{
					method: "GET",
					path: "/info",
					handler: () => json({ name: "sub-app" }),
				},
			],
		};

		app.mount("/api", subApp);

		const res1 = await app.request.get("/api");
		expect(res1.status).toBe(200);
		expect(await res1.text()).toBe("Sub app home");

		const res2 = await app.request.get("/api/info");
		expect(res2.status).toBe(200);
		expect(await res2.json()).toEqual({ name: "sub-app" });
	});

	test("mount app with wildcard routes", async () => {
		const app = createTestApp();

		const subApp: MountableApp = {
			routes: [
				{
					method: "GET",
					path: "/*",
					handler: (req) => {
						const url = new URL(req.url);
						return json({ path: url.pathname });
					},
				},
			],
		};

		app.mount("/files", subApp);

		const res = await app.request.get("/files/documents/test.pdf");
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.path).toBe("/files/documents/test.pdf");
	});

	test("mount multiple apps", async () => {
		const app = createTestApp();

		const apiV1: MountableApp = {
			routes: [
				{
					method: "GET",
					path: "/users",
					handler: () => json({ version: "v1", users: [] }),
				},
			],
		};

		const apiV2: MountableApp = {
			routes: [
				{
					method: "GET",
					path: "/users",
					handler: () => json({ version: "v2", data: { users: [] } }),
				},
			],
		};

		app.mount("/api/v1", apiV1);
		app.mount("/api/v2", apiV2);

		const res1 = await app.request.get("/api/v1/users");
		expect(await res1.json()).toEqual({ version: "v1", users: [] });

		const res2 = await app.request.get("/api/v2/users");
		expect(await res2.json()).toEqual({ version: "v2", data: { users: [] } });
	});

	test("mount app with params", async () => {
		const app = createTestApp();

		const subApp: MountableApp = {
			routes: [
				{
					method: "GET",
					path: "/items/:id",
					handler: (req, params) => json({ id: params.id }),
				},
			],
		};

		app.mount("/shop", subApp);

		const res = await app.request.get("/shop/items/123");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ id: "123" });
	});
});

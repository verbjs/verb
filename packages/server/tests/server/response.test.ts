import { describe, test, expect } from "bun:test";
import { json, text, html, error, notFound } from "../../src/response.ts";

describe("Response Helpers", () => {
	test("json() creates JSON response", async () => {
		const data = { message: "test" };
		const response = json(data);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(await response.json()).toEqual(data);
	});

	test("json() with custom status", async () => {
		const response = json({ created: true }, 201);
		expect(response.status).toBe(201);
	});

	test("text() creates text response", async () => {
		const response = text("Hello");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain");
		expect(await response.text()).toBe("Hello");
	});

	test("html() creates HTML response", async () => {
		const response = html("<h1>Hello</h1>");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html");
		expect(await response.text()).toBe("<h1>Hello</h1>");
	});

	test("error() creates error response", async () => {
		const response = error("Bad Request", 400);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Bad Request" });
	});

	test("notFound() creates 404 response", () => {
		const response = notFound();
		expect(response.status).toBe(404);
	});
});

import { describe, test, expect } from "bun:test";
import { parseBody, getQuery, getCookies } from "../../src/request.ts";

describe("Request Utilities", () => {
	describe("parseBody()", () => {
		test("parses JSON body", async () => {
			const data = { name: "test" };
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(data),
			});

			const body = await parseBody(req);
			expect(body).toEqual(data);
		});

		test("parses form data", async () => {
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "name=test&age=25",
			});

			const body = await parseBody(req);
			expect(body).toEqual({ name: "test", age: "25" });
		});

		test("parses text body", async () => {
			const req = new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "text/plain" },
				body: "Hello World",
			});

			const body = await parseBody(req);
			expect(body).toBe("Hello World");
		});
	});

	describe("getQuery()", () => {
		test("parses query parameters", () => {
			const req = new Request("http://localhost?name=test&age=25");
			const query = getQuery(req);

			expect(query).toEqual({ name: "test", age: "25" });
		});

		test("handles empty query", () => {
			const req = new Request("http://localhost");
			const query = getQuery(req);

			expect(query).toEqual({});
		});
	});

	describe("getCookies()", () => {
		test("parses cookies", () => {
			const req = new Request("http://localhost", {
				headers: { cookie: "session=abc123; user=john" },
			});
			const cookies = getCookies(req);

			expect(cookies).toEqual({ session: "abc123", user: "john" });
		});

		test("handles no cookies", () => {
			const req = new Request("http://localhost");
			const cookies = getCookies(req);

			expect(cookies).toEqual({});
		});

		test("handles URL encoded cookies", () => {
			const req = new Request("http://localhost", {
				headers: { cookie: "data=hello%20world" },
			});
			const cookies = getCookies(req);

			expect(cookies).toEqual({ data: "hello world" });
		});
	});
});

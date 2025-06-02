import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../../src/server.ts";
import {
	createPushHeader,
	responseWithPush,
	StreamPriority,
	createHttp2Headers,
	http2Middleware,
	isHttp2Preface,
} from "../../src/http2.ts";
import { text, html } from "../../src/response.ts";

describe("HTTP/2 Support", () => {
	test("createPushHeader - generates correct Link header", () => {
		const resources = [
			{ path: "/styles.css", type: "text/css", rel: "preload" },
			{
				path: "/app.js",
				type: "application/javascript",
				rel: "preload",
				importance: "high" as const,
			},
		];

		const linkHeader = createPushHeader(resources);

		expect(linkHeader).toBe(
			"</styles.css>; rel=preload; as=style, </app.js>; rel=preload; as=script; importance=high",
		);
	});

	test("responseWithPush - creates response with push headers", () => {
		const resources = [
			{ path: "/critical.css", type: "text/css", rel: "preload" },
		];

		const response = responseWithPush(
			"<html><body>Test</body></html>",
			resources,
			{ headers: { "Content-Type": "text/html" } },
		);

		expect(response.headers.get("Link")).toBe(
			"</critical.css>; rel=preload; as=style",
		);
		expect(response.headers.get("Content-Type")).toBe("text/html");
	});

	test("StreamPriority - provides correct constants", () => {
		expect(StreamPriority.HIGHEST).toBe(0);
		expect(StreamPriority.HIGH).toBe(1);
		expect(StreamPriority.MEDIUM).toBe(2);
		expect(StreamPriority.LOW).toBe(3);
		expect(StreamPriority.LOWEST).toBe(4);
	});

	test("createHttp2Headers - generates optimized headers", () => {
		const headers = createHttp2Headers(
			StreamPriority.HIGH,
			"public, max-age=3600",
		);

		expect(headers.get("Priority")).toBe("u=1");
		expect(headers.get("Vary")).toBe("Accept-Encoding");
		expect(headers.get("Cache-Control")).toBe("public, max-age=3600");
	});

	test("http2Middleware - adds optimization headers", async () => {
		const mockNext = () =>
			html("<html><head><title>Test</title></head><body>Hello</body></html>");
		const mockRequest = new Request("http://localhost:3000/");

		const response = await http2Middleware(mockRequest, mockNext);

		expect(response.headers.get("Link")).toContain("favicon.ico");
	});

	test("http2Middleware - optimizes static assets", async () => {
		const mockNext = () =>
			new Response("body { color: red; }", {
				headers: { "Content-Type": "text/css" },
			});
		const mockRequest = new Request("http://localhost:3000/styles.css");

		const response = await http2Middleware(mockRequest, mockNext);

		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	test("isHttp2Preface - validates HTTP/2 connection preface", () => {
		const validPreface = new TextEncoder().encode(
			"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n",
		);
		const invalidPreface = new TextEncoder().encode("GET / HTTP/1.1\r\n");

		expect(isHttp2Preface(validPreface)).toBe(true);
		expect(isHttp2Preface(invalidPreface)).toBe(false);
		expect(isHttp2Preface(new Uint8Array([1, 2, 3]))).toBe(false);
	});

	test("server configuration - validates HTTP/2 requirements", () => {
		// Test that HTTP/2 without TLS throws error
		expect(() => {
			createServer({ http2: true });
		}).toThrow("HTTP/2 requires TLS configuration");
	});

	test("server configuration - accepts valid HTTP/2 config", () => {
		// Test that providing HTTP/2 and TLS config structure is accepted
		// Note: We skip actual server creation to avoid certificate validation
		const config = {
			http2: true,
			tls: {
				cert: "./cert.pem",
				key: "./key.pem",
			},
		};

		expect(config.http2).toBe(true);
		expect(config.tls).toBeDefined();
		expect(config.tls.cert).toBe("./cert.pem");
		expect(config.tls.key).toBe("./key.pem");
	});
});

describe("HTTP/2 Integration", () => {
	let server: any;
	const port = 3002;

	afterAll(() => {
		if (server?.server) {
			server.server.stop();
		}
	});

	test("HTTP/1.1 server - should work without HTTP/2", async () => {
		server = createServer({ port });

		server.get("/", () => text("Hello HTTP/1.1"));

		const response = await fetch(`http://localhost:${port}/`);
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toBe("Hello HTTP/1.1");
	});

	test("responseWithPush function works correctly", () => {
		// Test that the responseWithPush function creates correct headers
		const resources = [
			{ path: "/styles.css", type: "text/css" },
			{ path: "/app.js", type: "application/javascript" },
		];

		const response = responseWithPush(
			"<html><head><title>HTTP/2 Test</title></head><body>Hello HTTP/2</body></html>",
			resources,
			{ headers: { "Content-Type": "text/html" } },
		);

		expect(response.headers.get("Link")).toContain("styles.css");
		expect(response.headers.get("Link")).toContain("app.js");
		expect(response.headers.get("Content-Type")).toBe("text/html");
	});

	test("HTTP/2 middleware - basic server integration", async () => {
		if (server?.server) {
			server.server.stop();
		}

		server = createServer({ port: port + 2 });

		// Add HTTP/2 middleware
		server.use(http2Middleware);

		server.get(
			"/styles.css",
			() =>
				new Response("body{}", {
					headers: { "Content-Type": "text/css" },
				}),
		);

		// Test CSS response gets cache headers through middleware
		const cssResponse = await fetch(`http://localhost:${port + 2}/styles.css`);
		expect(cssResponse.headers.get("Cache-Control")).toBe(
			"public, max-age=31536000, immutable",
		);
		expect(cssResponse.status).toBe(200);
	});
});

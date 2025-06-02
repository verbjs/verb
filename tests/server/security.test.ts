import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import {
	createServer,
	json,
	securityHeaders,
	csrfProtection,
	generateCSRFToken,
	inputSanitization,
	InputSanitizer,
	type SecurityOptions,
} from "../../src/index.ts";

describe("Security Headers", () => {
	let server: any;
	let baseURL: string;

	beforeEach(() => {
		const app = createServer({ port: 0 });

		app.use(
			securityHeaders({
				contentSecurityPolicy: {
					enabled: true,
					directives: {
						"default-src": ["'self'"],
						"script-src": ["'self'", "'unsafe-inline'"],
					},
				},
				hsts: {
					enabled: true,
					maxAge: 31536000,
					includeSubDomains: true,
				},
			}),
		);

		app.get("/test", () => json({ message: "test" }));

		server = app.server;
		baseURL = `http://localhost:${server.port}`;
	});

	afterEach(() => {
		if (server) server.stop();
	});

	test("should apply security headers", async () => {
		const response = await fetch(`${baseURL}/test`);

		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("content-security-policy")).toContain(
			"default-src",
		);
		expect(response.headers.get("strict-transport-security")).toBeDefined();
	});
});

describe("CSRF Protection", () => {
	test("should generate CSRF tokens", () => {
		const sessionId = "test-session";
		const token1 = generateCSRFToken(sessionId);
		const token2 = generateCSRFToken(sessionId);

		expect(token1).toBeDefined();
		expect(token2).toBeDefined();
		expect(token1).not.toBe(token2);
	});
});

describe("Input Sanitization", () => {
	test("should sanitize HTML input", () => {
		const malicious = '<script>alert("xss")</script><p>Safe</p>';

		const sanitized = InputSanitizer.sanitize(malicious, {
			stripScripts: true,
			stripHtml: false,
		});

		expect(sanitized).not.toContain("<script>");
		expect(sanitized).toContain("<p>");
	});

	test("should sanitize object recursively", () => {
		const obj = {
			name: '<script>alert("xss")</script>John',
			nested: { desc: '<img src="x" onerror="alert(1)">' },
		};

		const sanitized = InputSanitizer.sanitizeObject(obj, {
			stripScripts: true,
			stripHtml: true,
		});

		expect(sanitized.name).not.toContain("<script>");
		expect(sanitized.nested.desc).not.toContain("onerror");
	});

	test("should remove null bytes", () => {
		const input = "text\0with\0nulls";
		const sanitized = InputSanitizer.removeNullBytes(input);
		expect(sanitized).toBe("textwithnulls");
	});
});

console.log("✅ Security Test Suite Complete");

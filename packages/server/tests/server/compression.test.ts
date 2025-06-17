import { expect, test, describe } from "bun:test";
import {
	createMockServer,
	json,
	text,
	compression,
	gzip,
	deflate,
	productionCompression,
	developmentCompression,
} from "../../src/index.ts";

describe("Compression middleware", () => {
	test("should compress JSON responses with gzip", async () => {
		const app = createMockServer();

		app.use(compression({ algorithms: ["gzip"] }));
		app.get("/api/data", () => json({ message: "Hello World".repeat(100) }));

		const response = await app.request.get("/api/data", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Encoding")).toBe("gzip");
		expect(response.headers.get("Vary")).toBe("Accept-Encoding");
		expect(response.headers.has("Content-Length")).toBe(true);
	});

	test("should compress text responses with deflate", async () => {
		const app = createMockServer();

		app.use(compression({ algorithms: ["deflate"] }));
		app.get("/text", () =>
			text("This is a long text that should be compressed. ".repeat(50)),
		);

		const response = await app.request.get("/text", {
			headers: { "Accept-Encoding": "deflate" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Encoding")).toBe("deflate");
		expect(response.headers.get("Vary")).toBe("Accept-Encoding");
	});

	test("should prefer gzip over deflate when both available", async () => {
		const app = createMockServer();

		app.use(compression({ algorithms: ["gzip", "deflate"], threshold: 100 }));
		app.get("/api/data", () => json({ data: "test".repeat(100) }));

		const response = await app.request.get("/api/data", {
			headers: { "Accept-Encoding": "gzip, deflate" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("gzip");
	});

	test("should not compress small responses below threshold", async () => {
		const app = createMockServer();

		app.use(compression({ threshold: 1000 }));
		app.get("/small", () => text("small"));

		const response = await app.request.get("/small", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe(null);
	});

	test("should not compress responses without Accept-Encoding header", async () => {
		const app = createMockServer();

		app.use(compression());
		app.get("/api/data", () => json({ message: "Hello World".repeat(100) }));

		const response = await app.request.get("/api/data");

		expect(response.headers.get("Content-Encoding")).toBe(null);
	});

	test("should not compress already compressed responses", async () => {
		const app = createMockServer();

		app.use(compression());
		app.get("/pre-compressed", () => {
			return new Response("compressed", {
				headers: {
					"Content-Encoding": "gzip",
					"Content-Type": "text/plain",
				},
			});
		});

		const response = await app.request.get("/pre-compressed", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("gzip");
	});

	test("should not compress non-compressible content types", async () => {
		const app = createMockServer();

		app.use(compression());
		app.get("/image", () => {
			return new Response("binary image data", {
				headers: { "Content-Type": "image/jpeg" },
			});
		});

		const response = await app.request.get("/image", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe(null);
	});

	test("should not compress error responses", async () => {
		const app = createMockServer();

		app.use(compression());
		app.get("/error", () => {
			return new Response("Not Found", { status: 404 });
		});

		const response = await app.request.get("/error", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Encoding")).toBe(null);
	});

	test("gzip convenience function should only use gzip", async () => {
		const app = createMockServer();

		app.use(gzip());
		app.get("/api/data", () => json({ message: "Hello World".repeat(100) }));

		const response = await app.request.get("/api/data", {
			headers: { "Accept-Encoding": "deflate, gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("gzip");
	});

	test("deflate convenience function should only use deflate", async () => {
		const app = createMockServer();

		app.use(deflate());
		app.get("/api/data", () => json({ message: "Hello World".repeat(100) }));

		const response = await app.request.get("/api/data", {
			headers: { "Accept-Encoding": "gzip, deflate" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("deflate");
	});

	test("production compression should have aggressive settings", async () => {
		const app = createMockServer();

		app.use(productionCompression());
		app.get("/small", () => text("A".repeat(600))); // Above 512 threshold

		const response = await app.request.get("/small", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("gzip");
	});

	test("development compression should have relaxed settings", async () => {
		const app = createMockServer();

		app.use(developmentCompression());
		app.get("/medium", () => text("A".repeat(1500))); // Below 2048 threshold

		const response = await app.request.get("/medium", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe(null);
	});

	test("should handle compression errors gracefully", async () => {
		const app = createMockServer();

		app.use(compression());
		app.get("/api/data", () => {
			// Create a response with a stream that will cause compression issues
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("test".repeat(300)));
					controller.close();
				},
			});
			return new Response(stream, {
				headers: { "Content-Type": "application/json" },
			});
		});

		const response = await app.request.get("/api/data", {
			headers: { "Accept-Encoding": "gzip" },
		});

		// Should fallback to uncompressed response on error
		expect(response.status).toBe(200);
	});

	test("should compress custom content types when specified", async () => {
		const app = createMockServer();

		app.use(
			compression({
				contentTypes: ["application/custom"],
			}),
		);

		app.get("/custom", () => {
			return new Response("custom data".repeat(100), {
				headers: { "Content-Type": "application/custom" },
			});
		});

		const response = await app.request.get("/custom", {
			headers: { "Accept-Encoding": "gzip" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("gzip");
	});

	test("should handle Accept-Encoding with quality values", async () => {
		const app = createMockServer();

		app.use(compression());
		app.get("/api/data", () => json({ message: "Hello World".repeat(100) }));

		const response = await app.request.get("/api/data", {
			headers: { "Accept-Encoding": "deflate;q=0.8, gzip;q=0.9" },
		});

		expect(response.headers.get("Content-Encoding")).toBe("gzip");
	});
});

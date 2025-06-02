import { expect, test, describe } from "bun:test";
import { createMockServer } from "../../src/mock.ts";
import {
	stream,
	streamFile,
	streamSSE,
	streamJSON,
	streamText,
} from "../../src/response.ts";

describe("Streaming Response Functions", () => {
	test("stream() creates readable stream response", async () => {
		const mockServer = createMockServer();

		mockServer.get("/test", () => {
			const testStream = new ReadableStream({
				start(controller) {
					controller.enqueue("Hello ");
					controller.enqueue("World!");
					controller.close();
				},
			});

			return stream(testStream, "text/plain");
		});

		const response = await mockServer.request.get("/test");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain");

		const text = await response.text();
		expect(text).toBe("Hello World!");
	});

	test("stream() with custom headers", async () => {
		const mockServer = createMockServer();

		mockServer.get("/test", () => {
			const testStream = new ReadableStream({
				start(controller) {
					controller.enqueue("test data");
					controller.close();
				},
			});

			return stream(testStream, "application/json", {
				"X-Custom-Header": "test-value",
				"Cache-Control": "no-cache",
			});
		});

		const response = await mockServer.request.get("/test");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(response.headers.get("x-custom-header")).toBe("test-value");
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});

	test("streamText() with array chunks", async () => {
		const mockServer = createMockServer();

		mockServer.get("/test", () => {
			return streamText(["Hello ", "streaming ", "world!"], "text/plain", 0);
		});

		const response = await mockServer.request.get("/test");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain");

		const text = await response.text();
		expect(text).toBe("Hello streaming world!");
	});

	test("streamText() with async generator", async () => {
		const mockServer = createMockServer();

		mockServer.get("/test", () => {
			async function* textGenerator() {
				yield "First ";
				yield "Second ";
				yield "Third";
			}

			return streamText(textGenerator(), "text/plain", 0);
		});

		const response = await mockServer.request.get("/test");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain");

		const text = await response.text();
		expect(text).toBe("First Second Third");
	});

	test("streamJSON() with async generator", async () => {
		const mockServer = createMockServer();

		mockServer.get("/test", () => {
			async function* dataGenerator() {
				yield { id: 1, name: "Alice" };
				yield { id: 2, name: "Bob" };
				yield { id: 3, name: "Charlie" };
			}

			return streamJSON(dataGenerator());
		});

		const response = await mockServer.request.get("/test");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/x-ndjson");

		const text = await response.text();
		const lines = text.trim().split("\n");
		expect(lines).toHaveLength(3);

		expect(JSON.parse(lines[0])).toEqual({ id: 1, name: "Alice" });
		expect(JSON.parse(lines[1])).toEqual({ id: 2, name: "Bob" });
		expect(JSON.parse(lines[2])).toEqual({ id: 3, name: "Charlie" });
	});

	test("streamSSE() formats events correctly", async () => {
		const mockServer = createMockServer();

		mockServer.get("/test", () => {
			async function* eventGenerator() {
				yield {
					data: "Hello World",
					id: "1",
					event: "message",
				};
				yield {
					data: "Goodbye",
					id: "2",
					event: "message",
					retry: 1000,
				};
			}

			return streamSSE(eventGenerator());
		});

		const response = await mockServer.request.get("/test");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/event-stream");
		expect(response.headers.get("cache-control")).toBe("no-cache");
		expect(response.headers.get("connection")).toBe("keep-alive");

		const text = await response.text();
		expect(text).toContain("event: message\n");
		expect(text).toContain("id: 1\n");
		expect(text).toContain("data: Hello World\n");
		expect(text).toContain("retry: 1000\n");
		expect(text).toContain("data: Goodbye\n");
	});

	test("streamFile() handles non-existent files", async () => {
		const response = await streamFile("./non-existent-file.txt");
		expect(response.status).toBe(404);
	});

	test("streamFile() with existing file", async () => {
		// Create a temporary file for testing
		const testFilePath = "./test-stream-file.txt";
		const testContent = "This is test content for streaming";

		await Bun.write(testFilePath, testContent);

		try {
			const response = await streamFile(testFilePath);
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toMatch(/^text\/plain/);
			expect(response.headers.get("accept-ranges")).toBe("bytes");
			expect(response.headers.get("content-length")).toBe(
				testContent.length.toString(),
			);

			const responseText = await response.text();
			expect(responseText).toBe(testContent);
		} finally {
			// Clean up test file
			try {
				await Bun.write(testFilePath, ""); // Clear file
				// Note: In a real test environment, you might want to actually delete the file
			} catch (error) {
				// Ignore cleanup errors
			}
		}
	});

	test("streamFile() with custom content type", async () => {
		// Create a temporary file for testing
		const testFilePath = "./test-stream-custom.json";
		const testContent = '{"message": "hello"}';

		await Bun.write(testFilePath, testContent);

		try {
			const response = await streamFile(testFilePath, "application/json");
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("application/json");

			const responseText = await response.text();
			expect(responseText).toBe(testContent);
		} finally {
			// Clean up test file
			try {
				await Bun.write(testFilePath, "");
			} catch (error) {
				// Ignore cleanup errors
			}
		}
	});
});

describe("Streaming Integration Tests", () => {
	test("large data streaming doesn't block", async () => {
		const mockServer = createMockServer();

		mockServer.get("/large", () => {
			async function* largeDataGenerator() {
				for (let i = 0; i < 1000; i++) {
					yield {
						id: i,
						data: `Record ${i}`.repeat(100), // Make each record larger
					};
				}
			}

			return streamJSON(largeDataGenerator());
		});

		const startTime = Date.now();
		const response = await mockServer.request.get("/large");
		const setupTime = Date.now() - startTime;

		// Setup should be fast, even for large datasets
		expect(setupTime).toBeLessThan(100); // Should be very fast to setup
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/x-ndjson");

		// Reading the entire stream might take longer, but that's expected
		const text = await response.text();
		const lines = text.trim().split("\n");
		expect(lines).toHaveLength(1000);
	});

	test("SSE with rapid events", async () => {
		const mockServer = createMockServer();

		mockServer.get("/rapid", () => {
			async function* rapidEvents() {
				for (let i = 0; i < 10; i++) {
					yield {
						data: `Event ${i}`,
						id: i.toString(),
						event: "rapid",
					};
					// No delay - rapid fire events
				}
			}

			return streamSSE(rapidEvents());
		});

		const response = await mockServer.request.get("/rapid");
		expect(response.status).toBe(200);

		const text = await response.text();
		const eventCount = (text.match(/event: rapid/g) || []).length;
		expect(eventCount).toBe(10);
	});

	test("error handling in streams", async () => {
		const mockServer = createMockServer();

		mockServer.get("/error", () => {
			async function* errorGenerator() {
				yield { id: 1, data: "good" };
				throw new Error("Stream error");
			}

			return streamJSON(errorGenerator());
		});

		const response = await mockServer.request.get("/error");
		expect(response.status).toBe(200); // Stream starts successfully

		// The error will be handled by the stream's error handling
		// In a real implementation, you might want to test error recovery
	});
});

// Optimized response helpers with pre-allocated headers and minimal allocations

// Pre-allocated header objects to reduce GC pressure
const JSON_HEADERS = Object.freeze({ "Content-Type": "application/json" });
const TEXT_HEADERS = Object.freeze({ "Content-Type": "text/plain" });
const HTML_HEADERS = Object.freeze({ "Content-Type": "text/html" });

// Pre-allocated common responses
const NOT_FOUND_RESPONSE = new Response("Not Found", { status: 404 });
const INTERNAL_ERROR_RESPONSE = new Response(
	JSON.stringify({ error: "Internal Server Error" }),
	{
		status: 500,
		headers: JSON_HEADERS,
	},
);

// Response cache for common static responses
const responseCache = new Map<string, Response>();

/**
 * Creates a JSON response with proper content-type header
 * @param data - The data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON content
 * @example
 * ```ts
 * json({ message: "Hello" }) // 200 OK
 * json({ error: "Not found" }, 404) // 404 with JSON error
 * ```
 */
export const json = (data: unknown, status = 200): Response => {
	// Cache simple static responses
	if (
		status === 200 &&
		typeof data === "object" &&
		data &&
		Object.keys(data).length <= 2
	) {
		const cacheKey = `json:${status}:${JSON.stringify(data)}`;
		const cached = responseCache.get(cacheKey);
		if (cached) return cached.clone();

		const response = new Response(JSON.stringify(data), {
			status,
			headers: JSON_HEADERS,
		});

		if (responseCache.size < 100) {
			// Limit cache size
			responseCache.set(cacheKey, response.clone());
		}
		return response;
	}

	return new Response(JSON.stringify(data), {
		status,
		headers: JSON_HEADERS,
	});
};

/**
 * Creates a plain text response
 * @param data - The text content
 * @param status - HTTP status code (default: 200)
 * @returns Response object with plain text content
 * @example
 * ```ts
 * text("Hello World") // 200 OK with text
 * text("Not Found", 404) // 404 with text message
 * ```
 */
export const text = (data: string, status = 200): Response => {
	// Cache common text responses
	if (status === 200 && data.length < 50) {
		const cacheKey = `text:${status}:${data}`;
		const cached = responseCache.get(cacheKey);
		if (cached) return cached.clone();

		const response = new Response(data, {
			status,
			headers: TEXT_HEADERS,
		});

		if (responseCache.size < 100) {
			responseCache.set(cacheKey, response.clone());
		}
		return response;
	}

	return new Response(data, {
		status,
		headers: TEXT_HEADERS,
	});
};

/**
 * Creates an HTML response
 * @param data - The HTML content
 * @param status - HTTP status code (default: 200)
 * @returns Response object with HTML content
 * @example
 * ```ts
 * html("<h1>Welcome</h1>") // 200 OK with HTML
 * html("<h1>404</h1>", 404) // 404 with HTML page
 * ```
 */
export const html = (data: string, status = 200): Response =>
	new Response(data, {
		status,
		headers: HTML_HEADERS,
	});

/**
 * Creates a JSON error response
 * @param message - The error message
 * @param status - HTTP status code (default: 500)
 * @returns Response object with JSON error format: { error: message }
 * @example
 * ```ts
 * error("Bad Request", 400) // { error: "Bad Request" } with 400 status
 * error("Server Error") // { error: "Server Error" } with 500 status
 * ```
 */
export const error = (message: string, status = 500): Response => {
	// Return pre-allocated response for common errors
	if (status === 500 && message === "Internal Server Error") {
		return INTERNAL_ERROR_RESPONSE.clone();
	}

	// Cache common error responses
	const cacheKey = `error:${status}:${message}`;
	const cached = responseCache.get(cacheKey);
	if (cached) return cached.clone();

	const response = new Response(JSON.stringify({ error: message }), {
		status,
		headers: JSON_HEADERS,
	});

	if (responseCache.size < 100) {
		responseCache.set(cacheKey, response.clone());
	}

	return response;
};

/**
 * Creates a standard 404 Not Found response
 * @returns Response object with 404 status
 */
export const notFound = (): Response => NOT_FOUND_RESPONSE.clone();

/**
 * Fast redirect response
 */
export const redirect = (location: string, status = 302): Response =>
	new Response(null, {
		status,
		headers: { Location: location },
	});

/**
 * Streaming response for large data
 * @param stream - ReadableStream to stream
 * @param contentType - Content type header (default: "application/octet-stream")
 * @param headers - Additional headers
 * @returns Response object with streaming content
 * @example
 * ```ts
 * const dataStream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("chunk 1\n");
 *     controller.enqueue("chunk 2\n");
 *     controller.close();
 *   }
 * });
 * return stream(dataStream, "text/plain");
 * ```
 */
export const stream = (
	stream: ReadableStream,
	contentType = "application/octet-stream",
	headers: Record<string, string> = {},
): Response =>
	new Response(stream, {
		headers: { "Content-Type": contentType, ...headers },
	});

/**
 * Stream a file directly from the filesystem
 * @param filePath - Path to the file to stream
 * @param contentType - Content type header (auto-detected if not provided)
 * @returns Response object streaming the file
 * @example
 * ```ts
 * return streamFile("./large-video.mp4", "video/mp4");
 * ```
 */
export const streamFile = async (
	filePath: string,
	contentType?: string,
): Promise<Response> => {
	const file = Bun.file(filePath);
	const exists = await file.exists();

	if (!exists) {
		return notFound();
	}

	const headers: Record<string, string> = {
		"Content-Type": contentType || file.type || "application/octet-stream",
		"Content-Length": file.size.toString(),
		"Accept-Ranges": "bytes",
	};

	return new Response(file, { headers });
};

/**
 * Create a Server-Sent Events (SSE) stream
 * @param generator - Async generator that yields SSE events
 * @returns Response object with SSE stream
 * @example
 * ```ts
 * async function* eventGenerator() {
 *   let count = 0;
 *   while (count < 10) {
 *     yield { data: `Event ${count}`, id: count.toString() };
 *     await new Promise(resolve => setTimeout(resolve, 1000));
 *     count++;
 *   }
 * }
 * return streamSSE(eventGenerator());
 * ```
 */
export const streamSSE = (
	generator: AsyncGenerator<{
		data: string;
		event?: string;
		id?: string;
		retry?: number;
	}>,
): Response => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			try {
				for await (const event of generator) {
					let message = "";

					if (event.event) message += `event: ${event.event}\n`;
					if (event.id) message += `id: ${event.id}\n`;
					if (event.retry) message += `retry: ${event.retry}\n`;
					message += `data: ${event.data}\n\n`;

					controller.enqueue(encoder.encode(message));
				}
			} catch (error) {
				controller.error(error);
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "Cache-Control",
		},
	});
};

/**
 * Stream JSON objects line by line (JSONL format)
 * @param generator - Async generator that yields objects to serialize
 * @returns Response object with JSONL stream
 * @example
 * ```ts
 * async function* dataGenerator() {
 *   for (let i = 0; i < 1000; i++) {
 *     yield { id: i, data: `record ${i}` };
 *   }
 * }
 * return streamJSON(dataGenerator());
 * ```
 */
export const streamJSON = (generator: AsyncGenerator<unknown>): Response => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			try {
				for await (const item of generator) {
					const json = `${JSON.stringify(item)}\n`;
					controller.enqueue(encoder.encode(json));
				}
			} catch (error) {
				controller.error(error);
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: { "Content-Type": "application/x-ndjson" },
	});
};

/**
 * Create a chunked text stream
 * @param chunks - Array of text chunks or async generator
 * @param contentType - Content type (default: "text/plain")
 * @param delay - Delay between chunks in milliseconds (default: 0)
 * @returns Response object with chunked stream
 * @example
 * ```ts
 * return streamText(["Hello ", "world ", "from ", "streaming!"], "text/plain", 100);
 * ```
 */
export const streamText = (
	chunks: string[] | AsyncGenerator<string>,
	contentType = "text/plain",
	delay = 0,
): Response => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			try {
				if (Array.isArray(chunks)) {
					for (const chunk of chunks) {
						controller.enqueue(encoder.encode(chunk));
						if (delay > 0) {
							await new Promise((resolve) => setTimeout(resolve, delay));
						}
					}
				} else {
					for await (const chunk of chunks) {
						controller.enqueue(encoder.encode(chunk));
						if (delay > 0) {
							await new Promise((resolve) => setTimeout(resolve, delay));
						}
					}
				}
			} catch (error) {
				controller.error(error);
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: { "Content-Type": contentType },
	});
};

/**
 * No content response (204)
 */
export const noContent = (): Response => new Response(null, { status: 204 });

/**
 * Clear response cache (for memory management)
 */
export const clearResponseCache = (): void => responseCache.clear();

/**
 * Get response cache stats
 */
export const getResponseCacheStats = () => ({
	size: responseCache.size,
	keys: Array.from(responseCache.keys()),
});

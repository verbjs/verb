/**
 * HTTP/2 utilities and performance optimizations
 */

/**
 * HTTP/2 server push configuration
 */
interface PushResource {
	/** URL path to push */
	path: string;
	/** MIME type of the resource */
	type?: string;
	/** Relationship type (preload, prefetch, etc.) */
	rel?: string;
	/** Resource importance (high, medium, low) */
	importance?: "high" | "medium" | "low";
}

/**
 * Creates an HTTP/2 server push response header
 * @param resources - Array of resources to push
 * @returns Link header value for server push
 * @example
 * ```ts
 * const linkHeader = createPushHeader([
 *   { path: "/styles.css", type: "text/css", rel: "preload" },
 *   { path: "/app.js", type: "application/javascript", rel: "preload" }
 * ]);
 *
 * return new Response(html, {
 *   headers: {
 *     "Content-Type": "text/html",
 *     "Link": linkHeader
 *   }
 * });
 * ```
 */
export const createPushHeader = (resources: PushResource[]): string => {
	return resources
		.map(({ path, type, rel = "preload", importance }) => {
			let link = `<${path}>; rel=${rel}`;
			if (type) link += `; as=${getResourceType(type)}`;
			if (importance) link += `; importance=${importance}`;
			return link;
		})
		.join(", ");
};

/**
 * Maps MIME types to HTTP/2 resource types
 * @private
 */
const getResourceType = (mimeType: string): string => {
	if (mimeType.startsWith("text/css")) return "style";
	if (
		mimeType.startsWith("application/javascript") ||
		mimeType.startsWith("text/javascript")
	)
		return "script";
	if (mimeType.startsWith("image/")) return "image";
	if (mimeType.startsWith("font/") || mimeType.includes("font")) return "font";
	if (mimeType.startsWith("audio/")) return "audio";
	if (mimeType.startsWith("video/")) return "video";
	return "fetch";
};

/**
 * Creates a response with HTTP/2 server push optimization
 * @param content - Response content
 * @param resources - Resources to push
 * @param options - Additional response options
 * @returns Response with push headers
 */
export const responseWithPush = (
	content: string | ArrayBuffer | ReadableStream,
	resources: PushResource[],
	options: ResponseInit = {},
): Response => {
	const headers = new Headers(options.headers);

	if (resources.length > 0) {
		headers.set("Link", createPushHeader(resources));
	}

	return new Response(content, {
		...options,
		headers,
	});
};

/**
 * HTTP/2 stream priority constants
 */
export const StreamPriority = {
	HIGHEST: 0,
	HIGH: 1,
	MEDIUM: 2,
	LOW: 3,
	LOWEST: 4,
} as const;

/**
 * Creates optimized headers for HTTP/2 multiplexing
 * @param priority - Stream priority
 * @param cacheControl - Cache control directive
 * @returns Headers optimized for HTTP/2
 */
export const createHttp2Headers = (
	priority: number = StreamPriority.MEDIUM,
	cacheControl?: string,
): Headers => {
	const headers = new Headers();

	// Set stream priority hint
	headers.set("Priority", `u=${priority}`);

	// Optimize for HTTP/2 compression
	headers.set("Vary", "Accept-Encoding");

	if (cacheControl) {
		headers.set("Cache-Control", cacheControl);
	}

	return headers;
};

/**
 * Middleware for HTTP/2 performance optimizations
 * @param req - Request object
 * @param next - Next middleware function
 * @returns Response with HTTP/2 optimizations
 */
export const http2Middleware = async (
	req: Request,
	next: () => Response | Promise<Response>,
): Promise<Response> => {
	const response = await next();

	// Add HTTP/2 specific headers if not present
	const headers = new Headers(response.headers);

	// Enable HTTP/2 server push hints for HTML responses
	const contentType = headers.get("Content-Type");
	if (contentType?.includes("text/html") && !headers.has("Link")) {
		// Add common resource preload hints
		const commonResources: PushResource[] = [
			{ path: "/favicon.ico", type: "image/x-icon", rel: "preload" },
		];

		if (commonResources.length > 0) {
			headers.set("Link", createPushHeader(commonResources));
		}
	}

	// Optimize caching for static assets
	const url = new URL(req.url);
	if (isStaticAsset(url.pathname)) {
		headers.set("Cache-Control", "public, max-age=31536000, immutable");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

/**
 * Checks if a path represents a static asset
 * @private
 */
const isStaticAsset = (pathname: string): boolean => {
	const staticExtensions = [
		".css",
		".js",
		".png",
		".jpg",
		".jpeg",
		".gif",
		".svg",
		".ico",
		".woff",
		".woff2",
		".ttf",
	];
	return staticExtensions.some((ext) => pathname.endsWith(ext));
};

/**
 * Creates a self-signed certificate for HTTP/2 development
 * @param domain - Domain name for the certificate
 * @returns Promise that generates certificate files
 */
export const generateDevCert = async (
	domain = "localhost",
): Promise<{
	cert: string;
	key: string;
}> => {
	// This would typically use a library like node-forge or call openssl
	// For now, we'll provide instructions
	const instructions = `
To generate a self-signed certificate for HTTP/2 development, run:

openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=${domain}"

Then use the generated files:
{
  http2: true,
  tls: {
    cert: "./cert.pem",
    key: "./key.pem"
  }
}
  `.trim();

	throw new Error(instructions);
};

/**
 * HTTP/2 connection preface validator
 * @param data - Raw connection data
 * @returns True if valid HTTP/2 connection preface
 */
export const isHttp2Preface = (data: Uint8Array): boolean => {
	const preface = new TextEncoder().encode("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

	if (data.length < preface.length) return false;

	for (let i = 0; i < preface.length; i++) {
		if (data[i] !== preface[i]) return false;
	}

	return true;
};

import { serve } from "bun";

import type { Handler, Method, Middleware } from "../types.ts";

import {
	type RouterConfig,
	RouterType,
	type UniversalRouter,
	createUniversalRouter,
	defaultRouterConfig,
} from "../routers/index.ts";

import { getCached, setCached } from "../cache.ts";

import { type MountableApp, mountApp } from "../mount.ts";
import {
	type Plugin,
	PluginManager,
	type PluginRegistrationOptions,
} from "../plugin.ts";
import { notFound } from "../response.ts";

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
			if (type) {
				link += `; as=${getResourceType(type)}`;
			}
			if (importance) {
				link += `; importance=${importance}`;
			}
			return link;
		})
		.join(", ");
};

/**
 * Maps MIME types to HTTP/2 resource types
 * @private
 */
const getResourceType = (mimeType: string): string => {
	if (mimeType.startsWith("text/css")) {
		return "style";
	}
	if (
		mimeType.startsWith("application/javascript") ||
		mimeType.startsWith("text/javascript")
	) {
		return "script";
	}
	if (mimeType.startsWith("image/")) {
		return "image";
	}
	if (mimeType.startsWith("font/") || mimeType.includes("font")) {
		return "font";
	}
	if (mimeType.startsWith("audio/")) {
		return "audio";
	}
	if (mimeType.startsWith("video/")) {
		return "video";
	}
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

	if (data.length < preface.length) {
		return false;
	}

	for (let i = 0; i < preface.length; i++) {
		if (data[i] !== preface[i]) {
			return false;
		}
	}

	return true;
};

/**
 * TLS configuration for HTTP/2 support
 */
interface TLSOptions {
	/** Path to the certificate file */
	cert?: string | Buffer;
	/** Path to the private key file */
	key?: string | Buffer;
	/** Certificate authority bundle */
	ca?: string | Buffer;
	/** Server name indication */
	servername?: string;
	/** Passphrase for the private key */
	passphrase?: string;
}

/**
 * HTTP/2 Server configuration options
 */
interface Http2ServerOptions {
	/** Port to listen on (default: 3443) */
	port?: number;
	/** Hostname to bind to (default: "0.0.0.0") */
	hostname?: string;
	/** Maximum request body size in bytes (default: 10MB) */
	maxRequestBodySize?: number;
	/** TLS configuration (required for HTTP/2) */
	tls: TLSOptions;
	/** Development mode (allows self-signed certificates) */
	development?: boolean;
	/** Router configuration */
	router?: RouterConfig;
}

/**
 * Creates a high-performance HTTP/2 server with routing and middleware support
 * @param options - HTTP/2 Server configuration options
 * @returns Server instance with route registration methods
 * @example
 * ```ts
 * // HTTP/2 server with TLS
 * const app = createHttp2Server({
 *   port: 3443,
 *   tls: {
 *     cert: "./cert.pem",
 *     key: "./key.pem"
 *   }
 * });
 *
 * app.get("/", () => text("Hello HTTP/2!"));
 * app.post("/users", async (req) => {
 *   const body = await parseBody(req);
 *   return json(body, 201);
 * });
 *
 * app.use(async (req, next) => {
 *   console.log(`${req.method} ${req.url}`);
 *   return next();
 * });
 * ```
 */
export const createHttp2Server = (options: Http2ServerOptions) => {
	const {
		port = 3443,
		hostname = "0.0.0.0",
		maxRequestBodySize = 10 * 1024 * 1024, // 10MB
		tls,
		development = false,
		router: routerConfig = defaultRouterConfig,
	} = options;

	if (!tls) {
		throw new Error(
			"HTTP/2 requires TLS configuration. Please provide tls options with cert and key.",
		);
	}

	const router = createUniversalRouter(
		routerConfig.type ?? RouterType.MANUAL,
		routerConfig.options,
	);
	const pluginManager = new PluginManager(null, router.state); // Will be updated with server instance

	/**
	 * Optimized HTTP/2 request handler with route caching
	 * @private
	 */
	const fetch = async (req: Request): Promise<Response> => {
		// For filesystem router, use direct handling (no caching)
		if (router.type === RouterType.FILESYSTEM) {
			return router.handleRequest(req);
		}

		// For manual router, use caching optimization
		const url = new URL(req.url);
		const cacheKey = `${req.method}:${url.pathname}`;

		// Try cache first
		const cached = getCached(cacheKey);
		if (cached && router.findRoute) {
			// Execute middleware chain for cached routes
			let index = 0;
			const next = async (): Promise<Response> => {
				if (index < router.state.middlewares.length) {
					const middleware = router.state.middlewares[index++];
					return middleware(req, next);
				}
				return cached.handler(req, cached.params);
			};
			return next();
		}

		// Find route
		const method = req.method as Method;
		const match = router.findRoute?.(method, url.pathname);

		if (!match) {
			return notFound();
		}

		// Cache the route (only for manual router)
		setCached(cacheKey, match.route.handler, match.params);

		// Handle request with middleware
		return router.handleRequest(req);
	};

	// Configure HTTP/2 server with TLS
	const serverConfig: {
		port?: number;
		hostname?: string;
		fetch: (req: Request) => Response | Promise<Response>;
		development?: boolean;
		maxRequestBodySize?: number;
		tls?: {
			cert: string;
			key: string;
		};
		routes?: Record<string, unknown>;
	} = {
		port,
		hostname,
		fetch,
		development: development,
		maxRequestBodySize,
		tls,
		routes: {}, // Empty routes object since we use our own router
	};

	const server = serve(serverConfig);

	console.log(
		`HTTP/2 server running at https://${hostname}:${port} (HTTP/2 enabled)`,
	);

	// Create server instance with plugin support
	const serverInstance = {
		/** Bun server instance */
		server,
		/** Router type being used */
		routerType: router.type,
		/** Register GET route (only for manual router) */
		get: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "GET", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Register POST route (only for manual router) */
		post: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "POST", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Register PUT route (only for manual router) */
		put: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "PUT", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Register DELETE route (only for manual router) */
		delete: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "DELETE", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Register PATCH route (only for manual router) */
		patch: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "PATCH", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Register HEAD route (only for manual router) */
		head: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "HEAD", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Register OPTIONS route (only for manual router) */
		options: (path: string, handler: Handler) => {
			if (router.type === RouterType.MANUAL) {
				const { addRoute } = require("../routers/manual.ts");
				return addRoute(router.state, "OPTIONS", path, handler);
			}
			throw new Error(
				`Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
			);
		},
		/** Add middleware to the stack */
		use: (middleware: Middleware) => router.addMiddleware(middleware),
		/** Mount a sub-application at a base path (only for manual router) */
		mount: (basePath: string, app: MountableApp) => {
			if (router.type === RouterType.MANUAL) {
				return mountApp(router.state, basePath, app);
			}
			throw new Error(`App mounting not supported for ${router.type} router.`);
		},
		/** Router instance (for advanced usage) */
		router: router.state,
		/** Universal router wrapper */
		universalRouter: router,
		/** Plugin manager instance */
		plugins: pluginManager,
		/** Register a plugin */
		register: (plugin: Plugin, options?: PluginRegistrationOptions) =>
			pluginManager.register(plugin, options),
		/** Start the plugin manager (automatically called) */
		startPlugins: () => pluginManager.start(),
		/** Stop the plugin manager */
		stopPlugins: () => pluginManager.stop(),
	};

	// Update plugin manager with server instance
	// Add server property to plugin manager
	(pluginManager as unknown as { server: unknown }).server = serverInstance;

	// Public API
	return serverInstance;
};

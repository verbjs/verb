import { serve } from "bun";

import type { Handler, Middleware, Method } from "./types.ts";

import {
	createRouter,
	addRoute,
	addMiddleware,
	findRoute,
	handleRequest,
} from "./router.ts";

import { getCached, setCached } from "./cache.ts";

import { notFound } from "./response.ts";
import { mountApp, type MountableApp } from "./mount.ts";
import {
	PluginManager,
	type Plugin,
	type PluginRegistrationOptions,
} from "./plugin.ts";

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
 * Server configuration options
 */
interface ServerOptions {
	/** Port to listen on (default: 3000) */
	port?: number;
	/** Hostname to bind to (default: "0.0.0.0") */
	hostname?: string;
	/** Maximum request body size in bytes (default: 10MB) */
	maxRequestBodySize?: number;
	/** Enable HTTP/2 support (requires TLS) */
	http2?: boolean;
	/** TLS configuration for HTTPS/HTTP2 */
	tls?: TLSOptions;
	/** Development mode (allows self-signed certificates) */
	development?: boolean;
}

/**
 * Creates a high-performance HTTP server with routing and middleware support
 * @param options - Server configuration options
 * @returns Server instance with route registration methods
 * @example
 * ```ts
 * // HTTP/1.1 server
 * const app = createServer({ port: 3000 });
 *
 * // HTTP/2 server with TLS
 * const app2 = createServer({
 *   port: 3443,
 *   http2: true,
 *   tls: {
 *     cert: "./cert.pem",
 *     key: "./key.pem"
 *   }
 * });
 *
 * app.get("/", () => text("Hello World"));
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
export const createServer = (options?: ServerOptions) => {
	const {
		port = 3000,
		hostname = "0.0.0.0",
		maxRequestBodySize = 10 * 1024 * 1024, // 10MB
		http2 = false,
		tls,
		development = false,
	} = options || {};

	const router = createRouter();
	const pluginManager = new PluginManager(null, router); // Will be updated with server instance

	/**
	 * Optimized request handler with route caching
	 * @private
	 */
	const fetch = async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const cacheKey = `${req.method}:${url.pathname}`;

		// Try cache first
		const cached = getCached(cacheKey);
		if (cached) {
			// Execute middleware chain for cached routes
			let index = 0;
			const next = async (): Promise<Response> => {
				if (index < router.middlewares.length) {
					const middleware = router.middlewares[index++];
					return middleware(req, next);
				}
				return cached.handler(req, cached.params);
			};
			return next();
		}

		// Find route
		const method = req.method as Method;
		const match = findRoute(router, method, url.pathname);

		if (!match) return notFound();

		// Cache the route
		setCached(cacheKey, match.route.handler, match.params);

		// Handle request with middleware
		return handleRequest(router, req);
	};

	// Configure server options with HTTP/2 support
	const serverConfig: any = {
		port,
		hostname,
		fetch,
		development: development,
		maxRequestBodySize,
		routes: {}, // Empty routes object since we use our own router
	};

	// Add TLS configuration for HTTP/2
	if (http2 && tls) {
		serverConfig.tls = tls;
	} else if (http2) {
		throw new Error(
			"HTTP/2 requires TLS configuration. Please provide both http2: true and tls options.",
		);
	}

	const server = serve(serverConfig);

	const protocol = http2 && tls ? "https" : "http";
	const http2Status = http2 ? " (HTTP/2 enabled)" : "";
	console.log(
		`Server running at ${protocol}://${hostname}:${port}${http2Status}`,
	);

	// Create server instance with plugin support
	const serverInstance = {
		/** Bun server instance */
		server,
		/** Register GET route */
		get: (path: string, handler: Handler) =>
			addRoute(router, "GET", path, handler),
		/** Register POST route */
		post: (path: string, handler: Handler) =>
			addRoute(router, "POST", path, handler),
		/** Register PUT route */
		put: (path: string, handler: Handler) =>
			addRoute(router, "PUT", path, handler),
		/** Register DELETE route */
		delete: (path: string, handler: Handler) =>
			addRoute(router, "DELETE", path, handler),
		/** Register PATCH route */
		patch: (path: string, handler: Handler) =>
			addRoute(router, "PATCH", path, handler),
		/** Register HEAD route */
		head: (path: string, handler: Handler) =>
			addRoute(router, "HEAD", path, handler),
		/** Register OPTIONS route */
		options: (path: string, handler: Handler) =>
			addRoute(router, "OPTIONS", path, handler),
		/** Add middleware to the stack */
		use: (middleware: Middleware) => addMiddleware(router, middleware),
		/** Mount a sub-application at a base path */
		mount: (basePath: string, app: MountableApp) =>
			mountApp(router, basePath, app),
		/** Router instance (for advanced usage) */
		router,
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

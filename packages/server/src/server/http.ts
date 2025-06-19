import { serve } from "bun";

import type { Handler, Method, Middleware } from "../types.ts";

import {
  type RouterConfig,
  RouterType,
  createUniversalRouter,
  defaultRouterConfig,
} from "../routers/index.ts";

import { getCached, setCached } from "../cache.ts";

import type { MountableApp } from "../mount.ts";
import { type Plugin, PluginManager, type PluginRegistrationOptions } from "../plugin.ts";
import { notFound } from "../response.ts";

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
  /** Router configuration */
  router?: RouterConfig;
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
    router: routerConfig = defaultRouterConfig,
  } = options || {};

  const router = createUniversalRouter(
    routerConfig.type ?? RouterType.MANUAL,
    routerConfig.options,
  );
  const pluginManager = new PluginManager(null, router.state); // Will be updated with server instance

  /**
   * Optimized request handler with improved route caching
   * @private
   */
  const fetch = async (req: Request): Promise<Response> => {
    // For filesystem router, use direct handling (no caching)
    if (router.type === RouterType.FILESYSTEM) {
      return router.handleRequest(req);
    }

    // For manual router, use enhanced caching optimization
    const url = new URL(req.url);
    const method = req.method as Method;

    // Create a more specific cache key that includes query parameters for APIs that rely on them
    // This is more accurate for APIs that use query parameters heavily
    const hasQueryParams = url.search.length > 0;
    const cacheKey = hasQueryParams
      ? `${method}:${url.pathname}:${url.search}`
      : `${method}:${url.pathname}`;

    // Try cache first for better performance
    const cached = getCached(cacheKey);
    if (cached) {
      // Get middleware count for optimization
      const middlewareCount = router.state.middlewares.length;

      // If no middleware, execute handler directly (fast path)
      if (middlewareCount === 0) {
        return cached.handler(req, cached.params);
      }

      // Execute middleware chain with optimized recursion
      let index = 0;

      // Use a named function for better performance and stack traces
      const executeMiddleware = async (): Promise<Response> => {
        // Check if we've reached the end of middleware chain
        if (index < middlewareCount) {
          const middleware = router.state.middlewares[index++];
          return middleware(req, executeMiddleware);
        }
        // Execute the cached handler with params
        return cached.handler(req, cached.params);
      };

      return executeMiddleware();
    }

    // Find route using the optimized radix tree
    const match = router.findRoute?.(method, url.pathname);
    if (!match) {
      return notFound();
    }

    // Cache the route for future requests
    setCached(cacheKey, match.route.handler, match.params);

    // Handle request with middleware
    return router.handleRequest(req);
  };

  // Configure server options with HTTP/2 support
  const serverConfig: {
    port?: number;
    hostname?: string;
    fetch: (req: Request) => Response | Promise<Response>;
    development?: boolean;
    maxRequestBodySize?: number;
    routes?: Record<string, unknown>;
  } = {
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
  console.log(`Server running at ${protocol}://${hostname}:${port}${http2Status}`);

  /**
   * Creates a method handler for HTTP methods
   * @param method HTTP method to create handler for
   * @returns A function that registers a route for the specified method
   */
  const createMethodHandler = (method: Method) => (path: string, handler: Handler) => {
    if (router.type === RouterType.MANUAL) {
      // Use dynamic import for better performance and code splitting
      return import("../routers/manual.ts").then(({ addRoute }) =>
        addRoute(router.state, method, path, handler),
      );
    }
    throw new Error(
      `Route registration not supported for ${router.type} router. Use filesystem routes instead.`,
    );
  };

  // Create server instance with plugin support
  const serverInstance = {
    /** Bun server instance */
    server,
    /** Router type being used */
    routerType: router.type,
    /** Register GET route (only for manual router) */
    get: createMethodHandler("GET"),
    /** Register POST route (only for manual router) */
    post: createMethodHandler("POST"),
    /** Register PUT route (only for manual router) */
    put: createMethodHandler("PUT"),
    /** Register DELETE route (only for manual router) */
    delete: createMethodHandler("DELETE"),
    /** Register PATCH route (only for manual router) */
    patch: createMethodHandler("PATCH"),
    /** Register HEAD route (only for manual router) */
    head: createMethodHandler("HEAD"),
    /** Register OPTIONS route (only for manual router) */
    options: createMethodHandler("OPTIONS"),
    /** Add middleware to the stack */
    use: (middleware: Middleware) => router.addMiddleware(middleware),
    /** Mount a sub-application at a base path (only for manual router) */
    mount: (basePath: string, app: MountableApp) => {
      if (router.type === RouterType.MANUAL) {
        // Use dynamic import for better performance and code splitting
        return import("../mount.ts").then(({ mountApp }) => mountApp(router.state, basePath, app));
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

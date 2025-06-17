import { type MountableApp, mountApp } from "./mount.ts";
import { type Plugin, PluginManager, type PluginRegistrationOptions } from "./plugin.ts";
import { addMiddleware, addRoute, createRouter, handleRequest } from "./routers/manual.ts";
// mock.ts - Mock server for testing
import type { Handler, Middleware } from "./types.ts";

/**
 * Configuration options for mock server
 */
interface MockServerOptions {
  /** Base URL for requests (default: "http://localhost:3000") */
  baseUrl?: string;
}

/**
 * Creates a mock server for testing without network overhead
 * @param options - Mock server configuration options
 * @returns Mock server instance with testing utilities
 * @example
 * ```ts
 * const app = createMockServer();
 *
 * app.get("/users/:id", (req, params) => json({ id: params.id }));
 *
 * const res = await app.request.get("/users/123");
 * expect(res.status).toBe(200);
 * expect(await res.json()).toEqual({ id: "123" });
 * ```
 */
export const createMockServer = (options?: MockServerOptions) => {
  const { baseUrl = "http://localhost:3000" } = options || {};
  const router = createRouter();
  let pluginManager: PluginManager; // Will be initialized after server instance is created

  /**
   * Makes a mock request to the server
   * @param path - Request path
   * @param options - Fetch options
   * @returns Response object
   */
  const mockRequest = async (path: string, options?: RequestInit): Promise<Response> => {
    const url = `${baseUrl}${path}`;
    const req = new Request(url, options);
    return handleRequest(router, req);
  };

  /**
   * Makes a GET request
   * @param path - Request path
   * @param init - Additional request options
   */
  const get = (path: string, init?: RequestInit) => mockRequest(path, { ...init, method: "GET" });

  /**
   * Makes a POST request with automatic JSON serialization
   * @param path - Request path
   * @param body - Request body (will be JSON stringified if object)
   * @param init - Additional request options
   */
  const post = (path: string, body?: unknown, init?: RequestInit) =>
    mockRequest(path, {
      ...init,
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
        ...init?.headers,
      },
    });

  /**
   * Makes a PUT request with automatic JSON serialization
   * @param path - Request path
   * @param body - Request body (will be JSON stringified if object)
   * @param init - Additional request options
   */
  const put = (path: string, body?: unknown, init?: RequestInit) =>
    mockRequest(path, {
      ...init,
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
        ...init?.headers,
      },
    });

  /**
   * Makes a DELETE request
   * @param path - Request path
   * @param init - Additional request options
   */
  const del = (path: string, init?: RequestInit) =>
    mockRequest(path, { ...init, method: "DELETE" });

  /**
   * Makes a PATCH request with automatic JSON serialization
   * @param path - Request path
   * @param body - Request body (will be JSON stringified if object)
   * @param init - Additional request options
   */
  const patch = (path: string, body?: unknown, init?: RequestInit) =>
    mockRequest(path, {
      ...init,
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
        ...init?.headers,
      },
    });

  // Create server instance with plugin support
  const serverInstance = {
    /** Register GET route */
    get: (path: string, handler: Handler) => addRoute(router, "GET", path, handler),
    /** Register POST route */
    post: (path: string, handler: Handler) => addRoute(router, "POST", path, handler),
    /** Register PUT route */
    put: (path: string, handler: Handler) => addRoute(router, "PUT", path, handler),
    /** Register DELETE route */
    delete: (path: string, handler: Handler) => addRoute(router, "DELETE", path, handler),
    /** Register PATCH route */
    patch: (path: string, handler: Handler) => addRoute(router, "PATCH", path, handler),
    /** Register HEAD route */
    head: (path: string, handler: Handler) => addRoute(router, "HEAD", path, handler),
    /** Register OPTIONS route */
    options: (path: string, handler: Handler) => addRoute(router, "OPTIONS", path, handler),
    /** Add middleware to the stack */
    use: (middleware: Middleware) => addMiddleware(router, middleware),
    /** Mount a sub-application at a base path */
    mount: (basePath: string, app: MountableApp) => mountApp(router, basePath, app),

    /** Test request methods */
    request: {
      /** Make GET request */
      get,
      /** Make POST request */
      post,
      /** Make PUT request */
      put,
      /** Make DELETE request */
      delete: del,
      /** Make PATCH request */
      patch,
      /** Make raw request with full control */
      raw: mockRequest,
    },

    /** Direct access to router for testing */
    router,
    /** Plugin manager instance */
    plugins: pluginManager,
    /** Register a plugin */
    register: (plugin: Plugin, options?: PluginRegistrationOptions) =>
      pluginManager.register(plugin, options),
    /** Start the plugin manager */
    startPlugins: () => pluginManager.start(),
    /** Stop the plugin manager */
    stopPlugins: () => pluginManager.stop(),
  };

  // Initialize plugin manager with server instance
  pluginManager = new PluginManager(serverInstance, router);

  // Update the server instance with the plugin manager
  // Add plugins property to server instance
  (serverInstance as unknown as { plugins: PluginManager }).plugins = pluginManager;

  return serverInstance;
};

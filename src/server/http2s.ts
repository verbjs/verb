import { enhanceRequest } from "../request";
import { createResponse } from "../response";

// Bun-specific types
type BunFile = any;
import type { RouteInstance } from "../router";
import { createRouter } from "../router";
import type {
  Handler,
  ListenOptions,
  Method,
  Middleware,
  MiddlewareHandler,
  Request,
  Response,
  RouteConfig,
  ServerInstance,
} from "../types";
import { parseFormData } from "../upload";
import { parseQuery } from "../utils";

export type Http2sOptions = {
  cert: string | ArrayBuffer | BunFile;
  key: string | ArrayBuffer | BunFile;
  passphrase?: string;
  ca?: string | ArrayBuffer | BunFile;
  dhParamsFile?: string;
  lowMemoryMode?: boolean;
  secureOptions?: number;
};

export type Http2sServerInstance = ServerInstance & {
  withTLS: (options: Http2sOptions) => Http2sServerInstance;
};

export const createHttp2sServer = (): Http2sServerInstance => {
  const router = createRouter();
  const globalMiddlewares: Middleware[] = [];
  const pathMiddlewares: Map<string, Middleware[]> = new Map();
  let htmlRoutes: RouteConfig | null = null;
  let serverOptions: ListenOptions | null = null;
  let tlsOptions: Http2sOptions | null = null;

  const addRoute = (method: Method, path: string, middlewares: Middleware[], handler: Handler) => {
    router.addRoute(method, path, middlewares, handler);
  };

  const use = (pathOrMiddleware: string | Middleware, ...middlewares: Middleware[]) => {
    if (typeof pathOrMiddleware === "string") {
      // Path-specific middleware: app.use('/api', middleware1, middleware2)
      const path = pathOrMiddleware;

      // Check if any middleware is actually a router (has a stack property)
      const processedMiddlewares: Middleware[] = [];

      for (const middleware of middlewares) {
        if (
          middleware != null &&
          typeof middleware === "object" &&
          "stack" in (middleware as any) &&
          (middleware as any).stack != null
        ) {
          // This is a router - create middleware that handles router mounting
          const routerInstance = middleware as any;
          const routerMiddleware: Middleware = async (req, res, next) => {
            const url = new URL(req.url);
            const requestPath = url.pathname;

            // Check if request path starts with mount path
            if (!requestPath.startsWith(path)) {
              return next();
            }

            // Strip mount path from request path for router matching
            const subPath = requestPath.slice(path.length) || "/";
            const method = req.method as Method;

            // Try to match route in the mounted router
            let matchFound = false;

            for (const layer of routerInstance.stack) {
              if (layer.method !== "USE" && layer.method !== method) {
                continue;
              }

              const testPath = subPath;
              const match = testPath.match(layer.regexp);

              if (match) {
                matchFound = true;

                // Extract parameters
                const params: Record<string, string> = {};
                for (let i = 0; i < layer.keys.length; i++) {
                  params[layer.keys[i]] = decodeURIComponent(match[i + 1] || "");
                }

                // Merge with existing params
                (req as any).params = { ...(req as any).params, ...params };

                // Execute router handlers
                for (const handler of layer.handlers) {
                  await handler(req, res, () => {});
                }
                return;
              }
            }

            // If no route matched in router, continue to next middleware
            if (!matchFound) {
              next();
            }
          };
          processedMiddlewares.push(routerMiddleware);
        } else {
          processedMiddlewares.push(middleware);
        }
      }

      const existing = pathMiddlewares.get(path) || [];
      pathMiddlewares.set(path, [...existing, ...processedMiddlewares]);
    } else {
      // Global middleware: app.use(middleware)
      globalMiddlewares.push(pathOrMiddleware);
    }
  };

  const withRoutes = (routes: RouteConfig) => {
    htmlRoutes = routes;
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const withTLS = (options: Http2sOptions): Http2sServerInstance => {
    tlsOptions = options;
    return http2sServer;
  };

  const logRoutes = () => {
    console.log("\n📋 HTTP/2 Secure Server Routes:");
    console.log("=================================");

    // Get routes from our router
    const routeEntries = router.getRoutes();

    if (routeEntries.length === 0 && !htmlRoutes) {
      console.log("  No routes registered");
      return;
    }

    // Show traditional routes
    if (routeEntries.length > 0) {
      console.log("  Traditional Routes:");
      routeEntries.forEach((route) => {
        const params =
          route.params && route.params.length > 0 ? ` (params: ${route.params.join(", ")})` : "";
        console.log(`    ${route.method.padEnd(7)} ${route.path}${params}`);
      });
    }

    // Show HTML routes
    if (htmlRoutes) {
      console.log("  HTML Routes:");
      Object.keys(htmlRoutes).forEach((path) => {
        const route = htmlRoutes ? htmlRoutes[path] : undefined;
        if (typeof route === "object" && route.constructor === Object) {
          // It's a route object with methods
          Object.keys(route).forEach((method) => {
            console.log(`    ${method.padEnd(7)} ${path} (HTML route)`);
          });
        } else {
          // It's a direct HTML import
          console.log(`    GET     ${path} (HTML import)`);
        }
      });
    }

    console.log("");
  };

  // Helper to separate middlewares from handler
  const parseHandlers = (
    ...handlers: MiddlewareHandler[]
  ): { middlewares: Middleware[]; handler: Handler } => {
    const handler = handlers[handlers.length - 1] as Handler;
    const middlewares = handlers.slice(0, -1) as Middleware[];
    return { middlewares, handler };
  };

  const get = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("GET", p, middlewares, handler));
  };
  const post = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("POST", p, middlewares, handler));
  };
  const put = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("PUT", p, middlewares, handler));
  };
  const del = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("DELETE", p, middlewares, handler));
  };
  const patch = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("PATCH", p, middlewares, handler));
  };
  const head = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("HEAD", p, middlewares, handler));
  };
  const options = (path: string | string[], ...handlers: MiddlewareHandler[]) => {
    const { middlewares, handler } = parseHandlers(...handlers);
    const paths = Array.isArray(path) ? path : [path];
    paths.forEach((p) => addRoute("OPTIONS", p, middlewares, handler));
  };

  // Express.js style route method
  const route = (path: string): RouteInstance => {
    const routeInstance: Partial<RouteInstance> = {};

    const httpMethods = ["get", "post", "put", "delete", "patch", "head", "options"] as const;

    httpMethods.forEach((method) => {
      (routeInstance as any)[method] = (...handlers: MiddlewareHandler[]): RouteInstance => {
        const { middlewares, handler } = parseHandlers(...handlers);
        addRoute(method.toUpperCase() as Method, path, middlewares, handler);
        return routeInstance as RouteInstance;
      };
    });

    // All method - matches any HTTP method
    routeInstance.all = (...handlers: MiddlewareHandler[]): RouteInstance => {
      const { middlewares, handler } = parseHandlers(...handlers);
      httpMethods.forEach((method) => {
        addRoute(method.toUpperCase() as Method, path, middlewares, handler);
      });
      return routeInstance as RouteInstance;
    };

    return routeInstance as RouteInstance;
  };

  // Execute middleware pipeline
  const executeMiddlewares = async (
    middlewares: Middleware[],
    req: Request,
    res: Response,
  ): Promise<boolean> => {
    const _index = 0;
    let nextCalled = false;

    const next = () => {
      nextCalled = true;
    };

    for (const middleware of middlewares) {
      nextCalled = false;
      try {
        await middleware(req, res, next);
        if (!nextCalled) {
          // Middleware didn't call next(), stop pipeline
          return false;
        }
      } catch (error) {
        console.error("Middleware error:", error);
        throw error;
      }
    }
    return true;
  };

  const createFetchHandler =
    (): ((req: Request) => Promise<Response>) => async (req: Request) => {
      const url = req.url;
      const method = req.method as Method;

      // Enhance request with all additional properties
      const extendedReq = enhanceRequest(req);

      // Add query parsing
      extendedReq.query = parseQuery(url);

      // Add formData helper for multipart/form-data requests
      if (req.headers.get("content-type")?.includes("multipart/form-data")) {
        (extendedReq as any).formData = () => parseFormData(req);
      }

      // Get path from enhanced request
      const path = extendedReq.path || "/";

      try {
        const { res, getResponse } = createResponse();

        // Collect all middlewares to execute
        const middlewaresToExecute: Middleware[] = [];

        // 1. Global middlewares
        middlewaresToExecute.push(...globalMiddlewares);

        // 2. Path-specific middlewares (check if request path starts with middleware path)
        for (const [middlewarePath, middlewares] of Array.from(pathMiddlewares)) {
          if (path === middlewarePath || path.startsWith(`${middlewarePath}/`)) {
            middlewaresToExecute.push(...middlewares);
          }
        }

        // Execute middleware pipeline first
        const shouldContinue = await executeMiddlewares(middlewaresToExecute, extendedReq, res);

        if (!shouldContinue) {
          // Middleware stopped the pipeline
          return await getResponse();
        }

        // Try to match route
        const matchResult = router.match(method, path);
        if (!matchResult) {
          return new Response("Not Found", { status: 404 });
        }

        // Add route params and route-specific middlewares
        extendedReq.params = matchResult.params || {};

        // Execute route-specific middlewares
        const routeMiddlewareContinue = await executeMiddlewares(
          matchResult.middlewares,
          extendedReq,
          res,
        );

        if (routeMiddlewareContinue) {
          // All middlewares passed, execute the handler
          await matchResult.handler(extendedReq, res);
        }

        return await getResponse();
      } catch (error) {
        console.error("Handler error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    };

  const listen = (port?: number, hostname?: string) => {
    if (!tlsOptions) {
      throw new Error("HTTP/2 Secure server requires TLS options. Use withTLS() to configure.");
    }

    // Use stored options, or create default config
    const finalPort = port ?? serverOptions?.port ?? 3000;
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    const config: any = {
      port: finalPort,
      hostname: finalHostname,
      // Enable HTTP/2 with TLS
      h2: true,
      tls: tlsOptions,
    };

    // If HTML routes are set, use Bun's native routes feature
    if (htmlRoutes) {
      config.routes = htmlRoutes;
    } else {
      // Otherwise use our custom fetch handler
      config.fetch = createFetchHandler();
    }

    // Apply development options if set
    if (serverOptions?.development) {
      config.development = serverOptions.development;
    }

    const server = Bun.serve(config);

    // Show routes if enabled
    if (serverOptions?.showRoutes) {
      logRoutes();
    }

    return server;
  };

  const http2sServer: Http2sServerInstance = {
    get,
    post,
    put,
    delete: del,
    patch,
    head,
    options,
    use,
    route,
    withRoutes,
    withOptions,
    listen,
    // Expose for testing
    createFetchHandler,
    // Expose router for introspection
    router,
    // HTTP/2 Secure-specific methods
    withTLS,
  };

  return http2sServer;
};
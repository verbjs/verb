import type { Method, Handler, Middleware } from "../types";
import { pathToRegex, isDynamicRoute, extractParams } from "./pattern";
import type { CoreRouterInstance } from "./types";

/**
 * Core internal router for high-performance routing
 * Used by the main Verb server for direct route handling
 */
export const createCoreRouter = (): CoreRouterInstance => {
  const staticRoutes = new Map<string, { handler: Handler; middlewares: Middleware[] }>();
  const dynamicRoutes: { pattern: RegExp; handler: Handler; middlewares: Middleware[]; keys: string[] }[] = [];
  const allRoutes: { method: Method; path: string; handler: Handler; middlewares: Middleware[]; params?: string[] }[] = [];

  const addRoute = (method: Method, path: string, middlewares: Middleware[], handler: Handler) => {
    const routeKey = `${method}:${path}`;

    // Store route info for logging
    const paramKeys = extractParams(path);
    allRoutes.push({ method, path, handler, middlewares, params: paramKeys });

    if (isDynamicRoute(path)) {
      const { pattern, keys } = pathToRegex(path, method);
      dynamicRoutes.push({
        pattern,
        handler,
        middlewares,
        keys,
      });
    } else {
      staticRoutes.set(routeKey, { handler, middlewares });
    }
  };

  const match = (
    method: Method,
    path: string,
  ): { handler: Handler; middlewares: Middleware[]; params?: Record<string, string> } | null => {
    const routeKey = `${method}:${path}`;

    // Check static routes first (fastest)
    const staticRoute = staticRoutes.get(routeKey);
    if (staticRoute) {
      return { handler: staticRoute.handler, middlewares: staticRoute.middlewares };
    }

    // Check dynamic routes
    const testKey = `${method}:${path}`;
    for (const route of dynamicRoutes) {
      const matchResult = testKey.match(route.pattern);
      if (matchResult) {
        const params: Record<string, string> = {};
        for (let i = 0; i < route.keys.length; i++) {
          const key = route.keys[i];
          if (key) {
            params[key] = matchResult[i + 1] || '';
          }
        }
        return { handler: route.handler, middlewares: route.middlewares, params };
      }
    }

    return null;
  };

  const getRoutes = () => {
    return allRoutes;
  };

  return {
    addRoute,
    match,
    getRoutes,
  };
};
import type { Method, MiddlewareHandler } from "../types";
import { advancedPathToRegex } from "./pattern";

import type { 
  RouterOptions, 
  VerbRouterInstance, 
  RouteInstance, 
  ParamHandler, 
  RouteLayer 
} from "./types";

export { createCoreRouter as createRouter } from "./core";

export { 
  pathToRegex, 
  advancedPathToRegex, 
  isDynamicRoute, 
  extractParams 
} from "./pattern";

export type {
  RouterOptions,
  VerbRouterInstance as RouterInstance,
  RouteInstance,
  ParamHandler,
  RouteLayer,
  CoreRouterInstance
} from "./types";

export type { PatternResult, AdvancedPatternResult } from "./pattern";

/**
 * Advanced modular router for organizing routes
 * Main Router factory function for Verb
 */
export const Router = (options: RouterOptions = {}): VerbRouterInstance => {
  const {
    caseSensitive = false,
    mergeParams = false,
    strict = false
  } = options;

  const stack: RouteLayer[] = [];
  const paramHandlers: Record<string, ParamHandler> = {};

  // Helper function to normalize handlers
  const normalizeHandlers = (handlers: MiddlewareHandler[]): MiddlewareHandler[] => {
    return handlers.filter(h => typeof h === 'function');
  };

  // Helper function to add route to stack
  const addLayer = (path: string, method: Method | 'USE' | 'PARAM', handlers: MiddlewareHandler[], route?: RouteInstance) => {
    const { regexp, keys } = advancedPathToRegex(path, method, { caseSensitive, strict });
    
    const layer: RouteLayer = {
      path: method === 'USE' ? path : undefined,
      method,
      regexp,
      keys,
      handlers: normalizeHandlers(handlers),
      paramHandlers: Object.keys(paramHandlers).length > 0 ? { ...paramHandlers } : undefined,
      route
    };

    stack.push(layer);
  };

  // HTTP method handlers
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

  const router: Partial<VerbRouterInstance> = {
    stack,
    mergeParams,
    caseSensitive,
    strict
  };

  // Add HTTP method functions with support for route arrays
  httpMethods.forEach(method => {
    (router as any)[method] = (path: string | string[], ...handlers: MiddlewareHandler[]): VerbRouterInstance => {
      if (handlers.length === 0) {
        throw new Error(`Router.${method}() requires at least one handler`);
      }
      
      // Handle route arrays: multiple paths for same handler
      const paths = Array.isArray(path) ? path : [path];
      paths.forEach(p => {
        addLayer(p, method.toUpperCase() as Method, handlers);
      });
      
      return router as VerbRouterInstance;
    };
  });

  // Use middleware function
  router.use = (pathOrMiddleware: string | MiddlewareHandler, ...handlers: MiddlewareHandler[]): VerbRouterInstance => {
    let path = '/';
    let middlewares: MiddlewareHandler[];

    if (typeof pathOrMiddleware === 'string') {
      path = pathOrMiddleware;
      middlewares = handlers;
    } else {
      middlewares = [pathOrMiddleware, ...handlers];
    }

    if (middlewares.length === 0) {
      throw new Error('Router.use() requires at least one middleware function');
    }

    // Check if any middleware is actually a router
    middlewares.forEach((middleware) => {
      if (middleware != null && typeof middleware === 'object' && 'stack' in (middleware as any) && (middleware as any).stack != null) {
        const routerMiddleware = middleware as any;
        const layer: RouteLayer = {
          path,
          method: 'USE',
          regexp: advancedPathToRegex(path, 'USE', { caseSensitive, strict }).regexp,
          keys: [],
          handlers: [],
          isRouter: true
        };
        (layer as any).router = routerMiddleware;
        stack.push(layer);
      } else {
        addLayer(path, 'USE', [middleware]);
      }
    });

    return router as VerbRouterInstance;
  };

  // Route function - creates a new route instance
  router.route = (path: string): RouteInstance => {
    const route: Partial<RouteInstance> = {};

    httpMethods.forEach(method => {
      (route as any)[method] = (...handlers: MiddlewareHandler[]): RouteInstance => {
        if (handlers.length === 0) {
          throw new Error(`Route.${method}() requires at least one handler`);
        }
        
        addLayer(path, method.toUpperCase() as Method, handlers, route as RouteInstance);
        return route as RouteInstance;
      };
    });

    // All method - matches any HTTP method
    route.all = (...handlers: MiddlewareHandler[]): RouteInstance => {
      if (handlers.length === 0) {
        throw new Error('Route.all() requires at least one handler');
      }

      httpMethods.forEach(method => {
        addLayer(path, method.toUpperCase() as Method, handlers, route as RouteInstance);
      });

      return route as RouteInstance;
    };

    return route as RouteInstance;
  };

  // Parameter handler
  router.param = (name: string, handler: ParamHandler): VerbRouterInstance => {
    paramHandlers[name] = handler;
    return router as VerbRouterInstance;
  };

  return router as VerbRouterInstance;
};

// Enhanced router matching function for the main server
export const matchVerbRouter = (
  router: VerbRouterInstance, 
  method: Method, 
  path: string, 
  basePath: string = ''
): {
  handlers: MiddlewareHandler[];
  params: Record<string, string>;
  matched: boolean;
} | null => {
  
  const escapeRegex = (str: string): string => {
    return str.replace(/[.+?^${}|[\]\\]/g, '\\$&');
  };
  
  for (const layer of router.stack) {
    // Skip if method doesn't match (except for USE middleware)
    if (layer.method !== 'USE' && layer.method !== method) {
      continue;
    }

    // Test if path matches this layer
    const testPath = basePath ? path.replace(new RegExp(`^${escapeRegex(basePath)}`), '') || '/' : path;
    const match = testPath.match(layer.regexp);

    if (match) {
      const params: Record<string, string> = {};
      
      // Extract parameters
      for (let i: number = 0; i < layer.keys.length; i++) {
        const key = layer.keys[i];
        if (typeof key === 'string') {
          params[key] = decodeURIComponent(match[i + 1] || '');
        }
      }

      // Handle nested router
      if (layer.isRouter && (layer as any).router) {
        const nestedRouter = (layer as any).router as VerbRouterInstance;
        const newBasePath = layer.path ? basePath + layer.path : basePath;
        const nestedResult = matchVerbRouter(nestedRouter, method, path, newBasePath);
        
        if (nestedResult) {
          return {
            handlers: nestedResult.handlers,
            params: { ...params, ...nestedResult.params },
            matched: true
          };
        }
        continue;
      }

      // For USE middleware, continue if path matches but isn't exact
      if (layer.method === 'USE' && layer.path) {
        const mountPath = basePath + layer.path;
        if (!path.startsWith(mountPath)) {
          continue;
        }
      }

      return {
        handlers: layer.handlers,
        params,
        matched: true
      };
    }
  }

  return null;
};
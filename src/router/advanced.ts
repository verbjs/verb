import type { VerbRequest, VerbResponse, Middleware, ServerInstance, Handler } from './types';
import { createRouter } from './router';
import type { RouteInstance } from './router';

// Route namespace types
export type RouteNamespace = {
  prefix: string;
  middlewares: Middleware[];
  routes: Map<string, RouteEntry>;
};

export type RouteEntry = {
  method: string;
  path: string;
  handler: Handler;
  middlewares: Middleware[];
  fullPath: string;
};

export type RouteCache = {
  method: string;
  path: string;
  handler: Handler;
  middlewares: Middleware[];
  params: Record<string, string>;
};

export type RouteIntrospection = {
  method: string;
  path: string;
  middlewares: number;
  namespace?: string;
  cached: boolean;
};

// Route namespace registry
const routeNamespaces = new Map<string, RouteNamespace>();
const routeCache = new Map<string, RouteCache>();

// Create a route namespace
export const createRouteNamespace = (prefix: string, middlewares: Middleware[] = []): RouteNamespace => {
  const namespace: RouteNamespace = {
    prefix: prefix.startsWith('/') ? prefix : `/${prefix}`,
    middlewares,
    routes: new Map()
  };
  
  routeNamespaces.set(prefix, namespace);
  return namespace;
};

// Add route to namespace
export const addRouteToNamespace = (
  namespace: RouteNamespace,
  method: string,
  path: string,
  handler: Handler,
  middlewares: Middleware[] = []
): void => {
  const fullPath = `${namespace.prefix}${path.startsWith('/') ? path : `/${path}`}`;
  const routeKey = `${method}:${fullPath}`;
  
  const route: RouteEntry = {
    method,
    path,
    handler,
    middlewares: [...namespace.middlewares, ...middlewares],
    fullPath
  };
  
  namespace.routes.set(routeKey, route);
};

// Namespace builder for fluent API
export const namespace = (prefix: string, middlewares: Middleware[] = []) => {
  const ns = createRouteNamespace(prefix, middlewares);
  
  const api = {
    get: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'GET', path, handler, middlewares);
      return api;
    },
    post: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'POST', path, handler, middlewares);
      return api;
    },
    put: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'PUT', path, handler, middlewares);
      return api;
    },
    delete: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'DELETE', path, handler, middlewares);
      return api;
    },
    patch: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'PATCH', path, handler, middlewares);
      return api;
    },
    head: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'HEAD', path, handler, middlewares);
      return api;
    },
    options: (path: string, handler: Handler, ...middlewares: Middleware[]) => {
      addRouteToNamespace(ns, 'OPTIONS', path, handler, middlewares);
      return api;
    },
    use: (middleware: Middleware) => {
      ns.middlewares.push(middleware);
      return api;
    },
    mount: (app: ServerInstance) => {
      // Mount all routes from this namespace to the app
      for (const [key, route] of ns.routes) {
        const method = route.method.toLowerCase() as keyof ServerInstance;
        if (typeof app[method] === 'function') {
          (app[method] as any)(route.fullPath, ...route.middlewares, route.handler);
        }
      }
      return app;
    }
  };
  
  return api;
};

// Route caching for performance optimization
export const enableRouteCache = (maxSize: number = 1000): void => {
  // Clear existing cache if resizing
  if (routeCache.size > maxSize) {
    routeCache.clear();
  }
};

export const cacheRoute = (method: string, path: string, handler: Handler, middlewares: Middleware[], params: Record<string, string>): void => {
  const key = `${method}:${path}`;
  
  // Implement LRU-like behavior by removing oldest entries when cache is full
  if (routeCache.size >= 1000) {
    const firstKey = routeCache.keys().next().value;
    if (firstKey) {
      routeCache.delete(firstKey);
    }
  }
  
  routeCache.set(key, {
    method,
    path,
    handler,
    middlewares,
    params
  });
};

export const getCachedRoute = (method: string, path: string): RouteCache | null => {
  const key = `${method}:${path}`;
  return routeCache.get(key) || null;
};

export const clearRouteCache = (): void => {
  routeCache.clear();
};

// Route introspection for programmatic route access
export const getRegisteredRoutes = (app: ServerInstance): RouteIntrospection[] => {
  const routes: RouteIntrospection[] = [];
  
  // Get routes from internal router if available
  const router = (app as any).router;
  if (router && typeof router.getRoutes === 'function') {
    const routeEntries = router.getRoutes();
    for (const route of routeEntries) {
      routes.push({
        method: route.method,
        path: route.path,
        middlewares: route.middlewares?.length || 0,
        cached: getCachedRoute(route.method, route.path) !== null
      });
    }
  }
  
  // Add namespace routes
  for (const [prefix, namespace] of routeNamespaces) {
    for (const [key, route] of namespace.routes) {
      routes.push({
        method: route.method,
        path: route.fullPath,
        middlewares: route.middlewares.length,
        namespace: prefix,
        cached: getCachedRoute(route.method, route.fullPath) !== null
      });
    }
  }
  
  return routes;
};

export const getRoutesByMethod = (app: ServerInstance, method: string): RouteIntrospection[] => {
  return getRegisteredRoutes(app).filter(route => route.method === method.toUpperCase());
};

export const getRoutesByPath = (app: ServerInstance, pathPattern: string): RouteIntrospection[] => {
  return getRegisteredRoutes(app).filter(route => route.path.includes(pathPattern));
};

export const getRoutesByNamespace = (namespace: string): RouteIntrospection[] => {
  return getRegisteredRoutes({} as ServerInstance).filter(route => route.namespace === namespace);
};

// Route debugging utilities
export const debugRoute = (method: string, path: string): void => {
  console.log(`\n🔍 Route Debug: ${method} ${path}`);
  console.log('='.repeat(50));
  
  // Check cache
  const cached = getCachedRoute(method, path);
  if (cached) {
    console.log('✅ Route found in cache');
    console.log(`   Middlewares: ${cached.middlewares.length}`);
    console.log(`   Params: ${JSON.stringify(cached.params)}`);
    return;
  }
  
  // Check namespaces
  for (const [prefix, namespace] of routeNamespaces) {
    const key = `${method}:${path}`;
    const route = namespace.routes.get(key);
    if (route) {
      console.log(`✅ Route found in namespace: ${prefix}`);
      console.log(`   Full path: ${route.fullPath}`);
      console.log(`   Middlewares: ${route.middlewares.length}`);
      return;
    }
  }
  
  console.log('❌ Route not found');
};

export const logRouteStatistics = (app: ServerInstance): void => {
  const routes = getRegisteredRoutes(app);
  const methods = new Map<string, number>();
  const namespaces = new Map<string, number>();
  let cachedCount = 0;
  
  for (const route of routes) {
    // Count by method
    methods.set(route.method, (methods.get(route.method) || 0) + 1);
    
    // Count by namespace
    if (route.namespace) {
      namespaces.set(route.namespace, (namespaces.get(route.namespace) || 0) + 1);
    }
    
    // Count cached routes
    if (route.cached) {
      cachedCount++;
    }
  }
  
  console.log('\n📊 Route Statistics');
  console.log('='.repeat(30));
  console.log(`Total routes: ${routes.length}`);
  console.log(`Cached routes: ${cachedCount}`);
  console.log(`Cache hit rate: ${routes.length > 0 ? (cachedCount / routes.length * 100).toFixed(1) : 0}%`);
  
  console.log('\nBy Method:');
  for (const [method, count] of methods) {
    console.log(`  ${method}: ${count}`);
  }
  
  if (namespaces.size > 0) {
    console.log('\nBy Namespace:');
    for (const [namespace, count] of namespaces) {
      console.log(`  ${namespace}: ${count}`);
    }
  }
};

// Performance optimization utilities
export const precompileRoutes = (app: ServerInstance): void => {
  const routes = getRegisteredRoutes(app);
  console.log(`🚀 Precompiling ${routes.length} routes for optimal performance...`);
  
  // Enable route caching
  enableRouteCache(1000);
  
  // Pre-warm cache with static routes (routes without parameters)
  for (const route of routes) {
    if (!route.path.includes(':') && !route.path.includes('*')) {
      // This is a static route, pre-cache it
      cacheRoute(route.method, route.path, 
        async () => {}, // Placeholder handler
        [], // Placeholder middlewares
        {} // No params for static routes
      );
    }
  }
  
  console.log('✅ Route precompilation complete');
};

// Route group utilities for organizing routes
export const routeGroup = (options: { prefix?: string; middlewares?: Middleware[] }) => {
  const { prefix = '', middlewares = [] } = options;
  
  const routes: { method: string; path: string; handler: Handler; middlewares: Middleware[] }[] = [];
  
  return {
    get: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'GET',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    post: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'POST',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    put: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'PUT',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    delete: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'DELETE',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    patch: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'PATCH',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    head: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'HEAD',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    options: (path: string, handler: Handler, ...routeMiddlewares: Middleware[]) => {
      routes.push({
        method: 'OPTIONS',
        path: prefix + path,
        handler,
        middlewares: [...middlewares, ...routeMiddlewares]
      });
      return routes[routes.length - 1];
    },
    routes: () => routes,
    apply: (app: ServerInstance) => {
      for (const route of routes) {
        const method = route.method.toLowerCase() as keyof ServerInstance;
        if (typeof app[method] === 'function') {
          (app[method] as any)(route.path, ...route.middlewares, route.handler);
        }
      }
    }
  };
};

// Export all namespace and route utilities
export const getAllNamespaces = (): Map<string, RouteNamespace> => {
  return new Map(routeNamespaces);
};

export const getNamespace = (prefix: string): RouteNamespace | null => {
  return routeNamespaces.get(prefix) || null;
};

export const removeNamespace = (prefix: string): boolean => {
  return routeNamespaces.delete(prefix);
};

export const clearAllNamespaces = (): void => {
  routeNamespaces.clear();
};
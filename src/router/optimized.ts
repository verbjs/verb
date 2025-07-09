// High-performance router with precompiled routes and caching
import type { Handler, Method, Middleware } from "../types";

export interface CompiledRoute {
  method: Method;
  path: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
  middlewares: Middleware[];
  isStatic: boolean; // For static routes (no parameters)
  priority: number; // For route ordering
}

export interface RouteMatch {
  handler: Handler;
  middlewares: Middleware[];
  params: Record<string, string>;
}

export interface OptimizedRouterOptions {
  caseSensitive?: boolean;
  strict?: boolean;
  enableCaching?: boolean;
  maxCacheSize?: number;
}

export class OptimizedRouter {
  private routes: CompiledRoute[] = [];
  private staticRoutes: Map<string, CompiledRoute> = new Map(); // Fast lookup for static routes
  private routeCache: Map<string, RouteMatch | null> = new Map(); // LRU cache for route matches
  private options: OptimizedRouterOptions;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(options: OptimizedRouterOptions = {}) {
    this.options = {
      caseSensitive: false,
      strict: false,
      enableCaching: true,
      maxCacheSize: 1000,
      ...options
    };
  }

  // Add route with precompilation
  addRoute(method: Method, path: string, middlewares: Middleware[], handler: Handler): void {
    const compiledRoute = this.compileRoute(method, path, middlewares, handler);
    
    // Store in routes array
    this.routes.push(compiledRoute);
    
    // Store static routes in fast lookup map
    if (compiledRoute.isStatic) {
      const key = this.getStaticKey(method, path);
      this.staticRoutes.set(key, compiledRoute);
    }
    
    // Sort routes by priority (static routes first, then by specificity)
    this.routes.sort((a, b) => b.priority - a.priority);
    
    // Clear cache when routes change
    this.clearCache();
  }

  // Precompile route for maximum performance
  private compileRoute(method: Method, path: string, middlewares: Middleware[], handler: Handler): CompiledRoute {
    const keys: string[] = [];
    const isStatic = !path.includes(':') && !path.includes('*');
    
    // Calculate priority (static routes have higher priority)
    let priority = 0;
    if (isStatic) {
      priority = 1000 + path.length; // Static routes get high priority, longer paths first
    } else {
      priority = 500 - (path.split('/').length * 10); // Dynamic routes get lower priority
    }

    // Convert path to regex
    let regexPath = path;
    
    // Handle parameters like :id
    regexPath = regexPath.replace(/:([^(/]+)(\([^)]+\))?/g, (match, key, constraint) => {
      keys.push(key);
      if (constraint) {
        // Handle regex constraints like :id(\\d+)
        return constraint;
      }
      return '([^/]+)';
    });
    
    // Handle wildcards like *
    regexPath = regexPath.replace(/\*/g, () => {
      keys.push('*');
      return '(.*)';
    });
    
    // Make regex case insensitive if needed
    const flags = this.options.caseSensitive ? '' : 'i';
    
    // Handle strict mode for trailing slashes
    if (!this.options.strict) {
      regexPath = regexPath.replace(/\/$/, '');
      regexPath += '\\/?';
    }
    
    const regex = new RegExp(`^${regexPath}$`, flags);

    return {
      method,
      path,
      regex,
      keys,
      handler,
      middlewares,
      isStatic,
      priority
    };
  }

  // Ultra-fast route matching with caching
  match(method: Method, path: string): RouteMatch | null {
    const cacheKey = `${method}:${path}`;
    
    // Check cache first
    if (this.options.enableCaching && this.routeCache.has(cacheKey)) {
      this.cacheHits++;
      return this.routeCache.get(cacheKey)!;
    }

    this.cacheMisses++;
    
    // Try static routes first (fastest)
    const staticKey = this.getStaticKey(method, path);
    if (this.staticRoutes.has(staticKey)) {
      const route = this.staticRoutes.get(staticKey)!;
      const match: RouteMatch = {
        handler: route.handler,
        middlewares: route.middlewares,
        params: {}
      };
      
      this.cacheResult(cacheKey, match);
      return match;
    }
    
    // Try dynamic routes
    for (const route of this.routes) {
      if (route.method !== method || route.isStatic) continue;
      
      const regexMatch = path.match(route.regex);
      if (regexMatch) {
        const params: Record<string, string> = {};
        
        // Extract parameters
        for (let i = 0; i < route.keys.length; i++) {
          const key = route.keys[i];
          const value = regexMatch[i + 1];
          params[key] = value ? decodeURIComponent(value) : '';
        }
        
        const match: RouteMatch = {
          handler: route.handler,
          middlewares: route.middlewares,
          params
        };
        
        this.cacheResult(cacheKey, match);
        return match;
      }
    }
    
    // No match found
    this.cacheResult(cacheKey, null);
    return null;
  }

  // Get all routes for debugging
  getRoutes(): Array<{ method: Method; path: string; params: string[] }> {
    return this.routes.map(route => ({
      method: route.method,
      path: route.path,
      params: route.keys
    }));
  }

  // Cache management
  private cacheResult(key: string, result: RouteMatch | null): void {
    if (!this.options.enableCaching) return;
    
    // Simple LRU: if cache is full, remove oldest entries
    if (this.routeCache.size >= this.options.maxCacheSize!) {
      const firstKey = this.routeCache.keys().next().value;
      this.routeCache.delete(firstKey);
    }
    
    this.routeCache.set(key, result);
  }

  private clearCache(): void {
    this.routeCache.clear();
  }

  private getStaticKey(method: Method, path: string): string {
    return `${method}:${this.options.caseSensitive ? path : path.toLowerCase()}`;
  }

  // Performance metrics
  getMetrics(): { cacheHits: number; cacheMisses: number; hitRate: number; routeCount: number; staticRoutes: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: total > 0 ? (this.cacheHits / total) * 100 : 0,
      routeCount: this.routes.length,
      staticRoutes: this.staticRoutes.size
    };
  }

  // Reset metrics
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // Precompile all routes for maximum performance
  precompileRoutes(): void {
    // Routes are already precompiled when added, but this can be used
    // to trigger any additional optimizations
    
    // Sort routes by priority again to ensure optimal order
    this.routes.sort((a, b) => b.priority - a.priority);
    
    // Clear cache to ensure fresh start
    this.clearCache();
  }

  // Get route statistics
  getRouteStatistics(): {
    totalRoutes: number;
    staticRoutes: number;
    dynamicRoutes: number;
    methodBreakdown: Record<Method, number>;
    averagePathLength: number;
  } {
    const methodBreakdown: Record<Method, number> = {} as any;
    let totalPathLength = 0;
    
    for (const route of this.routes) {
      methodBreakdown[route.method] = (methodBreakdown[route.method] || 0) + 1;
      totalPathLength += route.path.length;
    }
    
    return {
      totalRoutes: this.routes.length,
      staticRoutes: this.staticRoutes.size,
      dynamicRoutes: this.routes.length - this.staticRoutes.size,
      methodBreakdown,
      averagePathLength: this.routes.length > 0 ? totalPathLength / this.routes.length : 0
    };
  }
}

// Create optimized router with performance features
export const createOptimizedRouter = (options?: OptimizedRouterOptions): OptimizedRouter => {
  return new OptimizedRouter(options);
};

// Benchmark router performance
export const benchmarkRouter = async (router: OptimizedRouter, iterations = 10000): Promise<{
  averageTime: number;
  operationsPerSecond: number;
  cacheHitRate: number;
}> => {
  const testRoutes = [
    { method: 'GET' as Method, path: '/api/users' },
    { method: 'GET' as Method, path: '/api/users/123' },
    { method: 'POST' as Method, path: '/api/users' },
    { method: 'GET' as Method, path: '/api/posts/456/comments' },
    { method: 'PUT' as Method, path: '/api/users/789' },
    { method: 'DELETE' as Method, path: '/api/users/999' },
    { method: 'GET' as Method, path: '/health' },
    { method: 'GET' as Method, path: '/api/search' },
  ];

  router.resetMetrics();
  
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const route = testRoutes[i % testRoutes.length];
    router.match(route.method, route.path);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const metrics = router.getMetrics();
  
  return {
    averageTime: totalTime / iterations,
    operationsPerSecond: (iterations / totalTime) * 1000,
    cacheHitRate: metrics.hitRate
  };
};
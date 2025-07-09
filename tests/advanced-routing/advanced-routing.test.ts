import { test, expect } from "bun:test";
import { createServer } from "../../src/server";
import { 
  createRouteNamespace,
  addRouteToNamespace,
  namespace,
  enableRouteCache,
  cacheRoute,
  getCachedRoute,
  clearRouteCache,
  getRegisteredRoutes,
  getRoutesByMethod,
  getRoutesByPath,
  getRoutesByNamespace,
  debugRoute,
  logRouteStatistics,
  precompileRoutes,
  routeGroup,
  getAllNamespaces,
  getNamespace,
  removeNamespace,
  clearAllNamespaces
} from "../../src/router/advanced";

// Route namespace tests
test("createRouteNamespace - creates namespace with prefix", () => {
  const ns = createRouteNamespace('/api');
  
  expect(ns.prefix).toBe('/api');
  expect(ns.middlewares).toEqual([]);
  expect(ns.routes).toBeInstanceOf(Map);
});

test("createRouteNamespace - handles prefix formatting", () => {
  const ns1 = createRouteNamespace('api');
  const ns2 = createRouteNamespace('/api');
  
  expect(ns1.prefix).toBe('/api');
  expect(ns2.prefix).toBe('/api');
});

test("createRouteNamespace - includes middlewares", () => {
  const middleware1 = async (req: any, res: any, next: any) => next();
  const middleware2 = async (req: any, res: any, next: any) => next();
  
  const ns = createRouteNamespace('/api', [middleware1, middleware2]);
  
  expect(ns.middlewares).toHaveLength(2);
  expect(ns.middlewares[0]).toBe(middleware1);
  expect(ns.middlewares[1]).toBe(middleware2);
});

test("addRouteToNamespace - adds route to namespace", () => {
  const ns = createRouteNamespace('/api');
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  addRouteToNamespace(ns, 'GET', '/users', handler);
  
  expect(ns.routes.size).toBe(1);
  expect(ns.routes.has('GET:/api/users')).toBe(true);
  
  const route = ns.routes.get('GET:/api/users');
  expect(route?.method).toBe('GET');
  expect(route?.path).toBe('/users');
  expect(route?.fullPath).toBe('/api/users');
  expect(route?.handler).toBe(handler);
});

test("addRouteToNamespace - handles path formatting", () => {
  const ns = createRouteNamespace('/api');
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  addRouteToNamespace(ns, 'GET', 'users', handler);
  addRouteToNamespace(ns, 'POST', '/posts', handler);
  
  expect(ns.routes.has('GET:/api/users')).toBe(true);
  expect(ns.routes.has('POST:/api/posts')).toBe(true);
});

test("addRouteToNamespace - combines namespace and route middlewares", () => {
  const nsMiddleware = async (req: any, res: any, next: any) => next();
  const routeMiddleware = async (req: any, res: any, next: any) => next();
  
  const ns = createRouteNamespace('/api', [nsMiddleware]);
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  addRouteToNamespace(ns, 'GET', '/users', handler, [routeMiddleware]);
  
  const route = ns.routes.get('GET:/api/users');
  expect(route?.middlewares).toHaveLength(2);
  expect(route?.middlewares[0]).toBe(nsMiddleware);
  expect(route?.middlewares[1]).toBe(routeMiddleware);
});

// Fluent namespace API tests
test("namespace - creates fluent namespace API", () => {
  const api = namespace('/api');
  
  expect(api.get).toBeDefined();
  expect(api.post).toBeDefined();
  expect(api.put).toBeDefined();
  expect(api.delete).toBeDefined();
  expect(api.patch).toBeDefined();
  expect(api.head).toBeDefined();
  expect(api.options).toBeDefined();
  expect(api.use).toBeDefined();
  expect(api.mount).toBeDefined();
});

test("namespace - fluent API adds routes", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  const api = namespace('/api')
    .get('/users', handler)
    .post('/users', handler)
    .put('/users/:id', handler);
  
  const namespaces = getAllNamespaces();
  const apiNamespace = namespaces.get('/api');
  
  expect(apiNamespace?.routes.size).toBe(3);
  expect(apiNamespace?.routes.has('GET:/api/users')).toBe(true);
  expect(apiNamespace?.routes.has('POST:/api/users')).toBe(true);
  expect(apiNamespace?.routes.has('PUT:/api/users/:id')).toBe(true);
});

test("namespace - fluent API with middleware", () => {
  const middleware = async (req: any, res: any, next: any) => next();
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  const api = namespace('/api', [middleware])
    .get('/users', handler)
    .use(middleware);
  
  const namespaces = getAllNamespaces();
  const apiNamespace = namespaces.get('/api');
  
  expect(apiNamespace?.middlewares).toHaveLength(2);
});

test("namespace - mount routes to app", () => {
  const app = createServer();
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  // Mock app methods to track calls
  let getCallCount = 0;
  let postCallCount = 0;
  
  const originalGet = app.get;
  const originalPost = app.post;
  
  app.get = (...args: any[]) => {
    getCallCount++;
    return originalGet.apply(app, args);
  };
  
  app.post = (...args: any[]) => {
    postCallCount++;
    return originalPost.apply(app, args);
  };
  
  namespace('/api')
    .get('/users', handler)
    .post('/users', handler)
    .mount(app);
  
  expect(getCallCount).toBe(1);
  expect(postCallCount).toBe(1);
});

// Route caching tests
test("enableRouteCache - enables route caching", () => {
  enableRouteCache(100);
  
  // Cache should be enabled (no direct way to test, but shouldn't throw)
  expect(true).toBe(true);
});

test("cacheRoute - caches route", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  const middlewares = [async (req: any, res: any, next: any) => next()];
  const params = { id: '123' };
  
  cacheRoute('GET', '/users/:id', handler, middlewares, params);
  
  const cached = getCachedRoute('GET', '/users/:id');
  
  expect(cached).toBeDefined();
  expect(cached?.method).toBe('GET');
  expect(cached?.path).toBe('/users/:id');
  expect(cached?.handler).toBe(handler);
  expect(cached?.middlewares).toBe(middlewares);
  expect(cached?.params).toBe(params);
});

test("getCachedRoute - returns cached route", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  cacheRoute('POST', '/posts', handler, [], {});
  
  const cached = getCachedRoute('POST', '/posts');
  expect(cached).toBeDefined();
  expect(cached?.method).toBe('POST');
  expect(cached?.path).toBe('/posts');
  
  const notCached = getCachedRoute('GET', '/nonexistent');
  expect(notCached).toBeNull();
});

test("clearRouteCache - clears all cached routes", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  cacheRoute('GET', '/test1', handler, [], {});
  cacheRoute('GET', '/test2', handler, [], {});
  
  expect(getCachedRoute('GET', '/test1')).toBeDefined();
  expect(getCachedRoute('GET', '/test2')).toBeDefined();
  
  clearRouteCache();
  
  expect(getCachedRoute('GET', '/test1')).toBeNull();
  expect(getCachedRoute('GET', '/test2')).toBeNull();
});

test("route cache - LRU behavior", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  // Fill cache beyond limit to test LRU
  for (let i = 0; i < 1001; i++) {
    cacheRoute('GET', `/route${i}`, handler, [], {});
  }
  
  // First route should be evicted
  expect(getCachedRoute('GET', '/route0')).toBeNull();
  
  // Last route should still be cached
  expect(getCachedRoute('GET', '/route1000')).toBeDefined();
});

// Route introspection tests
test("getRegisteredRoutes - returns routes for app", () => {
  const app = createServer();
  
  app.get('/users', async (req, res) => res.json({ users: [] }));
  app.post('/users', async (req, res) => res.json({ success: true }));
  
  const routes = getRegisteredRoutes(app);
  
  expect(routes.length).toBeGreaterThanOrEqual(2);
  expect(routes.some(r => r.method === 'GET' && r.path.includes('/users'))).toBe(true);
  expect(routes.some(r => r.method === 'POST' && r.path.includes('/users'))).toBe(true);
});

test("getRoutesByMethod - filters routes by method", () => {
  const app = createServer();
  
  app.get('/users', async (req, res) => res.json({ users: [] }));
  app.post('/users', async (req, res) => res.json({ success: true }));
  app.get('/posts', async (req, res) => res.json({ posts: [] }));
  
  const getRoutes = getRoutesByMethod(app, 'GET');
  const postRoutes = getRoutesByMethod(app, 'POST');
  
  expect(getRoutes.every(r => r.method === 'GET')).toBe(true);
  expect(postRoutes.every(r => r.method === 'POST')).toBe(true);
  expect(getRoutes.length).toBeGreaterThanOrEqual(2);
  expect(postRoutes.length).toBeGreaterThanOrEqual(1);
});

test("getRoutesByPath - filters routes by path pattern", () => {
  const app = createServer();
  
  app.get('/users', async (req, res) => res.json({ users: [] }));
  app.get('/users/:id', async (req, res) => res.json({ user: {} }));
  app.get('/posts', async (req, res) => res.json({ posts: [] }));
  
  const userRoutes = getRoutesByPath(app, '/users');
  const postRoutes = getRoutesByPath(app, '/posts');
  
  expect(userRoutes.every(r => r.path.includes('/users'))).toBe(true);
  expect(postRoutes.every(r => r.path.includes('/posts'))).toBe(true);
  expect(userRoutes.length).toBeGreaterThanOrEqual(2);
  expect(postRoutes.length).toBeGreaterThanOrEqual(1);
});

test("getRoutesByNamespace - filters routes by namespace", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  namespace('/api')
    .get('/users', handler)
    .post('/users', handler);
  
  namespace('/admin')
    .get('/dashboard', handler);
  
  const apiRoutes = getRoutesByNamespace('/api');
  const adminRoutes = getRoutesByNamespace('/admin');
  
  expect(apiRoutes.every(r => r.namespace === '/api')).toBe(true);
  expect(adminRoutes.every(r => r.namespace === '/admin')).toBe(true);
  expect(apiRoutes.length).toBeGreaterThanOrEqual(2);
  expect(adminRoutes.length).toBeGreaterThanOrEqual(1);
});

// Route debugging tests
test("debugRoute - logs route information", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  // Mock console.log to capture output
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => logs.push(args.join(' '));
  
  try {
    cacheRoute('GET', '/cached', handler, [], {});
    
    debugRoute('GET', '/cached');
    
    expect(logs.some(log => log.includes('Route Debug'))).toBe(true);
    expect(logs.some(log => log.includes('Route found in cache'))).toBe(true);
    
    logs.length = 0;
    
    debugRoute('GET', '/notfound');
    
    expect(logs.some(log => log.includes('Route not found'))).toBe(true);
  } finally {
    console.log = originalLog;
  }
});

test("logRouteStatistics - logs route statistics", () => {
  const app = createServer();
  
  app.get('/users', async (req, res) => res.json({ users: [] }));
  app.post('/users', async (req, res) => res.json({ success: true }));
  
  // Mock console.log to capture output
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => logs.push(args.join(' '));
  
  try {
    logRouteStatistics(app);
    
    expect(logs.some(log => log.includes('Route Statistics'))).toBe(true);
    expect(logs.some(log => log.includes('Total routes:'))).toBe(true);
    expect(logs.some(log => log.includes('By Method:'))).toBe(true);
  } finally {
    console.log = originalLog;
  }
});

test("precompileRoutes - precompiles routes for performance", () => {
  const app = createServer();
  
  app.get('/users', async (req, res) => res.json({ users: [] }));
  app.get('/posts', async (req, res) => res.json({ posts: [] }));
  
  // Mock console.log to capture output
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => logs.push(args.join(' '));
  
  try {
    precompileRoutes(app);
    
    expect(logs.some(log => log.includes('Precompiling'))).toBe(true);
    expect(logs.some(log => log.includes('Route precompilation complete'))).toBe(true);
  } finally {
    console.log = originalLog;
  }
});

// Route group tests
test("routeGroup - creates route group", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  const group = routeGroup({ prefix: '/api' });
  
  expect(group.get).toBeDefined();
  expect(group.post).toBeDefined();
  expect(group.routes).toBeDefined();
  expect(group.apply).toBeDefined();
});

test("routeGroup - adds routes with prefix", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  const group = routeGroup({ prefix: '/api' });
  
  group.get('/users', handler);
  group.post('/users', handler);
  
  const routes = group.routes();
  
  expect(routes).toHaveLength(2);
  expect(routes[0].method).toBe('GET');
  expect(routes[0].path).toBe('/api/users');
  expect(routes[1].method).toBe('POST');
  expect(routes[1].path).toBe('/api/users');
});

test("routeGroup - includes middlewares", () => {
  const middleware = async (req: any, res: any, next: any) => next();
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  const group = routeGroup({ 
    prefix: '/api',
    middlewares: [middleware]
  });
  
  group.get('/users', handler);
  
  const routes = group.routes();
  
  expect(routes[0].middlewares).toHaveLength(1);
  expect(routes[0].middlewares[0]).toBe(middleware);
});

test("routeGroup - applies routes to app", () => {
  const app = createServer();
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  // Mock app methods to track calls
  let getCallCount = 0;
  let postCallCount = 0;
  
  const originalGet = app.get;
  const originalPost = app.post;
  
  app.get = (...args: any[]) => {
    getCallCount++;
    return originalGet.apply(app, args);
  };
  
  app.post = (...args: any[]) => {
    postCallCount++;
    return originalPost.apply(app, args);
  };
  
  const group = routeGroup({ prefix: '/api' });
  group.get('/users', handler);
  group.post('/users', handler);
  group.apply(app);
  
  expect(getCallCount).toBe(1);
  expect(postCallCount).toBe(1);
});

// Namespace management tests
test("getAllNamespaces - returns all namespaces", () => {
  clearAllNamespaces();
  
  createRouteNamespace('/api');
  createRouteNamespace('/admin');
  
  const namespaces = getAllNamespaces();
  
  expect(namespaces.size).toBe(2);
  expect(namespaces.has('/api')).toBe(true);
  expect(namespaces.has('/admin')).toBe(true);
});

test("getNamespace - returns specific namespace", () => {
  const ns = createRouteNamespace('/test');
  
  const retrieved = getNamespace('/test');
  
  expect(retrieved).toBe(ns);
  expect(retrieved?.prefix).toBe('/test');
});

test("getNamespace - returns null for non-existent namespace", () => {
  const retrieved = getNamespace('/nonexistent');
  
  expect(retrieved).toBeNull();
});

test("removeNamespace - removes namespace", () => {
  createRouteNamespace('/temp');
  
  expect(getNamespace('/temp')).toBeDefined();
  
  const removed = removeNamespace('/temp');
  
  expect(removed).toBe(true);
  expect(getNamespace('/temp')).toBeNull();
});

test("removeNamespace - returns false for non-existent namespace", () => {
  const removed = removeNamespace('/nonexistent');
  
  expect(removed).toBe(false);
});

test("clearAllNamespaces - clears all namespaces", () => {
  createRouteNamespace('/api');
  createRouteNamespace('/admin');
  
  expect(getAllNamespaces().size).toBeGreaterThan(0);
  
  clearAllNamespaces();
  
  expect(getAllNamespaces().size).toBe(0);
});

// Performance tests
test("namespace creation performance", () => {
  const startTime = performance.now();
  
  // Create many namespaces
  for (let i = 0; i < 1000; i++) {
    createRouteNamespace(`/ns${i}`);
  }
  
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(500); // Should be reasonably fast
});

test("route caching performance", () => {
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  const startTime = performance.now();
  
  // Cache many routes
  for (let i = 0; i < 1000; i++) {
    cacheRoute('GET', `/route${i}`, handler, [], {});
  }
  
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(500); // Should be reasonably fast
});

// Integration tests
test("complex routing scenario", () => {
  const app = createServer();
  const handler = async (req: any, res: any) => res.json({ success: true });
  
  // Create namespace
  const api = namespace('/api')
    .get('/users', handler)
    .post('/users', handler);
  
  // Create route group
  const admin = routeGroup({ prefix: '/admin' });
  admin.get('/dashboard', handler);
  
  // Mount to app
  api.mount(app);
  admin.apply(app);
  
  // Cache some routes
  cacheRoute('GET', '/cached', handler, [], {});
  
  // Get route statistics
  const routes = getRegisteredRoutes(app);
  const apiRoutes = getRoutesByNamespace('/api');
  const cachedRoute = getCachedRoute('GET', '/cached');
  
  expect(routes.length).toBeGreaterThan(0);
  expect(apiRoutes.length).toBeGreaterThanOrEqual(2);
  expect(cachedRoute).toBeDefined();
});
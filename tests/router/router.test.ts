import { test, expect } from "bun:test";
import { Router } from "../../src/router";
import type { VerbRequest, VerbResponse } from "../../src/types";

// Mock request/response helpers
const createMockRequest = (method: string, path: string): VerbRequest => {
  const url = `http://localhost:3000${path}`;
  return {
    method,
    url,
    headers: new Headers(),
    params: {},
    query: {},
    text: async () => "",
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as VerbRequest;
};

const createMockResponse = (): { res: VerbResponse; getLastCall: () => any } => {
  let lastCall: any = null;
  
  const res: VerbResponse = {
    send: (data) => { lastCall = { method: 'send', data }; },
    json: (data) => { lastCall = { method: 'json', data }; },
    status: (code) => { lastCall = { method: 'status', code }; return res; },
    redirect: (url, code) => { lastCall = { method: 'redirect', url, code }; },
    html: (content) => { lastCall = { method: 'html', content }; },
    text: (content) => { lastCall = { method: 'text', content }; },
    header: (name, value) => { lastCall = { method: 'header', name, value }; return res; },
    headers: (headers) => { lastCall = { method: 'headers', headers }; return res; },
    cookie: (name, value, options) => { lastCall = { method: 'cookie', name, value, options }; return res; },
    clearCookie: (name) => { lastCall = { method: 'clearCookie', name }; return res; },
    end: () => { lastCall = { method: 'end' }; }
  };
  
  return { res, getLastCall: () => lastCall };
};

// Router Creation Tests
test("Router() creates a new router instance", () => {
  const router = Router();
  expect(router).toBeDefined();
  expect(router.stack).toEqual([]);
  expect(router.caseSensitive).toBe(false);
  expect(router.strict).toBe(false);
  expect(router.mergeParams).toBe(false);
});

test("Router() accepts options", () => {
  const router = Router({ 
    caseSensitive: true, 
    strict: true, 
    mergeParams: true 
  });
  expect(router.caseSensitive).toBe(true);
  expect(router.strict).toBe(true);
  expect(router.mergeParams).toBe(true);
});

// HTTP Method Tests
test("Router.get() adds GET route to stack", () => {
  const router = Router();
  const handler = () => {};
  
  router.get('/test', handler);
  
  expect(router.stack).toHaveLength(1);
  expect(router.stack[0].method).toBe('GET');
  expect(router.stack[0].handlers).toContain(handler);
});

test("Router.post() adds POST route to stack", () => {
  const router = Router();
  const handler = () => {};
  
  router.post('/test', handler);
  
  expect(router.stack).toHaveLength(1);
  expect(router.stack[0].method).toBe('POST');
});

test("Router supports all HTTP methods", () => {
  const router = Router();
  const handler = () => {};
  
  router.get('/get', handler);
  router.post('/post', handler);
  router.put('/put', handler);
  router.delete('/delete', handler);
  router.patch('/patch', handler);
  router.head('/head', handler);
  router.options('/options', handler);
  
  expect(router.stack).toHaveLength(7);
  expect(router.stack.map(s => s.method)).toEqual([
    'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
  ]);
});

// Route Array Tests
test("Router supports route arrays", () => {
  const router = Router();
  const handler = () => {};
  
  router.get(['/api', '/api/v1'], handler);
  
  expect(router.stack).toHaveLength(2);
  expect(router.stack[0].path).toBeUndefined(); // path is only for USE middleware
  expect(router.stack[1].path).toBeUndefined();
});

// Middleware Tests
test("Router.use() adds middleware to stack", () => {
  const router = Router();
  const middleware = () => {};
  
  router.use(middleware);
  
  expect(router.stack).toHaveLength(1);
  expect(router.stack[0].method).toBe('USE');
  expect(router.stack[0].handlers).toContain(middleware);
});

test("Router.use() with path adds path-specific middleware", () => {
  const router = Router();
  const middleware = () => {};
  
  router.use('/api', middleware);
  
  expect(router.stack).toHaveLength(1);
  expect(router.stack[0].method).toBe('USE');
  expect(router.stack[0].path).toBe('/api');
});

// Route Instance Tests
test("Router.route() returns route instance", () => {
  const router = Router();
  const route = router.route('/test');
  
  expect(route).toBeDefined();
  expect(typeof route.get).toBe('function');
  expect(typeof route.post).toBe('function');
  expect(typeof route.all).toBe('function');
});

test("Route.get() adds route to router stack", () => {
  const router = Router();
  const handler = () => {};
  
  router.route('/test').get(handler);
  
  expect(router.stack).toHaveLength(1);
  expect(router.stack[0].method).toBe('GET');
  expect(router.stack[0].handlers).toContain(handler);
});

test("Route.all() adds route for all methods", () => {
  const router = Router();
  const handler = () => {};
  
  router.route('/test').all(handler);
  
  expect(router.stack).toHaveLength(7); // One for each HTTP method
  const methods = router.stack.map(s => s.method);
  expect(methods).toContain('GET');
  expect(methods).toContain('POST');
  expect(methods).toContain('PUT');
  expect(methods).toContain('DELETE');
  expect(methods).toContain('PATCH');
  expect(methods).toContain('HEAD');
  expect(methods).toContain('OPTIONS');
});

// Pattern Matching Tests
test("Router patterns - static routes", () => {
  const router = Router();
  const handler = () => {};
  
  router.get('/users', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/users')).toBe(true);
  expect(layer.regexp.test('/users/123')).toBe(false);
  expect(layer.keys).toEqual([]);
});

test("Router patterns - parameter routes", () => {
  const router = Router();
  const handler = () => {};
  
  router.get('/users/:id', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/users/123')).toBe(true);
  expect(layer.regexp.test('/users')).toBe(false);
  expect(layer.keys).toEqual(['id']);
});

test("Router patterns - regex parameter routes", () => {
  const router = Router();
  const handler = () => {};
  
  router.get('/users/:id(\\d+)', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/users/123')).toBe(true);
  expect(layer.regexp.test('/users/abc')).toBe(false);
  expect(layer.keys).toEqual(['id']);
});

test("Router patterns - wildcard routes", () => {
  const router = Router();
  const handler = () => {};
  
  router.get('/files/*', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/files/test.txt')).toBe(true);
  expect(layer.regexp.test('/files/docs/report.pdf')).toBe(true);
  expect(layer.regexp.test('/files')).toBe(false);
  expect(layer.keys).toEqual(['*']);
});

// Case Sensitivity Tests
test("Case sensitive router - exact case matching", () => {
  const router = Router({ caseSensitive: true });
  const handler = () => {};
  
  router.get('/Users', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/Users')).toBe(true);
  expect(layer.regexp.test('/users')).toBe(false);
});

test("Case insensitive router (default) - flexible case matching", () => {
  const router = Router({ caseSensitive: false });
  const handler = () => {};
  
  router.get('/Users', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/Users')).toBe(true);
  expect(layer.regexp.test('/users')).toBe(true);
});

// Strict Routing Tests
test("Strict router - exact trailing slash matching", () => {
  const router = Router({ strict: true });
  const handler = () => {};
  
  router.get('/users/', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/users/')).toBe(true);
  expect(layer.regexp.test('/users')).toBe(false);
});

test("Non-strict router (default) - flexible trailing slash", () => {
  const router = Router({ strict: false });
  const handler = () => {};
  
  router.get('/users', handler);
  
  const layer = router.stack[0];
  expect(layer.regexp.test('/users')).toBe(true);
  expect(layer.regexp.test('/users/')).toBe(true);
});

// Error Handling Tests
test("Router.get() throws error with no handlers", () => {
  const router = Router();
  
  expect(() => {
    (router as any).get('/test');
  }).toThrow('Router.get() requires at least one handler');
});

test("Router.use() throws error with no middleware", () => {
  const router = Router();
  
  expect(() => {
    (router as any).use('/test');
  }).toThrow('Router.use() requires at least one middleware function');
});

test("Route.get() throws error with no handlers", () => {
  const router = Router();
  const route = router.route('/test');
  
  expect(() => {
    (route as any).get();
  }).toThrow('Route.get() requires at least one handler');
});

// Parameter Handler Tests
test("Router.param() adds parameter handler", () => {
  const router = Router();
  const paramHandler = () => {};
  
  router.param('id', paramHandler);
  
  // Param handlers are stored internally, not in stack
  expect(router.stack).toHaveLength(0);
  
  // Add a route and verify param handler is attached
  router.get('/users/:id', () => {});
  expect(router.stack[0].paramHandlers).toBeDefined();
  expect(router.stack[0].paramHandlers!.id).toBe(paramHandler);
});

// Integration Tests with Mock Execution
test("Router executes handler for matching route", async () => {
  const router = Router();
  const { res, getLastCall } = createMockResponse();
  
  router.get('/test', (req, res) => {
    res.json({ message: 'success' });
  });
  
  // Find matching layer
  const layer = router.stack.find(l => l.regexp.test('/test'));
  expect(layer).toBeDefined();
  
  // Execute handler
  const req = createMockRequest('GET', '/test');
  await layer!.handlers[0](req, res, () => {});
  
  const lastCall = getLastCall();
  expect(lastCall.method).toBe('json');
  expect(lastCall.data).toEqual({ message: 'success' });
});

test("Router extracts parameters correctly", async () => {
  const router = Router();
  let capturedParams: any = null;
  
  router.get('/users/:id', (req, res) => {
    capturedParams = req.params;
    res.json({ userId: req.params!.id });
  });
  
  // Find matching layer and extract params
  const layer = router.stack[0];
  const match = '/users/123'.match(layer.regexp);
  expect(match).toBeTruthy();
  
  // Simulate parameter extraction
  const params: Record<string, string> = {};
  for (let i = 0; i < layer.keys.length; i++) {
    params[layer.keys[i]] = match![i + 1];
  }
  
  const req = createMockRequest('GET', '/users/123');
  req.params = params;
  
  const { res, getLastCall } = createMockResponse();
  await layer.handlers[0](req, res, () => {});
  
  expect(capturedParams).toEqual({ id: '123' });
  const lastCall = getLastCall();
  expect(lastCall.data).toEqual({ userId: '123' });
});
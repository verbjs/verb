import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../../src/index";

let server: any;
const TEST_PORT = 3341;

beforeAll(async () => {
  const app = createServer();
  
  // Global middleware
  let globalMiddlewareExecuted = false;
  app.use((req, res, next) => {
    globalMiddlewareExecuted = true;
    res.header('X-Global', 'true');
    next();
  });

  // Path-specific middleware
  app.use('/api', (req, res, next) => {
    res.header('X-API', 'true');
    next();
  });

  // Route-specific middleware
  const authMiddleware = (req, res, next) => {
    const token = req.headers.get('authorization');
    if (!token) {
      res.status(401).json({ error: 'No token' });
      return;
    }
    next();
  };

  const logMiddleware = (req, res, next) => {
    res.header('X-Logged', 'true');
    next();
  };

  // Routes with different middleware combinations
  app.get('/', (req, res) => {
    res.json({ message: 'home' });
  });

  app.get('/api/users', (req, res) => {
    res.json({ users: ['test'] });
  });

  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ message: 'protected' });
  });

  app.get('/multi', authMiddleware, logMiddleware, (req, res) => {
    res.json({ message: 'multiple middlewares' });
  });

  // Middleware that doesn't call next()
  app.get('/stop', (req, res, next) => {
    res.json({ message: 'stopped by middleware' });
    // Don't call next()
  }, (req, res) => {
    res.json({ message: 'should not reach here' });
  });

  server = app.listen(TEST_PORT);
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(() => {
  if (server) {
    server.stop();
  }
});

test("Global middleware executes on all routes", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/`);
  expect(response.status).toBe(200);
  expect(response.headers.get('X-Global')).toBe('true');
});

test("Path-specific middleware executes for matching paths", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/users`);
  expect(response.status).toBe(200);
  expect(response.headers.get('X-Global')).toBe('true');
  expect(response.headers.get('X-API')).toBe('true');
});

test("Path-specific middleware doesn't execute for non-matching paths", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/`);
  expect(response.status).toBe(200);
  expect(response.headers.get('X-Global')).toBe('true');
  expect(response.headers.get('X-API')).toBe(null);
});

test("Route-specific middleware executes and can block request", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/protected`);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'No token' });
});

test("Route-specific middleware allows request when conditions met", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/protected`, {
    headers: { 'Authorization': 'Bearer token' }
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: 'protected' });
});

test("Multiple route-specific middlewares execute in order", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/multi`, {
    headers: { 'Authorization': 'Bearer token' }
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('X-Logged')).toBe('true');
  expect(await response.json()).toEqual({ message: 'multiple middlewares' });
});

test("Middleware that doesn't call next() stops pipeline", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/stop`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: 'stopped by middleware' });
});

test("All middleware types work together", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/users`);
  expect(response.status).toBe(200);
  
  // Should have global middleware header
  expect(response.headers.get('X-Global')).toBe('true');
  // Should have path-specific middleware header
  expect(response.headers.get('X-API')).toBe('true');
  
  const data = await response.json();
  expect(data).toEqual({ users: ['test'] });
});
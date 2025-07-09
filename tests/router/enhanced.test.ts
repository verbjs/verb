import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer, Router } from "../../src/index";

let server: any;
const TEST_PORT = 3343;

beforeAll(async () => {
  const app = createServer();
  
  // 1. Regex parameter routes
  app.get('/users/:id(\\d+)', (req, res) => {
    res.json({ userId: req.params!.id, type: 'numeric' });
  });

  app.get('/profiles/:name([a-zA-Z]+)', (req, res) => {
    res.json({ username: req.params!.name, type: 'alpha' });
  });

  // 2. Wildcard routes
  app.get('/files/*', (req, res) => {
    const filePath = req.params!['*'] || req.params!['0'];
    res.json({ filePath, type: 'wildcard' });
  });

  // 3. Route arrays
  app.get(['/api', '/api/v1', '/api/version'], (req, res) => {
    res.json({ path: new URL(req.url).pathname, type: 'array' });
  });

  // 4. Verb Router
  const userRouter = Router();
  userRouter.get('/', (req, res) => {
    res.json({ message: 'All users from router' });
  });
  userRouter.get('/:id', (req, res) => {
    res.json({ userId: req.params!.id, source: 'router' });
  });
  app.use('/router-users', userRouter as any);

  // 5. Case sensitive router
  const strictRouter = Router({ caseSensitive: true, strict: true });
  strictRouter.get('/CaseSensitive', (req, res) => {
    res.json({ message: 'Case sensitive match' });
  });
  app.use('/strict', strictRouter as any);

  // 6. Route chaining
  app.route('/products/:id')
    .get((req, res) => {
      res.json({ method: 'GET', productId: req.params!.id });
    })
    .post((req, res) => {
      res.json({ method: 'POST', productId: req.params!.id });
    })
    .put((req, res) => {
      res.json({ method: 'PUT', productId: req.params!.id });
    });

  // 7. Complex nested patterns
  app.get('/api/:version(v\\d+)/users/:userId(\\d+)/posts/:postId(\\d+)', (req, res) => {
    res.json({
      version: req.params!.version,
      userId: req.params!.userId,
      postId: req.params!.postId,
      type: 'complex'
    });
  });

  server = app.listen(TEST_PORT);
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(async () => {
  if (server) {
    server.stop();
  }
});

// Regex Parameter Tests
test("Regex parameters - numeric ID matches", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/users/123`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.userId).toBe('123');
  expect(data.type).toBe('numeric');
});

test("Regex parameters - non-numeric ID should not match numeric pattern", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/users/abc`);
  expect(response.status).toBe(404);
});

test("Regex parameters - alpha name matches", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/profiles/john`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.username).toBe('john');
  expect(data.type).toBe('alpha');
});

// Wildcard Route Tests
test("Wildcard routes - simple file path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/files/document.pdf`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.filePath).toBe('document.pdf');
  expect(data.type).toBe('wildcard');
});

test("Wildcard routes - nested file path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/files/docs/reports/2024/annual.pdf`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.filePath).toBe('docs/reports/2024/annual.pdf');
  expect(data.type).toBe('wildcard');
});

// Route Array Tests
test("Route arrays - first path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.path).toBe('/api');
  expect(data.type).toBe('array');
});

test("Route arrays - second path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/v1`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.path).toBe('/api/v1');
  expect(data.type).toBe('array');
});

test("Route arrays - third path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/version`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.path).toBe('/api/version');
  expect(data.type).toBe('array');
});

// Verb Router Tests
test("Verb Router - root path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/router-users`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.message).toBe('All users from router');
});

test("Verb Router - parameterized path", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/router-users/456`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.userId).toBe('456');
  expect(data.source).toBe('router');
});

// Case Sensitive Router Tests
test("Case sensitive router - exact case match", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/strict/CaseSensitive`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.message).toBe('Case sensitive match');
});

test("Case sensitive router - wrong case should not match", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/strict/casesensitive`);
  expect(response.status).toBe(404);
});

// Route Chaining Tests
test("Route chaining - GET method", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/products/100`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe('GET');
  expect(data.productId).toBe('100');
});

test("Route chaining - POST method", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/products/200`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Product' })
  });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe('POST');
  expect(data.productId).toBe('200');
});

test("Route chaining - PUT method", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/products/300`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Product' })
  });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.method).toBe('PUT');
  expect(data.productId).toBe('300');
});

// Complex Pattern Tests
test("Complex nested pattern - valid pattern", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/123/posts/456`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.version).toBe('v1');
  expect(data.userId).toBe('123');
  expect(data.postId).toBe('456');
  expect(data.type).toBe('complex');
});

test("Complex nested pattern - invalid version format", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/version1/users/123/posts/456`);
  expect(response.status).toBe(404);
});

test("Complex nested pattern - invalid user ID format", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/abc/posts/456`);
  expect(response.status).toBe(404);
});

test("Complex nested pattern - another valid pattern", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/v2/users/789/posts/101`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.version).toBe('v2');
  expect(data.userId).toBe('789');
  expect(data.postId).toBe('101');
});
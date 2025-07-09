import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer, middleware } from "../../src/index";

let server: any;
const TEST_PORT = 3342;

beforeAll(async () => {
  const app = createServer();
  
  // JSON middleware
  app.use('/api/json', middleware.json({ limit: '1kb' }));
  
  // URL-encoded middleware
  app.use('/api/form', middleware.urlencoded({ extended: true }));
  
  // Text middleware
  app.use('/api/text', middleware.text());
  
  // Raw middleware
  app.use('/api/raw', middleware.raw());
  
  // Static middleware (create test directory first)
  await Bun.$`mkdir -p test-static`;
  await Bun.write('test-static/test.txt', 'Hello from static file!');
  await Bun.write('test-static/test.json', '{"message": "JSON file"}');
  app.use('/static', middleware.staticFiles('./test-static'));

  // Routes
  app.post('/api/json/test', (req, res) => {
    res.json({ 
      received: req._bodyParsed ? req.body : undefined, 
      type: typeof req.body,
      hasBody: !!req._bodyParsed 
    });
  });

  app.post('/api/form/test', (req, res) => {
    res.json({ received: req._bodyParsed ? req.body : undefined });
  });

  app.post('/api/text/test', (req, res) => {
    res.json({ 
      received: req._bodyParsed ? req.body : undefined, 
      length: req._bodyParsed && req.body ? req.body.length : 0,
      hasBody: !!req._bodyParsed 
    });
  });

  app.post('/api/raw/test', (req, res) => {
    res.json({ 
      received: req._bodyParsed ? req.body.length : 0, 
      isBuffer: req._bodyParsed ? Buffer.isBuffer(req.body) : false 
    });
  });

  server = app.listen(TEST_PORT);
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(async () => {
  if (server) {
    server.stop();
  }
  // Cleanup test files
  await Bun.$`rm -rf test-static`;
});

// JSON Middleware Tests
test("JSON middleware parses valid JSON", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/json/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test', value: 123 })
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.received).toEqual({ name: 'test', value: 123 });
  expect(data.type).toBe('object');
});

test("JSON middleware rejects invalid JSON", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/json/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json }'
  });
  
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toBe('Invalid JSON');
});

test("JSON middleware respects size limits", async () => {
  const largeObject = { data: 'a'.repeat(2000) }; // Larger than 1kb limit
  const response = await fetch(`http://localhost:${TEST_PORT}/api/json/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(largeObject)
  });
  
  expect(response.status).toBe(413);
  const data = await response.json();
  expect(data.error).toBe('Payload too large');
});

test("JSON middleware ignores non-JSON content types", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/json/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'plain text'
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.hasBody).toBe(false); // Body should not be parsed
});

// URL-encoded Middleware Tests
test("URL-encoded middleware parses form data", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/form/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=John&age=30&active=true'
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.received).toEqual({ name: 'John', age: '30', active: 'true' });
});

test("URL-encoded middleware handles array notation", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/form/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'items[0]=apple&items[1]=banana&user[name]=John&user[age]=30'
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.received.items).toEqual(['apple', 'banana']);
  expect(data.received.user).toEqual({ name: 'John', age: '30' });
});

// Text Middleware Tests
test("Text middleware parses plain text", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/text/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'Hello, this is plain text!'
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.received).toBe('Hello, this is plain text!');
  expect(data.length).toBe(26);
});

// Raw Middleware Tests
test("Raw middleware parses binary data", async () => {
  const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
  const response = await fetch(`http://localhost:${TEST_PORT}/api/raw/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: binaryData
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.received).toBe(5); // Length of buffer
  expect(data.isBuffer).toBe(true);
});

// Static Middleware Tests
test("Static middleware serves text files", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/static/test.txt`);
  
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/plain');
  expect(await response.text()).toBe('Hello from static file!');
});

test("Static middleware serves JSON files", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/static/test.json`);
  
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(await response.json()).toEqual({ message: 'JSON file' });
});

test("Static middleware returns 404 for non-existent files", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/static/nonexistent.txt`);
  expect(response.status).toBe(404);
});

test("Static middleware sets cache headers", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/static/test.txt`);
  
  expect(response.status).toBe(200);
  expect(response.headers.get('last-modified')).toBeTruthy();
  expect(response.headers.get('etag')).toBeTruthy();
});

test("Static middleware handles HEAD requests", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/static/test.txt`, {
    method: 'HEAD'
  });
  
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/plain');
  expect(response.headers.get('content-length')).toBeTruthy();
  expect(await response.text()).toBe(''); // No body for HEAD
});

test("Content type detection is not affected by middleware order", async () => {
  // Test that wrong content type doesn't get parsed by wrong middleware
  const response = await fetch(`http://localhost:${TEST_PORT}/api/text/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: 'data' })
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.hasBody).toBe(false); // Should not be parsed by text middleware
});
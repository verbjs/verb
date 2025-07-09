import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../../src/index";

let server: any;
const TEST_PORT = 3333;

beforeAll(async () => {
  const app = createServer();
  
  // Basic routes
  app.get('/', (req, res) => {
    res.send('Hello World!');
  });
  app.get('/json', (req, res) => {
    res.json({ hello: 'world' });
  });
  app.get('/users/:id', (req, res) => {
    const { id } = req.params!;
    res.json({ id, name: `User ${id}` });
  });
  
  app.post('/users', async (req, res) => {
    const body = await req.json();
    res.status(201).json({ id: 'new-id', ...body });
  });
  
  app.put('/users/:id', async (req, res) => {
    const { id } = req.params!;
    const body = await req.json();
    res.json({ id, ...body });
  });
  
  app.delete('/users/:id', (req, res) => {
    const { id } = req.params!;
    res.json({ deleted: id });
  });
  
  // Query parameters
  app.get('/search', (req, res) => {
    const { q, limit } = req.query!;
    res.json({ query: q, limit: limit || '10' });
  });
  
  server = app.listen(TEST_PORT);
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(() => {
  if (server) {
    server.stop();
  }
});

test("GET / - basic route", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/`);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('Hello World!');
});

test("GET /json - JSON response", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/json`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ hello: 'world' });
});

test("GET /users/:id - path parameters", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/users/123`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: '123', name: 'User 123' });
});

test("POST /users - create with JSON body", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'John', email: 'john@example.com' })
  });
  
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ 
    id: 'new-id', 
    name: 'John', 
    email: 'john@example.com' 
  });
});

test("PUT /users/:id - update with path params and body", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/users/456`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Jane' })
  });
  
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ 
    id: '456', 
    name: 'Jane' 
  });
});

test("DELETE /users/:id - delete with path params", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/users/789`, {
    method: 'DELETE'
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deleted: '789' });
});

test("GET /search - query parameters", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/search?q=test&limit=5`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ 
    query: 'test', 
    limit: '5' 
  });
});

test("GET /search - query parameters with defaults", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/search?q=hello`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ 
    query: 'hello', 
    limit: '10' 
  });
});

test("GET /not-found - 404 response", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/not-found`);
  expect(response.status).toBe(404);
  expect(await response.text()).toBe('Not Found');
});

test("POST / - method not allowed (route exists but wrong method)", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/`, {
    method: 'POST'
  });
  expect(response.status).toBe(404);
});
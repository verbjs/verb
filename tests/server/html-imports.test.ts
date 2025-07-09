import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../../src/index";

let server: any;
const TEST_PORT = 3334;

beforeAll(async () => {
  const app = createServer();
  
  // Configure with HTML routes
  app.withRoutes({
    '/': new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body><h1>Hello HTML!</h1></body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    }),
    '/api/test': {
      GET: () => Response.json({ message: 'API works' })
    }
  });
  
  // Start server
  server = app.listen(TEST_PORT);
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(() => {
  if (server) {
    server.stop();
  }
});

test("HTML route serves HTML content", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/html');
  
  const html = await response.text();
  expect(html).toContain('<h1>Hello HTML!</h1>');
  expect(html).toContain('<title>Test</title>');
});

test("API route works alongside HTML routes", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/api/test`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: 'API works' });
});

test("Non-existent route returns 404", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/not-found`);
  expect(response.status).toBe(404);
});
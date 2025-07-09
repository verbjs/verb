import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../../src/index";

let server: any;
const TEST_PORT = 3335;

beforeAll(async () => {
  const app = createServer();
  
  app.get('/', (req, res) => {
    res.send('Dev server');
  });
  
  server = app.listen(TEST_PORT, 'localhost', { 
    hmr: true, 
    console: true 
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(() => {
  if (server) {
    server.stop();
  }
});

test("Development server starts with HMR options", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/`);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('Dev server');
});

test("withOptions works", async () => {
  const app = createServer();
  app.get('/test', (req, res) => {
    res.send('Options test');
  });
  
  app.withOptions({
    port: 3336,
    hostname: 'localhost',
    development: {
      hmr: false,
      console: false
    }
  });
  
  const testServer = app.listen();
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const response = await fetch('http://localhost:3336/test');
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('Options test');
  
  testServer.stop();
});
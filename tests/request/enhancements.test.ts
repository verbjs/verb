import { test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../../src/index";

let server: any;
const TEST_PORT = 3344;

beforeAll(async () => {
  const app = createServer();

  // Test route that returns request properties
  app.get('/test-request', (req, res) => {
    res.json({
      cookies: req.cookies,
      ip: req.ip,
      path: req.path,
      hostname: req.hostname,
      protocol: req.protocol,
      secure: req.secure,
      xhr: req.xhr,
      userAgent: req.get?.('user-agent'),
      customHeader: req.get?.('x-custom-header')
    });
  });

  // Test route for cookie parsing
  app.get('/cookies', (req, res) => {
    res.json({ cookies: req.cookies });
  });

  // Test route for header access
  app.get('/headers', (req, res) => {
    res.json({
      contentType: req.get?.('content-type'),
      authorization: req.get?.('authorization'),
      customHeader: req.get?.('x-test-header')
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

// Cookie Parsing Tests
test("req.cookies parses single cookie", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/cookies`, {
    headers: {
      'Cookie': 'session=abc123'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.cookies).toEqual({ session: 'abc123' });
});

test("req.cookies parses multiple cookies", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/cookies`, {
    headers: {
      'Cookie': 'session=abc123; user=john; theme=dark'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.cookies).toEqual({
    session: 'abc123',
    user: 'john',
    theme: 'dark'
  });
});

test("req.cookies handles cookies with special characters", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/cookies`, {
    headers: {
      'Cookie': 'token=eyJ0eXAiOiJKV1Q=; preferences=color%3Dred%26size%3Dlarge'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.cookies).toEqual({
    token: 'eyJ0eXAiOiJKV1Q=',
    preferences: 'color%3Dred%26size%3Dlarge'
  });
});

test("req.cookies returns empty object when no cookies", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/cookies`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.cookies).toEqual({});
});

// IP Address Tests
test("req.ip extracts IP from x-forwarded-for header", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'X-Forwarded-For': '203.0.113.195, 70.41.3.18, 150.172.238.178'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ip).toBe('203.0.113.195');
});

test("req.ip extracts IP from x-real-ip header", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'X-Real-IP': '192.168.1.100'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ip).toBe('192.168.1.100');
});

test("req.ip extracts IP from cf-connecting-ip header", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'CF-Connecting-IP': '10.0.0.1'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ip).toBe('10.0.0.1');
});

test("req.ip falls back to unknown when no IP headers", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ip).toBe('unknown');
});

// Path Tests
test("req.path returns path without query string", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request?foo=bar&baz=qux`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.path).toBe('/test-request');
});

test("req.path returns path for root route", async () => {
  const app = createServer();
  app.get('/', (req, res) => {
    res.json({ path: req.path });
  });
  
  const tempServer = app.listen(3345);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const response = await fetch('http://localhost:3345/');
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.path).toBe('/');
  
  tempServer.stop();
});

// Hostname Tests
test("req.hostname extracts hostname from host header", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'Host': 'example.com:8080'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.hostname).toBe('example.com');
});

test("req.hostname falls back to localhost", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.hostname).toBe('localhost');
});

// Protocol Tests
test("req.protocol detects https from x-forwarded-proto", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'X-Forwarded-Proto': 'https'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe('https');
  expect(data.secure).toBe(true);
});

test("req.protocol defaults to http", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe('http');
  expect(data.secure).toBe(false);
});

// XHR Detection Tests
test("req.xhr detects XMLHttpRequest", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.xhr).toBe(true);
});

test("req.xhr returns false for regular requests", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.xhr).toBe(false);
});

// Header Getter Tests
test("req.get() retrieves header values", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/headers`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
      'X-Test-Header': 'custom-value'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.contentType).toBe('application/json');
  expect(data.authorization).toBe('Bearer token123');
  expect(data.customHeader).toBe('custom-value');
});

test("req.get() returns undefined for non-existent headers", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/headers`);
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.contentType).toBeUndefined();
  expect(data.authorization).toBeUndefined();
  expect(data.customHeader).toBeUndefined();
});

test("req.get() is case-insensitive", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request`, {
    headers: {
      'User-Agent': 'Test-Browser/1.0'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.userAgent).toBe('Test-Browser/1.0');
});

// Integration Test - All Properties
test("All request enhancements work together", async () => {
  const response = await fetch(`http://localhost:${TEST_PORT}/test-request?test=value`, {
    headers: {
      'Cookie': 'session=abc123; user=john',
      'X-Forwarded-For': '203.0.113.195',
      'X-Forwarded-Proto': 'https',
      'Host': 'api.example.com',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Test-Client/1.0',
      'X-Custom-Header': 'test-value'
    }
  });
  
  expect(response.status).toBe(200);
  const data = await response.json();
  
  expect(data.cookies).toEqual({ session: 'abc123', user: 'john' });
  expect(data.ip).toBe('203.0.113.195');
  expect(data.path).toBe('/test-request');
  expect(data.hostname).toBe('api.example.com');
  expect(data.protocol).toBe('https');
  expect(data.secure).toBe(true);
  expect(data.xhr).toBe(true);
  expect(data.userAgent).toBe('Test-Client/1.0');
  expect(data.customHeader).toBe('test-value');
});
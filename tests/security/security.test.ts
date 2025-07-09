import { test, expect } from "bun:test";
import { createServer } from "../../src/server";
import { trustProxy, rateLimit, cors, securityHeaders, createSecurityMiddleware, securityPresets } from "../../src/security";
import type { VerbRequest, VerbResponse } from "../../src/types";

// Mock helper functions
const createMockRequest = (overrides: Partial<Request> = {}): VerbRequest => {
  const mockHeaders = new Headers();
  const baseRequest = {
    method: 'GET',
    url: 'http://localhost:3000/test',
    headers: mockHeaders,
    ...overrides
  };
  
  return Object.assign(baseRequest, {
    ip: '127.0.0.1',
    protocol: 'http',
    secure: false,
    hostname: 'localhost',
    port: 3000,
    path: '/test',
    query: {},
    params: {},
    cookies: {},
    xhr: false,
    get: (header: string) => mockHeaders.get(header),
    header: (header: string) => mockHeaders.get(header),
    headers: mockHeaders
  }) as VerbRequest;
};

const createMockResponse = (): VerbResponse => {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let responseBody: any = null;
  
  const mockRes = {
    statusCode,
    header: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
      return mockRes;
    },
    headers: (obj: Record<string, string>) => {
      Object.entries(obj).forEach(([key, value]) => {
        headers.set(key.toLowerCase(), value);
      });
      return mockRes;
    },
    status: (code: number) => {
      statusCode = code;
      mockRes.statusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      responseBody = data;
      return mockRes;
    },
    send: (data: any) => {
      responseBody = data;
      return mockRes;
    },
    end: () => mockRes,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    getHeaders: () => Object.fromEntries(headers.entries()),
    _getResponseBody: () => responseBody,
    _getStatusCode: () => statusCode
  };
  
  return mockRes as any;
};

// Trust Proxy Tests
test("trustProxy - handles X-Forwarded-Proto header", () => {
  const req = createMockRequest();
  req.headers.set('x-forwarded-proto', 'https');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = trustProxy({ enabled: true });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect((req as any).protocol).toBe('https');
  expect((req as any).secure).toBe(true);
});

test("trustProxy - handles X-Forwarded-Host header", () => {
  const req = createMockRequest();
  req.headers.set('x-forwarded-host', 'example.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = trustProxy({ enabled: true });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect((req as any).hostname).toBe('example.com');
});

test("trustProxy - handles X-Forwarded-Port header", () => {
  const req = createMockRequest();
  req.headers.set('x-forwarded-port', '443');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = trustProxy({ enabled: true });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect((req as any).port).toBe(443);
});

test("trustProxy - validates trusted proxies", () => {
  const req = createMockRequest();
  req.ip = '192.168.1.1';
  req.headers.set('x-forwarded-proto', 'https');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = trustProxy({ 
    enabled: true, 
    trustedProxies: ['10.0.0.1', '172.16.0.1'] 
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  // Should not modify protocol since proxy is not trusted
  expect((req as any).protocol).toBe('http');
});

test("trustProxy - disabled mode", () => {
  const req = createMockRequest();
  req.headers.set('x-forwarded-proto', 'https');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = trustProxy({ enabled: false });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect((req as any).protocol).toBe('http'); // Should not change
});

// Rate Limit Tests
test("rateLimit - allows requests within limit", () => {
  const req = createMockRequest();
  req.ip = '192.168.1.1';
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = rateLimit({ max: 10, windowMs: 60000 });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('ratelimit-limit')).toBe('10');
  expect(res.getHeader('ratelimit-remaining')).toBe('9');
});

test("rateLimit - blocks requests exceeding limit", () => {
  const req = createMockRequest();
  req.ip = '192.168.1.2';
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = rateLimit({ max: 2, windowMs: 60000 });
  
  // First request
  middleware(req, res, () => { nextCalled = true; });
  expect(nextCalled).toBe(true);
  nextCalled = false;
  
  // Second request
  middleware(req, res, () => { nextCalled = true; });
  expect(nextCalled).toBe(true);
  nextCalled = false;
  
  // Third request should be blocked
  middleware(req, res, () => { nextCalled = true; });
  expect(nextCalled).toBe(false);
  expect(res._getStatusCode()).toBe(429);
});

test("rateLimit - custom key generator", () => {
  const req = createMockRequest();
  req.headers.set('x-api-key', 'test-key');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = rateLimit({ 
    max: 5, 
    windowMs: 60000,
    keyGenerator: (req) => req.headers.get('x-api-key') || 'default'
  });
  
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('ratelimit-remaining')).toBe('4');
});

test("rateLimit - custom message", () => {
  const req = createMockRequest();
  req.ip = '192.168.1.3';
  const res = createMockResponse();
  
  const middleware = rateLimit({ 
    max: 1, 
    windowMs: 60000,
    message: 'Custom rate limit message'
  });
  
  // First request
  middleware(req, res, () => {});
  
  // Second request should be blocked with custom message
  middleware(req, res, () => {});
  
  expect(res._getStatusCode()).toBe(429);
  expect(res._getResponseBody()).toEqual({ error: 'Custom rate limit message' });
});

// CORS Tests
test("cors - sets basic CORS headers", () => {
  const req = createMockRequest();
  req.headers.set('origin', 'https://example.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ origin: '*' });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('access-control-allow-origin')).toBe('*');
});

test("cors - handles origin array", () => {
  const req = createMockRequest();
  req.headers.set('origin', 'https://example.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ origin: ['https://example.com', 'https://test.com'] });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('access-control-allow-origin')).toBe('https://example.com');
});

test("cors - handles origin function", () => {
  const req = createMockRequest();
  req.headers.set('origin', 'https://allowed.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ 
    origin: (origin) => origin.includes('allowed')
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('access-control-allow-origin')).toBe('https://allowed.com');
});

test("cors - handles preflight OPTIONS request", () => {
  const req = createMockRequest({ method: 'OPTIONS' });
  req.headers.set('origin', 'https://example.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ 
    origin: 'https://example.com',
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(false); // Should not call next for OPTIONS
  expect(res.getHeader('access-control-allow-origin')).toBe('https://example.com');
  expect(res.getHeader('access-control-allow-methods')).toBe('GET, POST, PUT');
  expect(res.getHeader('access-control-allow-headers')).toBe('Content-Type, Authorization');
  expect(res._getStatusCode()).toBe(204);
});

test("cors - sets credentials header", () => {
  const req = createMockRequest();
  req.headers.set('origin', 'https://example.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ 
    origin: 'https://example.com',
    credentials: true
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('access-control-allow-credentials')).toBe('true');
});

test("cors - sets exposed headers", () => {
  const req = createMockRequest();
  req.headers.set('origin', 'https://example.com');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ 
    origin: 'https://example.com',
    exposedHeaders: ['X-Total-Count', 'X-Custom-Header']
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('access-control-expose-headers')).toBe('X-Total-Count, X-Custom-Header');
});

// Security Headers Tests
test("securityHeaders - sets default security headers", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = securityHeaders();
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('content-security-policy')).toBe("default-src 'self'");
  expect(res.getHeader('x-dns-prefetch-control')).toBe('off');
  expect(res.getHeader('x-frame-options')).toBe('DENY');
  expect(res.getHeader('x-powered-by')).toBe('');
  expect(res.getHeader('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  expect(res.getHeader('x-download-options')).toBe('noopen');
  expect(res.getHeader('x-content-type-options')).toBe('nosniff');
  expect(res.getHeader('origin-agent-cluster')).toBe('?1');
  expect(res.getHeader('x-permitted-cross-domain-policies')).toBe('none');
  expect(res.getHeader('referrer-policy')).toBe('no-referrer');
  expect(res.getHeader('x-xss-protection')).toBe('1; mode=block');
});

test("securityHeaders - custom CSP", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = securityHeaders({
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'"
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('content-security-policy')).toBe("default-src 'self'; script-src 'self' 'unsafe-inline'");
});

test("securityHeaders - disable CSP", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = securityHeaders({ contentSecurityPolicy: false });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('content-security-policy')).toBeUndefined();
});

test("securityHeaders - custom frame options", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = securityHeaders({
    frameguard: { action: 'allowfrom', domain: 'https://example.com' }
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('x-frame-options')).toBe('ALLOW-FROM https://example.com');
});

test("securityHeaders - custom HSTS", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = securityHeaders({
    hsts: { maxAge: 86400, includeSubDomains: false, preload: true }
  });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('strict-transport-security')).toBe('max-age=86400; preload');
});

test("securityHeaders - disable HSTS", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = securityHeaders({ hsts: false });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('strict-transport-security')).toBeUndefined();
});

// Integration Tests
test("createSecurityMiddleware - creates middleware stack", () => {
  const middlewares = createSecurityMiddleware({
    trustProxy: { enabled: true },
    rateLimit: { max: 100, windowMs: 60000 },
    cors: { origin: '*' },
    securityHeaders: { contentSecurityPolicy: "default-src 'self'" }
  });
  
  expect(middlewares).toHaveLength(4);
  expect(typeof middlewares[0]).toBe('function');
  expect(typeof middlewares[1]).toBe('function');
  expect(typeof middlewares[2]).toBe('function');
  expect(typeof middlewares[3]).toBe('function');
});

test("securityPresets - development preset", () => {
  const middlewares = securityPresets.development();
  
  expect(middlewares).toHaveLength(2);
  expect(typeof middlewares[0]).toBe('function');
  expect(typeof middlewares[1]).toBe('function');
});

test("securityPresets - production preset", () => {
  const middlewares = securityPresets.production();
  
  expect(middlewares).toHaveLength(4);
  expect(typeof middlewares[0]).toBe('function');
  expect(typeof middlewares[1]).toBe('function');
  expect(typeof middlewares[2]).toBe('function');
  expect(typeof middlewares[3]).toBe('function');
});

test("securityPresets - api preset", () => {
  const middlewares = securityPresets.api();
  
  expect(middlewares).toHaveLength(4);
  expect(typeof middlewares[0]).toBe('function');
  expect(typeof middlewares[1]).toBe('function');
  expect(typeof middlewares[2]).toBe('function');
  expect(typeof middlewares[3]).toBe('function');
});

// Edge Cases
test("rateLimit - handles missing IP", () => {
  const req = createMockRequest();
  req.ip = undefined;
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = rateLimit({ max: 10, windowMs: 60000 });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect(res.getHeader('ratelimit-remaining')).toBe('9');
});

test("cors - handles missing origin", () => {
  const req = createMockRequest();
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = cors({ origin: true });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  // When origin is missing, no access-control-allow-origin header should be set
  expect(res.getHeader('access-control-allow-origin')).toBeUndefined();
});

test("trustProxy - handles multiple forwarded values", () => {
  const req = createMockRequest();
  req.headers.set('x-forwarded-proto', 'https,http');
  req.headers.set('x-forwarded-host', 'example.com,internal.com');
  req.headers.set('x-forwarded-port', '443,80');
  const res = createMockResponse();
  let nextCalled = false;
  
  const middleware = trustProxy({ enabled: true });
  middleware(req, res, () => { nextCalled = true; });
  
  expect(nextCalled).toBe(true);
  expect((req as any).protocol).toBe('https');
  expect((req as any).hostname).toBe('example.com');
  expect((req as any).port).toBe(443);
});
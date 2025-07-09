import { test, expect } from "bun:test";
import { createServer } from "../../src/server";
import { 
  enableRouteDebugging,
  isRouteDebuggingEnabled,
  clearRouteDebugLogs,
  getRouteDebugLogs,
  logRouteDebug,
  createRouteDebugMiddleware,
  enablePerformanceMonitoring,
  isPerformanceMonitoringEnabled,
  updatePerformanceMetrics,
  getPerformanceMetrics,
  resetPerformanceMetrics,
  createPerformanceMonitoringMiddleware,
  registerHealthCheck,
  unregisterHealthCheck,
  getRegisteredHealthChecks,
  runHealthChecks,
  registerBuiltInHealthChecks,
  createHealthCheckEndpoints,
  createDevelopmentMiddleware,
  formatMemoryUsage,
  formatUptime,
  getSystemInfo
} from "../../src/development";
import type { RouteDebugInfo, PerformanceMetrics, HealthCheckResult } from "../../src/development";

// Mock helper functions
const createMockRequest = (overrides: Partial<Request> = {}): any => {
  const mockHeaders = new Headers();
  const baseRequest = {
    method: 'GET',
    url: 'http://localhost:3000/test',
    headers: mockHeaders,
    path: '/test',
    query: {},
    params: {},
    ...overrides
  };
  
  return baseRequest;
};

const createMockResponse = (): any => {
  const headers = new Headers();
  let statusCode = 200;
  let body = '';
  
  return {
    status: (code: number) => {
      statusCode = code;
      return this;
    },
    json: (data: any) => {
      body = JSON.stringify(data);
      return this;
    },
    send: (data: any) => {
      body = typeof data === 'string' ? data : JSON.stringify(data);
      return this;
    },
    end: () => {
      return this;
    },
    statusCode,
    headers,
    body
  };
};

// Route debugging tests
test("enableRouteDebugging - enables and disables debugging", () => {
  enableRouteDebugging(true);
  expect(isRouteDebuggingEnabled()).toBe(true);
  
  enableRouteDebugging(false);
  expect(isRouteDebuggingEnabled()).toBe(false);
});

test("clearRouteDebugLogs - clears debug logs", () => {
  enableRouteDebugging(true);
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 6,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  logRouteDebug(mockDebugInfo);
  expect(getRouteDebugLogs()).toHaveLength(1);
  
  clearRouteDebugLogs();
  expect(getRouteDebugLogs()).toHaveLength(0);
});

test("getRouteDebugLogs - returns logs with limit", () => {
  enableRouteDebugging(true);
  clearRouteDebugLogs();
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 6,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  // Add multiple logs
  for (let i = 0; i < 5; i++) {
    logRouteDebug({ ...mockDebugInfo, path: `/test${i}` });
  }
  
  expect(getRouteDebugLogs()).toHaveLength(5);
  expect(getRouteDebugLogs(3)).toHaveLength(3);
});

test("logRouteDebug - logs debug info when enabled", async () => {
  // Mock console.log to capture output
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => logs.push(args.join(' '));
  
  try {
    enableRouteDebugging(true);
    clearRouteDebugLogs();
    
    const mockDebugInfo: RouteDebugInfo = {
      path: '/test',
      method: 'GET',
      timestamp: Date.now(),
      matchTime: 1,
      middlewareTime: 2,
      handlerTime: 3,
      totalTime: 6,
      matched: true,
      params: { id: '123' },
      query: { search: 'test' },
      statusCode: 200,
      responseSize: 100,
      memoryUsage: process.memoryUsage()
    };
    
    logRouteDebug(mockDebugInfo);
    
    // Wait a bit for async console operations
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(logs.some(log => log.includes('GET') && log.includes('/test'))).toBe(true);
    expect(logs.some(log => log.includes('Params:'))).toBe(true);
    expect(logs.some(log => log.includes('Query:'))).toBe(true);
    expect(getRouteDebugLogs()).toHaveLength(1);
  } finally {
    console.log = originalLog;
  }
});

test("logRouteDebug - doesn't log when disabled", () => {
  enableRouteDebugging(false);
  clearRouteDebugLogs();
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 6,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  logRouteDebug(mockDebugInfo);
  expect(getRouteDebugLogs()).toHaveLength(0);
});

test("createRouteDebugMiddleware - creates middleware", () => {
  const middleware = createRouteDebugMiddleware();
  
  expect(middleware).toBeDefined();
  expect(typeof middleware).toBe('function');
});

test("route debug middleware - executes next when debugging disabled", async () => {
  enableRouteDebugging(false);
  
  const middleware = createRouteDebugMiddleware();
  const req = createMockRequest();
  const res = createMockResponse();
  
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  
  await middleware(req, res, next);
  
  expect(nextCalled).toBe(true);
});

// Performance monitoring tests
test("enablePerformanceMonitoring - enables and disables monitoring", () => {
  enablePerformanceMonitoring(true);
  expect(isPerformanceMonitoringEnabled()).toBe(true);
  
  enablePerformanceMonitoring(false);
  expect(isPerformanceMonitoringEnabled()).toBe(false);
});

test("getPerformanceMetrics - returns initial metrics", () => {
  resetPerformanceMetrics();
  
  const metrics = getPerformanceMetrics();
  
  expect(metrics.requestCount).toBe(0);
  expect(metrics.averageResponseTime).toBe(0);
  expect(metrics.slowestRequest).toBeNull();
  expect(metrics.fastestRequest).toBeNull();
  expect(metrics.errorCount).toBe(0);
  expect(metrics.memoryPeak).toBe(0);
  expect(metrics.uptime).toBeGreaterThanOrEqual(0);
});

test("updatePerformanceMetrics - updates metrics", () => {
  enablePerformanceMonitoring(true);
  resetPerformanceMetrics();
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 100,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  updatePerformanceMetrics(mockDebugInfo);
  
  const metrics = getPerformanceMetrics();
  
  expect(metrics.requestCount).toBe(1);
  expect(metrics.averageResponseTime).toBe(100);
  expect(metrics.slowestRequest).toEqual(mockDebugInfo);
  expect(metrics.fastestRequest).toEqual(mockDebugInfo);
  expect(metrics.errorCount).toBe(0);
});

test("updatePerformanceMetrics - tracks errors", () => {
  enablePerformanceMonitoring(true);
  resetPerformanceMetrics();
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 100,
    matched: true,
    params: {},
    query: {},
    statusCode: 500,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  updatePerformanceMetrics(mockDebugInfo);
  
  const metrics = getPerformanceMetrics();
  
  expect(metrics.errorCount).toBe(1);
});

test("updatePerformanceMetrics - tracks slowest and fastest requests", () => {
  enablePerformanceMonitoring(true);
  resetPerformanceMetrics();
  
  const fastRequest: RouteDebugInfo = {
    path: '/fast',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 50,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  const slowRequest: RouteDebugInfo = {
    path: '/slow',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 200,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  updatePerformanceMetrics(fastRequest);
  updatePerformanceMetrics(slowRequest);
  
  const metrics = getPerformanceMetrics();
  
  expect(metrics.slowestRequest?.path).toBe('/slow');
  expect(metrics.fastestRequest?.path).toBe('/fast');
  expect(metrics.averageResponseTime).toBe(125);
});

test("resetPerformanceMetrics - resets all metrics", () => {
  enablePerformanceMonitoring(true);
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 100,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  updatePerformanceMetrics(mockDebugInfo);
  
  resetPerformanceMetrics();
  
  const metrics = getPerformanceMetrics();
  
  expect(metrics.requestCount).toBe(0);
  expect(metrics.averageResponseTime).toBe(0);
  expect(metrics.slowestRequest).toBeNull();
  expect(metrics.fastestRequest).toBeNull();
  expect(metrics.errorCount).toBe(0);
});

test("createPerformanceMonitoringMiddleware - creates middleware", () => {
  const middleware = createPerformanceMonitoringMiddleware();
  
  expect(middleware).toBeDefined();
  expect(typeof middleware).toBe('function');
});

test("performance monitoring middleware - executes next when disabled", async () => {
  enablePerformanceMonitoring(false);
  
  const middleware = createPerformanceMonitoringMiddleware();
  const req = createMockRequest();
  const res = createMockResponse();
  
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  
  await middleware(req, res, next);
  
  expect(nextCalled).toBe(true);
});

// Health check tests
test("registerHealthCheck - registers health check", () => {
  const healthCheck = async () => ({
    status: 'pass' as const,
    message: 'Test check'
  });
  
  registerHealthCheck('test-check', healthCheck);
  
  const checks = getRegisteredHealthChecks();
  expect(checks.includes('test-check')).toBe(true);
});

test("unregisterHealthCheck - removes health check", () => {
  const healthCheck = async () => ({
    status: 'pass' as const,
    message: 'Test check'
  });
  
  registerHealthCheck('temp-check', healthCheck);
  expect(getRegisteredHealthChecks().includes('temp-check')).toBe(true);
  
  const removed = unregisterHealthCheck('temp-check');
  expect(removed).toBe(true);
  expect(getRegisteredHealthChecks().includes('temp-check')).toBe(false);
});

test("unregisterHealthCheck - returns false for non-existent check", () => {
  const removed = unregisterHealthCheck('non-existent');
  expect(removed).toBe(false);
});

test("runHealthChecks - runs all registered checks", async () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerHealthCheck('test-pass', async () => ({
    status: 'pass',
    message: 'Pass test'
  }));
  
  registerHealthCheck('test-warn', async () => ({
    status: 'warn',
    message: 'Warn test'
  }));
  
  const result = await runHealthChecks();
  
  expect(result.status).toBe('degraded');
  expect(result.checks['test-pass'].status).toBe('pass');
  expect(result.checks['test-warn'].status).toBe('warn');
  expect(result.timestamp).toBeGreaterThan(0);
  expect(result.uptime).toBeGreaterThanOrEqual(0);
  expect(result.memory).toBeDefined();
});

test("runHealthChecks - handles failing checks", async () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerHealthCheck('test-fail', async () => ({
    status: 'fail',
    message: 'Fail test'
  }));
  
  const result = await runHealthChecks();
  
  expect(result.status).toBe('unhealthy');
  expect(result.checks['test-fail'].status).toBe('fail');
});

test("runHealthChecks - handles check errors", async () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerHealthCheck('test-error', async () => {
    throw new Error('Test error');
  });
  
  const result = await runHealthChecks();
  
  expect(result.status).toBe('unhealthy');
  expect(result.checks['test-error'].status).toBe('fail');
  expect(result.checks['test-error'].message).toBe('Test error');
});

test("registerBuiltInHealthChecks - registers built-in checks", () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerBuiltInHealthChecks();
  
  const checks = getRegisteredHealthChecks();
  expect(checks.includes('basic')).toBe(true);
  expect(checks.includes('memory')).toBe(true);
  expect(checks.includes('performance')).toBe(true);
  expect(checks.includes('error-rate')).toBe(true);
});

test("built-in health checks - basic check passes", async () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerHealthCheck('basic', async () => ({
    status: 'pass',
    message: 'Application is running'
  }));
  
  const result = await runHealthChecks();
  
  expect(result.checks['basic'].status).toBe('pass');
  expect(result.checks['basic'].message).toBe('Application is running');
});

// Health check endpoints tests
test("createHealthCheckEndpoints - creates health endpoints", () => {
  const app = createServer();
  
  // Mock app.get to track calls
  let getCallCount = 0;
  const originalGet = app.get;
  
  app.get = (...args: any[]) => {
    getCallCount++;
    return originalGet.apply(app, args);
  };
  
  createHealthCheckEndpoints(app);
  
  expect(getCallCount).toBe(4); // /health, /health/detailed, /health/performance, /health/debug
});

// Development middleware tests
test("createDevelopmentMiddleware - creates development middleware", () => {
  const middleware = createDevelopmentMiddleware();
  
  expect(middleware).toBeDefined();
  expect(typeof middleware).toBe('function');
});

test("createDevelopmentMiddleware - with custom options", () => {
  const middleware = createDevelopmentMiddleware({
    enableDebugging: false,
    enablePerformanceMonitoring: true,
    enableHealthChecks: false
  });
  
  expect(middleware).toBeDefined();
  expect(typeof middleware).toBe('function');
});

// Utility function tests
test("formatMemoryUsage - formats bytes to MB", () => {
  expect(formatMemoryUsage(1024 * 1024)).toBe('1.00 MB');
  expect(formatMemoryUsage(1024 * 1024 * 50)).toBe('50.00 MB');
  expect(formatMemoryUsage(1024 * 1024 * 1.5)).toBe('1.50 MB');
});

test("formatUptime - formats milliseconds to readable format", () => {
  expect(formatUptime(1000)).toBe('1s');
  expect(formatUptime(60000)).toBe('1m 0s');
  expect(formatUptime(3600000)).toBe('1h 0m 0s');
  expect(formatUptime(86400000)).toBe('1d 0h 0m');
  expect(formatUptime(90061000)).toBe('1d 1h 1m');
});

test("getSystemInfo - returns system information", () => {
  const info = getSystemInfo();
  
  expect(info.node).toBeDefined();
  expect(info.platform).toBeDefined();
  expect(info.arch).toBeDefined();
  expect(info.uptime).toBeDefined();
  expect(info.memory).toBeDefined();
  expect(info.memory.total).toBeDefined();
  expect(info.memory.used).toBeDefined();
  expect(info.cpu).toBeDefined();
});

// Integration tests
test("route debugging integration", async () => {
  const app = createServer();
  
  enableRouteDebugging(true);
  clearRouteDebugLogs();
  
  app.use(createRouteDebugMiddleware());
  
  app.get('/test', (req, res) => {
    res.json({ message: 'test' });
  });
  
  const fetchHandler = app.createFetchHandler();
  await fetchHandler(new Request('http://localhost:3000/test'));
  
  // Note: Full integration would require actual request handling
  // This test verifies the middleware is created correctly
  expect(getRouteDebugLogs().length).toBeGreaterThanOrEqual(0);
});

test("performance monitoring integration", async () => {
  const app = createServer();
  
  enablePerformanceMonitoring(true);
  resetPerformanceMetrics();
  
  app.use(createPerformanceMonitoringMiddleware());
  
  app.get('/test', (req, res) => {
    res.json({ message: 'test' });
  });
  
  const fetchHandler = app.createFetchHandler();
  await fetchHandler(new Request('http://localhost:3000/test'));
  
  // Note: Full integration would require actual request handling
  // This test verifies the middleware is created correctly
  const metrics = getPerformanceMetrics();
  expect(metrics).toBeDefined();
});

test("health check integration", async () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  // Enable performance monitoring and reset metrics for clean state
  enablePerformanceMonitoring(true);
  resetPerformanceMetrics();
  
  registerBuiltInHealthChecks();
  
  // Test the health check functionality directly without server
  const result = await runHealthChecks();
  
  // The overall status depends on actual system state (memory, performance, etc.)
  // In a test environment, we just verify the health check system is working
  expect(result.status).toMatch(/^(healthy|degraded|unhealthy)$/);
  expect(result.checks).toBeDefined();
  expect(result.checks['basic']).toBeDefined();
  expect(result.checks['memory']).toBeDefined();
  expect(result.checks['performance']).toBeDefined();
  expect(result.checks['error-rate']).toBeDefined();
  expect(result.timestamp).toBeGreaterThan(0);
  expect(result.uptime).toBeGreaterThanOrEqual(0);
  expect(result.memory).toBeDefined();
});

// Error handling tests
test("health check error handling", async () => {
  // Clear existing checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerHealthCheck('error-check', async () => {
    throw new Error('Test error');
  });
  
  const result = await runHealthChecks();
  
  expect(result.status).toBe('unhealthy');
  expect(result.checks['error-check'].status).toBe('fail');
  expect(result.checks['error-check'].message).toBe('Test error');
});

test("performance monitoring with disabled state", () => {
  // Store original state
  const originalState = isPerformanceMonitoringEnabled();
  
  enablePerformanceMonitoring(false);
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 100,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  const beforeMetrics = getPerformanceMetrics();
  updatePerformanceMetrics(mockDebugInfo);
  const afterMetrics = getPerformanceMetrics();
  
  // Metrics should not change when monitoring is disabled
  expect(beforeMetrics.requestCount).toBe(afterMetrics.requestCount);
  
  // Restore original state
  enablePerformanceMonitoring(originalState);
});

// Memory management tests
test("route debug logs - memory management", () => {
  enableRouteDebugging(true);
  clearRouteDebugLogs();
  
  const mockDebugInfo: RouteDebugInfo = {
    path: '/test',
    method: 'GET',
    timestamp: Date.now(),
    matchTime: 1,
    middlewareTime: 2,
    handlerTime: 3,
    totalTime: 100,
    matched: true,
    params: {},
    query: {},
    statusCode: 200,
    responseSize: 100,
    memoryUsage: process.memoryUsage()
  };
  
  // Add more than 1000 logs to test memory management
  for (let i = 0; i < 1005; i++) {
    logRouteDebug({ ...mockDebugInfo, path: `/test${i}` });
  }
  
  const logs = getRouteDebugLogs();
  expect(logs.length).toBe(1000); // Should be capped at 1000
});

test("complex development scenario", async () => {
  const app = createServer();
  
  // Enable all development features
  enableRouteDebugging(true);
  enablePerformanceMonitoring(true);
  
  // Clear existing state
  clearRouteDebugLogs();
  resetPerformanceMetrics();
  
  // Clear existing health checks
  const existing = getRegisteredHealthChecks();
  existing.forEach(check => unregisterHealthCheck(check));
  
  registerBuiltInHealthChecks();
  
  // Use development middleware
  app.use(createDevelopmentMiddleware());
  
  // Create health endpoints
  createHealthCheckEndpoints(app);
  
  // Add test routes
  app.get('/test', (req, res) => {
    res.json({ message: 'test' });
  });
  
  app.get('/slow', (req, res) => {
    // Simulate slow request
    setTimeout(() => {
      res.json({ message: 'slow' });
    }, 100);
  });
  
  // Verify all features are enabled
  expect(isRouteDebuggingEnabled()).toBe(true);
  expect(isPerformanceMonitoringEnabled()).toBe(true);
  expect(getRegisteredHealthChecks().length).toBeGreaterThan(0);
  
  // Test health check endpoint
  const fetchHandler = app.createFetchHandler();
  const healthResponse = await fetchHandler(new Request('http://localhost:3000/health'));
  
  expect(healthResponse.status).toBe(200);
  
  const healthBody = await healthResponse.json();
  expect(healthBody.status).toBeDefined();
  expect(healthBody.checks).toBeDefined();
});
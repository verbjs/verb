import { test, expect, mock } from "bun:test";
import { createServer } from "../../src/index";

test("showRoutes option logs routes when enabled", async () => {
  const app = createServer();
  
  // Add some routes
  app.get('/', (req, res) => res.send('Home'));
  app.get('/users/:id', (req, res) => res.send('User'));
  app.post('/users', (req, res) => res.send('Create'));
  
  // Mock console.log to capture output
  const mockLog = mock(() => {});
  const originalLog = console.log;
  console.log = mockLog;
  
  // Mock Bun.serve to avoid real server
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    // Configure with showRoutes enabled
    app.withOptions({
      port: 3337,
      showRoutes: true
    });
    
    // Start server (should trigger route logging)
    app.listen();
    
    // Check that routes were logged
    const logCalls = mockLog.mock.calls.map(call => call.join(' '));
    const logOutput = logCalls.join('\n');
    
    expect(logOutput).toContain('📋 HTTP Server Routes:');
    expect(logOutput).toContain('Traditional Routes:');
    expect(logOutput).toContain('GET     /');
    expect(logOutput).toContain('GET     /users/:id (params: id)');
    expect(logOutput).toContain('POST    /users');
    
    // Verify Bun.serve was called with correct config
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3337,
        hostname: "localhost",
        fetch: expect.any(Function)
      })
    );
  } finally {
    // Restore mocks
    console.log = originalLog;
    Bun.serve = originalServe;
  }
});

test("showRoutes disabled by default", async () => {
  const app = createServer();
  
  app.get('/test', (req, res) => res.send('Test'));
  
  // Mock console.log to capture output
  const mockLog = mock(() => {});
  const originalLog = console.log;
  console.log = mockLog;
  
  // Mock Bun.serve to avoid real server
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    // Configure without showRoutes (should default to false)
    app.withOptions({
      port: 3338
    });
    
    app.listen();
    
    // Should NOT contain route logging
    const logCalls = mockLog.mock.calls.map(call => call.join(' '));
    const logOutput = logCalls.join('\n');
    expect(logOutput).not.toContain('📋 HTTP Server Routes:');
    
  } finally {
    console.log = originalLog;
    Bun.serve = originalServe;
  }
});

test("showRoutes shows 'No routes registered' when no routes", async () => {
  const app = createServer();
  
  // Don't add any routes
  
  // Mock console.log to capture output
  const mockLog = mock(() => {});
  const originalLog = console.log;
  console.log = mockLog;
  
  // Mock Bun.serve to avoid real server
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.withOptions({
      port: 3339,
      showRoutes: true
    });
    
    app.listen();
    
    const logCalls = mockLog.mock.calls.map(call => call.join(' '));
    const logOutput = logCalls.join('\n');
    
    expect(logOutput).toContain('📋 HTTP Server Routes:');
    expect(logOutput).toContain('No routes registered');
    
  } finally {
    console.log = originalLog;
    Bun.serve = originalServe;
  }
});

test("showRoutes works with HTML routes", async () => {
  const app = createServer();
  
  // Add traditional route
  app.get('/api/test', (req, res) => res.send('API'));
  
  // Add HTML routes
  app.withRoutes({
    '/': new Response('<h1>Home</h1>', { headers: { 'Content-Type': 'text/html' } }),
    '/api/hello': {
      GET: () => Response.json({ message: 'Hello' })
    }
  });
  
  // Mock console.log to capture output
  const mockLog = mock(() => {});
  const originalLog = console.log;
  console.log = mockLog;
  
  // Mock Bun.serve to avoid real server
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.withOptions({
      port: 3340,
      showRoutes: true
    });
    
    app.listen();
    
    const logCalls = mockLog.mock.calls.map(call => call.join(' '));
    const logOutput = logCalls.join('\n');
    
    expect(logOutput).toContain('📋 HTTP Server Routes:');
    expect(logOutput).toContain('Traditional Routes:');
    expect(logOutput).toContain('GET     /api/test');
    expect(logOutput).toContain('HTML Routes:');
    expect(logOutput).toContain('GET     / (HTML import)');
    expect(logOutput).toContain('GET     /api/hello (HTML route)');
    
    // Verify Bun.serve was called with routes config
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3340,
        hostname: "localhost",
        routes: expect.objectContaining({
          '/': expect.any(Response),
          '/api/hello': expect.objectContaining({
            GET: expect.any(Function)
          })
        })
      })
    );
    
  } finally {
    console.log = originalLog;
    Bun.serve = originalServe;
  }
});
import { test, expect } from "bun:test";
import { createServer } from "../../src/index";

test("showRoutes option logs routes when enabled", async () => {
  const app = createServer();
  
  // Add some routes
  app.get('/', (req, res) => res.send('Home'));
  app.get('/users/:id', (req, res) => res.send('User'));
  app.post('/users', (req, res) => res.send('Create'));
  
  // Capture console output
  const originalLog = console.log;
  let logOutput = '';
  console.log = (...args) => {
    logOutput += args.join(' ') + '\n';
  };
  
  try {
    // Configure with showRoutes enabled
    app.withOptions({
      port: 3337,
      showRoutes: true
    });
    
    // Start server (should trigger route logging)
    const server = app.listen();
    
    // Wait a moment for logging
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Check that routes were logged
    expect(logOutput).toContain('📋 HTTP Server Routes:');
    expect(logOutput).toContain('Traditional Routes:');
    expect(logOutput).toContain('GET     /');
    expect(logOutput).toContain('GET     /users/:id (params: id)');
    expect(logOutput).toContain('POST    /users');
    
    server.stop();
  } finally {
    // Restore console.log
    console.log = originalLog;
  }
});

test("showRoutes disabled by default", async () => {
  const app = createServer();
  
  app.get('/test', (req, res) => res.send('Test'));
  
  // Capture console output
  const originalLog = console.log;
  let logOutput = '';
  console.log = (...args) => {
    logOutput += args.join(' ') + '\n';
  };
  
  try {
    // Configure without showRoutes (should default to false)
    app.withOptions({
      port: 3338
    });
    
    const server = app.listen();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should NOT contain route logging
    expect(logOutput).not.toContain('📋 Registered Routes:');
    
    server.stop();
  } finally {
    console.log = originalLog;
  }
});

test("showRoutes shows 'No routes registered' when no routes", async () => {
  const app = createServer();
  
  // Don't add any routes
  
  const originalLog = console.log;
  let logOutput = '';
  console.log = (...args) => {
    logOutput += args.join(' ') + '\n';
  };
  
  try {
    app.withOptions({
      port: 3339,
      showRoutes: true
    });
    
    const server = app.listen();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(logOutput).toContain('📋 HTTP Server Routes:');
    expect(logOutput).toContain('No routes registered');
    
    server.stop();
  } finally {
    console.log = originalLog;
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
  
  const originalLog = console.log;
  let logOutput = '';
  console.log = (...args) => {
    logOutput += args.join(' ') + '\n';
  };
  
  try {
    app.withOptions({
      port: 3340,
      showRoutes: true
    });
    
    const server = app.listen();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(logOutput).toContain('📋 HTTP Server Routes:');
    expect(logOutput).toContain('Traditional Routes:');
    expect(logOutput).toContain('GET     /api/test');
    expect(logOutput).toContain('HTML Routes:');
    expect(logOutput).toContain('GET     / (HTML import)');
    expect(logOutput).toContain('GET     /api/hello (HTML route)');
    
    server.stop();
  } finally {
    console.log = originalLog;
  }
});
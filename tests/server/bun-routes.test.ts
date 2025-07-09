import { test, expect, mock } from "bun:test";
import { createServer } from "../../src/index";

test("withRoutes supports all Bun route formats", async () => {
  const app = createServer();
  
  // Test all supported route formats
  app.withRoutes({
    // Direct Response object
    '/': new Response('<h1>Home</h1>', { 
      headers: { 'Content-Type': 'text/html' } 
    }),
    
    // Single handler function
    '/api/single': async (req) => {
      return Response.json({ method: req.method, url: req.url });
    },
    
    // Object with HTTP methods
    '/api/users': {
      GET: async (req) => {
        return Response.json([{ id: 1, name: 'John' }]);
      },
      POST: async (req) => {
        const body = await req.json();
        return Response.json({ id: 2, ...body });
      },
      PUT: async (req) => {
        const body = await req.json();
        return Response.json({ id: 1, ...body });
      },
      DELETE: async (req) => {
        return Response.json({ success: true });
      }
    },
    
    // Parameterized route
    '/api/users/:id': async (req) => {
      const { id } = req.params;
      return Response.json({ id, name: `User ${id}` });
    },
    
    // Complex parameterized route
    '/api/users/:userId/posts/:postId': async (req) => {
      const { userId, postId } = req.params;
      return Response.json({ userId, postId, title: `Post ${postId}` });
    }
  });
  
  // Mock Bun.serve to verify configuration
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    // Verify Bun.serve was called with routes object
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3000,
        hostname: "localhost",
        routes: expect.objectContaining({
          '/': expect.any(Response),
          '/api/single': expect.any(Function),
          '/api/users': expect.objectContaining({
            GET: expect.any(Function),
            POST: expect.any(Function),
            PUT: expect.any(Function),
            DELETE: expect.any(Function)
          }),
          '/api/users/:id': expect.any(Function),
          '/api/users/:userId/posts/:postId': expect.any(Function)
        })
      })
    );
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes handles empty routes object", async () => {
  const app = createServer();
  
  app.withRoutes({});
  
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: {}
      })
    );
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes works with development options", async () => {
  const app = createServer();
  
  app.withRoutes({
    '/': new Response('<h1>Dev Mode</h1>', { 
      headers: { 'Content-Type': 'text/html' } 
    })
  });
  
  app.withOptions({
    development: {
      hmr: true,
      console: true
    }
  });
  
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: expect.objectContaining({
          '/': expect.any(Response)
        }),
        development: {
          hmr: true,
          console: true
        }
      })
    );
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes without routes uses traditional fetch handler", async () => {
  const app = createServer();
  
  // Add traditional routes but no withRoutes
  app.get('/api/test', (req, res) => res.json({ message: 'test' }));
  
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    // Should use fetch handler, not routes
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch: expect.any(Function)
      })
    );
    
    // Should NOT have routes property
    const call = mockServe.mock.calls[0][0];
    expect(call).not.toHaveProperty('routes');
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes integrates with traditional routes for route display", async () => {
  const app = createServer();
  
  // Add traditional routes
  app.get('/api/traditional', (req, res) => res.json({ type: 'traditional' }));
  
  // Add HTML routes
  app.withRoutes({
    '/': new Response('<h1>HTML Route</h1>', { 
      headers: { 'Content-Type': 'text/html' } 
    }),
    '/api/html': {
      GET: () => Response.json({ type: 'html' })
    }
  });
  
  // Mock console.log to capture route display
  const mockLog = mock(() => {});
  const originalLog = console.log;
  console.log = mockLog;
  
  // Mock Bun.serve
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.withOptions({ showRoutes: true });
    app.listen(3000);
    
    const logCalls = mockLog.mock.calls.map(call => call.join(' '));
    const logOutput = logCalls.join('\n');
    
    // Should show both traditional and HTML routes
    expect(logOutput).toContain('Traditional Routes:');
    expect(logOutput).toContain('GET     /api/traditional');
    expect(logOutput).toContain('HTML Routes:');
    expect(logOutput).toContain('GET     / (HTML import)');
    expect(logOutput).toContain('GET     /api/html (HTML route)');
    
  } finally {
    console.log = originalLog;
    Bun.serve = originalServe;
  }
});
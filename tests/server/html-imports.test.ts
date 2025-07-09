import { test, expect, mock } from "bun:test";
import { createServer } from "../../src/index";

test("withRoutes configures HTML routes correctly", async () => {
  const app = createServer();
  
  const htmlResponse = new Response(`
    <!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body><h1>Hello HTML!</h1></body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
  
  const apiHandler = () => Response.json({ message: 'API works' });
  
  // Configure with HTML routes
  app.withRoutes({
    '/': htmlResponse,
    '/api/test': {
      GET: apiHandler
    }
  });
  
  // Mock Bun.serve to verify routes are passed correctly
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    // Verify Bun.serve was called with the correct routes
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3000,
        hostname: "localhost",
        routes: {
          '/': htmlResponse,
          '/api/test': {
            GET: apiHandler
          }
        }
      })
    );
    
    // Verify no fetch handler is used when routes are provided
    const call = mockServe.mock.calls[0][0];
    expect(call).not.toHaveProperty('fetch');
    
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes API routes work alongside HTML routes", async () => {
  const app = createServer();
  
  const getHandler = () => Response.json({ message: 'API works' });
  const getUsersHandler = () => Response.json([{ id: 1, name: 'John' }]);
  const postUsersHandler = async (req) => {
    const body = await req.json();
    return Response.json({ id: 2, ...body });
  };
  
  app.withRoutes({
    '/api/test': {
      GET: getHandler
    },
    '/api/users': {
      GET: getUsersHandler,
      POST: postUsersHandler
    }
  });
  
  // Mock Bun.serve to verify routes are passed correctly
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    // Verify Bun.serve was called with the correct routes
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: {
          '/api/test': {
            GET: getHandler
          },
          '/api/users': {
            GET: getUsersHandler,
            POST: postUsersHandler
          }
        }
      })
    );
    
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes parameterized routes work correctly", async () => {
  const app = createServer();
  
  const paramHandler = async (req) => {
    const { id } = req.params;
    return Response.json({ id, name: `User ${id}` });
  };
  
  app.withRoutes({
    '/api/users/:id': paramHandler
  });
  
  // Mock Bun.serve to verify routes are passed correctly
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    // Verify Bun.serve was called with the correct routes
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: {
          '/api/users/:id': paramHandler
        }
      })
    );
    
  } finally {
    Bun.serve = originalServe;
  }
});

test("withRoutes uses Bun's native routing system", async () => {
  const app = createServer();
  
  const handler = () => Response.json({ message: 'API works' });
  
  app.withRoutes({
    '/api/test': {
      GET: handler
    }
  });
  
  // Mock Bun.serve to verify routes are passed correctly
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;
  
  try {
    app.listen(3000);
    
    // Verify Bun.serve was called with routes (not fetch handler)
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: {
          '/api/test': {
            GET: handler
          }
        }
      })
    );
    
    // Verify no fetch handler is used when routes are provided
    const call = mockServe.mock.calls[0][0];
    expect(call).not.toHaveProperty('fetch');
    
  } finally {
    Bun.serve = originalServe;
  }
});
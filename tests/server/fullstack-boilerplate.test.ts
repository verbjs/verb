import { test, expect, mock } from "bun:test";
import { createServer, ServerProtocol } from "../../src/index";

test("Fullstack boilerplate pattern - withRoutes for HTML and API", async () => {
  const app = createServer(ServerProtocol.HTTP);
  
  // Mock data
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];
  
  const products = [
    { id: 1, name: 'Laptop', price: 999.99, inStock: true },
    { id: 2, name: 'Phone', price: 599.99, inStock: false }
  ];

  // Mock HTML imports
  const indexHtml = new Response('<html><body><div id="root"></div></body></html>', {
    headers: { 'Content-Type': 'text/html' }
  });
  const apiHtml = new Response('<html><body><h1>API Demo</h1></body></html>', {
    headers: { 'Content-Type': 'text/html' }
  });

  app.withRoutes({
    // ** HTML imports **
    "/": indexHtml,
    "/api-demo": apiHtml,

    // ** API endpoints ** (Verb + Bun v1.2.3+ pattern)
    "/api/users": {
      async GET() {
        return Response.json(users);
      },
      async POST(req: Request) {
        const { name, email } = await req.json();
        if (!name || !email) {
          return Response.json({ error: "Name and email are required" }, { status: 400 });
        }
        const newUser = { id: Date.now(), name, email };
        users.push(newUser);
        return Response.json(newUser, { status: 201 });
      },
    },
    "/api/users/:id": async (req: Request) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const id = parseInt(pathParts[pathParts.length - 1] || '0');
      const user = users.find(u => u.id === id);
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      return Response.json(user);
    },
    
    // Main API info endpoint
    "/api": async () => {
      return Response.json({
        message: "Verb + Bun Fullstack API",
        version: "1.0.0",
        endpoints: [
          "GET /api",
          "GET /api/health",
          "GET /api/users",
          "POST /api/users", 
          "GET /api/users/:id",
          "GET /api/products",
          "POST /api/products",
          "GET /api/products/:id"
        ]
      });
    },

    // Health check endpoint
    "/api/health": async () => {
      return Response.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    },

    // Products endpoints
    "/api/products": {
      async GET(req: Request) {
        const url = new URL(req.url);
        const inStockFilter = url.searchParams.get('inStock');
        
        if (inStockFilter !== null) {
          const filterValue = inStockFilter === 'true';
          const filtered = products.filter(p => p.inStock === filterValue);
          return Response.json(filtered);
        }
        
        return Response.json(products);
      },
      async POST(req: Request) {
        const { name, price, inStock = true } = await req.json();
        if (!name || price === undefined) {
          return Response.json({ error: "Name and price are required" }, { status: 400 });
        }
        const newProduct = { 
          id: Date.now(), 
          name, 
          price: parseFloat(price), 
          inStock: Boolean(inStock) 
        };
        products.push(newProduct);
        return Response.json(newProduct, { status: 201 });
      },
    },
    
    "/api/products/:id": async (req: Request) => {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const id = parseInt(pathParts[pathParts.length - 1] || '0');
      const product = products.find(p => p.id === id);
      if (!product) {
        return Response.json({ error: "Product not found" }, { status: 404 });
      }
      return Response.json(product);
    }
  });

  // Configure development options
  app.withOptions({
    port: 3001,
    hostname: 'localhost',
    development: {
      hmr: true,     // Hot module reloading (Bun v1.2.3+ required)
      console: true  // Enhanced console output
    }
  });

  // Mock Bun.serve to verify configuration
  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;

  try {
    app.listen();

    // Verify Bun.serve was called with complete boilerplate configuration
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3001,
        hostname: "localhost",
        development: {
          hmr: true,
          console: true
        },
        routes: expect.objectContaining({
          // HTML routes
          '/': indexHtml,
          '/api-demo': apiHtml,
          
          // API routes with HTTP methods
          '/api/users': expect.objectContaining({
            GET: expect.any(Function),
            POST: expect.any(Function)
          }),
          
          // Single handler routes
          '/api': expect.any(Function),
          '/api/health': expect.any(Function),
          '/api/users/:id': expect.any(Function),
          
          // Products API
          '/api/products': expect.objectContaining({
            GET: expect.any(Function),
            POST: expect.any(Function)
          }),
          '/api/products/:id': expect.any(Function)
        })
      })
    );
  } finally {
    Bun.serve = originalServe;
  }
});

test("TypeScript support for withRoutes handlers", async () => {
  const app = createServer(ServerProtocol.HTTP);

  // Test that handlers can be typed properly
  const typedGetHandler = async (req: Request): Promise<Response> => {
    return Response.json({ method: req.method });
  };

  const typedPostHandler = async (req: Request): Promise<Response> => {
    const body = await req.json();
    return Response.json({ received: body });
  };

  app.withRoutes({
    "/api/typed": {
      GET: typedGetHandler,
      POST: typedPostHandler
    }
  });

  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;

  try {
    app.listen();

    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: expect.objectContaining({
          '/api/typed': expect.objectContaining({
            GET: typedGetHandler,
            POST: typedPostHandler
          })
        })
      })
    );
  } finally {
    Bun.serve = originalServe;
  }
});

test("Error handling in withRoutes API endpoints", async () => {
  const app = createServer(ServerProtocol.HTTP);

  app.withRoutes({
    "/api/error-test": {
      async GET() {
        return Response.json({ error: "Not found" }, { status: 404 });
      },
      async POST(req: Request) {
        try {
          const body = await req.json();
          if (!body.name) {
            return Response.json({ error: "Name is required" }, { status: 400 });
          }
          return Response.json({ success: true, name: body.name });
        } catch (error) {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
      }
    }
  });

  const mockServe = mock(() => ({ stop: () => {} }));
  const originalServe = Bun.serve;
  Bun.serve = mockServe;

  try {
    app.listen();

    const call = mockServe.mock.calls[0][0];
    expect(call.routes['/api/error-test']).toBeDefined();
    expect(call.routes['/api/error-test'].GET).toBeFunction();
    expect(call.routes['/api/error-test'].POST).toBeFunction();
  } finally {
    Bun.serve = originalServe;
  }
});
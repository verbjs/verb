# Routing

This guide covers Verb's powerful routing system, including traditional routing and Bun native routes.

## Basic Routing

### HTTP Methods

Verb supports all standard HTTP methods:

```typescript
import { createServer } from "verb";

const app = createServer();

// Basic routes
app.get("/", (req, res) => {
  res.json({ message: "GET request" });
});

app.post("/users", (req, res) => {
  res.json({ message: "POST request" });
});

app.put("/users/:id", (req, res) => {
  res.json({ message: "PUT request" });
});

app.delete("/users/:id", (req, res) => {
  res.json({ message: "DELETE request" });
});

app.patch("/users/:id", (req, res) => {
  res.json({ message: "PATCH request" });
});

app.head("/users", (req, res) => {
  res.status(200).end();
});

app.options("/users", (req, res) => {
  res.status(200).end();
});
```

### Route Parameters

#### Path Parameters

```typescript
const app = createServer();

// Single parameter
app.get("/users/:id", (req, res) => {
  const userId = req.params.id;
  res.json({ userId });
});

// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Optional parameters
app.get("/posts/:year/:month?", (req, res) => {
  const { year, month } = req.params;
  res.json({ year, month: month || "all" });
});
```

#### Query Parameters

```typescript
const app = createServer();

app.get("/search", (req, res) => {
  const { q, page, limit } = req.query;
  res.json({ 
    query: q,
    page: page || 1,
    limit: limit || 10
  });
});

// URL: /search?q=typescript&page=2&limit=20
```

### Route Patterns

#### Wildcards

```typescript
const app = createServer();

// Wildcard routes
app.get("/files/*", (req, res) => {
  const filePath = req.params[0]; // Everything after /files/
  res.json({ filePath });
});

// Named wildcards
app.get("/api/*/users", (req, res) => {
  const version = req.params[0];
  res.json({ version, users: [] });
});
```

#### Regular Expressions

```typescript
const app = createServer();

// RegExp patterns
app.get(/.*fly$/, (req, res) => {
  res.json({ message: "Ends with 'fly'" });
});

// Named regex parameters
app.get("/users/:id(\\d+)", (req, res) => {
  const userId = req.params.id; // Only matches numbers
  res.json({ userId });
});
```

## Route Arrays

Define multiple paths for the same handler:

```typescript
const app = createServer();

// Multiple paths
app.get(["/home", "/", "/index"], (req, res) => {
  res.json({ message: "Home page" });
});

// With parameters
app.get(["/user/:id", "/profile/:id"], (req, res) => {
  res.json({ userId: req.params.id });
});
```

## Route Chaining

Chain multiple handlers for the same route:

```typescript
const app = createServer();

app.route("/users/:id")
  .get((req, res) => {
    res.json({ action: "get", id: req.params.id });
  })
  .post((req, res) => {
    res.json({ action: "post", id: req.params.id });
  })
  .put((req, res) => {
    res.json({ action: "put", id: req.params.id });
  })
  .delete((req, res) => {
    res.json({ action: "delete", id: req.params.id });
  });
```

## Route Middleware

### Route-Specific Middleware

```typescript
const app = createServer();

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Verify token...
  next();
};

// Apply middleware to specific route
app.get("/protected", authenticate, (req, res) => {
  res.json({ message: "Protected resource" });
});

// Multiple middleware
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
};

app.get("/api/users", logger, authenticate, (req, res) => {
  res.json({ users: [] });
});
```

### Path-Based Middleware

```typescript
const app = createServer();

// Apply middleware to all routes starting with /api
app.use("/api", (req, res, next) => {
  res.header("X-API-Version", "1.0");
  next();
});

// Apply to specific method and path
app.use("/admin", authenticate, (req, res, next) => {
  // Admin-specific middleware
  next();
});
```

## Sub-Applications

Mount sub-applications at specific paths:

```typescript
const app = createServer();
const apiApp = createServer();

// API routes
apiApp.get("/users", (req, res) => {
  res.json({ users: [] });
});

apiApp.get("/posts", (req, res) => {
  res.json({ posts: [] });
});

// Mount API app at /api
app.use("/api", apiApp);

// Now accessible at /api/users and /api/posts
```

## Router Module

Create modular routers:

```typescript
import { Router } from "verb";

// Create router
const userRouter = Router();

userRouter.get("/", (req, res) => {
  res.json({ users: [] });
});

userRouter.get("/:id", (req, res) => {
  res.json({ user: { id: req.params.id } });
});

userRouter.post("/", (req, res) => {
  res.json({ created: true });
});

// Use router in main app
const app = createServer();
app.use("/users", userRouter);
```

## Bun Native Routes

Verb supports Bun's native routing system for fullstack applications:

### Basic Native Routes

```typescript
import { createServer } from "verb";

const app = createServer();

app.withRoutes({
  // Direct Response objects
  "/": new Response("Hello World", {
    headers: { "Content-Type": "text/plain" }
  }),
  
  // HTML responses
  "/about": new Response(`
    <html>
      <head><title>About</title></head>
      <body><h1>About Page</h1></body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  }),
  
  // JSON responses
  "/api/health": new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" }
  })
});
```

### HTML Imports

```typescript
import { createServer } from "verb";
import homepage from "./index.html";
import dashboard from "./dashboard.html";

const app = createServer();

app.withRoutes({
  // HTML files with automatic bundling
  "/": homepage,
  "/dashboard": dashboard
});
```

### API Routes with Methods

```typescript
const app = createServer();

app.withRoutes({
  "/api/users": {
    async GET(req) {
      const users = await getUsersFromDB();
      return Response.json(users);
    },
    
    async POST(req) {
      const userData = await req.json();
      const user = await createUser(userData);
      return Response.json(user, { status: 201 });
    },
    
    async PUT(req) {
      const userData = await req.json();
      const user = await updateUser(userData);
      return Response.json(user);
    },
    
    async DELETE(req) {
      await deleteUser(req.params.id);
      return new Response(null, { status: 204 });
    }
  }
});
```

### Parameterized Native Routes

```typescript
const app = createServer();

app.withRoutes({
  // Single parameter
  "/api/users/:id": async (req) => {
    const { id } = req.params;
    const user = await getUserById(id);
    return Response.json(user);
  },
  
  // Multiple parameters
  "/api/users/:userId/posts/:postId": async (req) => {
    const { userId, postId } = req.params;
    const post = await getPostByIds(userId, postId);
    return Response.json(post);
  },
  
  // With HTTP methods
  "/api/posts/:id": {
    async GET(req) {
      const post = await getPost(req.params.id);
      return Response.json(post);
    },
    
    async PUT(req) {
      const { id } = req.params;
      const data = await req.json();
      const post = await updatePost(id, data);
      return Response.json(post);
    },
    
    async DELETE(req) {
      await deletePost(req.params.id);
      return new Response(null, { status: 204 });
    }
  }
});
```

### Mixed Traditional and Native Routes

```typescript
const app = createServer();

// Traditional routes (processed by Verb)
app.get("/api/legacy", (req, res) => {
  res.json({ legacy: true });
});

// Native routes (processed by Bun)
app.withRoutes({
  "/": new Response("Native route"),
  "/api/native": {
    GET: () => Response.json({ native: true })
  }
});

// Traditional routes work alongside native routes
app.get("/api/mixed", (req, res) => {
  res.json({ mixed: true });
});
```

## Route Patterns and Matching

### Route Priority

Routes are matched in the order they're defined:

```typescript
const app = createServer();

// More specific routes first
app.get("/users/admin", (req, res) => {
  res.json({ message: "Admin user" });
});

app.get("/users/:id", (req, res) => {
  res.json({ userId: req.params.id });
});

// /users/admin will match the first route
// /users/123 will match the second route
```

### Case Sensitivity

```typescript
const app = createServer();

// Case sensitive routing (default: false)
app.set("case sensitive routing", true);

app.get("/Users", (req, res) => {
  res.json({ path: "/Users" });
});

// /users will return 404
// /Users will return the response
```

### Strict Routing

```typescript
const app = createServer();

// Strict routing (default: false)
app.set("strict routing", true);

app.get("/users", (req, res) => {
  res.json({ users: [] });
});

// /users will work
// /users/ will return 404 (with strict routing)
```

## Route Debugging

### Show Routes

```typescript
const app = createServer();

app.get("/", (req, res) => res.json({ message: "Home" }));
app.get("/users/:id", (req, res) => res.json({ id: req.params.id }));

app.withRoutes({
  "/native": Response.json({ native: true })
});

// Show all registered routes
app.withOptions({ showRoutes: true });

app.listen(3000);
// Output:
// 📋 HTTP Server Routes:
// ======================
//   Traditional Routes:
//     GET     /
//     GET     /users/:id (params: id)
//   HTML Routes:
//     GET     /native (HTML import)
```

### Route Introspection

```typescript
const app = createServer();

// Access router for introspection
const routes = app.router.getRoutes();
console.log("Registered routes:", routes);

// Get specific route info
const route = app.router.match("GET", "/users/123");
console.log("Matched route:", route);
```

## Advanced Routing

### Dynamic Route Loading

```typescript
const app = createServer();

// Load routes from directory
const routeFiles = await Bun.glob("./routes/*.ts");
for (const file of routeFiles) {
  const route = await import(file);
  app.use(route.path, route.handler);
}
```

### Route Versioning

```typescript
const app = createServer();

// Version-specific routes
app.use("/api/v1", (req, res, next) => {
  res.locals.version = "v1";
  next();
});

app.use("/api/v2", (req, res, next) => {
  res.locals.version = "v2";
  next();
});

// Version-specific handlers
app.get("/api/v1/users", (req, res) => {
  res.json({ users: [], version: "v1" });
});

app.get("/api/v2/users", (req, res) => {
  res.json({ users: [], version: "v2", enhanced: true });
});
```

### Route Caching

```typescript
const app = createServer();

// Enable route caching for better performance
app.withOptions({
  routeCache: true,
  cacheSize: 1000
});

// Pre-compile routes
app.withOptions({
  precompileRoutes: true
});
```

## Error Handling in Routes

### Route-Level Error Handling

```typescript
const app = createServer();

app.get("/error", (req, res) => {
  try {
    // Potentially throwing code
    throw new Error("Something went wrong");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Async error handling
app.get("/async-error", async (req, res) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Global Error Handler

```typescript
const app = createServer();

app.get("/throw", (req, res) => {
  throw new Error("Intentional error");
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Route error:", error);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: error.message 
  });
});
```

## Best Practices

1. **Route Organization**: Group related routes together
2. **Middleware First**: Apply middleware before route handlers
3. **Error Handling**: Always handle errors in route handlers
4. **Parameter Validation**: Validate route parameters
5. **Consistent Responses**: Use consistent response formats
6. **Performance**: Use route caching for high-traffic applications

## Next Steps

- [Middleware](/guide/middleware) - Learn about middleware patterns
- [Request & Response](/guide/request-response) - Understand request/response handling
- [Bun Native Routes](/guide/bun-routes) - Deep dive into Bun's routing system
- [Examples](/examples/) - See routing examples in action
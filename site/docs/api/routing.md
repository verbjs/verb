# Routing API

Complete API reference for Verb's routing system including HTTP methods, route parameters, and middleware.

## Core Routing Methods

### app.get(path, ...handlers)

Register a GET route handler.

```typescript
app.get(path: string, ...handlers: RouteHandler[]): VerbApplication
```

**Parameters:**
- `path` - Route path with optional parameters (e.g., `/users/:id`)
- `handlers` - One or more route handler functions

**Example:**
```typescript
app.get("/users", (req, res) => {
  res.json({ users: [] });
});

app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({ userId: id });
});
```

### app.post(path, ...handlers)

Register a POST route handler.

```typescript
app.post(path: string, ...handlers: RouteHandler[]): VerbApplication
```

**Example:**
```typescript
app.post("/users", (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

### app.put(path, ...handlers)

Register a PUT route handler.

```typescript
app.put(path: string, ...handlers: RouteHandler[]): VerbApplication
```

### app.patch(path, ...handlers)

Register a PATCH route handler.

```typescript
app.patch(path: string, ...handlers: RouteHandler[]): VerbApplication
```

### app.delete(path, ...handlers)

Register a DELETE route handler.

```typescript
app.delete(path: string, ...handlers: RouteHandler[]): VerbApplication
```

### app.head(path, ...handlers)

Register a HEAD route handler.

```typescript
app.head(path: string, ...handlers: RouteHandler[]): VerbApplication
```

### app.options(path, ...handlers)

Register an OPTIONS route handler.

```typescript
app.options(path: string, ...handlers: RouteHandler[]): VerbApplication
```

### app.all(path, ...handlers)

Register a handler for all HTTP methods.

```typescript
app.all(path: string, ...handlers: RouteHandler[]): VerbApplication
```

**Example:**
```typescript
app.all("/api/*", authenticate); // Apply to all methods
```

## Route Patterns

### Static Routes

```typescript
app.get("/about", handler);
app.get("/api/users", handler);
```

### Route Parameters

```typescript
// Single parameter
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
});

// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, res) => {
  const { userId, postId } = req.params;
});

// Optional parameters
app.get("/posts/:id?", (req, res) => {
  const { id } = req.params; // undefined if not provided
});
```

### Wildcard Routes

```typescript
// Catch-all
app.get("/files/*", (req, res) => {
  const path = req.params["*"]; // Everything after /files/
});

// Named wildcards
app.get("/api/*/users", (req, res) => {
  const version = req.params["*"];
});
```

### Regular Expression Routes

```typescript
// Custom pattern
app.get(/.*fly$/, (req, res) => {
  // Matches any path ending with "fly"
});

// With capture groups
app.get(/^\/users\/(\d+)$/, (req, res) => {
  const id = req.params[0]; // First capture group
});
```

## Route Handler Types

### Basic Handler

```typescript
type RouteHandler = (
  req: VerbRequest,
  res: VerbResponse,
  next?: NextFunction
) => void | Promise<void>;
```

### Middleware Handler

```typescript
type MiddlewareHandler = (
  req: VerbRequest,
  res: VerbResponse,
  next: NextFunction
) => void | Promise<void>;
```

### Error Handler

```typescript
type ErrorHandler = (
  error: Error,
  req: VerbRequest,
  res: VerbResponse,
  next: NextFunction
) => void | Promise<void>;
```

## Middleware

### app.use(middleware)

Register global middleware.

```typescript
app.use(middleware: MiddlewareHandler): VerbApplication
```

**Example:**
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

### app.use(path, middleware)

Register middleware for specific paths.

```typescript
app.use(path: string, middleware: MiddlewareHandler): VerbApplication
```

**Example:**
```typescript
app.use("/api", authenticate);
app.use("/admin", authorize("admin"));
```

## Router Class

### Creating Routers

```typescript
import { Router } from "verb";

const router = new Router();

router.get("/users", getUsersHandler);
router.post("/users", createUserHandler);

app.use("/api", router);
```

### Router Methods

All the same methods as the main app:

```typescript
router.get(path, ...handlers)
router.post(path, ...handlers)
router.put(path, ...handlers)
router.patch(path, ...handlers)
router.delete(path, ...handlers)
router.head(path, ...handlers)
router.options(path, ...handlers)
router.all(path, ...handlers)
router.use(middleware)
router.use(path, middleware)
```

### Router Options

```typescript
const router = new Router({
  caseSensitive: false,    // Case-sensitive routing
  mergeParams: false,      // Merge parent params
  strict: false            // Strict routing
});
```

## Route Matching

### Match Priority

Routes are matched in the order they are defined:

```typescript
app.get("/users/new", handler1);     // Higher priority
app.get("/users/:id", handler2);     // Lower priority
```

### Path Normalization

Paths are normalized automatically:

```typescript
app.get("/users/", handler);    // Same as "/users"
app.get("/users", handler);     // Same as "/users/"
```

## Advanced Routing

### Conditional Routing

```typescript
app.get("/users/:id", 
  (req, res, next) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    next();
  },
  getUserHandler
);
```

### Route-specific Middleware

```typescript
app.get("/protected", 
  authenticate,
  authorize("admin"),
  protectedHandler
);
```

### Error Handling

```typescript
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    res.json(user);
  } catch (error) {
    next(error); // Pass to error handler
  }
});

// Error handler
app.use((error, req, res, next) => {
  res.status(500).json({ error: error.message });
});
```

## Bun Native Routes

### withRoutes(routes)

Configure Bun-style routes.

```typescript
app.withRoutes(routes: BunRoutes): VerbApplication
```

**Example:**
```typescript
import homepage from "./index.html";

app.withRoutes({
  "/": homepage,
  "/api/users": {
    GET: async () => Response.json(await getUsers()),
    POST: async (req) => {
      const user = await createUser(await req.json());
      return Response.json(user, { status: 201 });
    }
  },
  "/api/users/:id": {
    GET: async (req) => {
      const user = await getUser(req.params.id);
      return Response.json(user);
    }
  }
});
```

### BunRoutes Type

```typescript
type BunRouteHandler = (req: Request) => Response | Promise<Response>;

type BunRoutes = {
  [path: string]: 
    | BunRouteHandler
    | { [method: string]: BunRouteHandler }
    | any; // For HTML imports
};
```

## Route Information

### Getting Route Info

```typescript
// Get all registered routes
const routes = app.getRoutes();

// Get routes for specific method
const getRoutes = app.getRoutes("GET");

// Check if route exists
const exists = app.hasRoute("GET", "/users");
```

### Route Metadata

```typescript
interface RouteInfo {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware: MiddlewareHandler[];
  params: string[];
  regexp: RegExp;
}
```

## Performance Considerations

### Route Optimization

```typescript
// Prefer specific routes first
app.get("/users/active", getActiveUsers);  // Specific
app.get("/users/:id", getUser);            // Parameter

// Use router for grouped routes
const apiRouter = new Router();
apiRouter.get("/users", getUsers);
apiRouter.post("/users", createUser);
app.use("/api", apiRouter);
```

### Caching Routes

```typescript
// Routes are compiled and cached automatically
// No manual optimization needed
```

## Testing Routes

```typescript
import { test, expect } from "bun:test";

test("route handling", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ success: true });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
});
```

## Common Patterns

### RESTful Routes

```typescript
const router = new Router();

router.get("/users", getUsers);           // GET /users
router.get("/users/:id", getUser);        // GET /users/:id
router.post("/users", createUser);        // POST /users
router.put("/users/:id", updateUser);     // PUT /users/:id
router.delete("/users/:id", deleteUser);  // DELETE /users/:id

app.use("/api", router);
```

### Nested Resources

```typescript
router.get("/users/:userId/posts", getUserPosts);
router.get("/users/:userId/posts/:id", getUserPost);
router.post("/users/:userId/posts", createUserPost);
```

### API Versioning

```typescript
const v1Router = new Router();
const v2Router = new Router();

v1Router.get("/users", getUsersV1);
v2Router.get("/users", getUsersV2);

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
```

## Error Handling

### Route Not Found

```typescript
// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
    method: req.method
  });
});
```

### Method Not Allowed

```typescript
app.use((req, res, next) => {
  const allowedMethods = app.getAllowedMethods(req.path);
  
  if (allowedMethods.length > 0 && !allowedMethods.includes(req.method)) {
    res.header("Allow", allowedMethods.join(", "));
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  
  next();
});
```

## Migration Guide

### From Express

```typescript
// Express
app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

// Verb (same syntax)
app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});
```

### From Fastify

```typescript
// Fastify
fastify.get("/users/:id", async (request, reply) => {
  return { id: request.params.id };
});

// Verb
app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});
```

## Type Definitions

```typescript
interface VerbApplication {
  get(path: string, ...handlers: RouteHandler[]): VerbApplication;
  post(path: string, ...handlers: RouteHandler[]): VerbApplication;
  put(path: string, ...handlers: RouteHandler[]): VerbApplication;
  patch(path: string, ...handlers: RouteHandler[]): VerbApplication;
  delete(path: string, ...handlers: RouteHandler[]): VerbApplication;
  head(path: string, ...handlers: RouteHandler[]): VerbApplication;
  options(path: string, ...handlers: RouteHandler[]): VerbApplication;
  all(path: string, ...handlers: RouteHandler[]): VerbApplication;
  use(middleware: MiddlewareHandler): VerbApplication;
  use(path: string, middleware: MiddlewareHandler): VerbApplication;
  withRoutes(routes: BunRoutes): VerbApplication;
}

interface Router {
  get(path: string, ...handlers: RouteHandler[]): Router;
  post(path: string, ...handlers: RouteHandler[]): Router;
  put(path: string, ...handlers: RouteHandler[]): Router;
  patch(path: string, ...handlers: RouteHandler[]): Router;
  delete(path: string, ...handlers: RouteHandler[]): Router;
  head(path: string, ...handlers: RouteHandler[]): Router;
  options(path: string, ...handlers: RouteHandler[]): Router;
  all(path: string, ...handlers: RouteHandler[]): Router;
  use(middleware: MiddlewareHandler): Router;
  use(path: string, middleware: MiddlewareHandler): Router;
}
```
---
title: Router API Reference
description: Complete reference for the Verb routing system
---

# Verb Router API Reference

This document provides a comprehensive reference for the Verb routing system, which is responsible for matching HTTP requests to handlers and executing middleware.

## Router Types

Verb supports two types of routers:

1. **Manual Router**: Routes are defined programmatically using methods like `app.get()`, `app.post()`, etc.
2. **Filesystem Router**: Routes are automatically generated based on files in a directory structure.

## Manual Router

### createRouter

Creates a new manual router instance.

```typescript
const createRouter = () => Router;
```

**Returns:** A new router instance

### addRoute

Adds a route to a router.

```typescript
const addRoute = (
  router: Router, 
  method: Method, 
  path: string, 
  handler: Handler
) => void;
```

**Parameters:**
- `router`: The router instance
- `method`: HTTP method (GET, POST, PUT, DELETE, etc.)
- `path`: URL path pattern
- `handler`: Function that handles the request

**Example:**
```typescript
const router = createRouter();
addRoute(router, "GET", "/users", () => json([{ id: 1, name: "John" }]));
addRoute(router, "POST", "/users", async (req) => {
  const body = await parseBody(req);
  return json({ id: 2, ...body }, 201);
});
```

### addMiddleware

Adds middleware to a router.

```typescript
const addMiddleware = (router: Router, middleware: Middleware) => void;
```

**Parameters:**
- `router`: The router instance
- `middleware`: Middleware function

**Example:**
```typescript
const router = createRouter();
addMiddleware(router, async (req, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
});
```

### findRoute

Finds a route that matches a method and path.

```typescript
const findRoute = (
  router: Router, 
  method: Method, 
  pathname: string
) => RouteMatch | null;
```

**Parameters:**
- `router`: The router instance
- `method`: HTTP method
- `pathname`: URL path

**Returns:** A route match object or null if no match is found

### handleRequest

Handles an HTTP request using a router.

```typescript
const handleRequest = (
  router: Router, 
  req: Request
) => Promise<Response>;
```

**Parameters:**
- `router`: The router instance
- `req`: HTTP request

**Returns:** HTTP response

## Filesystem Router

### createFilesystemRouter

Creates a filesystem-based router.

```typescript
const createFilesystemRouter = (
  options?: FilesystemRouterOptions
) => FilesystemRouterState;
```

**Parameters:**
- `options`: Configuration options
  - `dir`: Root directory for routes (default: "./routes")
  - `extensions`: File extensions to include (default: [".js", ".ts", ".jsx", ".tsx"])
  - `ignorePatterns`: Patterns to ignore (default: ["**/*.test.*", "**/*.spec.*"])
  - `watchMode`: Enable file watching (default: false)

**Returns:** A filesystem router state

### scanRoutes

Scans a directory for route files and adds them to the router.

```typescript
const scanRoutes = (
  router: FilesystemRouterState, 
  dir?: string
) => Promise<void>;
```

**Parameters:**
- `router`: The filesystem router state
- `dir`: Directory to scan (defaults to router's configured directory)

### addFilesystemMiddleware

Adds middleware to a filesystem router.

```typescript
const addFilesystemMiddleware = (
  router: FilesystemRouterState, 
  middleware: Middleware
) => void;
```

**Parameters:**
- `router`: The filesystem router state
- `middleware`: Middleware function

### findFilesystemRoute

Finds a route in a filesystem router.

```typescript
const findFilesystemRoute = (
  router: FilesystemRouterState, 
  method: Method, 
  pathname: string
) => RouteMatch | null;
```

**Parameters:**
- `router`: The filesystem router state
- `method`: HTTP method
- `pathname`: URL path

**Returns:** A route match object or null if no match is found

### handleFilesystemRequest

Handles an HTTP request using a filesystem router.

```typescript
const handleFilesystemRequest = (
  router: FilesystemRouterState, 
  req: Request
) => Promise<Response>;
```

**Parameters:**
- `router`: The filesystem router state
- `req`: HTTP request

**Returns:** HTTP response

### getFilesystemRoutes

Gets all routes in a filesystem router.

```typescript
const getFilesystemRoutes = (
  router: FilesystemRouterState
) => FileRoute[];
```

**Parameters:**
- `router`: The filesystem router state

**Returns:** Array of file routes

### reloadRoute

Reloads a specific route file.

```typescript
const reloadRoute = (
  router: FilesystemRouterState, 
  filePath: string
) => Promise<void>;
```

**Parameters:**
- `router`: The filesystem router state
- `filePath`: Path to the route file

### clearFilesystemRoutes

Clears all routes from a filesystem router.

```typescript
const clearFilesystemRoutes = (
  router: FilesystemRouterState
) => void;
```

**Parameters:**
- `router`: The filesystem router state

## Universal Router

### createUniversalRouter

Creates a universal router that can be either manual or filesystem-based.

```typescript
const createUniversalRouter = (
  type: RouterType, 
  options?: FilesystemRouterOptions
) => UniversalRouter;
```

**Parameters:**
- `type`: Router type ("manual" or "filesystem")
- `options`: Configuration options for filesystem router

**Returns:** A universal router instance

## Route Patterns

Verb supports various route patterns for flexible URL matching:

### Static Routes

Match exact paths:

```typescript
app.get("/users", handler);
```

### Dynamic Parameters

Match path segments and capture them as parameters:

```typescript
app.get("/users/:id", (req, params) => {
  const userId = params.id;
  return json({ id: userId });
});
```

### Optional Parameters

Match paths with optional segments:

```typescript
app.get("/posts/:id?", (req, params) => {
  if (params.id) {
    return json({ id: params.id });
  }
  return json([{ id: 1 }, { id: 2 }]);
});
```

### Wildcard Routes

Match any path after a prefix:

```typescript
app.get("/files/*", (req, params) => {
  const filePath = params["*"];
  return streamFile(`./public/${filePath}`);
});
```

### Regular Expression Routes

Match paths using regular expressions:

```typescript
app.get("/users/:id(\\d+)", (req, params) => {
  const userId = parseInt(params.id);
  return json({ id: userId });
});
```

## Middleware

Middleware functions process requests before they reach route handlers.

```typescript
type Middleware = (
  req: Request, 
  next: () => Promise<Response>
) => Promise<Response>;
```

**Example:**
```typescript
app.use(async (req, next) => {
  console.log(`${req.method} ${req.url}`);
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;
  console.log(`Request took ${duration}ms`);
  return response;
});
```

## Route Handlers

Route handlers process requests and return responses.

```typescript
type Handler = (
  req: Request, 
  params: Record<string, string>
) => Response | Promise<Response>;
```

**Example:**
```typescript
app.get("/users/:id", (req, params) => {
  const userId = params.id;
  return json({ id: userId, name: "John Doe" });
});
```

## Mounting Applications

You can mount one application inside another at a specific path prefix.

```typescript
const mountApp = (
  router: Router, 
  basePath: string, 
  app: MountableApp
) => void;
```

**Parameters:**
- `router`: The router instance
- `basePath`: Base path to mount the application at
- `app`: Application to mount

**Example:**
```typescript
const mainApp = createServer({ port: 3000 });
const apiApp = createServer();

apiApp.get("/users", () => json([{ id: 1, name: "John" }]));
apiApp.post("/users", async (req) => {
  const body = await parseBody(req);
  return json({ id: 2, ...body }, 201);
});

mainApp.mount("/api", apiApp);
// Now /api/users will be handled by apiApp
```

## Route Organization

### Grouping Routes

While Verb doesn't have a built-in route grouping mechanism, you can organize routes using functions:

```typescript
function userRoutes(app) {
  app.get("/users", listUsers);
  app.post("/users", createUser);
  app.get("/users/:id", getUser);
  app.put("/users/:id", updateUser);
  app.delete("/users/:id", deleteUser);
}

function postRoutes(app) {
  app.get("/posts", listPosts);
  app.post("/posts", createPost);
  app.get("/posts/:id", getPost);
  app.put("/posts/:id", updatePost);
  app.delete("/posts/:id", deletePost);
}

const app = createServer();
userRoutes(app);
postRoutes(app);
```

### Filesystem-based Organization

With the filesystem router, routes are organized based on file structure:

```
routes/
  index.ts         # Handles /
  users/
    index.ts       # Handles /users
    [id].ts        # Handles /users/:id
  posts/
    index.ts       # Handles /posts
    [id].ts        # Handles /posts/:id
    comments.ts    # Handles /posts/comments
```

## Performance Considerations

The Verb router is optimized for performance:

- **Radix Tree**: Uses a radix tree for efficient route matching
- **Route Caching**: Caches route lookups for better performance
- **Middleware Optimization**: Optimizes middleware execution
- **Lazy Loading**: Loads route handlers only when needed (for filesystem router)

## Best Practices

1. **Organize Routes Logically**: Group related routes together
2. **Use Middleware Wisely**: Apply middleware only where needed
3. **Validate Parameters**: Validate route parameters before using them
4. **Handle Errors**: Always handle potential errors in route handlers
5. **Use Descriptive Routes**: Make routes descriptive and follow REST conventions
6. **Cache Heavy Operations**: Cache results of heavy operations
7. **Use Proper HTTP Methods**: Use appropriate HTTP methods for operations
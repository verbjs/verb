---
title: Routing
description: Learn how to define and organize routes in Verb
---

# Routing in Verb

Routing is a core feature of Verb that allows you to define how your application responds to client requests. This guide covers the routing system in detail.

## Basic Routing

In Verb, routes are defined using HTTP method functions on the server instance:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

// Basic GET route
app.get("/", () => {
  return new Response("Hello, World!");
});

// POST route
app.post("/users", () => {
  return new Response("Create a user");
});

// PUT route
app.put("/users/:id", () => {
  return new Response("Update a user");
});

// DELETE route
app.delete("/users/:id", () => {
  return new Response("Delete a user");
});

// PATCH route
app.patch("/users/:id", () => {
  return new Response("Partially update a user");
});

// OPTIONS route
app.options("/users", () => {
  return new Response(null, {
    headers: {
      "Allow": "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    }
  });
});

// HEAD route
app.head("/users", () => {
  return new Response(null);
});
```

## Route Parameters

Verb supports dynamic route parameters, which are defined using the `:paramName` syntax:

```typescript
app.get("/users/:id", (req, params) => {
  return new Response(`User ID: ${params.id}`);
});

app.get("/posts/:postId/comments/:commentId", (req, params) => {
  return new Response(`Post ID: ${params.postId}, Comment ID: ${params.commentId}`);
});
```

## Wildcard Routes

You can use wildcards to match multiple paths:

```typescript
// Match any path under /files/
app.get("/files/*", (req) => {
  const path = req.url.replace("/files/", "");
  return new Response(`Requested file: ${path}`);
});
```

## Route Handlers

Route handlers receive two arguments:
1. The request object (`Request`)
2. The route parameters (if any)

```typescript
app.get("/users/:id", (req, params) => {
  // req: Request object
  // params: { id: "123" }
  
  return new Response(`User ID: ${params.id}`);
});
```

## Async Route Handlers

Route handlers can be asynchronous, allowing you to perform async operations:

```typescript
app.get("/users/:id", async (req, params) => {
  // Simulate fetching a user from a database
  const user = await fetchUserFromDatabase(params.id);
  
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  
  return new Response(JSON.stringify(user), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Route Groups

You can organize related routes using route groups:

```typescript
// API routes
const apiRoutes = app.group("/api");

apiRoutes.get("/users", () => {
  return new Response("Get all users");
});

apiRoutes.get("/users/:id", (req, params) => {
  return new Response(`Get user ${params.id}`);
});

// Admin routes with a prefix and middleware
const adminRoutes = app.group("/admin", [authMiddleware]);

adminRoutes.get("/dashboard", () => {
  return new Response("Admin dashboard");
});

adminRoutes.get("/users", () => {
  return new Response("Admin users list");
});
```

## Route Middleware

You can apply middleware to specific routes:

```typescript
import { createServer } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Authentication middleware
const auth: Middleware = (req, next) => {
  const token = req.headers.get("Authorization");
  
  if (!token || !token.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Continue to the next middleware or route handler
  return next();
};

// Logging middleware
const logger: Middleware = (req, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
};

// Apply middleware to a specific route
app.get("/protected", [auth, logger], () => {
  return new Response("Protected resource");
});

// Apply middleware to a group of routes
const apiRoutes = app.group("/api", [logger]);

apiRoutes.get("/users", () => {
  return new Response("Get all users");
});
```

## Route Priority

When multiple routes could match a request, Verb uses the following priority rules:

1. Exact matches (e.g., `/users`)
2. Parameter routes (e.g., `/users/:id`)
3. Wildcard routes (e.g., `/files/*`)

If multiple routes have the same priority, the first one defined will be used.

## All HTTP Methods

You can handle all HTTP methods for a path using the `all` method:

```typescript
app.all("/api", () => {
  return new Response("Handles all HTTP methods");
});
```

## Custom HTTP Methods

You can also handle custom HTTP methods:

```typescript
app.on("PROPFIND", "/webdav", () => {
  return new Response("WebDAV PROPFIND method");
});
```

## Route Not Found Handler

You can define a custom handler for routes that don't match any defined route:

```typescript
app.notFound((req) => {
  return new Response(`Route not found: ${req.url}`, {
    status: 404
  });
});
```

## Best Practices

- **Organize Routes**: Use route groups to organize related routes
- **Descriptive Paths**: Use descriptive and consistent path naming
- **Parameter Validation**: Validate route parameters in your handlers
- **Error Handling**: Provide appropriate error responses
- **HTTP Methods**: Use the appropriate HTTP method for each operation

## Next Steps

Now that you understand routing in Verb, you can explore related topics:

- [Middleware](/server/middleware) - Learn more about middleware
- [Request Handling](/server/request-handling) - Learn how to handle different types of requests
- [Response Types](/server/response-types) - Explore the different response types available in Verb
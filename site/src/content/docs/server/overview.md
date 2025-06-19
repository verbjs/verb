---
title: Server Overview
description: Learn about the core concepts of the Verb server
---

# Verb Server Overview

The `@verb/server` package is the core of the Verb library, providing a high-performance HTTP server built specifically for Bun. This guide provides an overview of the server's architecture and core concepts.

## Core Concepts

### Server Instance

The central component of Verb is the server instance, created using the `createServer` function:

```typescript
import { createServer } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});
```

The server instance provides methods for defining routes, adding middleware, and handling requests.

### Routing

Verb uses a fast, pattern-based routing system that supports URL parameters, wildcards, and middleware:

```typescript
// Basic route
app.get("/", () => new Response("Hello, World!"));

// Route with parameters
app.get("/users/:id", (req, params) => {
  return new Response(`User ID: ${params.id}`);
});

// Route with wildcard
app.get("/files/*", (req) => {
  // Handle file requests
});
```

### Request Handling

Verb provides a simple API for handling HTTP requests. Route handlers receive the request object and any URL parameters:

```typescript
app.get("/api/users/:id", (req, params) => {
  // req: Request object
  // params: { id: "123" }
  
  return new Response(`User ID: ${params.id}`);
});
```

### Response Types

Verb supports various response types, with helper functions for common formats:

```typescript
import { json, html, text } from "@verb/server";

// JSON response
app.get("/api/data", () => json({ message: "Hello, World!" }));

// HTML response
app.get("/page", () => html("<h1>Hello, World!</h1>"));

// Text response
app.get("/text", () => text("Hello, World!"));

// Raw Response
app.get("/custom", () => {
  return new Response("Custom response", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Custom-Header": "Value"
    }
  });
});
```

### Middleware

Middleware functions in Verb allow you to execute code before the route handler:

```typescript
import type { Middleware } from "@verb/server";

// Define middleware
const logger: Middleware = (req, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
};

// Apply middleware to all routes
app.use(logger);

// Apply middleware to specific routes
app.get("/admin", [authMiddleware, loggerMiddleware], () => {
  // Handler code
});
```

### Error Handling

Verb provides mechanisms for handling errors in your application:

```typescript
// Error response helper
app.get("/not-found", () => {
  return error("Resource not found", 404);
});

// Global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  return new Response("An unexpected error occurred", {
    status: 500
  });
});
```

## Server Configuration

When creating a server, you can provide various configuration options:

```typescript
const app = createServer({
  // Server port (default: 3000)
  port: 8080,
  
  // Host to bind to (default: "0.0.0.0")
  hostname: "localhost",
  
  // Development mode enables additional logging and error details
  development: true,
  
  // TLS/SSL configuration for HTTPS
  tls: {
    key: Bun.file("./key.pem"),
    cert: Bun.file("./cert.pem")
  },
  
  // Maximum request body size in bytes (default: 1MB)
  maxRequestBodySize: 5 * 1024 * 1024
});
```

## Performance Considerations

Verb is designed for high performance:

- **Minimal Overhead**: Verb adds minimal overhead to Bun's already fast HTTP server.
- **Efficient Routing**: The routing system is optimized for speed and memory efficiency.
- **Streaming Support**: Verb supports streaming responses for efficient handling of large data.
- **Async by Design**: All operations are designed to work efficiently with async/await patterns.

## Next Steps

Now that you understand the basics of the Verb server, you can explore more specific topics:

- [Routing](/server/routing) - Learn more about defining and organizing routes
- [Middleware](/server/middleware) - Dive deeper into middleware patterns
- [Request Handling](/server/request-handling) - Learn how to handle different types of requests
- [Response Types](/server/response-types) - Explore the different response types available in Verb
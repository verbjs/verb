---
title: Error Handling
description: Learn how to handle errors in Verb applications
---

# Error Handling in Verb

Proper error handling is crucial for building robust web applications. Verb provides several mechanisms for handling errors in your application. This guide covers error handling in detail.

## Basic Error Handling

The simplest way to handle errors in Verb is to use try/catch blocks in your route handlers:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

app.get("/api/users/:id", async (req, params) => {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id) || id <= 0) {
      return new Response("Invalid user ID", { status: 400 });
    }
    
    // Simulate database query
    const user = await fetchUser(id);
    
    if (!user) {
      return new Response("User not found", { status: 404 });
    }
    
    return new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    
    return new Response("Internal server error", { status: 500 });
  }
});
```

## Error Response Helper

Verb provides an `error` helper function for creating error responses:

```typescript
import { createServer, error } from "@verb/server";

const app = createServer();

app.get("/api/users/:id", async (req, params) => {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id) || id <= 0) {
      return error("Invalid user ID", 400);
    }
    
    // Simulate database query
    const user = await fetchUser(id);
    
    if (!user) {
      return error("User not found", 404);
    }
    
    return new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    
    return error("Internal server error", 500);
  }
});
```

## Global Error Handler

Verb allows you to define a global error handler for uncaught exceptions:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

// Define routes
app.get("/api/users/:id", (req, params) => {
  const id = parseInt(params.id);
  
  if (isNaN(id) || id <= 0) {
    throw new Error("Invalid user ID");
  }
  
  // Simulate database query
  if (id > 100) {
    throw new Error("User not found");
  }
  
  return new Response(JSON.stringify({ id, name: `User ${id}` }), {
    headers: { "Content-Type": "application/json" }
  });
});

// Global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  // Customize response based on error
  if (err.message === "Invalid user ID") {
    return new Response("Invalid user ID", { status: 400 });
  }
  
  if (err.message === "User not found") {
    return new Response("User not found", { status: 404 });
  }
  
  // Default error response
  return new Response("Internal server error", { status: 500 });
});
```

## Error Middleware

You can create middleware for handling errors:

```typescript
import { createServer } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Error handling middleware
const errorHandler: Middleware = async (req, next) => {
  try {
    return await next();
  } catch (err) {
    console.error(`Error handling ${req.method} ${req.url}:`, err);
    
    // Customize response based on error
    if (err.message === "Invalid user ID") {
      return new Response("Invalid user ID", { status: 400 });
    }
    
    if (err.message === "User not found") {
      return new Response("User not found", { status: 404 });
    }
    
    // Default error response
    return new Response("Internal server error", { status: 500 });
  }
};

// Apply error handling middleware
app.use(errorHandler);

// Define routes
app.get("/api/users/:id", (req, params) => {
  const id = parseInt(params.id);
  
  if (isNaN(id) || id <= 0) {
    throw new Error("Invalid user ID");
  }
  
  // Simulate database query
  if (id > 100) {
    throw new Error("User not found");
  }
  
  return new Response(JSON.stringify({ id, name: `User ${id}` }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Custom Error Classes

You can create custom error classes for different types of errors:

```typescript
class ValidationError extends Error {
  status: number;
  
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

class NotFoundError extends Error {
  status: number;
  
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
}

class UnauthorizedError extends Error {
  status: number;
  
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 401;
  }
}

// Use custom errors in route handlers
app.get("/api/users/:id", (req, params) => {
  const id = parseInt(params.id);
  
  if (isNaN(id) || id <= 0) {
    throw new ValidationError("Invalid user ID");
  }
  
  // Simulate authentication check
  const token = req.headers.get("Authorization");
  if (!token) {
    throw new UnauthorizedError("Authentication required");
  }
  
  // Simulate database query
  if (id > 100) {
    throw new NotFoundError(`User with ID ${id} not found`);
  }
  
  return new Response(JSON.stringify({ id, name: `User ${id}` }), {
    headers: { "Content-Type": "application/json" }
  });
});

// Handle custom errors in global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  // Handle custom errors
  if (err instanceof ValidationError) {
    return new Response(err.message, { status: err.status });
  }
  
  if (err instanceof NotFoundError) {
    return new Response(err.message, { status: err.status });
  }
  
  if (err instanceof UnauthorizedError) {
    return new Response(err.message, {
      status: err.status,
      headers: { "WWW-Authenticate": "Bearer" }
    });
  }
  
  // Default error response
  return new Response("Internal server error", { status: 500 });
});
```

## Async Error Handling

When working with async functions, make sure to properly handle errors:

```typescript
// Async route handler with error handling
app.get("/api/users/:id", async (req, params) => {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id) || id <= 0) {
      return error("Invalid user ID", 400);
    }
    
    // Simulate async database query
    const user = await fetchUserFromDatabase(id);
    
    if (!user) {
      return error("User not found", 404);
    }
    
    return new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    
    return error("Internal server error", 500);
  }
});

// Alternative: Let the global error handler catch it
app.get("/api/posts/:id", async (req, params) => {
  const id = parseInt(params.id);
  
  if (isNaN(id) || id <= 0) {
    throw new ValidationError("Invalid post ID");
  }
  
  // This will be caught by the global error handler if it fails
  const post = await fetchPostFromDatabase(id);
  
  if (!post) {
    throw new NotFoundError(`Post with ID ${id} not found`);
  }
  
  return new Response(JSON.stringify(post), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Error Logging

It's important to log errors for debugging and monitoring:

```typescript
// Global error handler with detailed logging
app.onError((err, req) => {
  // Log error details
  console.error({
    type: "error",
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  });
  
  // Return appropriate response
  if (err instanceof ValidationError) {
    return new Response(err.message, { status: err.status });
  }
  
  // Default error response
  return new Response("Internal server error", { status: 500 });
});
```

## Development vs. Production Error Handling

You might want to handle errors differently in development and production:

```typescript
import { createServer } from "@verb/server";

const isDevelopment = process.env.NODE_ENV !== "production";

const app = createServer({
  development: isDevelopment
});

// Global error handler
app.onError((err, req) => {
  console.error(`Error handling ${req.method} ${req.url}:`, err);
  
  if (isDevelopment) {
    // In development, return detailed error information
    return new Response(JSON.stringify({
      error: err.name,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    }), {
      status: err instanceof ValidationError ? err.status : 500,
      headers: { "Content-Type": "application/json" }
    });
  } else {
    // In production, return minimal error information
    return new Response(JSON.stringify({
      error: err instanceof ValidationError ? err.message : "Internal server error"
    }), {
      status: err instanceof ValidationError ? err.status : 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

## Not Found Handler

You can define a custom handler for routes that don't match any defined route:

```typescript
app.notFound((req) => {
  return new Response(`Route not found: ${req.url}`, {
    status: 404,
    headers: { "Content-Type": "text/plain" }
  });
});
```

## JSON Error Responses

For API endpoints, it's often better to return errors as JSON:

```typescript
// Helper function for JSON error responses
function jsonError(message: string, status = 400, details?: any) {
  return new Response(JSON.stringify({
    error: {
      message,
      status,
      details,
      timestamp: new Date().toISOString()
    }
  }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

app.get("/api/users/:id", (req, params) => {
  const id = parseInt(params.id);
  
  if (isNaN(id) || id <= 0) {
    return jsonError("Invalid user ID", 400, { id: params.id });
  }
  
  // Simulate database query
  if (id > 100) {
    return jsonError("User not found", 404, { id });
  }
  
  return new Response(JSON.stringify({ id, name: `User ${id}` }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Best Practices

- **Be Specific**: Provide specific error messages that help identify the issue
- **Use Appropriate Status Codes**: Use the correct HTTP status codes for different types of errors
- **Log Errors**: Log errors for debugging and monitoring
- **Sanitize Error Messages**: Don't expose sensitive information in error messages
- **Consistent Format**: Use a consistent format for error responses
- **Graceful Degradation**: Ensure your application continues to function even when errors occur
- **Validation**: Validate input early to prevent errors later

## Next Steps

Now that you understand error handling in Verb, you can explore related topics:

- [Middleware](/server/middleware) - Learn how to use middleware for error handling
- [Request Handling](/server/request-handling) - Learn how to handle different types of requests
- [Validation](/server/validation) - Learn about request validation to prevent errors
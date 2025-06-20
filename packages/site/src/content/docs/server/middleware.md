---
title: Middleware
description: Learn how to use middleware in Verb to extend functionality
---

# Middleware in Verb

Middleware functions in Verb allow you to execute code before and after route handlers, enabling you to add functionality like logging, authentication, error handling, and more. This guide covers the middleware system in detail.

## What is Middleware?

Middleware functions in Verb have the following signature:

```typescript
type Middleware = (req: Request, next: () => Response | Promise<Response>) => Response | Promise<Response>;
```

A middleware function receives:
1. The request object (`Request`)
2. A `next` function that calls the next middleware or route handler

The middleware can:
- Modify the request
- Execute code before calling `next()`
- Execute code after calling `next()`
- Decide whether to call `next()` or return a response directly

## Basic Middleware

Here's a simple logging middleware:

```typescript
import { createServer } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Define a logging middleware
const logger: Middleware = (req, next) => {
  console.log(`${req.method} ${req.url} - Started`);
  
  const start = Date.now();
  const response = next();
  
  if (response instanceof Promise) {
    return response.then(res => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} - ${res.status} (${duration}ms)`);
      return res;
    });
  } else {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${response.status} (${duration}ms)`);
    return response;
  }
};

// Apply middleware to all routes
app.use(logger);

// Define routes
app.get("/", () => {
  return new Response("Hello, World!");
});
```

## Global Middleware

You can apply middleware to all routes using the `use` method:

```typescript
// Apply middleware to all routes
app.use(logger);
app.use(authMiddleware);
app.use(corsMiddleware);
```

Middleware is executed in the order it's added.

## Route-Specific Middleware

You can apply middleware to specific routes:

```typescript
// Apply middleware to a specific route
app.get("/admin", [authMiddleware, loggerMiddleware], () => {
  return new Response("Admin Dashboard");
});

// Apply middleware to a POST route
app.post("/api/users", [authMiddleware, validateUserMiddleware], async (req) => {
  const user = await req.json();
  // Create user
  return new Response("User created", { status: 201 });
});
```

## Middleware for Route Groups

You can apply middleware to groups of routes:

```typescript
// Create a route group with middleware
const apiRoutes = app.group("/api", [authMiddleware, loggerMiddleware]);

// Define routes within the group
apiRoutes.get("/users", () => {
  return new Response("Get all users");
});

apiRoutes.post("/users", async (req) => {
  // Create user
  return new Response("User created", { status: 201 });
});
```

## Conditional Middleware

You can create middleware that only runs under certain conditions:

```typescript
// Conditional middleware
const conditionalAuth: Middleware = (req, next) => {
  // Skip authentication for public routes
  if (req.url.startsWith("/public")) {
    return next();
  }
  
  // Authenticate other routes
  const token = req.headers.get("Authorization");
  
  if (!token || !token.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Continue to the next middleware or route handler
  return next();
};

app.use(conditionalAuth);
```

## Error Handling Middleware

You can create middleware for handling errors:

```typescript
// Error handling middleware
const errorHandler: Middleware = (req, next) => {
  try {
    return next();
  } catch (err) {
    console.error(`Error handling ${req.method} ${req.url}:`, err);
    
    return new Response("An unexpected error occurred", {
      status: 500
    });
  }
};

// Apply error handling middleware
app.use(errorHandler);
```

For async error handling, you can use:

```typescript
// Async error handling middleware
const asyncErrorHandler: Middleware = async (req, next) => {
  try {
    return await next();
  } catch (err) {
    console.error(`Error handling ${req.method} ${req.url}:`, err);
    
    return new Response("An unexpected error occurred", {
      status: 500
    });
  }
};

app.use(asyncErrorHandler);
```

## Request Modification

Middleware can modify the request before it reaches the route handler:

```typescript
// Request modification middleware
const requestModifier: Middleware = (req, next) => {
  // Add a custom property to the request
  // Note: We need to use type assertion since we're extending the Request object
  (req as any).customProperty = "custom value";
  
  // Continue to the next middleware or route handler
  return next();
};

app.use(requestModifier);

// Access the custom property in a route handler
app.get("/", (req) => {
  const customProperty = (req as any).customProperty;
  
  return new Response(`Custom property: ${customProperty}`);
});
```

## Response Modification

Middleware can also modify the response:

```typescript
// Response modification middleware
const responseModifier: Middleware = (req, next) => {
  // Get the response from the next middleware or route handler
  const response = next();
  
  if (response instanceof Promise) {
    return response.then(res => {
      // Add a custom header to the response
      res.headers.set("X-Custom-Header", "custom value");
      
      return res;
    });
  } else {
    // Add a custom header to the response
    response.headers.set("X-Custom-Header", "custom value");
    
    return response;
  }
};

app.use(responseModifier);
```

## Common Middleware Examples

### Authentication Middleware

```typescript
const auth: Middleware = (req, next) => {
  const token = req.headers.get("Authorization");
  
  if (!token || !token.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Verify the token (in a real app, you would validate the token)
  const tokenValue = token.replace("Bearer ", "");
  
  if (tokenValue !== "valid-token") {
    return new Response("Invalid token", { status: 403 });
  }
  
  // Add user information to the request
  (req as any).user = {
    id: 123,
    name: "Example User"
  };
  
  return next();
};
```

### CORS Middleware

```typescript
const cors: Middleware = (req, next) => {
  // Get the response from the next middleware or route handler
  const response = next();
  
  const addCorsHeaders = (res: Response) => {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return res;
  };
  
  if (response instanceof Promise) {
    return response.then(addCorsHeaders);
  } else {
    return addCorsHeaders(response);
  }
};

app.use(cors);

// Handle OPTIONS requests for CORS preflight
app.options("*", () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400" // 24 hours
    }
  });
});
```

### Rate Limiting Middleware

```typescript
const rateLimit: Middleware = (() => {
  const requests = new Map<string, { count: number, timestamp: number }>();
  
  return (req, next) => {
    const ip = req.headers.get("X-Forwarded-For") || "unknown";
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100; // 100 requests per minute
    
    // Get or create request record
    const record = requests.get(ip) || { count: 0, timestamp: now };
    
    // Reset if outside window
    if (now - record.timestamp > windowMs) {
      record.count = 0;
      record.timestamp = now;
    }
    
    // Increment request count
    record.count++;
    
    // Update record
    requests.set(ip, record);
    
    // Check if rate limit exceeded
    if (record.count > maxRequests) {
      return new Response("Too many requests", {
        status: 429,
        headers: {
          "Retry-After": "60"
        }
      });
    }
    
    return next();
  };
})();

app.use(rateLimit);
```

### Logging Middleware

```typescript
const logger: Middleware = (req, next) => {
  const start = Date.now();
  const id = crypto.randomUUID();
  
  console.log(JSON.stringify({
    id,
    type: "request",
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  }));
  
  const response = next();
  
  const logResponse = (res: Response) => {
    const duration = Date.now() - start;
    
    console.log(JSON.stringify({
      id,
      type: "response",
      timestamp: new Date().toISOString(),
      duration,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries())
    }));
    
    return res;
  };
  
  if (response instanceof Promise) {
    return response.then(logResponse);
  } else {
    return logResponse(response);
  }
};

app.use(logger);
```

## Best Practices

- **Keep Middleware Focused**: Each middleware should have a single responsibility
- **Order Matters**: Middleware is executed in the order it's added
- **Error Handling**: Use try/catch blocks to handle errors in middleware
- **Async/Await**: Use async/await for asynchronous operations
- **Type Safety**: Use TypeScript types for better type checking
- **Performance**: Be mindful of performance implications, especially for global middleware

## Next Steps

Now that you understand middleware in Verb, you can explore related topics:

- [Routing](/server/routing) - Learn more about routing in Verb
- [Request Handling](/server/request-handling) - Learn how to handle different types of requests
- [Error Handling](/server/error-handling) - Learn about error handling in Verb
- [Authentication](/server/authentication) - Learn about authentication in Verb
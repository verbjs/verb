# Bun Native Routes

This guide covers Verb's integration with Bun's native routing system for building fullstack applications with HTML imports and automatic bundling.

## Overview

Bun's native routing system provides powerful features for fullstack applications:

- **HTML Imports**: Import HTML files directly with automatic bundling
- **Automatic Bundling**: TypeScript, JSX, and CSS processing out of the box
- **Hot Module Reloading**: Real-time updates during development
- **Optimized Performance**: Native implementation for maximum speed

## Getting Started

### Basic Setup

```typescript
import { createServer } from "verb";

const app = createServer();

app.withRoutes({
  "/": new Response("Hello World", {
    headers: { "Content-Type": "text/plain" }
  })
});

app.listen(3000);
```

### HTML Imports

```typescript
import { createServer } from "verb";
import homepage from "./index.html";
import dashboard from "./dashboard.html";

const app = createServer();

app.withRoutes({
  "/": homepage,
  "/dashboard": dashboard
});

app.listen(3000);
```

## HTML File Structure

### Basic HTML Structure

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="app">
    <h1>Welcome to My App</h1>
  </div>
  <script type="module" src="./frontend.tsx"></script>
</body>
</html>
```

### With TypeScript/JSX

```html
<!-- app.html -->
<!DOCTYPE html>
<html>
<head>
  <title>React App</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./app.tsx"></script>
</body>
</html>
```

```tsx
// app.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const App = () => {
  return (
    <div className="app">
      <h1>Hello from React!</h1>
      <p>This is bundled automatically by Bun!</p>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

## Route Types

### Direct Response Objects

```typescript
const app = createServer();

app.withRoutes({
  "/": new Response("Hello World", {
    headers: { "Content-Type": "text/plain" }
  }),
  
  "/json": new Response(JSON.stringify({ message: "Hello JSON" }), {
    headers: { "Content-Type": "application/json" }
  }),
  
  "/html": new Response(`
    <html>
      <head><title>HTML Response</title></head>
      <body><h1>HTML Content</h1></body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  })
});
```

### Single Handler Functions

```typescript
const app = createServer();

app.withRoutes({
  "/api/time": (req) => {
    return Response.json({ 
      time: new Date().toISOString(),
      method: req.method 
    });
  },
  
  "/api/echo": async (req) => {
    const body = await req.text();
    return new Response(`Echo: ${body}`);
  }
});
```

### HTTP Method Objects

```typescript
const app = createServer();

app.withRoutes({
  "/api/users": {
    async GET(req) {
      const users = await fetchUsers();
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
      const { id } = await req.json();
      await deleteUser(id);
      return new Response(null, { status: 204 });
    }
  }
});
```

## Parameterized Routes

### Single Parameters

```typescript
const app = createServer();

app.withRoutes({
  "/users/:id": async (req) => {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      return new Response("User not found", { status: 404 });
    }
    
    return Response.json(user);
  },
  
  "/posts/:slug": async (req) => {
    const { slug } = req.params;
    const post = await getPostBySlug(slug);
    return Response.json(post);
  }
});
```

### Multiple Parameters

```typescript
const app = createServer();

app.withRoutes({
  "/users/:userId/posts/:postId": async (req) => {
    const { userId, postId } = req.params;
    const post = await getPostByIds(userId, postId);
    return Response.json(post);
  },
  
  "/api/v:version/users/:id": async (req) => {
    const { version, id } = req.params;
    const user = await getUserById(id, version);
    return Response.json(user);
  }
});
```

### Parameters with HTTP Methods

```typescript
const app = createServer();

app.withRoutes({
  "/api/posts/:id": {
    async GET(req) {
      const { id } = req.params;
      const post = await getPost(id);
      return Response.json(post);
    },
    
    async PUT(req) {
      const { id } = req.params;
      const data = await req.json();
      const post = await updatePost(id, data);
      return Response.json(post);
    },
    
    async DELETE(req) {
      const { id } = req.params;
      await deletePost(id);
      return new Response(null, { status: 204 });
    }
  }
});
```

## Request Handling

### Request Object

```typescript
const app = createServer();

app.withRoutes({
  "/api/request-info": async (req) => {
    const url = new URL(req.url);
    const method = req.method;
    const headers = Object.fromEntries(req.headers.entries());
    
    let body = null;
    if (req.method !== "GET") {
      body = await req.text();
    }
    
    return Response.json({
      url: url.pathname,
      method,
      headers,
      body,
      params: req.params,
      query: Object.fromEntries(url.searchParams)
    });
  }
});
```

### Request Body Parsing

```typescript
const app = createServer();

app.withRoutes({
  "/api/data": {
    async POST(req) {
      const contentType = req.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        const data = await req.json();
        return Response.json({ received: data });
      }
      
      if (contentType?.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        const data = Object.fromEntries(formData);
        return Response.json({ received: data });
      }
      
      const text = await req.text();
      return Response.json({ received: text });
    }
  }
});
```

## Response Handling

### JSON Responses

```typescript
const app = createServer();

app.withRoutes({
  "/api/users": {
    async GET(req) {
      const users = await getUsers();
      return Response.json(users);
    },
    
    async POST(req) {
      const userData = await req.json();
      const user = await createUser(userData);
      
      return Response.json(user, {
        status: 201,
        headers: {
          "Location": `/api/users/${user.id}`,
          "X-Created": new Date().toISOString()
        }
      });
    }
  }
});
```

### Custom Headers

```typescript
const app = createServer();

app.withRoutes({
  "/api/download": async (req) => {
    const file = await Bun.file("./downloads/file.pdf");
    
    return new Response(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=file.pdf",
        "Cache-Control": "no-cache"
      }
    });
  }
});
```

### Stream Responses

```typescript
const app = createServer();

app.withRoutes({
  "/api/stream": async (req) => {
    const stream = new ReadableStream({
      start(controller) {
        let count = 0;
        
        const interval = setInterval(() => {
          controller.enqueue(`data: ${count++}\n\n`);
          
          if (count >= 10) {
            controller.close();
            clearInterval(interval);
          }
        }, 1000);
      }
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache"
      }
    });
  }
});
```

## Development Options

### Hot Module Reloading

```typescript
const app = createServer();

app.withRoutes({
  "/": homepage,
  "/dashboard": dashboard
});

app.withOptions({
  development: {
    hmr: true,      // Enable hot module reloading
    console: true   // Enhanced console logging
  }
});

app.listen(3000);
```

### Route Display

```typescript
const app = createServer();

app.withRoutes({
  "/": homepage,
  "/api/users": {
    GET: () => Response.json({ users: [] })
  }
});

app.withOptions({
  showRoutes: true  // Show routes on startup
});

app.listen(3000);
// Output:
// 📋 HTTP Server Routes:
// ======================
//   HTML Routes:
//     GET     / (HTML import)
//     GET     /api/users (HTML route)
```

## Mixed Routing

### Traditional + Native Routes

```typescript
const app = createServer();

// Traditional Verb routes
app.get("/api/legacy", (req, res) => {
  res.json({ type: "legacy" });
});

app.use("/api/middleware", (req, res, next) => {
  res.header("X-Middleware", "true");
  next();
});

// Native Bun routes
app.withRoutes({
  "/": homepage,
  "/api/native": {
    GET: () => Response.json({ type: "native" })
  }
});

app.listen(3000);
```

## File Serving

### Static Files

```typescript
const app = createServer();

app.withRoutes({
  "/": homepage,
  
  "/favicon.ico": async (req) => {
    const file = Bun.file("./public/favicon.ico");
    return new Response(file);
  },
  
  "/assets/:filename": async (req) => {
    const { filename } = req.params;
    const file = Bun.file(`./public/assets/${filename}`);
    
    if (!(await file.exists())) {
      return new Response("File not found", { status: 404 });
    }
    
    return new Response(file);
  }
});
```

### Dynamic File Generation

```typescript
const app = createServer();

app.withRoutes({
  "/api/export/csv": async (req) => {
    const data = await getExportData();
    const csv = generateCSV(data);
    
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=export.csv"
      }
    });
  },
  
  "/api/images/:id": async (req) => {
    const { id } = req.params;
    const image = await generateImage(id);
    
    return new Response(image, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
});
```

## Error Handling

### Route-Level Error Handling

```typescript
const app = createServer();

app.withRoutes({
  "/api/users/:id": async (req) => {
    try {
      const { id } = req.params;
      const user = await getUserById(id);
      
      if (!user) {
        return Response.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      return Response.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return Response.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
});
```

### Global Error Handling

```typescript
const app = createServer();

const handleError = (error: Error, req: Request) => {
  console.error("Route error:", error);
  
  if (error.name === "ValidationError") {
    return Response.json(
      { error: "Invalid request data" },
      { status: 400 }
    );
  }
  
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
};

app.withRoutes({
  "/api/users": {
    async POST(req) {
      try {
        const userData = await req.json();
        const user = await createUser(userData);
        return Response.json(user, { status: 201 });
      } catch (error) {
        return handleError(error, req);
      }
    }
  }
});
```

## Performance Optimization

### Caching

```typescript
const app = createServer();

const cache = new Map();

app.withRoutes({
  "/api/expensive": async (req) => {
    const cacheKey = req.url;
    
    if (cache.has(cacheKey)) {
      return Response.json(cache.get(cacheKey), {
        headers: { "X-Cache": "HIT" }
      });
    }
    
    const result = await expensiveOperation();
    cache.set(cacheKey, result);
    
    return Response.json(result, {
      headers: { "X-Cache": "MISS" }
    });
  }
});
```

### Compression

```typescript
const app = createServer();

app.withRoutes({
  "/api/large-data": async (req) => {
    const data = await getLargeDataset();
    const compressed = await compress(JSON.stringify(data));
    
    return new Response(compressed, {
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip"
      }
    });
  }
});
```

## TypeScript Support

### Type-Safe Routes

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

const app = createServer();

app.withRoutes({
  "/api/users": {
    async GET(req): Promise<Response> {
      const users: User[] = await getUsers();
      return Response.json(users);
    },
    
    async POST(req): Promise<Response> {
      const userData: CreateUserRequest = await req.json();
      const user: User = await createUser(userData);
      return Response.json(user, { status: 201 });
    }
  }
});
```

### Route Type Definitions

```typescript
type RouteHandler = (req: Request) => Response | Promise<Response>;

type RouteMethodHandlers = {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  DELETE?: RouteHandler;
  PATCH?: RouteHandler;
};

type RouteValue = 
  | Response
  | RouteHandler
  | RouteMethodHandlers;

type Routes = {
  [path: string]: RouteValue;
};
```

## Testing

### Unit Testing Routes

```typescript
import { test, expect } from "bun:test";

const userRoute = async (req: Request) => {
  const { id } = req.params;
  const user = await getUserById(id);
  return Response.json(user);
};

test("user route", async () => {
  const req = new Request("http://localhost/users/123");
  req.params = { id: "123" };
  
  const response = await userRoute(req);
  const data = await response.json();
  
  expect(data.id).toBe("123");
});
```

### Integration Testing

```typescript
import { test, expect } from "bun:test";
import { createServer } from "verb";

test("native routes integration", async () => {
  const app = createServer();
  
  app.withRoutes({
    "/test": () => Response.json({ test: true })
  });
  
  // Test would depend on how the server is actually started
  // This is a conceptual example
});
```

## Best Practices

1. **Use TypeScript**: Take advantage of type safety
2. **Error Handling**: Always handle errors gracefully
3. **Performance**: Use caching and compression where appropriate
4. **Security**: Validate inputs and sanitize outputs
5. **Testing**: Write tests for your routes
6. **Documentation**: Document your API endpoints

## Common Patterns

### API Versioning

```typescript
const app = createServer();

app.withRoutes({
  "/api/v1/users": {
    GET: () => Response.json({ version: "v1", users: [] })
  },
  
  "/api/v2/users": {
    GET: () => Response.json({ version: "v2", users: [], enhanced: true })
  }
});
```

### Authentication

```typescript
const app = createServer();

const authenticate = async (req: Request) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
};

app.withRoutes({
  "/api/protected": async (req) => {
    const user = await authenticate(req);
    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    return Response.json({ user, message: "Protected resource" });
  }
});
```

## Next Steps

- [Request & Response](/guide/request-response) - Deep dive into request/response handling
- [Performance](/guide/performance) - Performance optimization techniques
- [Examples](/examples/fullstack) - See fullstack examples in action
- [Testing](/guide/testing) - Testing strategies for native routes
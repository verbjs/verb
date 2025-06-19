---
title: Response Types
description: Learn about the different response types available in Verb
---

# Response Types in Verb

Verb provides a variety of response types to make it easy to return different kinds of data from your route handlers. This guide covers the various response types available in Verb.

## Basic Response

The most basic way to respond to a request is to use the standard Web API `Response` object:

```typescript
app.get("/", () => {
  return new Response("Hello, World!", {
    status: 200,
    headers: {
      "Content-Type": "text/plain"
    }
  });
});
```

## JSON Response

For JSON responses, Verb provides a `json` helper function:

```typescript
import { createServer, json } from "@verb/server";

const app = createServer();

app.get("/api/users", () => {
  const users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" }
  ];
  
  return json(users);
});

app.get("/api/users/:id", (req, params) => {
  const user = { id: parseInt(params.id), name: `User ${params.id}` };
  
  return json(user);
});

// With custom status code
app.post("/api/users", async (req) => {
  const body = await req.json();
  const newUser = { id: 4, name: body.name };
  
  return json(newUser, 201); // 201 Created
});

// With custom headers
app.get("/api/data", () => {
  const data = { message: "Hello, World!" };
  
  return json(data, 200, {
    "Cache-Control": "max-age=3600",
    "X-Custom-Header": "Custom Value"
  });
});
```

## HTML Response

For HTML responses, Verb provides an `html` helper function:

```typescript
import { createServer, html } from "@verb/server";

const app = createServer();

app.get("/", () => {
  return html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Verb Example</title>
      <style>
        body {
          font-family: system-ui, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }
      </style>
    </head>
    <body>
      <h1>Hello from Verb!</h1>
      <p>This is an HTML response.</p>
    </body>
    </html>
  `);
});

// With custom status code
app.get("/not-found", () => {
  return html(`
    <h1>404 - Not Found</h1>
    <p>The requested resource was not found.</p>
  `, 404);
});

// With custom headers
app.get("/page", () => {
  return html(`
    <h1>Hello, World!</h1>
  `, 200, {
    "Cache-Control": "max-age=3600"
  });
});
```

## Text Response

For plain text responses, Verb provides a `text` helper function:

```typescript
import { createServer, text } from "@verb/server";

const app = createServer();

app.get("/text", () => {
  return text("Hello, World!");
});

// With custom status code
app.get("/error", () => {
  return text("An error occurred", 500);
});

// With custom headers
app.get("/text-with-headers", () => {
  return text("Hello, World!", 200, {
    "Cache-Control": "max-age=3600"
  });
});
```

## Error Response

For error responses, Verb provides an `error` helper function:

```typescript
import { createServer, error } from "@verb/server";

const app = createServer();

app.get("/api/users/:id", (req, params) => {
  const id = parseInt(params.id);
  
  if (id <= 0) {
    return error("Invalid user ID", 400);
  }
  
  if (id > 100) {
    return error("User not found", 404);
  }
  
  return new Response(`User ${id}`);
});

// With custom headers
app.get("/api/restricted", (req) => {
  const token = req.headers.get("Authorization");
  
  if (!token) {
    return error("Unauthorized", 401, {
      "WWW-Authenticate": "Bearer"
    });
  }
  
  return new Response("Authorized");
});
```

## Redirect Response

For redirects, you can use the standard `Response` object with the appropriate status code and `Location` header:

```typescript
app.get("/old-page", () => {
  return new Response(null, {
    status: 302, // Temporary redirect
    headers: {
      "Location": "/new-page"
    }
  });
});

app.get("/permanent-redirect", () => {
  return new Response(null, {
    status: 301, // Permanent redirect
    headers: {
      "Location": "/new-location"
    }
  });
});
```

## File Response

For serving files, Verb provides a `serveStatic` helper function:

```typescript
import { createServer, serveStatic } from "@verb/server";

const app = createServer();

app.get("/files/*", (req) => {
  return serveStatic(req, {
    directory: "./public"
  });
});

// Serve a specific file
app.get("/download/report", () => {
  return serveStatic(new Request("file.pdf"), {
    directory: "./files",
    headers: {
      "Content-Disposition": "attachment; filename=report.pdf"
    }
  });
});
```

## Stream Response

For streaming responses, you can use the standard `Response` object with a `ReadableStream`:

```typescript
app.get("/stream", () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue("Hello, ");
      
      setTimeout(() => {
        controller.enqueue("World!");
        controller.close();
      }, 1000);
    }
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain"
    }
  });
});

// Stream a large file
app.get("/large-file", async () => {
  const file = Bun.file("./large-file.bin");
  const stream = file.stream();
  
  return new Response(stream, {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.size)
    }
  });
});
```

## Binary Response

For binary responses, you can use the standard `Response` object with an `ArrayBuffer` or `Uint8Array`:

```typescript
app.get("/binary", () => {
  const buffer = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII
  
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/octet-stream"
    }
  });
});

// Serve an image
app.get("/image", async () => {
  const file = Bun.file("./image.png");
  const buffer = await file.arrayBuffer();
  
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png"
    }
  });
});
```

## No Content Response

For responses with no content, you can use the standard `Response` object with a `204` status code:

```typescript
app.delete("/api/users/:id", (req, params) => {
  // Delete the user
  
  return new Response(null, {
    status: 204 // No Content
  });
});
```

## Custom Response Headers

You can add custom headers to any response:

```typescript
app.get("/api/data", () => {
  const response = new Response(JSON.stringify({ message: "Hello" }), {
    headers: {
      "Content-Type": "application/json",
      "X-API-Version": "1.0",
      "X-Request-ID": crypto.randomUUID()
    }
  });
  
  return response;
});
```

## Content Negotiation

You can implement content negotiation by checking the `Accept` header:

```typescript
app.get("/api/data", (req) => {
  const data = { message: "Hello, World!" };
  const accept = req.headers.get("Accept") || "";
  
  if (accept.includes("application/xml")) {
    const xml = `<message>Hello, World!</message>`;
    
    return new Response(xml, {
      headers: { "Content-Type": "application/xml" }
    });
  }
  
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## CORS Headers

For cross-origin requests, you can add CORS headers to your responses:

```typescript
app.get("/api/data", () => {
  const data = { message: "Hello, World!" };
  
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
});

// Handle OPTIONS requests for CORS preflight
app.options("/api/*", () => {
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

## Best Practices

- **Content Type**: Always set the appropriate `Content-Type` header
- **Status Codes**: Use appropriate HTTP status codes
- **Error Handling**: Provide clear error messages
- **Security Headers**: Include security headers where appropriate
- **Performance**: Use streaming for large responses
- **Caching**: Set appropriate caching headers

## Next Steps

Now that you understand response types in Verb, you can explore related topics:

- [Request Handling](/server/request-handling) - Learn how to handle different types of requests
- [Middleware](/server/middleware) - Learn how to use middleware for response processing
- [Error Handling](/server/error-handling) - Learn about error handling in Verb
- [Streaming](/server/streaming) - Learn more about streaming responses
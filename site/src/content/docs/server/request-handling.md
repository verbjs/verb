---
title: Request Handling
description: Learn how to handle different types of requests in Verb
---

# Request Handling in Verb

Verb provides a simple yet powerful API for handling HTTP requests. This guide covers the various aspects of request handling in Verb.

## The Request Object

In Verb, route handlers receive the standard Web API `Request` object, which provides access to request details:

```typescript
app.get("/example", (req) => {
  console.log(req.method);  // HTTP method (GET, POST, etc.)
  console.log(req.url);     // Full URL
  console.log(req.headers); // Request headers
  
  return new Response("Request received");
});
```

## URL Parameters

Route parameters are passed as the second argument to route handlers:

```typescript
app.get("/users/:id", (req, params) => {
  // params is an object containing route parameters
  console.log(params.id); // Value of the 'id' parameter
  
  return new Response(`User ID: ${params.id}`);
});
```

## Query Parameters

You can access query parameters using the `getQuery` helper function:

```typescript
import { createServer, getQuery } from "@verb/server";

const app = createServer();

app.get("/search", (req) => {
  const query = getQuery(req);
  
  console.log(query.q);        // Value of the 'q' parameter
  console.log(query.category); // Value of the 'category' parameter
  
  return new Response(`Search query: ${query.q}, Category: ${query.category}`);
});
```

## Request Body

Verb provides several methods for parsing request bodies:

### JSON Body

```typescript
app.post("/api/users", async (req) => {
  try {
    const body = await req.json();
    
    console.log(body.name);  // Access JSON properties
    console.log(body.email);
    
    return new Response("JSON received");
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }
});
```

### Form Data

```typescript
app.post("/submit-form", async (req) => {
  try {
    const formData = await req.formData();
    
    const name = formData.get("name");
    const email = formData.get("email");
    
    return new Response(`Form received: ${name}, ${email}`);
  } catch (err) {
    return new Response("Invalid form data", { status: 400 });
  }
});
```

### Text Body

```typescript
app.post("/text", async (req) => {
  try {
    const text = await req.text();
    
    return new Response(`Text received: ${text}`);
  } catch (err) {
    return new Response("Error reading text", { status: 400 });
  }
});
```

### Binary Data

```typescript
app.post("/binary", async (req) => {
  try {
    const buffer = await req.arrayBuffer();
    
    // Process binary data
    const byteLength = buffer.byteLength;
    
    return new Response(`Binary data received: ${byteLength} bytes`);
  } catch (err) {
    return new Response("Error reading binary data", { status: 400 });
  }
});
```

## Request Headers

You can access request headers through the `headers` property:

```typescript
app.get("/headers", (req) => {
  const userAgent = req.headers.get("User-Agent");
  const contentType = req.headers.get("Content-Type");
  const authorization = req.headers.get("Authorization");
  
  return new Response(`User-Agent: ${userAgent}`);
});
```

## Cookies

Verb provides a helper function for parsing cookies:

```typescript
import { createServer, getCookies } from "@verb/server";

const app = createServer();

app.get("/cookies", (req) => {
  const cookies = getCookies(req);
  
  console.log(cookies.sessionId); // Value of the 'sessionId' cookie
  console.log(cookies.theme);     // Value of the 'theme' cookie
  
  return new Response(`Session ID: ${cookies.sessionId}`);
});
```

## File Uploads

Verb supports file uploads through the `formData` API:

```typescript
app.post("/upload", async (req) => {
  try {
    const formData = await req.formData();
    
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response("No file uploaded", { status: 400 });
    }
    
    // Access file properties
    console.log(file.name);     // Original filename
    console.log(file.size);     // File size in bytes
    console.log(file.type);     // MIME type
    
    // Read file content
    const content = await file.arrayBuffer();
    
    // Process the file (e.g., save to disk, upload to storage, etc.)
    
    return new Response(`File uploaded: ${file.name} (${file.size} bytes)`);
  } catch (err) {
    return new Response("Error processing upload", { status: 400 });
  }
});
```

## Request Validation

For request validation, you can use the built-in validation helpers or implement your own validation logic:

```typescript
import { createServer } from "@verb/server";

const app = createServer();

// Basic validation
app.post("/api/users", async (req) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.name) {
      return new Response("Name is required", { status: 400 });
    }
    
    if (!body.email) {
      return new Response("Email is required", { status: 400 });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response("Invalid email format", { status: 400 });
    }
    
    // Process valid request
    return new Response("User created", { status: 201 });
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }
});
```

## Content Negotiation

You can implement content negotiation by checking the `Accept` header:

```typescript
app.get("/api/data", (req) => {
  const accept = req.headers.get("Accept") || "";
  
  const data = {
    id: 1,
    name: "Example",
    description: "This is an example"
  };
  
  if (accept.includes("application/xml")) {
    // Return XML response
    const xml = `
      <data>
        <id>1</id>
        <name>Example</name>
        <description>This is an example</description>
      </data>
    `;
    
    return new Response(xml, {
      headers: { "Content-Type": "application/xml" }
    });
  }
  
  // Default to JSON
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## Request Context

You can use middleware to add context to requests:

```typescript
import { createServer } from "@verb/server";
import type { Middleware } from "@verb/server";

const app = createServer();

// Add user context middleware
const addUserContext: Middleware = (req, next) => {
  // In a real app, you would extract this from a token or session
  const user = {
    id: 123,
    name: "Example User",
    roles: ["user"]
  };
  
  // Attach user to request object
  // Note: We need to use type assertion since we're extending the Request object
  (req as any).user = user;
  
  return next();
};

// Apply middleware
app.use(addUserContext);

// Access context in route handler
app.get("/profile", (req) => {
  const user = (req as any).user;
  
  return new Response(`Hello, ${user.name}!`);
});
```

## Best Practices

- **Validate Input**: Always validate user input to prevent security issues
- **Error Handling**: Provide clear error messages for invalid requests
- **Content Types**: Check and respect the `Content-Type` header
- **Async/Await**: Use async/await for handling asynchronous operations
- **Request Size**: Be mindful of request size limits
- **Security**: Implement proper security measures (CSRF protection, input sanitization, etc.)

## Next Steps

Now that you understand request handling in Verb, you can explore related topics:

- [Response Types](/server/response-types) - Learn about different response types
- [Middleware](/server/middleware) - Learn how to use middleware for request processing
- [Validation](/server/validation) - Learn about advanced validation techniques
- [File Uploads](/server/file-uploads) - Learn more about handling file uploads
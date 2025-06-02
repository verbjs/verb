<div align="center">
  <img src="verb.png" alt="Verb Logo" width="64" height="64">
  <h1>Verb</h1>
</div>

A blazingly fast HTTP server framework for TypeScript and Bun, designed to outperform other servers with zero compromises on developer experience.

## ⚡ Key Features

- **Bun-Native Performance** - Built on Bun's ultra-fast HTTP server
- **TypeScript First** - Full type safety with excellent IntelliSense
- **Zero Dependencies** - Leverages Bun's built-in APIs exclusively
- **Route Caching** - Intelligent LRU cache for maximum throughput
- **Middleware Support** - Clean, composable middleware chain
- **Static File Serving** - Production-ready with caching, ETags, and compression
- **Response Compression** - Automatic gzip/deflate compression middleware
- **Parameterized Routes** - Express-style route parameters and wildcards
- **HTTP/2 Support** - Full HTTP/2 with TLS, server push, and stream multiplexing
- **Testing Utilities** - Built-in mock server for fast unit tests
- **Sub-App Mounting** - Modular application architecture

## 🚀 Quick Start

```bash
bun add verb
```

```typescript
import { createServer, json, text } from "verb";

const app = createServer({ port: 3000 });

app.get("/", () => text("Hello, Verb!"));
app.get("/api/users/:id", (req, params) => json({ id: params.id }));

// Server automatically starts at http://localhost:3000
```

## 📖 API Reference

### Server Creation

```typescript
import { createServer } from "verb";

const app = createServer({
  port: 3000,           // Default: 3000
  hostname: "0.0.0.0",  // Default: "0.0.0.0"
  maxRequestBodySize: 10 * 1024 * 1024  // Default: 10MB
});
```

### Route Registration

```typescript
// Basic routes
app.get("/users", handler);
app.post("/users", handler);
app.put("/users/:id", handler);
app.delete("/users/:id", handler);
app.patch("/users/:id", handler);
app.head("/users/:id", handler);
app.options("/users", handler);

// Route parameters
app.get("/users/:id", (req, params) => {
  return json({ userId: params.id });
});

// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, params) => {
  return json({ 
    userId: params.userId, 
    postId: params.postId 
  });
});

// Wildcard routes
app.get("/static/*", (req, params) => {
  const filePath = params["*"]; // Everything after /static/
  return text(`Serving: ${filePath}`);
});
```

### Response Helpers

```typescript
import { json, text, html, error } from "verb";

// JSON responses
app.get("/api/data", () => json({ message: "Hello" }));
app.post("/api/users", () => json({ id: 123 }, 201)); // Custom status

// Text responses
app.get("/health", () => text("OK"));
app.get("/error", () => text("Not Found", 404));

// HTML responses
app.get("/", () => html("<h1>Welcome</h1>"));

// Error responses
app.get("/fail", () => error("Something went wrong", 500));
app.get("/bad-request", () => error("Invalid input", 400));
```

### Streaming Responses

Verb provides comprehensive streaming support for handling large datasets, real-time data, and progressive content delivery:

```typescript
import { 
  stream, 
  streamFile, 
  streamSSE, 
  streamJSON, 
  streamText 
} from "verb";

// Basic ReadableStream
app.get("/stream/basic", () => {
  const dataStream = new ReadableStream({
    start(controller) {
      controller.enqueue("Hello ");
      controller.enqueue("streaming ");
      controller.enqueue("world!");
      controller.close();
    }
  });
  
  return stream(dataStream, "text/plain");
});

// Stream files directly from filesystem
app.get("/download/:filename", async (req, params) => {
  return await streamFile(`./files/${params.filename}`);
});

// Server-Sent Events (SSE) for real-time updates
app.get("/events", () => {
  async function* eventGenerator() {
    let count = 0;
    while (count < 100) {
      yield {
        data: JSON.stringify({ count, timestamp: Date.now() }),
        id: count.toString(),
        event: "update"
      };
      await new Promise(resolve => setTimeout(resolve, 1000));
      count++;
    }
  }
  
  return streamSSE(eventGenerator());
});

// Stream large datasets as JSON Lines (JSONL)
app.get("/api/export", () => {
  async function* dataGenerator() {
    for (let i = 0; i < 10000; i++) {
      yield {
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        timestamp: Date.now()
      };
    }
  }
  
  return streamJSON(dataGenerator());
});

// Progressive text streaming
app.get("/story", () => {
  const paragraphs = [
    "Once upon a time...",
    "In a land far away...",
    "There lived a brave developer...",
    "Who discovered the power of streaming..."
  ];
  
  return streamText(paragraphs, "text/plain", 1000); // 1 second delay
});
```

#### Streaming Use Cases

**Server-Sent Events (SSE)**
- Real-time notifications
- Live chat applications
- Stock price updates
- Progress indicators
- System monitoring dashboards

**JSON Streaming (JSONL)**
- Large dataset exports
- Database query results
- Analytics data processing
- Batch operations
- API pagination alternatives

**File Streaming**
- Video/audio content delivery
- Large file downloads
- Image galleries
- Document serving
- Content delivery networks

**Text Streaming**
- AI chat responses
- Live log streaming
- Progressive content loading
- Tutorial walkthroughs
- Status updates

#### Client-Side Consumption

```javascript
// Consuming Server-Sent Events
const events = new EventSource('/events');
events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Processing JSON Lines stream
fetch('/api/export')
  .then(response => response.body)
  .then(stream => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    function readChunk() {
      return reader.read().then(({ done, value }) => {
        if (done) return;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        lines.forEach(line => {
          if (line.trim()) {
            const record = JSON.parse(line);
            console.log('Processing record:', record);
          }
        });
        
        return readChunk();
      });
    }
    
    return readChunk();
  });
```

### Request Parsing

```typescript
import { parseBody, getQuery, getCookies } from "verb";

app.post("/api/users", async (req) => {
  // Parse JSON, form data, or text automatically
  const body = await parseBody(req);
  return json({ received: body });
});

app.get("/search", (req) => {
  // Parse query parameters: /search?q=hello&limit=10
  const query = getQuery(req);
  return json({ query: query.q, limit: query.limit });
});

app.get("/profile", (req) => {
  // Parse cookies
  const cookies = getCookies(req);
  const sessionId = cookies.session;
  return json({ sessionId });
});
```

### Middleware

```typescript
// Global middleware
app.use(async (req, next) => {
  console.log(`${req.method} ${req.url}`);
  const start = Date.now();
  const response = await next();
  console.log(`Request took ${Date.now() - start}ms`);
  return response;
});

// Authentication middleware
app.use(async (req, next) => {
  const auth = req.headers.get("authorization");
  if (!auth && req.url.startsWith("/api/")) {
    return error("Unauthorized", 401);
  }
  return next();
});

// CORS middleware
app.use(async (req, next) => {
  const response = await next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
});
```

### Response Compression

Verb includes automatic response compression middleware supporting gzip and deflate:

```typescript
import { 
  compression, 
  gzip, 
  deflate, 
  productionCompression, 
  developmentCompression 
} from "verb";

// Basic compression with default settings
app.use(compression());

// Custom compression options
app.use(compression({
  level: 9,                    // Compression level (1-9)
  threshold: 1024,             // Minimum size to compress (bytes)
  algorithms: ["gzip", "deflate"], // Supported algorithms
  contentTypes: [              // Content types to compress
    "text/html",
    "application/json",
    "text/css",
    "application/javascript"
  ]
}));

// Convenience functions
app.use(gzip(6, 1024));          // Gzip-only compression
app.use(deflate(6, 1024));       // Deflate-only compression

// Environment-specific presets
app.use(productionCompression()); // High compression for production
app.use(developmentCompression()); // Fast compression for development
```

#### Compression Features

- **Automatic negotiation** - Respects client `Accept-Encoding` headers
- **Content-type filtering** - Only compresses text-based content by default
- **Size threshold** - Skips compression for small responses
- **Multiple algorithms** - Supports gzip and deflate with preference order
- **Performance optimized** - Uses Bun's native compression APIs
- **Error handling** - Gracefully falls back to uncompressed responses

#### Usage Examples

```typescript
// Large JSON responses benefit from compression
app.get("/api/users", () => {
  const users = generateLargeUserList(); // 1000+ users
  return json(users); // Automatically compressed if > threshold
});

// Text responses are compressed
app.get("/data.csv", () => {
  const csvData = generateLargeCsv();
  return new Response(csvData, {
    headers: { "Content-Type": "text/csv" }
  }); // Compressed automatically
});

// Binary responses are not compressed by default
app.get("/image.jpg", () => {
  return new Response(imageData, {
    headers: { "Content-Type": "image/jpeg" }
  }); // Not compressed (binary content)
});
```

#### Testing Compression

```bash
# Test with curl
curl -H "Accept-Encoding: gzip" http://localhost:3000/api/users -v

# Look for these headers in the response:
# Content-Encoding: gzip
# Vary: Accept-Encoding
```

### Static File Serving

```typescript
import { serveStatic, staticFiles } from "verb";

// Serve static files from ./public
app.get("/static/*", serveStatic({
  root: "./public",
  index: ["index.html", "index.htm"],
  maxAge: 3600,        // 1 hour cache
  immutable: true,     // Add immutable directive
  etag: true,          // Generate ETags
  extensions: [".html"] // Try .html if file not found
}));

// Simplified static serving
app.get("/assets/*", staticFiles("./assets"));

// With caching
app.get("/images/*", staticFiles("./images", {
  maxAge: 86400,    // 1 day
  immutable: true
}));
```

### Sub-Application Mounting

```typescript
// Create a sub-application
const apiApp = {
  routes: [
    { method: "GET", path: "/", handler: () => json({ api: "v1" }) },
    { method: "GET", path: "/users", handler: () => json([]) },
    { method: "POST", path: "/users", handler: () => json({ created: true }) }
  ]
};

// Mount at /api/v1
app.mount("/api/v1", apiApp);

// Routes are now available at:
// GET /api/v1/        -> { api: "v1" }
// GET /api/v1/users   -> []
// POST /api/v1/users  -> { created: true }
```

### HTTP/2 Support

Verb provides full HTTP/2 support with TLS, server push, and stream multiplexing optimizations:

```typescript
import { createServer, responseWithPush, http2Middleware } from "verb";

// Create HTTP/2 server with TLS
const app = createServer({
  port: 3443,
  http2: true,
  tls: {
    cert: "./cert.pem",
    key: "./key.pem"
  }
});

// Add HTTP/2 optimization middleware
app.use(http2Middleware);

// Server push for critical resources
app.get("/", () => {
  const resources = [
    { path: "/styles/critical.css", type: "text/css", importance: "high" },
    { path: "/js/app.js", type: "application/javascript" }
  ];
  
  return responseWithPush(
    "<html><head><title>HTTP/2</title></head><body>Hello HTTP/2!</body></html>",
    resources,
    { headers: { "Content-Type": "text/html" } }
  );
});
```

#### HTTP/2 Features

```typescript
import { 
  createHttp2Headers, 
  StreamPriority, 
  createPushHeader 
} from "verb";

// Stream priority for multiplexing
app.get("/api/critical", () => {
  const headers = createHttp2Headers(StreamPriority.HIGH, "no-cache");
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ urgent: true }), { headers });
});

// Manual server push headers
app.get("/page", () => {
  const linkHeader = createPushHeader([
    { path: "/critical.css", type: "text/css", rel: "preload" },
    { path: "/app.js", type: "application/javascript", rel: "modulepreload" }
  ]);
  
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Link": linkHeader
    }
  });
});
```

#### Certificate Generation

For development, generate a self-signed certificate:

```bash
# Generate certificate and key
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Then use in your server
const app = createServer({
  http2: true,
  tls: { cert: "./cert.pem", key: "./key.pem" }
});
```

#### HTTP/2 Middleware

The `http2Middleware` automatically optimizes responses:

- Adds server push hints for HTML pages
- Sets aggressive caching for static assets
- Optimizes headers for HTTP/2 compression
- Enables stream priority hints

```typescript
// Automatic optimization
app.use(http2Middleware);

// HTML responses get push hints for common resources
// Static assets get immutable cache headers
// API responses get stream priority headers
```

## 🧪 Testing

Verb includes a built-in mock server for fast, network-free testing:

```typescript
import { createMockServer, json } from "verb";
import { expect, test } from "bun:test";

test("API endpoint", async () => {
  const app = createMockServer();
  
  app.get("/users/:id", (req, params) => json({ id: params.id }));
  
  const response = await app.request.get("/users/123");
  expect(response.status).toBe(200);
  
  const data = await response.json();
  expect(data).toEqual({ id: "123" });
});

test("POST with body", async () => {
  const app = createMockServer();
  
  app.post("/users", async (req) => {
    const body = await parseBody(req);
    return json({ created: body.name }, 201);
  });
  
  const response = await app.request.post("/users", { name: "John" });
  expect(response.status).toBe(201);
  
  const data = await response.json();
  expect(data).toEqual({ created: "John" });
});
```

## 🏎️ Performance

Verb is designed for maximum performance:

### Route Caching
Routes are cached after first match using an LRU cache (1000 entries), eliminating regex compilation overhead on subsequent requests.

### Optimized Routing
- Compiled regex patterns for fast route matching
- Minimal memory allocations per request
- Efficient parameter extraction

### Benchmarks
Built on Bun's native HTTP server, Verb delivers exceptional performance that surpasses traditional Node.js frameworks.

## 📊 Real-World Examples

### REST API

```typescript
import { createServer, json, parseBody, error } from "verb";

const app = createServer({ port: 3000 });

// In-memory store (use a real database in production)
const users = new Map();
let nextId = 1;

// List users
app.get("/api/users", () => {
  return json(Array.from(users.values()));
});

// Get user by ID
app.get("/api/users/:id", (req, params) => {
  const user = users.get(parseInt(params.id));
  if (!user) return error("User not found", 404);
  return json(user);
});

// Create user
app.post("/api/users", async (req) => {
  const body = await parseBody(req);
  const user = { id: nextId++, ...body };
  users.set(user.id, user);
  return json(user, 201);
});

// Update user
app.put("/api/users/:id", async (req, params) => {
  const id = parseInt(params.id);
  if (!users.has(id)) return error("User not found", 404);
  
  const body = await parseBody(req);
  const user = { id, ...body };
  users.set(id, user);
  return json(user);
});

// Delete user
app.delete("/api/users/:id", (req, params) => {
  const id = parseInt(params.id);
  if (!users.delete(id)) return error("User not found", 404);
  return new Response(null, { status: 204 });
});
```

### Full-Stack Application

```typescript
import { createServer, html, json, serveStatic } from "verb";

const app = createServer({ port: 3000 });

// Serve static files (CSS, JS, images)
app.get("/assets/*", serveStatic({
  root: "./public/assets",
  maxAge: 86400,
  immutable: true
}));

// HTML pages
app.get("/", () => html(`
  <!DOCTYPE html>
  <html>
    <head>
      <title>My App</title>
      <link rel="stylesheet" href="/assets/style.css">
    </head>
    <body>
      <h1>Welcome to Verb</h1>
      <script src="/assets/app.js"></script>
    </body>
  </html>
`));

// API endpoints
app.get("/api/status", () => json({ status: "ok", timestamp: Date.now() }));

// Health check
app.get("/health", () => new Response("OK"));
```

### Microservice with Middleware

```typescript
import { createServer, json, error } from "verb";

const app = createServer({ port: 3000 });

// Request logging
app.use(async (req, next) => {
  const start = Date.now();
  console.log(`-> ${req.method} ${req.url}`);
  const response = await next();
  console.log(`<- ${response.status} (${Date.now() - start}ms)`);
  return response;
});

// Authentication
app.use(async (req, next) => {
  if (req.url.startsWith("/api/")) {
    const token = req.headers.get("authorization");
    if (!token || !token.startsWith("Bearer ")) {
      return error("Unauthorized", 401);
    }
  }
  return next();
});

// CORS
app.use(async (req, next) => {
  const response = await next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
});

// Protected API routes
app.get("/api/protected", () => json({ message: "Secret data" }));
app.post("/api/data", async (req) => {
  const body = await parseBody(req);
  return json({ received: body });
});
```

## 🎯 Why Verb?

- **Performance First**: Built on Bun's lightning-fast runtime
- **Developer Experience**: Clean APIs with full TypeScript support
- **Zero Dependencies**: No external packages, just Bun's built-in capabilities
- **Production Ready**: Comprehensive static file serving, caching, and error handling
- **Testing Friendly**: Built-in mock server for fast unit tests
- **Modular**: Mount sub-applications for clean architecture

## 🔧 Requirements

- **Bun**: v1.0 or higher
- **TypeScript**: v5.0 or higher (peer dependency)

## 📄 License

MIT License - use Verb in any project, commercial or open source.

---

**Ready to build fast?** Start with `bun add verb` and experience the speed of modern HTTP serving.

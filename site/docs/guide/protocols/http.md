# HTTP/HTTPS

This guide covers creating and configuring HTTP and HTTPS servers with Verb.

## HTTP Server

### Basic HTTP Server

```typescript
import { createServer, ServerProtocol } from "verb";

// Default HTTP server
const app = createServer();
// or explicitly
const app = createServer(ServerProtocol.HTTP);

app.get("/", (req, res) => {
  res.json({ message: "Hello HTTP!" });
});

app.listen(3000);
console.log("HTTP server running on http://localhost:3000");
```

### HTTP Methods

```typescript
const app = createServer(ServerProtocol.HTTP);

// GET request
app.get("/users", (req, res) => {
  res.json({ users: [] });
});

// POST request
app.post("/users", (req, res) => {
  const user = req.body;
  res.status(201).json({ id: 1, ...user });
});

// PUT request
app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const user = req.body;
  res.json({ id, ...user });
});

// DELETE request
app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  res.status(204).send();
});

// PATCH request
app.patch("/users/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  res.json({ id, ...updates });
});

// HEAD request
app.head("/users", (req, res) => {
  res.status(200).end();
});

// OPTIONS request
app.options("/users", (req, res) => {
  res.header("Allow", "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS");
  res.status(200).end();
});
```

### Request Handling

```typescript
const app = createServer(ServerProtocol.HTTP);

app.post("/data", (req, res) => {
  // Request properties
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("URL:", req.url);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("Query:", req.query);
  console.log("Params:", req.params);
  console.log("Cookies:", req.cookies);
  console.log("IP:", req.ip);
  console.log("Hostname:", req.hostname);
  console.log("Protocol:", req.protocol);
  console.log("Secure:", req.secure);
  
  res.json({ received: "ok" });
});
```

### Response Methods

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/response-examples", (req, res) => {
  // JSON response
  res.json({ message: "JSON response" });
});

app.get("/text", (req, res) => {
  // Text response
  res.text("Plain text response");
});

app.get("/html", (req, res) => {
  // HTML response
  res.html("<h1>HTML Response</h1>");
});

app.get("/status", (req, res) => {
  // Status codes
  res.status(201).json({ created: true });
});

app.get("/headers", (req, res) => {
  // Custom headers
  res.header("X-Custom-Header", "custom-value");
  res.headers({
    "X-Another-Header": "another-value",
    "Content-Type": "application/json"
  });
  res.json({ message: "Headers set" });
});

app.get("/redirect", (req, res) => {
  // Redirects
  res.redirect("/new-location");
  // or with status
  res.redirect("/new-location", 301);
});

app.get("/cookies", (req, res) => {
  // Cookies
  res.cookie("sessionId", "abc123");
  res.cookie("preferences", "dark-mode", {
    maxAge: 86400000, // 24 hours
    httpOnly: true,
    secure: true
  });
  res.json({ message: "Cookies set" });
});
```

### File Operations

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/download", async (req, res) => {
  // File download
  await res.download("./files/document.pdf");
});

app.get("/attachment", (req, res) => {
  // File attachment
  res.attachment("data.json");
  res.json({ data: "example" });
});

app.get("/send-file", async (req, res) => {
  // Send file
  await res.sendFile("./public/index.html");
});

app.get("/file-stream", async (req, res) => {
  // Stream file
  const file = Bun.file("./large-file.txt");
  res.type("text/plain");
  res.send(file.stream());
});
```

## HTTPS Server

### Basic HTTPS Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTPS);

app.get("/secure", (req, res) => {
  res.json({ 
    message: "Secure HTTPS response",
    secure: req.secure,
    protocol: req.protocol
  });
});

// Configure TLS options
app.withOptions({
  // TLS configuration depends on Bun's implementation
  // This is a conceptual example
  tls: {
    key: await Bun.file("./ssl/private-key.pem").text(),
    cert: await Bun.file("./ssl/certificate.pem").text()
  }
});

app.listen(443);
console.log("HTTPS server running on https://localhost:443");
```

### TLS Configuration

```typescript
const app = createServer(ServerProtocol.HTTPS);

// TLS options (conceptual - depends on Bun's TLS implementation)
app.withOptions({
  tls: {
    key: process.env.TLS_KEY || await Bun.file("./ssl/key.pem").text(),
    cert: process.env.TLS_CERT || await Bun.file("./ssl/cert.pem").text(),
    ca: process.env.TLS_CA || await Bun.file("./ssl/ca.pem").text(),
    passphrase: process.env.TLS_PASSPHRASE,
    rejectUnauthorized: true,
    secureProtocol: "TLSv1_2_method"
  }
});

app.get("/", (req, res) => {
  res.json({ 
    secure: true,
    cipher: req.connection?.getCipher?.() 
  });
});
```

## Content Negotiation

### Accept Headers

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/content", (req, res) => {
  const acceptsJSON = req.accepts("application/json");
  const acceptsXML = req.accepts("application/xml");
  const acceptsHTML = req.accepts("text/html");
  
  if (acceptsJSON) {
    res.json({ format: "json" });
  } else if (acceptsXML) {
    res.type("application/xml");
    res.send("<?xml version=\"1.0\"?><root><format>xml</format></root>");
  } else if (acceptsHTML) {
    res.html("<h1>HTML Format</h1>");
  } else {
    res.status(406).json({ error: "Not Acceptable" });
  }
});
```

### Content Types

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/api/data", (req, res) => {
  const accepts = req.accepts(["json", "xml", "html"]);
  
  const data = { message: "Hello World" };
  
  switch (accepts) {
    case "json":
      res.json(data);
      break;
    case "xml":
      res.type("application/xml");
      res.send(`<root><message>${data.message}</message></root>`);
      break;
    case "html":
      res.html(`<h1>${data.message}</h1>`);
      break;
    default:
      res.status(406).json({ error: "Not Acceptable" });
  }
});
```

## Middleware

### Built-in Middleware

```typescript
import { createServer, middleware } from "verb";

const app = createServer(ServerProtocol.HTTP);

// JSON parsing
app.use(middleware.json());

// URL-encoded parsing
app.use(middleware.urlencoded({ extended: true }));

// Static files
app.use(middleware.staticFiles("public"));

// CORS
app.use(middleware.cors());

// Compression
app.use(middleware.compression());

// Security headers
app.use(middleware.helmet());

app.get("/", (req, res) => {
  res.json({ message: "Middleware applied" });
});
```

### Custom Middleware

```typescript
const app = createServer(ServerProtocol.HTTP);

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`→ ${req.method} ${req.path}`);
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`← ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Authentication middleware
app.use("/api", (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Verify token...
  next();
});
```

## Error Handling

### Route-Level Error Handling

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/error", (req, res) => {
  try {
    // Code that might throw
    throw new Error("Something went wrong");
  } catch (error) {
    console.error("Route error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Async error handling
app.get("/async-error", async (req, res) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Async operation failed" });
  }
});
```

### Global Error Handler

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/throw", (req, res) => {
  throw new Error("Intentional error");
});

// Global error handler (must be last)
app.use((error, req, res, next) => {
  console.error("Global error:", error);
  
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? error.message : undefined
  });
});
```

## Request Validation

### Body Validation

```typescript
const app = createServer(ServerProtocol.HTTP);

app.use(middleware.json());

const validateUser = (req, res, next) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      error: "Name and email are required" 
    });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ 
      error: "Invalid email format" 
    });
  }
  
  next();
};

app.post("/users", validateUser, (req, res) => {
  const user = req.body;
  res.status(201).json({ id: 1, ...user });
});
```

### Query Parameter Validation

```typescript
const app = createServer(ServerProtocol.HTTP);

app.get("/users", (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: "Invalid page number" });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: "Invalid limit (1-100)" });
  }
  
  res.json({ 
    users: [],
    pagination: { page: pageNum, limit: limitNum }
  });
});
```

## Performance Optimization

### Caching

```typescript
const app = createServer(ServerProtocol.HTTP);

const cache = new Map();

app.get("/expensive/:id", (req, res) => {
  const { id } = req.params;
  const cacheKey = `expensive:${id}`;
  
  // Check cache
  if (cache.has(cacheKey)) {
    res.header("X-Cache", "HIT");
    return res.json(cache.get(cacheKey));
  }
  
  // Expensive operation
  const result = performExpensiveOperation(id);
  
  // Cache result
  cache.set(cacheKey, result);
  
  res.header("X-Cache", "MISS");
  res.json(result);
});
```

### Compression

```typescript
const app = createServer(ServerProtocol.HTTP);

app.use(middleware.compression({
  threshold: 1024, // Only compress responses > 1KB
  level: 6,        // Compression level (1-9)
  filter: (req, res) => {
    // Don't compress images
    return !res.getHeader("Content-Type")?.startsWith("image/");
  }
}));

app.get("/large-data", (req, res) => {
  const largeData = generateLargeDataset();
  res.json(largeData); // Will be compressed
});
```

### Keep-Alive

```typescript
const app = createServer(ServerProtocol.HTTP);

app.withOptions({
  keepAlive: true,
  keepAliveTimeout: 5000, // 5 seconds
  maxRequestsPerSocket: 1000
});

app.get("/", (req, res) => {
  res.json({ message: "Keep-alive enabled" });
});
```

## Security

### HTTPS Redirect

```typescript
const app = createServer(ServerProtocol.HTTP);

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (!req.secure && req.headers.host) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

### Security Headers

```typescript
const app = createServer(ServerProtocol.HTTP);

app.use(middleware.helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Rate Limiting

```typescript
const app = createServer(ServerProtocol.HTTP);

app.use(middleware.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
}));
```

## HTTP/2 Compatibility

### Preparing for HTTP/2

```typescript
const app = createServer(ServerProtocol.HTTP);

// Use middleware that's HTTP/2 compatible
app.use(middleware.compression());
app.use(middleware.json());

// Avoid response.write() patterns - use response.json() instead
app.get("/data", (req, res) => {
  res.json({ data: "This works in both HTTP/1.1 and HTTP/2" });
});

// The same routes will work with HTTP/2
const http2App = createServer(ServerProtocol.HTTP2);
// Copy routes or use shared router
```

## Testing

### Unit Testing

```typescript
import { test, expect } from "bun:test";
import { createServer } from "verb";

test("HTTP server basic functionality", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ test: true });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.test).toBe(true);
});
```

### Integration Testing

```typescript
import { test, expect } from "bun:test";

test("HTTP server integration", async () => {
  const app = createServer();
  
  app.use(middleware.json());
  app.post("/users", (req, res) => {
    res.status(201).json({ id: 1, ...req.body });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "John", email: "john@example.com" })
  }));
  
  expect(response.status).toBe(201);
  const data = await response.json();
  expect(data.name).toBe("John");
});
```

## Best Practices

1. **Use HTTPS in Production**: Always use HTTPS for production applications
2. **Implement Proper Error Handling**: Handle errors gracefully
3. **Validate Input**: Always validate request data
4. **Use Middleware**: Leverage middleware for common functionality
5. **Enable Compression**: Use compression for better performance
6. **Set Security Headers**: Implement security headers
7. **Rate Limiting**: Protect against abuse
8. **Logging**: Implement comprehensive logging
9. **Keep-Alive**: Use keep-alive for better performance
10. **Content Negotiation**: Support multiple content types

## Examples

### RESTful API

```typescript
const app = createServer(ServerProtocol.HTTP);

app.use(middleware.json());
app.use(middleware.cors());

// Users resource
app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

app.get("/api/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({ id, name: `User ${id}` });
});

app.post("/api/users", (req, res) => {
  const user = req.body;
  res.status(201).json({ id: Date.now(), ...user });
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const user = req.body;
  res.json({ id, ...user });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  res.status(204).send();
});
```

### File Upload Server

```typescript
const app = createServer(ServerProtocol.HTTP);

app.use(middleware.multipart());

app.post("/upload", async (req, res) => {
  const { files } = req;
  
  if (!files || !files.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  const file = files.file;
  const filename = `${Date.now()}-${file.name}`;
  
  await Bun.write(`./uploads/${filename}`, file);
  
  res.json({ 
    message: "File uploaded successfully",
    filename,
    size: file.size
  });
});
```

## Next Steps

- [HTTP/2](/guide/protocols/http2) - Learn about HTTP/2 servers
- [WebSocket](/guide/protocols/websocket) - Real-time communication
- [Middleware](/guide/middleware) - Advanced middleware patterns
- [Security](/guide/security) - Security best practices
# HTTP Server

API reference for creating and configuring HTTP servers with Verb, including routing, middleware, and server options.

## Creating HTTP Server

### Basic HTTP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP);

app.get("/", (req, res) => {
  res.json({ message: "Hello from HTTP server!" });
});

app.listen(3000);
console.log("HTTP server running on http://localhost:3000");
```

### Default Server (HTTP)

```typescript
import { createServer } from "verb";

// HTTP is the default protocol
const app = createServer();

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(3000);
```

## Server Configuration

### Basic Options

```typescript
app.withOptions({
  port: 3000,
  hostname: "localhost",
  development: {
    hmr: true,      // Hot module reloading
    console: true   // Console logging
  }
});
```

### Advanced HTTP Options

```typescript
app.withOptions({
  port: 3000,
  hostname: "0.0.0.0",
  maxRequestBodySize: "10mb",
  keepAlive: true,
  keepAliveTimeout: 5000,
  headersTimeout: 60000,
  requestTimeout: 120000,
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  compression: {
    threshold: 1024,
    level: 6
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  }
});
```

## HTTP Methods

### Standard HTTP Methods

```typescript
// GET requests
app.get("/users", (req, res) => {
  const users = getAllUsers();
  res.json(users);
});

app.get("/users/:id", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

// POST requests
app.post("/users", (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(user);
});

// PUT requests
app.put("/users/:id", (req, res) => {
  const user = updateUser(req.params.id, req.body);
  res.json(user);
});

// PATCH requests
app.patch("/users/:id", (req, res) => {
  const user = partialUpdateUser(req.params.id, req.body);
  res.json(user);
});

// DELETE requests
app.delete("/users/:id", (req, res) => {
  deleteUser(req.params.id);
  res.status(204).send();
});

// HEAD requests
app.head("/users/:id", (req, res) => {
  const exists = userExists(req.params.id);
  res.status(exists ? 200 : 404).end();
});

// OPTIONS requests
app.options("/users", (req, res) => {
  res.header("Allow", "GET, POST, PUT, DELETE, OPTIONS");
  res.status(200).end();
});
```

### Method Chaining

```typescript
app.route("/users/:id")
  .get((req, res) => {
    const user = getUserById(req.params.id);
    res.json(user);
  })
  .put((req, res) => {
    const user = updateUser(req.params.id, req.body);
    res.json(user);
  })
  .delete((req, res) => {
    deleteUser(req.params.id);
    res.status(204).send();
  });
```

### Catch-All Routes

```typescript
// Handle all methods for a route
app.all("/api/*", (req, res, next) => {
  console.log(`API request: ${req.method} ${req.path}`);
  next();
});

// Catch unmatched routes
app.all("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method
  });
});
```

## Request Handling

### Request Properties

```typescript
app.get("/info", (req, res) => {
  res.json({
    method: req.method,           // HTTP method
    url: req.url,                 // Full URL
    path: req.path,               // URL path
    query: req.query,             // Query parameters
    params: req.params,           // Route parameters
    headers: Object.fromEntries(req.headers), // Request headers
    ip: req.ip,                   // Client IP
    userAgent: req.get("user-agent"),
    contentType: req.get("content-type"),
    contentLength: req.get("content-length")
  });
});
```

### Body Parsing

```typescript
import { json, urlencoded, raw, text } from "verb/middleware";

// JSON body parsing
app.use(json());

// URL-encoded form data
app.use(urlencoded({ extended: true }));

// Raw body as Buffer
app.use(raw({ type: "application/octet-stream" }));

// Text body
app.use(text({ type: "text/plain" }));

app.post("/data", (req, res) => {
  console.log("Body:", req.body);
  res.json({ received: true });
});
```

### File Uploads

```typescript
import { multer } from "verb/middleware";

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  }
});

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});
```

## Response Methods

### JSON Responses

```typescript
app.get("/api/users", (req, res) => {
  const users = getAllUsers();
  
  res.json({
    users,
    total: users.length,
    timestamp: new Date().toISOString()
  });
});
```

### HTML Responses

```typescript
app.get("/", (req, res) => {
  res.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Verb HTTP Server</title>
      </head>
      <body>
        <h1>Welcome to Verb!</h1>
        <p>HTTP server is running.</p>
      </body>
    </html>
  `);
});
```

### File Responses

```typescript
app.get("/download/:filename", async (req, res) => {
  const filename = req.params.filename;
  const filepath = `./downloads/${filename}`;
  
  try {
    await res.sendFile(filepath);
  } catch (error) {
    res.status(404).json({ error: "File not found" });
  }
});

app.get("/report", async (req, res) => {
  await res.download("./reports/monthly.pdf", "report.pdf");
});
```

### Streaming Responses

```typescript
app.get("/stream", (req, res) => {
  res.type("text/plain");
  res.header("Cache-Control", "no-cache");
  
  let count = 0;
  const interval = setInterval(() => {
    res.write(`Chunk ${count++}\n`);
    
    if (count >= 10) {
      clearInterval(interval);
      res.end("Stream complete\n");
    }
  }, 1000);
  
  // Handle client disconnect
  req.on("close", () => {
    clearInterval(interval);
  });
});
```

## Middleware

### Built-in Middleware

```typescript
import { 
  cors, 
  compression, 
  rateLimit, 
  helmet,
  morgan 
} from "verb/middleware";

// CORS middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://myapp.com"],
  credentials: true
}));

// Compression middleware
app.use(compression());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// Security headers
app.use(helmet());

// Request logging
app.use(morgan("combined"));
```

### Custom Middleware

```typescript
// Request timing middleware
const timing = (req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  
  next();
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.get("authorization");
  
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  try {
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

app.use(timing);
app.use("/api/protected", authenticate);
```

## Error Handling

### Error Middleware

```typescript
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);
  
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }
  
  res.status(500).json({
    error: "Internal server error"
  });
};

// Must be added after all routes
app.use(errorHandler);
```

### Async Error Handling

```typescript
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  
  res.json(user);
}));
```

## Static File Serving

```typescript
import { staticFiles } from "verb/middleware";

// Serve static files from public directory
app.use(staticFiles({ root: "./public" }));

// Serve with custom path
app.use("/assets", staticFiles({ 
  root: "./public",
  maxAge: "1d",
  index: ["index.html"],
  extensions: ["html", "htm"]
}));

// Serve single file
app.get("/favicon.ico", async (req, res) => {
  await res.sendFile("./public/favicon.ico");
});
```

## Session Management

```typescript
import { session } from "verb/middleware";

app.use(session({
  secret: "your-secret-key",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false // Set to true in production with HTTPS
  },
  resave: false,
  saveUninitialized: false
}));

app.post("/login", (req, res) => {
  // Authenticate user
  if (validCredentials(req.body)) {
    req.session.userId = user.id;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.get("/profile", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const user = getUserById(req.session.userId);
  res.json(user);
});
```

## Performance Optimization

### Caching

```typescript
const cache = new Map();

app.get("/expensive-operation", (req, res) => {
  const cacheKey = req.url;
  
  if (cache.has(cacheKey)) {
    res.header("X-Cache", "HIT");
    return res.json(cache.get(cacheKey));
  }
  
  const result = performExpensiveOperation();
  cache.set(cacheKey, result);
  
  res.header("X-Cache", "MISS");
  res.json(result);
});
```

### HTTP Caching

```typescript
app.get("/static-data", (req, res) => {
  res.header("Cache-Control", "public, max-age=3600"); // 1 hour
  res.header("ETag", generateETag(data));
  res.json(data);
});

app.get("/dynamic-data", (req, res) => {
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  res.json(getDynamicData());
});
```

## Health Checks

```typescript
app.get("/health", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  };
  
  res.json(health);
});

app.get("/ready", async (req, res) => {
  try {
    await checkDatabaseConnection();
    await checkExternalServices();
    
    res.json({ status: "ready" });
  } catch (error) {
    res.status(503).json({ 
      status: "not ready",
      error: error.message 
    });
  }
});
```

## Testing HTTP Server

```typescript
import { test, expect } from "bun:test";
import request from "supertest";

test("GET /users returns user list", async () => {
  const response = await request(app)
    .get("/users")
    .expect(200);
    
  expect(response.body).toHaveProperty("users");
  expect(Array.isArray(response.body.users)).toBe(true);
});

test("POST /users creates new user", async () => {
  const newUser = {
    name: "John Doe",
    email: "john@example.com"
  };
  
  const response = await request(app)
    .post("/users")
    .send(newUser)
    .expect(201);
    
  expect(response.body).toHaveProperty("id");
  expect(response.body.name).toBe(newUser.name);
});

test("handles 404 for unknown routes", async () => {
  await request(app)
    .get("/unknown-route")
    .expect(404);
});
```

## Best Practices

1. **Use Middleware**: Leverage built-in and custom middleware for cross-cutting concerns
2. **Error Handling**: Implement comprehensive error handling
3. **Security**: Use security middleware and validate all inputs
4. **Performance**: Implement caching and compression
5. **Monitoring**: Add health checks and logging
6. **Testing**: Write comprehensive tests for all endpoints

## See Also

- [HTTPS Server](/api/servers/https) - Secure HTTP with TLS
- [HTTP/2 Server](/api/servers/http2) - HTTP/2 protocol support
- [Middleware API](/api/middleware) - Creating custom middleware
- [Request API](/api/request) - Request object reference
- [Response API](/api/response) - Response object reference
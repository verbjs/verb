# Verb

> A fast, modern server framework built specifically for Bun runtime with multi-protocol support

[![npm version](https://badge.fury.io/js/verb.svg)](https://badge.fury.io/js/verb)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

## 📋 Requirements

**⚠️ Verb requires Bun runtime** - it won't work with Node.js, as it uses Bun-specific APIs.

- **Bun**: >= 1.0.0
- **TypeScript**: >= 5.8.3 (peer dependency)

## 📦 Installation

```bash
# Install Bun (if you haven't already)
curl -fsSL https://bun.sh/install | bash

# Install Verb
bun add verb
```

## 🚀 Quick Start

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP);

app.get("/", (req, res) => {
  res.json({ message: "Hello Verb!" });
});

app.listen(3000);
console.log("Server running on http://localhost:3000");
```

## Features

- **Multi-Protocol Support** - HTTP, HTTP/2, WebSocket, gRPC, UDP, TCP
- **Unified API** - Same interface across all protocols
- **Runtime Protocol Switching** - Switch between protocols dynamically
- **Built for Bun** - Native Bun APIs for maximum performance
- **Bun Native Routes** - `app.withRoutes()` for fullstack applications with HTML imports
- **TypeScript First** - Full type safety out of the box
- **Application Configuration** - Complete app settings, locals, and environment detection
- **Advanced Security** - Built-in CORS, rate limiting, and security headers
- **File Upload Support** - Streaming uploads with validation and progress tracking
- **JSON Optimization** - Schema-based validation and serialization for maximum performance
- **Performance Optimizations** - Route precompilation, caching, and ultra-fast parsing
- **Complete Middleware System** - Global, path-specific, and route-specific middleware
- **Simple Routing** - Path parameters, wildcards, and route chaining

## Basic Usage

### HTTP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP);

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.listen(3000);
```

### High-Performance JSON

Schema-based validation and serialization for maximum performance:

```typescript
import { createServer, schemas, optimizedJSON, validateSchema, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP);

// Define JSON schema for validation and optimization
const userSchema = schemas.object({
  name: schemas.string({ minLength: 1, maxLength: 50 }),
  email: schemas.string(),
  age: schemas.number({ minimum: 0, maximum: 150 }),
  active: schemas.boolean()
}, ['name', 'email']); // required fields

// Use optimized JSON middleware
app.use(optimizedJSON({
  requestSchema: userSchema,
  optimizeResponse: true,
  limit: 1024 * 1024 // 1MB limit
}));

// Route with schema validation
app.post('/users', validateSchema(userSchema), (req, res) => {
  // req.body is validated and cleaned
  const user = req.body;
  
  // Response uses optimized serialization
  res.json({
    success: true,
    data: { id: Date.now().toString(), ...user },
    message: "User created"
  });
});

app.listen(3000);
```

### Web Framework Features

Complete web framework capabilities:

```typescript
import { createServer, middleware, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP);

// Application settings
app.set("trust proxy", true);
app.set("view engine", "ejs");
console.log(app.getSetting("env")); // development/production

// Application locals
app.locals.title = "My App";
app.locals.user = { name: "John" };

// Built-in middleware
app.use(middleware.json());
app.use(middleware.urlencoded({ extended: true }));
app.use(middleware.staticFiles("public"));

// Routes with middleware
app.get("/", (req, res) => {
  res.json({ 
    title: app.locals.title,
    user: app.locals.user,
    cookies: req.cookies,
    ip: req.ip 
  });
});

// Error handling
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

app.listen(3000);
```

### Protocol Selection

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP/2 server
const http2Server = createServer(ServerProtocol.HTTP2);

// WebSocket server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.websocket({
  open: (ws) => ws.send("Connected!"),
  message: (ws, message) => ws.send(`Echo: ${message}`)
});

// gRPC server
const grpcServer = createServer(ServerProtocol.GRPC);
grpcServer.addMethod("UserService", {
  name: "GetUser",
  handler: async (request) => ({ id: request.id, name: "John" })
});

// UDP server
const udpServer = createServer(ServerProtocol.UDP);
udpServer.onMessage((message) => {
  console.log("UDP:", message.data.toString());
});

// TCP server
const tcpServer = createServer(ServerProtocol.TCP);
tcpServer.onConnection((connection) => {
  connection.write("Welcome to TCP server!");
});
```

### Bun Native Routes (Fullstack)

Use `app.withRoutes()` to leverage Bun's native routing system with HTML imports:

```typescript
import { createServer, ServerProtocol } from "verb";
import homepage from "./index.html";
import dashboard from "./dashboard.html";

const app = createServer(ServerProtocol.HTTP);

app.withRoutes({
  // HTML imports with automatic bundling
  "/": homepage,
  "/dashboard": dashboard,
  
  // API endpoints
  "/api/users": {
    async GET(req) {
      const users = await getUsers();
      return Response.json(users);
    },
    async POST(req) {
      const { name, email } = await req.json();
      const user = await createUser(name, email);
      return Response.json(user);
    }
  },
  
  // Parameterized routes
  "/api/users/:id": async (req) => {
    const { id } = req.params;
    const user = await getUserById(id);
    return Response.json(user);
  },
  
  // Complex parameterized routes
  "/api/users/:userId/posts/:postId": async (req) => {
    const { userId, postId } = req.params;
    const post = await getPostByIds(userId, postId);
    return Response.json(post);
  }
});

// Enable development features
app.withOptions({
  development: {
    hmr: true,      // Hot module reloading
    console: true   // Enhanced console logging
  }
});

app.listen(3000);
```

### Complete Fullstack Boilerplate

See our complete fullstack boilerplate that demonstrates the `withRoutes` pattern with React frontend and REST API:

```typescript
import { createServer, ServerProtocol } from 'verb';
// @ts-ignore - HTML imports work with Bun but TypeScript doesn't recognize them
import indexHtml from './frontend/index.html';
import apiHtml from './frontend/api.html';

const app = createServer(ServerProtocol.HTTP);

// Data stores
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

app.withRoutes({
  // ** HTML imports **
  // Bundle & route index.html to "/". This uses HTMLRewriter to scan the HTML for `<script>` and `<link>` tags, 
  // runs Bun's JavaScript & CSS bundler on them, transpiles any TypeScript, JSX, and TSX, 
  // downlevels CSS with Bun's CSS parser and serves the result.
  "/": indexHtml,
  "/api-demo": apiHtml,

  // ** API endpoints ** (Verb + Bun v1.2.3+ pattern)
  "/api/users": {
    async GET() {
      return Response.json(users);
    },
    async POST(req) {
      const { name, email } = await req.json();
      if (!name || !email) {
        return Response.json({ error: "Name and email are required" }, { status: 400 });
      }
      const newUser = { id: Date.now(), name, email };
      users.push(newUser);
      return Response.json(newUser, { status: 201 });
    },
  },
  "/api/users/:id": async (req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = parseInt(pathParts[pathParts.length - 1] || '0');
    const user = users.find(u => u.id === id);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json(user);
  },
  
  "/api/health": async () => {
    return Response.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }
});

// Configure development options
app.withOptions({
  port: 3001,
  hostname: 'localhost',
  development: {
    hmr: true,     // Hot module reloading (Bun v1.2.3+ required)
    console: true  // Enhanced console output
  }
});

app.listen();
console.log('🚀 Server running on http://localhost:3001');
```

**Features demonstrated:**
- HTML imports with automatic React/TSX bundling
- REST API with CRUD operations
- Parameter extraction from URLs
- Error handling and validation
- Health check endpoints
- Development features (HMR, route logging)

### Fluent API

```typescript
import { server } from "verb";

const httpApp = server.http();
const grpcApp = server.grpc();
const udpApp = server.udp();
```

## Protocol Gateway

Switch between protocols at runtime with the same routes:

```typescript
import { createProtocolGateway, ServerProtocol } from "verb";

const gateway = createProtocolGateway();

// Define routes that work across HTTP-based protocols
gateway.defineRoutes((app) => {
  app.get("/api/status", (req, res) => {
    res.json({ 
      status: "healthy",
      protocol: gateway.getCurrentProtocol() 
    });
  });
});

// Start with HTTP
gateway.listen(3000);

// Switch to HTTP/2
gateway.switchProtocol(ServerProtocol.HTTP2);
gateway.listen(3001);

// Switch to WebSocket
const wsServer = gateway.switchProtocol(ServerProtocol.WEBSOCKET);
wsServer.websocket({
  open: (ws) => ws.send("WebSocket ready!")
});
gateway.listen(3002);
```

## Available Protocols

| Protocol | Enum | Description |
|----------|------|-------------|
| HTTP/1.1 | `ServerProtocol.HTTP` | Standard HTTP server |
| HTTP/2 | `ServerProtocol.HTTP2` | HTTP/2 with multiplexing |
| WebSocket | `ServerProtocol.WEBSOCKET` | WebSocket with HTTP routes |
| gRPC | `ServerProtocol.GRPC` | gRPC service definitions |
| UDP | `ServerProtocol.UDP` | UDP message handling |
| TCP | `ServerProtocol.TCP` | TCP connection management |

## API Reference

### HTTP-based Servers (HTTP, HTTP/2, WebSocket)

```typescript
// Route methods
app.get(path, handler)
app.post(path, handler)
app.put(path, handler)
app.delete(path, handler)
app.patch(path, handler)

// Middleware
app.use(middleware)
app.use(path, middleware)

// Bun native routes
app.withRoutes(routesConfig)
app.withOptions(serverOptions)

// Application configuration
app.set(key, value)
app.getSetting(key)
app.locals // Object for application-wide variables
app.mountpath // Mount path for sub-applications
app.path() // Returns application path

// Start server
app.listen(port, hostname?)
```

### Request Object Extensions

```typescript
// Enhanced request object
req.body // Parsed request body
req.cookies // Parsed cookies
req.ip // Client IP address
req.path // URL path
req.hostname // Request hostname
req.protocol // http/https
req.secure // HTTPS check
req.xhr // XMLHttpRequest check
req.get(header) // Get header value
req.accepts(types) // Content negotiation
req.acceptsCharsets(charsets)
req.acceptsEncodings(encodings)
req.acceptsLanguages(languages)
```

### Response Object Extensions

```typescript
// Enhanced response object
res.json(data) // Send JSON response
res.send(data) // Send response
res.status(code) // Set status code
res.redirect(url) // Redirect response
res.cookie(name, value) // Set cookie
res.clearCookie(name) // Clear cookie
res.type(contentType) // Set content type
res.download(path) // File download
res.sendFile(path) // Send file
res.attachment(filename) // Set attachment headers
res.vary(header) // Vary header management
```

### Built-in Middleware

```typescript
import { middleware, schemas, optimizedJSON } from "verb";

// Body parsing
app.use(middleware.json()) // Parse JSON bodies
app.use(middleware.urlencoded()) // Parse form data
app.use(middleware.raw()) // Parse raw/binary data
app.use(middleware.text()) // Parse text data

// High-performance JSON with schema validation
app.use(optimizedJSON({
  requestSchema: schemas.object({
    name: schemas.string(),
    email: schemas.string()
  }),
  optimizeResponse: true
}));

// Static files
app.use(middleware.staticFiles("public"))

// Security
app.use(middleware.cors())
app.use(middleware.rateLimit())
app.use(middleware.securityHeaders())
```

### WebSocket Server

```typescript
app.websocket({
  open: (ws) => { /* connection opened */ },
  message: (ws, message) => { /* message received */ },
  close: (ws) => { /* connection closed */ }
});
```

### gRPC Server

```typescript
app.addService(service)
app.addMethod(serviceName, method)
```

### UDP Server

```typescript
app.onMessage((message) => { /* handle message */ })
app.send(data, port, address)
```

### TCP Server

```typescript
app.onConnection((connection) => { /* handle connection */ })
app.onData((connection, data) => { /* handle data */ })
```

## Environment Variables

Verb supports multiple environment variables for configuration:

```bash
# Environment detection (in order of precedence)
VERB_ENV=production    # Verb-specific environment
BUN_ENV=development    # Bun runtime environment  
NODE_ENV=development   # Node.js compatible environment

# Application settings are automatically configured based on environment
# Production: trust proxy = true, view cache = true
# Development: trust proxy = false, view cache = false
```

## Getting Started

Verb provides a familiar web framework API:

```typescript
import { createServer, ServerProtocol } from 'verb';
const app = createServer(ServerProtocol.HTTP);

// Application settings
app.set('trust proxy', true);
console.log(app.getSetting('trust proxy'));

// Routes and middleware
app.use(middleware.json());
app.get('/', (req, res) => res.json({ message: 'Hello!' }));
app.listen(3000);
```

## Performance

Built specifically for Bun runtime with native optimizations:

- **Native Bun APIs** - Uses `Bun.serve()`, `Bun.file()`, etc.
- **Bun Native Routes** - `app.withRoutes()` leverages Bun's native routing system
- **HTML Imports** - Automatic bundling with TypeScript, JSX, and CSS support
- **Zero runtime dependencies** - Leverages Bun's built-in modules
- **TypeScript-first** - No compilation overhead
- **HTTP/2 support** - Native HTTP/2 multiplexing
- **Streaming uploads** - Memory-efficient file handling
- **JSON Optimization** - Schema-based validation and serialization
  - 1000+ validations per millisecond
  - Optimized serialization faster than JSON.stringify()
  - Pre-compiled schemas for maximum performance
- **High-Performance Optimizations**:
  - Route precompilation and caching (1000+ route matches/ms)
  - Schema caching with LRU eviction
  - Optimized header parsing with caching
  - Ultra-fast query string parsing (10,000+ ops/ms)
  - Memory-efficient LRU caches throughout

## Development

```bash
# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.
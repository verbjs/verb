# Getting Started

Get up and running with Verb in less than 5 minutes! This guide will walk you through creating your first multi-protocol server.

## Quick Start

Install Verb and create your first server in seconds:

```bash
# Install Verb
bun install verb
```

Create your server:

```typescript
// server.ts
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.listen(3000);
console.log("Server running on http://localhost:3000");
```

Run your server:

```bash
bun server.ts
```

Visit <a href="http://localhost:3000" target="_blank" rel="noreferrer">http://localhost:3000</a> and you'll see:
```json
{ "message": "Hello World!" }
```

## Prerequisites

- [Bun](https://bun.sh) v1.0.0 or higher
- TypeScript knowledge (recommended)
- Basic understanding of server concepts

## Installation

Install Verb using Bun:

```bash
bun install verb
```

## Your First Server

Let's create a simple HTTP server:

```typescript
// server.ts
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello from Verb!" });
});

app.get("/users/:id", (req, res) => {
  res.json({ 
    id: req.params.id,
    name: `User ${req.params.id}`
  });
});

app.listen(3000);
console.log("Server running on http://localhost:3000");
```

Run your server:

```bash
bun server.ts
```

## Protocol Selection

Verb supports multiple protocols. Specify the protocol when creating a server:

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP Server (default)
const httpServer = createServer();
// or explicitly
const httpServer2 = createServer(ServerProtocol.HTTP);

// HTTPS Server
const httpsServer = createServer(ServerProtocol.HTTPS);

// HTTP/2 Server
const http2Server = createServer(ServerProtocol.HTTP2);

// WebSocket Server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
```

## Basic Routing

Verb supports standard HTTP methods:

```typescript
const app = createServer();

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
  const id = req.params.id;
  const user = req.body;
  res.json({ id, ...user });
});

// DELETE request
app.delete("/users/:id", (req, res) => {
  res.status(204).send();
});
```

## Middleware

Add middleware to process requests:

```typescript
const app = createServer();

// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Path-specific middleware
app.use("/api", (req, res, next) => {
  res.header("X-API-Version", "1.0");
  next();
});

// Route with middleware
app.get("/protected", 
  (req, res, next) => {
    // Auth middleware
    if (!req.headers.authorization) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
  (req, res) => {
    res.json({ message: "Access granted!" });
  }
);
```

## Error Handling

Handle errors gracefully:

```typescript
const app = createServer();

app.get("/error", (req, res) => {
  throw new Error("Something went wrong!");
});

// Global error handler
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: error.message 
  });
});
```

## Request and Response

Access request data and send responses:

```typescript
const app = createServer();

app.post("/data", (req, res) => {
  // Request data
  const body = req.body;
  const query = req.query;
  const params = req.params;
  const headers = req.headers;

  // Response methods
  res.json({ data: body });           // JSON response
  res.text("Hello World");           // Text response
  res.html("<h1>Hello</h1>");        // HTML response
  res.status(201).json({ id: 1 });   // Status + JSON
  res.redirect("/success");          // Redirect
  res.header("X-Custom", "value");   // Custom headers
});
```

## Multiple Protocols Example

Create servers for different protocols:

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP Server
const httpServer = createServer(ServerProtocol.HTTP);
httpServer.get("/", (req, res) => {
  res.json({ protocol: "HTTP" });
});
httpServer.listen(3000);

// WebSocket Server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.get("/", (req, res) => {
  res.json({ protocol: "WebSocket HTTP" });
});
wsServer.websocket({
  open: (ws) => {
    ws.send("WebSocket connected!");
  },
  message: (ws, message) => {
    ws.send(`Echo: ${message}`);
  }
});
wsServer.listen(3001);

// gRPC Server
const grpcServer = createServer(ServerProtocol.GRPC);
grpcServer.addMethod("UserService", {
  name: "GetUser",
  handler: async (request) => {
    return { id: request.id, name: "John Doe" };
  }
});
grpcServer.listen(50051);
```

## Development Tips

### Hot Reload
Use Bun's `--hot` flag for automatic reloading:

```bash
bun --hot server.ts
```

### TypeScript Support
Verb is built with TypeScript. Use types for better development experience:

```typescript
import { createServer, Request, Response } from "verb";

const app = createServer();

app.get("/typed", (req: Request, res: Response) => {
  // Full type safety
  res.json({ message: "Typed response" });
});
```

### Environment Variables
Use Bun's built-in environment variable support:

```typescript
const app = createServer();

const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";

app.listen(port, host);
```

## Advanced Features Preview

### Fullstack with Bun Routes

Build fullstack applications with HTML imports and automatic bundling:

```typescript
import { createServer } from "verb";
import homepage from "./index.html"; // HTML import

const app = createServer();

app.withRoutes({
  // Serve HTML with automatic bundling
  "/": homepage,
  
  // API routes
  "/api/users": {
    GET: async () => Response.json(await getUsers()),
    POST: async (req) => {
      const user = await createUser(await req.json());
      return Response.json(user, { status: 201 });
    }
  }
});

app.withOptions({
  port: 3000,
  development: {
    hmr: true,     // Hot module reloading
    console: true  // Enhanced console logging
  }
});

app.listen();
```

### Protocol Gateway

Connect different protocols seamlessly:

```typescript
import { createGateway } from "verb";

const gateway = createGateway();

// Add multiple protocol servers
const httpServer = gateway.addServer("http", { port: 3000 });
const wsServer = gateway.addServer("websocket", { port: 3001 });

// HTTP to WebSocket bridge
httpServer.post("/broadcast", (req, res) => {
  const { message } = req.body;
  
  // Send to all WebSocket clients
  gateway.broadcast("websocket", { 
    type: "message", 
    data: message 
  });
  
  res.json({ success: true });
});

gateway.start();
```

## Next Steps

Now that you have a basic understanding of Verb, explore:

- [HTTP Protocol](/guide/protocols/http) - Learn about HTTP servers
- [WebSocket Protocol](/guide/protocols/websocket) - Real-time communication
- [gRPC Protocol](/guide/protocols/grpc) - High-performance RPC
- [Protocol Gateway](/guide/protocol-gateway) - Runtime protocol switching
- [Middleware](/guide/middleware) - Advanced middleware patterns
- [API Reference](/api/) - Complete API documentation
- [Examples](/examples/) - Real-world examples

## Common Issues

### Port Already in Use
If you get "port already in use" errors:

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### TypeScript Errors
Make sure you have TypeScript installed:

```bash
bun install -D typescript
```

Need help? Check out our [GitHub Issues](https://github.com/verbjs/verb/issues) or [discussions](https://github.com/verbjs/verb/discussions).
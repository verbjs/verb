# Server Creation

This guide covers how to create and configure different types of servers in Verb.

## Basic Server Creation

### Default HTTP Server

```typescript
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.listen(3000);
```

### Explicit Protocol Selection

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP server (explicit)
const httpServer = createServer(ServerProtocol.HTTP);

// HTTPS server
const httpsServer = createServer(ServerProtocol.HTTPS);

// HTTP/2 server
const http2Server = createServer(ServerProtocol.HTTP2);

// WebSocket server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
```

## Fluent API

Use the fluent API for more readable server creation:

```typescript
import { server } from "verb";

const httpApp = server.http();
const httpsApp = server.https();
const http2App = server.http2();
const wsApp = server.websocket();
const grpcApp = server.grpc();
const udpApp = server.udp();
const tcpApp = server.tcp();
```

## HTTP/HTTPS Servers

### HTTP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP);

// Basic routes
app.get("/", (req, res) => {
  res.json({ protocol: "HTTP" });
});

app.post("/users", (req, res) => {
  const user = req.body;
  res.status(201).json({ id: 1, ...user });
});

// Middleware support
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.listen(3000);
```

### HTTPS Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTPS);

// Configure TLS options
app.withOptions({
  // TLS configuration would go here
  // (depends on Bun's TLS implementation)
});

app.get("/secure", (req, res) => {
  res.json({ 
    protocol: "HTTPS",
    secure: req.secure 
  });
});

app.listen(443);
```

## HTTP/2 Servers

### HTTP/2 Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP2);

app.get("/", (req, res) => {
  res.json({ 
    protocol: "HTTP/2",
    multiplexed: true 
  });
});

// HTTP/2 supports server push (when available)
app.get("/push-example", (req, res) => {
  // Server push logic would go here
  res.json({ message: "HTTP/2 with push" });
});

app.listen(3000);
```

### HTTP/2 Secure (HTTP2S)

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP2S);

app.get("/", (req, res) => {
  res.json({ 
    protocol: "HTTP/2 Secure",
    secure: true 
  });
});

app.listen(443);
```

## WebSocket Servers

### Basic WebSocket Server

```typescript
import { createServer, ServerProtocol } from "verb";

const wsServer = createServer(ServerProtocol.WEBSOCKET);

// HTTP routes still work
wsServer.get("/", (req, res) => {
  res.json({ protocol: "WebSocket HTTP" });
});

// WebSocket configuration
wsServer.websocket({
  open: (ws) => {
    console.log("WebSocket connection opened");
    ws.send("Welcome to WebSocket server!");
  },
  
  message: (ws, message) => {
    console.log("Received:", message);
    ws.send(`Echo: ${message}`);
  },
  
  close: (ws, code, reason) => {
    console.log("WebSocket closed:", code, reason);
  }
});

wsServer.listen(3001);
```

### WebSocket Secure (WSS)

```typescript
import { createServer, ServerProtocol } from "verb";

const wssServer = createServer(ServerProtocol.WEBSOCKETS);

wssServer.websocket({
  open: (ws) => {
    ws.send("Secure WebSocket connection established");
  },
  
  message: (ws, message) => {
    // Handle secure messages
    ws.send(`Secure echo: ${message}`);
  }
});

wssServer.listen(443);
```

## gRPC Servers

### Basic gRPC Server

```typescript
import { createServer, ServerProtocol } from "verb";

const grpcServer = createServer(ServerProtocol.GRPC);

// Add a service
grpcServer.addService({
  name: "UserService",
  methods: {
    GetUser: {
      requestType: "GetUserRequest",
      responseType: "GetUserResponse",
      handler: async (request) => {
        return {
          id: request.id,
          name: "John Doe",
          email: "john@example.com"
        };
      }
    },
    
    CreateUser: {
      requestType: "CreateUserRequest", 
      responseType: "CreateUserResponse",
      handler: async (request) => {
        const user = {
          id: Date.now().toString(),
          ...request
        };
        return user;
      }
    }
  }
});

// Or add methods individually
grpcServer.addMethod("UserService", {
  name: "DeleteUser",
  handler: async (request) => {
    return { success: true };
  }
});

grpcServer.listen(50051);
```

### gRPC Secure (gRPCS)

```typescript
import { createServer, ServerProtocol } from "verb";

const grpcsServer = createServer(ServerProtocol.GRPCS);

grpcsServer.addService({
  name: "SecureService",
  methods: {
    SecureMethod: {
      handler: async (request) => {
        return { secure: true, data: request };
      }
    }
  }
});

grpcsServer.listen(50052);
```

## UDP Servers

### Basic UDP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const udpServer = createServer(ServerProtocol.UDP);

// Handle incoming messages
udpServer.onMessage((message) => {
  console.log("UDP message:", message.data.toString());
  console.log("From:", message.address, message.port);
  
  // Echo back
  udpServer.send(
    `Echo: ${message.data}`,
    message.port,
    message.address
  );
});

// Handle errors
udpServer.onError((error) => {
  console.error("UDP error:", error);
});

udpServer.listen(3002);
```

### DTLS Server (Secure UDP)

```typescript
import { createServer, ServerProtocol } from "verb";

const dtlsServer = createServer(ServerProtocol.DTLS);

dtlsServer.onMessage((message) => {
  console.log("Secure UDP message:", message.data.toString());
  
  // Handle secure UDP messages
  dtlsServer.send(
    `Secure echo: ${message.data}`,
    message.port,
    message.address
  );
});

dtlsServer.listen(3003);
```

## TCP Servers

### Basic TCP Server

```typescript
import { createServer, ServerProtocol } from "verb";

const tcpServer = createServer(ServerProtocol.TCP);

// Handle new connections
tcpServer.onConnection((connection) => {
  console.log("New TCP connection");
  
  connection.write("Welcome to TCP server!\\n");
  
  // Handle data from this connection
  connection.onData((data) => {
    console.log("Received:", data.toString());
    connection.write(`Echo: ${data}`);
  });
  
  // Handle connection close
  connection.onClose(() => {
    console.log("TCP connection closed");
  });
  
  // Handle connection errors
  connection.onError((error) => {
    console.error("TCP connection error:", error);
  });
});

tcpServer.listen(3004);
```

### TLS Server (Secure TCP)

```typescript
import { createServer, ServerProtocol } from "verb";

const tlsServer = createServer(ServerProtocol.TLS);

tlsServer.onConnection((connection) => {
  console.log("New TLS connection");
  
  connection.write("Secure TCP connection established\\n");
  
  connection.onData((data) => {
    console.log("Secure data:", data.toString());
    connection.write(`Secure echo: ${data}`);
  });
});

tlsServer.listen(3005);
```

## Unified Server

Create a server that can handle multiple protocols:

```typescript
import { createUnifiedServer } from "verb";

const server = createUnifiedServer();

// The server adapts based on the protocol used
server.get("/", (req, res) => {
  res.json({ 
    message: "Universal route",
    protocol: req.protocol 
  });
});

server.listen(3000);
```

## Server Configuration

### Listen Options

```typescript
const app = createServer();

// Configure before listening
app.withOptions({
  port: 3000,
  hostname: "localhost",
  showRoutes: true,
  development: {
    hmr: true,
    console: true
  }
});

app.listen();
```

### Advanced Configuration

```typescript
const app = createServer();

// Application settings
app.set("trust proxy", true);
app.set("view cache", false);

// Application locals
app.locals.appName = "My Server";
app.locals.version = "1.0.0";

// Server options
app.withOptions({
  port: process.env.PORT || 3000,
  hostname: process.env.HOST || "0.0.0.0",
  showRoutes: process.env.NODE_ENV === "development"
});

app.listen();
```

## Multiple Server Instances

Run multiple servers simultaneously:

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP server
const httpServer = createServer(ServerProtocol.HTTP);
httpServer.get("/", (req, res) => {
  res.json({ protocol: "HTTP" });
});
httpServer.listen(3000);

// WebSocket server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.websocket({
  open: (ws) => ws.send("WebSocket ready")
});
wsServer.listen(3001);

// gRPC server
const grpcServer = createServer(ServerProtocol.GRPC);
grpcServer.addMethod("TestService", {
  name: "Test",
  handler: async () => ({ success: true })
});
grpcServer.listen(50051);

console.log("HTTP server: http://localhost:3000");
console.log("WebSocket server: ws://localhost:3001");
console.log("gRPC server: localhost:50051");
```

## Server Lifecycle

### Startup

```typescript
const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Configure and start
app.withOptions({ port: 3000 });
const server = app.listen();

console.log("Server started on port 3000");
```

### Graceful Shutdown

```typescript
const app = createServer();
const server = app.listen(3000);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  server.stop();
  process.exit(0);
});
```

## Error Handling

### Server-Level Error Handling

```typescript
const app = createServer();

// Global error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal Server Error" });
});

// Catch server startup errors
try {
  const server = app.listen(3000);
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}
```

## Best Practices

1. **Protocol Selection**: Choose the right protocol for your use case
2. **Error Handling**: Always implement proper error handling
3. **Configuration**: Use environment variables for configuration
4. **Security**: Use secure protocols (HTTPS, WSS, gRPCS, TLS) in production
5. **Monitoring**: Implement health checks and monitoring
6. **Graceful Shutdown**: Handle shutdown signals properly

## Next Steps

- [Routing](/guide/routing) - Learn about routing in different protocols
- [Middleware](/guide/middleware) - Understand middleware for different server types
- [Protocol Gateway](/guide/protocol-gateway) - Runtime protocol switching
- [Examples](/examples/) - See real-world server implementations
# Verb

A fast, modern server framework for Bun with multi-protocol support. Build HTTP, HTTP/2, WebSocket, gRPC, UDP, and TCP servers with the same intuitive API.

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

## Features

- **Multi-Protocol Support** - HTTP, HTTP/2, WebSocket, gRPC, UDP, TCP
- **Unified API** - Same interface across all protocols
- **Runtime Protocol Switching** - Switch between protocols dynamically
- **Built for Bun** - Native Bun APIs for maximum performance
- **TypeScript First** - Full type safety out of the box

## Basic Usage

### HTTP Server

```typescript
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
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
import { ProtocolGateway, ServerProtocol } from "verb";

const gateway = new ProtocolGateway();

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

// Start server
app.listen(port, hostname?)
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

## Development

```bash
# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
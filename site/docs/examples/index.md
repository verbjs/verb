# Examples

Welcome to the Verb examples section! Here you'll find practical, real-world examples demonstrating Verb's capabilities across different protocols and use cases.

## Getting Started Examples

Perfect for beginners to understand the basics.

### [Basic HTTP Server](/examples/basic-http)
A simple HTTP server with routing, middleware, and basic error handling.

```typescript
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello Verb!" });
});

app.listen(3000);
```

### REST API (Coming Soon)
Complete RESTful API with CRUD operations, validation, and error handling. For now, see the [Basic HTTP Server](/examples/basic-http) example which includes REST patterns.

```typescript
// Full CRUD operations for users resource
app.get("/api/users", getAllUsers);
app.get("/api/users/:id", getUser);
app.post("/api/users", createUser);
app.put("/api/users/:id", updateUser);
app.delete("/api/users/:id", deleteUser);
```

## Fullstack Applications

Build complete applications with frontend and backend.

### [Fullstack Application](/examples/fullstack)
Complete fullstack app using Bun's native routing with HTML imports, React, and automatic bundling.

```typescript
import { createServer } from "verb";
import homepage from "./index.html";

const app = createServer();

app.withRoutes({
  "/": homepage,
  "/api/users": {
    GET: () => Response.json(await getUsers())
  }
});
```

## Real-time Communication

Examples showcasing WebSocket capabilities.

### WebSocket Chat (Coming Soon)
Real-time chat application with rooms, user management, and message broadcasting. For now, see the [WebSocket Protocol Guide](/guide/protocols/websocket).

```typescript
const wsServer = createServer(ServerProtocol.WEBSOCKET);

wsServer.websocket({
  open: (ws) => {
    connections.add(ws);
    broadcastUserCount();
  },
  message: (ws, message) => {
    broadcastMessage(JSON.parse(message));
  }
});
```

### Real-time API (Coming Soon)
Live data feeds with WebSocket subscriptions and real-time updates. For now, see the [WebSocket Protocol Guide](/guide/protocols/websocket).

```typescript
// Subscribe to live data feeds
app.websocket({
  message: (ws, message) => {
    const { type, topic } = JSON.parse(message);
    if (type === "subscribe") {
      subscribeToTopic(ws, topic);
    }
  }
});
```

## Microservices

High-performance service communication.

### gRPC Service (Coming Soon)
Complete gRPC service with multiple methods, streaming, and error handling. For now, see the [gRPC Protocol Guide](/guide/protocols/grpc).

```typescript
const grpcServer = createServer(ServerProtocol.GRPC);

grpcServer.addService({
  name: "UserService",
  methods: {
    GetUser: { handler: getUserById },
    CreateUser: { handler: createUser },
    StreamUsers: { handler: streamUsers }
  }
});
```

## File Operations

Handle file uploads and downloads.

### File Upload
Secure file upload with validation, streaming, and progress tracking. See the [File Uploads Guide](/guide/file-uploads) for complete implementation.

```typescript
app.post("/upload", async (req, res) => {
  const { files } = await req.formData();
  const file = files.file;
  
  // Validate and save file
  await saveFile(file);
  res.json({ success: true });
});
```

## Authentication & Security

Implement secure authentication patterns.

### Authentication
Complete authentication system with JWT tokens, middleware, and protected routes. See the [Security Guide](/guide/security) for complete implementation.

```typescript
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization;
  const user = await verifyToken(token);
  req.user = user;
  next();
};

app.use("/api/protected", authenticate);
```

## By Protocol

### HTTP/HTTPS Examples

- **[Basic HTTP Server](/examples/basic-http)** - Simple HTTP server setup
- **[File Upload Guide](/guide/file-uploads)** - File handling with HTTP
- **[Security Guide](/guide/security)** - Authentication with HTTP

### WebSocket Examples

- **[WebSocket Protocol Guide](/guide/protocols/websocket)** - Real-time communication
- **[Fullstack Application](/examples/fullstack)** - WebSocket integration
- **WebSocket Authentication** - See [Security Guide](/guide/security)
- **WebSocket Rooms** - Multi-room chat patterns

### gRPC Examples

- **[gRPC Protocol Guide](/guide/protocols/grpc)** - Complete gRPC implementation
- **gRPC Streaming** - Server and client streaming
- **gRPC Authentication** - Secure gRPC with auth
- **gRPC Load Balancing** - Multi-service setup

### UDP/TCP Examples

- **UDP Message Server** - Connectionless messaging
- **TCP Connection Server** - Persistent connections
- **Protocol Conversion** - UDP to TCP bridging
- **Network Monitoring** - Traffic analysis tools

## By Use Case

### Web Applications
- [Basic HTTP Server](/examples/basic-http)
- [Fullstack Application](/examples/fullstack)
- [File Upload Guide](/guide/file-uploads)
- [Security Guide](/guide/security)

### Real-time Applications
- [WebSocket Protocol Guide](/guide/protocols/websocket)
- [Fullstack Application](/examples/fullstack) - includes WebSocket
- Live Gaming Server (Coming Soon)
- Collaborative Editor (Coming Soon)

### Microservices
- [gRPC Protocol Guide](/guide/protocols/grpc)
- Service Discovery
- API Gateway
- Message Queue

### IoT & Networking
- MQTT Broker
- Device Communication
- Sensor Data Collection
- Network Proxy

## Advanced Examples

### Performance Optimization
- Connection Pooling
- Caching Strategies
- Load Testing
- Memory Management

### Testing
- Unit Testing
- Integration Testing
- Load Testing
- Mock Services

### Deployment
- Docker Containers
- Kubernetes
- Cloud Deployment
- CI/CD Pipelines

### Monitoring
- Health Checks
- Metrics Collection
- Logging
- Error Tracking

## Code Organization

### Project Structure
```
my-verb-app/
├── src/
│   ├── server.ts          # Main server
│   ├── routes/            # Route handlers
│   ├── middleware/        # Custom middleware
│   ├── services/          # Business logic
│   └── types/             # TypeScript types
├── tests/                 # Test files
├── docs/                  # Documentation
└── examples/              # Example implementations
```

### Best Practices
- **Modular Design**: Separate concerns into modules
- **Type Safety**: Use TypeScript for better development
- **Error Handling**: Implement comprehensive error handling
- **Testing**: Write tests for all functionality
- **Documentation**: Document your APIs

## Getting Help

### Community Examples
- Browse the [GitHub repository](https://github.com/wess/verb/tree/main/examples)
- Check out community contributions
- Share your own examples

### Support
- [GitHub Issues](https://github.com/wess/verb/issues) - Report bugs or request features
- [Discussions](https://github.com/wess/verb/discussions) - Ask questions and share ideas
- [Documentation](/guide/) - Comprehensive guides

## Contributing Examples

We welcome community contributions! To add your example:

1. Fork the repository
2. Create your example in the `examples/` directory
3. Add documentation
4. Submit a pull request

### Example Guidelines
- **Clear Documentation**: Explain what the example demonstrates
- **Complete Code**: Provide working, runnable examples
- **Best Practices**: Follow Verb best practices
- **TypeScript**: Use TypeScript when possible

## Quick Start Templates

### HTTP API Template
```typescript
import { createServer, middleware } from "verb";

const app = createServer();

app.use(middleware.json());
app.use(middleware.cors());

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.listen(3000);
```

### WebSocket Server Template
```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

app.websocket({
  open: (ws) => console.log("Client connected"),
  message: (ws, msg) => ws.send(`Echo: ${msg}`),
  close: (ws) => console.log("Client disconnected")
});

app.listen(3001);
```

### gRPC Service Template
```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.GRPC);

app.addService({
  name: "ExampleService",
  methods: {
    SayHello: {
      handler: async (req) => ({ message: `Hello ${req.name}!` })
    }
  }
});

app.listen(50051);
```

## Next Steps

1. **Choose an Example**: Start with a basic example that matches your use case
2. **Run the Code**: Copy and run the example locally
3. **Modify and Experiment**: Adapt the example to your needs
4. **Read the Guides**: Dive deeper with our [comprehensive guides](/guide/)
5. **Build Your App**: Create your own application using Verb

Ready to start building? Pick an example and let's get started!
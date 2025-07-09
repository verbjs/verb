# What is Verb?

Verb is a fast, modern server framework for Bun that enables you to build servers using multiple protocols with the same intuitive API. Whether you need HTTP, WebSocket, gRPC, UDP, or TCP - Verb provides a unified interface that makes protocol switching seamless.

## Key Features

### 🔄 Multi-Protocol Support
Build servers using 12 different protocols:
- **HTTP/HTTPS** - Standard web servers with TLS support
- **HTTP/2/HTTP2S** - Modern HTTP with multiplexing and server push
- **WebSocket/WSS** - Real-time bidirectional communication
- **gRPC/gRPCS** - High-performance RPC framework
- **UDP/DTLS** - Fast connectionless networking
- **TCP/TLS** - Reliable connection-oriented networking

### ⚡ Built for Bun
- Native Bun APIs for maximum performance
- Modern JavaScript runtime features
- Built-in TypeScript support
- Optimized for speed and memory efficiency

### 🛠️ Unified API
```typescript
// Same API across all protocols
const httpServer = createServer(ServerProtocol.HTTP);
const wsServer = createServer(ServerProtocol.WEBSOCKET);
const grpcServer = createServer(ServerProtocol.GRPC);

// All support the same core methods
httpServer.listen(3000);
wsServer.listen(3001);
grpcServer.listen(3002);
```

### 🔐 Security First
- Built-in TLS/SSL support for all protocols
- Secure variants available (HTTPS, WSS, HTTP2S, etc.)
- Certificate management and validation
- Modern encryption standards

## Core Concepts

### Protocol Gateway
The Protocol Gateway allows you to switch between protocols at runtime while maintaining the same route definitions:

```typescript
import { createProtocolGateway, ServerProtocol } from "verb";

const gateway = createProtocolGateway();

// Define routes once
gateway.defineRoutes((app) => {
  app.get("/api/users", (req, res) => {
    res.json({ users: [] });
  });
});

// Switch protocols dynamically
gateway.switchProtocol(ServerProtocol.HTTP);
gateway.listen(3000);

gateway.switchProtocol(ServerProtocol.HTTP2);
gateway.listen(3001);
```

### Functional Architecture
Verb follows functional programming principles:
- No OOP classes - pure functions and composable interfaces
- Immutable state management
- Functional middleware pipeline
- Easy to test and reason about

## Why Choose Verb?

### Performance
- **Native Bun Integration**: Built specifically for Bun's runtime
- **Zero-Copy Operations**: Efficient memory usage
- **Protocol Optimization**: Each protocol is optimized for its use case

### Developer Experience
- **Intuitive API**: Same patterns across all protocols
- **TypeScript First**: Full type safety and IntelliSense
- **Comprehensive Documentation**: Clear guides and examples
- **Rich Ecosystem**: Middleware, plugins, and extensions

### Production Ready
- **Error Handling**: Comprehensive error management
- **Middleware Support**: Extensible middleware system
- **Performance Monitoring**: Built-in metrics and debugging
- **Testing Tools**: Easy to test with mocking support

## Getting Started

Ready to build your first Verb server? Check out our [Getting Started Guide](/guide/getting-started) or explore specific [protocol implementations](/guide/protocols/http).

## Community

- **GitHub**: [https://github.com/verbjs/verb](https://github.com/verbjs/verb)
- **Issues**: Report bugs and request features
- **Discussions**: Join the community discussions

## License

Verb is open source and available under the [MIT License](https://github.com/verbjs/verb/blob/main/LICENSE).
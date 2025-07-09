---
layout: home

hero:
  name: "Verb"
  text: "Multi-Protocol Server Framework"
  tagline: "Build HTTP, HTTP/2, WebSocket, gRPC, UDP, and TCP servers with the same intuitive API"
  image:
    src: /verb.png
    alt: Verb
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/verbjs/verb

features:
  - icon: ⚡
    title: Built for Bun
    details: Native Bun APIs for maximum performance and modern JavaScript runtime features
  - icon: 🔄
    title: Multi-Protocol Support
    details: HTTP, HTTPS, HTTP/2, WebSocket, gRPC, UDP, TCP - all with the same unified API
  - icon: 🛠️
    title: Runtime Protocol Switching
    details: Switch between protocols dynamically with the Protocol Gateway pattern
  - icon: 📦
    title: TypeScript First
    details: Full type safety out of the box with comprehensive TypeScript definitions
  - icon: 🔐
    title: Secure by Default
    details: Built-in TLS/SSL support for HTTPS, WSS, HTTP/2 Secure, and encrypted TCP/UDP
  - icon: 🚀
    title: Developer Experience
    details: Intuitive API design with middleware support and comprehensive error handling
---

## Quick Start

```bash
# Install Verb
bun install verb

# Create your first server
echo 'import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.listen(3000);' > server.ts

# Run your server
bun server.ts
```

## Multi-Protocol in Action

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP Server
const httpServer = createServer(ServerProtocol.HTTP);
httpServer.get("/", (req, res) => res.json({ protocol: "http" }));

// WebSocket Server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.websocket({
  open: (ws) => ws.send("Connected!"),
  message: (ws, message) => ws.send(`Echo: ${message}`)
});

// gRPC Server
const grpcServer = createServer(ServerProtocol.GRPC);
grpcServer.addMethod("UserService", {
  name: "GetUser",
  handler: async (request) => ({ id: request.id, name: "John" })
});

// All servers use the same unified API!
```

## Protocol Gateway

Switch between protocols at runtime:

```typescript
import { createProtocolGateway, ServerProtocol } from "verb";

const gateway = createProtocolGateway();

// Define routes that work across HTTP-based protocols
gateway.defineRoutes((app) => {
  app.get("/status", (req, res) => {
    res.json({ 
      protocol: gateway.getCurrentProtocol(),
      timestamp: new Date().toISOString()
    });
  });
});

// Start with HTTP
gateway.listen(3000);

// Switch to HTTP/2 at runtime
gateway.switchProtocol(ServerProtocol.HTTP2);
gateway.listen(3001);
```

## Why Verb?

- **🔄 One API, Multiple Protocols**: Write once, run on any protocol
- **⚡ Built for Bun**: Native performance with modern JavaScript features
- **🛠️ Developer Friendly**: Intuitive API with comprehensive TypeScript support
- **🔐 Secure**: Built-in TLS/SSL support for all protocols
- **🚀 Production Ready**: Comprehensive error handling and middleware support

<div class="vp-doc" style="margin-top: 2rem; padding: 1rem; background: var(--vp-c-bg-soft); border-radius: 8px;">

**Ready to build your next server?** [Get started with Verb →](/guide/getting-started)

</div>
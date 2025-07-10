# HTTP/2

Verb supports HTTP/2 for enhanced performance with features like multiplexing, server push, and header compression.

## Overview

HTTP/2 provides significant performance improvements over HTTP/1.1:
- **Multiplexing**: Multiple requests on a single connection
- **Server Push**: Push resources before they're requested
- **Header Compression**: Reduced overhead with HPACK
- **Binary Protocol**: More efficient than text-based HTTP/1.1

## Creating an HTTP/2 Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP2);

app.get("/", (req, res) => {
  res.json({ message: "HTTP/2 Server!" });
});

app.listen(3000);
```

## HTTPS with HTTP/2

HTTP/2 typically requires HTTPS in browsers:

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP2);

app.withOptions({
  port: 3000,
  tls: {
    cert: await Bun.file("cert.pem").text(),
    key: await Bun.file("key.pem").text()
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Secure HTTP/2!" });
});

app.listen();
```

## Server Push

Push resources to clients before they request them:

```typescript
app.get("/", (req, res) => {
  // Push CSS and JS resources
  res.push("/styles.css", {
    method: "GET",
    headers: { "content-type": "text/css" }
  });
  
  res.push("/app.js", {
    method: "GET", 
    headers: { "content-type": "application/javascript" }
  });
  
  res.html(`
    <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <h1>HTTP/2 with Server Push</h1>
        <script src="/app.js"></script>
      </body>
    </html>
  `);
});
```

## Stream Management

HTTP/2 uses streams for concurrent requests:

```typescript
app.use((req, res, next) => {
  console.log(`Stream ID: ${req.stream.id}`);
  console.log(`Priority: ${req.stream.priority}`);
  next();
});

app.get("/api/data", (req, res) => {
  // Set stream priority
  res.setStreamPriority(5);
  res.json({ data: "high priority response" });
});
```

## Performance Benefits

HTTP/2 provides significant performance improvements:

```typescript
// Multiple API calls are multiplexed
app.get("/api/multiple", async (req, res) => {
  // These would be concurrent in HTTP/2
  const [users, posts, comments] = await Promise.all([
    fetch("/api/users"),
    fetch("/api/posts"), 
    fetch("/api/comments")
  ]);
  
  res.json({ users, posts, comments });
});
```

## Best Practices

1. **Use HTTPS**: HTTP/2 requires HTTPS for browser support
2. **Optimize Headers**: Take advantage of header compression
3. **Server Push Carefully**: Only push critical resources
4. **Monitor Performance**: Track HTTP/2 specific metrics

## Configuration

```typescript
app.withOptions({
  port: 3000,
  protocol: ServerProtocol.HTTP2,
  http2: {
    allowHTTP1: true,
    maxSessionMemory: 10,
    settings: {
      headerTableSize: 4096,
      enablePush: true,
      maxConcurrentStreams: 100,
      initialWindowSize: 65535
    }
  }
});
```

## Next Steps

- [WebSocket](/guide/protocols/websocket) - Real-time communication
- [gRPC](/guide/protocols/grpc) - High-performance RPC
- [Performance](/guide/performance) - Optimization techniques
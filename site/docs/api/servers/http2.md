# HTTP/2 Server

API reference for creating HTTP/2 servers with multiplexing, server push, and advanced stream management features.

## Creating HTTP/2 Server

### Basic HTTP/2 Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTP2);

app.withOptions({
  port: 443,
  tls: {
    cert: await Bun.file("./certs/server.crt").text(),
    key: await Bun.file("./certs/server.key").text()
  },
  http2: {
    allowHTTP1: true // Fallback to HTTP/1.1 for compatibility
  }
});

app.get("/", (req, res) => {
  res.json({ 
    message: "HTTP/2 server running!",
    protocol: req.httpVersion // "2.0"
  });
});

app.listen(443);
console.log("HTTP/2 server running on https://localhost:443");
```

### HTTP/2 with HTTP/1.1 Fallback

```typescript
const app = createServer(ServerProtocol.HTTP2);

app.withOptions({
  port: 443,
  tls: { cert, key },
  http2: {
    allowHTTP1: true,
    
    // HTTP/2 specific settings
    settings: {
      headerTableSize: 4096,
      enablePush: true,
      maxConcurrentStreams: 100,
      initialWindowSize: 65535,
      maxFrameSize: 16384,
      maxHeaderListSize: 8192
    }
  }
});

app.get("/protocol-info", (req, res) => {
  res.json({
    protocol: req.httpVersion,
    isHTTP2: req.httpVersion === "2.0",
    stream: req.stream ? {
      id: req.stream.id,
      state: req.stream.state,
      pending: req.stream.pending
    } : null
  });
});
```

## HTTP/2 Configuration

### Advanced Settings

```typescript
app.withOptions({
  port: 443,
  tls: { cert, key },
  http2: {
    allowHTTP1: true,
    
    // Connection settings
    maxSessionMemory: 10, // MB
    maxDeflateDynamicTableSize: 4096,
    maxSettings: 32,
    maxHeaderListPairs: 128,
    maxOutstandingPings: 10,
    maxSendHeaderBlockLength: 8192,
    
    // Performance settings
    paddingStrategy: 0, // No padding
    peerMaxConcurrentStreams: 100,
    
    // Custom settings
    settings: {
      headerTableSize: 4096,
      enablePush: true,
      maxConcurrentStreams: 100,
      initialWindowSize: 65535,
      maxFrameSize: 16384,
      maxHeaderListSize: 8192
    },
    
    // Session management
    sessionTimeout: 300000, // 5 minutes
    
    // Debugging
    debug: process.env.NODE_ENV === "development"
  }
});
```

### Server Push Configuration

```typescript
app.withOptions({
  http2: {
    enablePush: true,
    pushStreams: {
      maxConcurrent: 10,
      timeout: 30000
    }
  }
});
```

## Server Push

### Basic Server Push

```typescript
app.get("/", (req, res) => {
  // Check if client supports push
  if (res.push) {
    // Push CSS file
    const pushCSS = res.push("/styles/main.css", {
      method: "GET",
      headers: {
        "content-type": "text/css"
      }
    });
    
    pushCSS.end(`
      body { font-family: Arial, sans-serif; }
      .container { max-width: 1200px; margin: 0 auto; }
    `);
    
    // Push JavaScript file
    const pushJS = res.push("/scripts/app.js", {
      method: "GET", 
      headers: {
        "content-type": "application/javascript"
      }
    });
    
    pushJS.end(`
      console.log("Pushed JavaScript loaded");
      document.addEventListener("DOMContentLoaded", () => {
        console.log("DOM ready");
      });
    `);
  }
  
  // Send main HTML response
  res.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>HTTP/2 Server Push</title>
        <link rel="stylesheet" href="/styles/main.css">
      </head>
      <body>
        <div class="container">
          <h1>HTTP/2 Server Push Demo</h1>
          <p>CSS and JS were pushed by the server!</p>
        </div>
        <script src="/scripts/app.js"></script>
      </body>
    </html>
  `);
});
```

### Smart Server Push

```typescript
import { ServerPushCache } from "verb/http2";

const pushCache = new ServerPushCache();

app.get("/page/:id", async (req, res) => {
  const pageId = req.params.id;
  const userAgent = req.get("user-agent");
  
  // Check what resources to push based on page and client
  const pushResources = await pushCache.getResourcesForPage(pageId, userAgent);
  
  // Only push if client supports it and hasn't cached resources
  if (res.push && pushResources.length > 0) {
    for (const resource of pushResources) {
      if (!req.get(`if-none-match-${resource.path}`)) {
        const pushStream = res.push(resource.path, {
          method: "GET",
          headers: resource.headers
        });
        
        pushStream.on("error", (err) => {
          console.log("Push stream error:", err.message);
        });
        
        await resource.content.pipeTo(pushStream);
      }
    }
  }
  
  // Send main response
  const pageContent = await getPageContent(pageId);
  res.html(pageContent);
});
```

### Conditional Push

```typescript
app.get("/app", (req, res) => {
  const acceptPush = req.get("accept-push-policy");
  const isFirstVisit = !req.get("cookie")?.includes("visited=true");
  
  if (res.push && acceptPush !== "none" && isFirstVisit) {
    // Push critical resources for first-time visitors
    const criticalResources = [
      { path: "/css/critical.css", type: "text/css" },
      { path: "/js/framework.js", type: "application/javascript" },
      { path: "/images/logo.png", type: "image/png" }
    ];
    
    criticalResources.forEach(resource => {
      const pushStream = res.push(resource.path, {
        headers: { "content-type": resource.type }
      });
      
      // Stream file content
      Bun.file(`./public${resource.path}`)
        .stream()
        .pipeTo(pushStream);
    });
  }
  
  res.cookie("visited", "true", { maxAge: 86400000 }); // 24 hours
  res.sendFile("./public/app.html");
});
```

## Stream Management

### Stream Events

```typescript
app.use((req, res, next) => {
  if (req.stream) {
    // Monitor stream events
    req.stream.on("close", () => {
      console.log(`Stream ${req.stream.id} closed`);
    });
    
    req.stream.on("error", (error) => {
      console.error(`Stream ${req.stream.id} error:`, error);
    });
    
    req.stream.on("timeout", () => {
      console.log(`Stream ${req.stream.id} timed out`);
    });
    
    req.stream.on("frameError", (type, code, id) => {
      console.error(`Frame error on stream ${id}: ${type} (${code})`);
    });
  }
  
  next();
});
```

### Stream Priority

```typescript
app.get("/high-priority", (req, res) => {
  if (req.stream) {
    // Set high priority for critical resources
    req.stream.priority({
      exclusive: false,
      parent: 0,
      weight: 256 // Maximum weight
    });
  }
  
  res.json({ priority: "high" });
});

app.get("/low-priority", (req, res) => {
  if (req.stream) {
    // Set low priority for less critical resources
    req.stream.priority({
      exclusive: false,
      parent: 0,
      weight: 1 // Minimum weight
    });
  }
  
  res.json({ priority: "low" });
});
```

### Flow Control

```typescript
app.get("/large-data", (req, res) => {
  const largeData = generateLargeDataset();
  
  if (req.stream) {
    // Monitor flow control
    req.stream.on("drain", () => {
      console.log("Stream buffer drained, can send more data");
    });
    
    // Check if stream is writable
    if (req.stream.writable) {
      res.json(largeData);
    } else {
      res.status(503).json({ error: "Stream not writable" });
    }
  } else {
    res.json(largeData);
  }
});
```

## Multiplexing

### Concurrent Stream Handling

```typescript
const activeStreams = new Map();

app.use((req, res, next) => {
  if (req.stream) {
    const streamId = req.stream.id;
    
    // Track active streams
    activeStreams.set(streamId, {
      url: req.url,
      method: req.method,
      startTime: Date.now()
    });
    
    req.stream.on("close", () => {
      const streamInfo = activeStreams.get(streamId);
      if (streamInfo) {
        const duration = Date.now() - streamInfo.startTime;
        console.log(`Stream ${streamId} completed in ${duration}ms`);
        activeStreams.delete(streamId);
      }
    });
  }
  
  next();
});

// Monitor concurrent streams
app.get("/stats", (req, res) => {
  res.json({
    activeStreams: activeStreams.size,
    maxConcurrentStreams: app.settings.http2?.maxConcurrentStreams || 100,
    streams: Array.from(activeStreams.entries()).map(([id, info]) => ({
      id,
      ...info,
      duration: Date.now() - info.startTime
    }))
  });
});
```

### Stream Pooling

```typescript
class StreamPool {
  private pools = new Map();
  
  getPool(connection) {
    if (!this.pools.has(connection)) {
      this.pools.set(connection, {
        available: [],
        active: new Set(),
        maxStreams: 100
      });
    }
    return this.pools.get(connection);
  }
  
  acquireStream(connection, callback) {
    const pool = this.getPool(connection);
    
    if (pool.available.length > 0) {
      const stream = pool.available.pop();
      pool.active.add(stream);
      callback(null, stream);
    } else if (pool.active.size < pool.maxStreams) {
      // Create new stream
      const stream = connection.createStream();
      pool.active.add(stream);
      callback(null, stream);
    } else {
      callback(new Error("Max streams exceeded"));
    }
  }
  
  releaseStream(connection, stream) {
    const pool = this.getPool(connection);
    pool.active.delete(stream);
    
    if (stream.readable && stream.writable) {
      pool.available.push(stream);
    }
  }
}

const streamPool = new StreamPool();
```

## Performance Optimization

### Header Compression (HPACK)

```typescript
app.withOptions({
  http2: {
    settings: {
      headerTableSize: 8192, // Larger table for better compression
      enablePush: true
    }
  }
});

// Optimize headers for compression
app.use((req, res, next) => {
  // Use consistent header names and values
  res.header("Server", "Verb/1.0");
  res.header("Cache-Control", "public, max-age=3600");
  
  next();
});
```

### Stream Coalescing

```typescript
app.get("/api/batch", async (req, res) => {
  const requests = req.body.requests || [];
  const results = [];
  
  // Process multiple requests in parallel using stream multiplexing
  const promises = requests.map(async (request) => {
    try {
      const result = await processApiRequest(request);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  const batchResults = await Promise.all(promises);
  
  res.json({
    results: batchResults,
    total: requests.length,
    successful: batchResults.filter(r => r.success).length
  });
});
```

### Connection Reuse

```typescript
app.withOptions({
  http2: {
    settings: {
      maxConcurrentStreams: 100 // Allow many concurrent streams
    },
    sessionTimeout: 300000, // Keep connections alive longer
    
    // Optimize for connection reuse
    allowHTTP1: true, // Gradual HTTP/2 adoption
    maxSessionMemory: 50 // MB per connection
  }
});
```

## WebSocket Over HTTP/2

### WebSocket Upgrade

```typescript
app.get("/ws", (req, res) => {
  if (req.headers.upgrade === "websocket") {
    // Handle WebSocket upgrade over HTTP/2
    const websocket = res.upgrade();
    
    websocket.on("message", (data) => {
      console.log("WebSocket message:", data);
      websocket.send(`Echo: ${data}`);
    });
    
    websocket.on("close", () => {
      console.log("WebSocket connection closed");
    });
  } else {
    res.status(400).json({ error: "WebSocket upgrade required" });
  }
});
```

## Error Handling

### HTTP/2 Specific Errors

```typescript
app.use((err, req, res, next) => {
  if (req.stream) {
    // Handle HTTP/2 stream errors
    if (err.code === "ERR_HTTP2_STREAM_CANCEL") {
      console.log("Stream was cancelled by client");
      return;
    }
    
    if (err.code === "ERR_HTTP2_GOAWAY_SESSION") {
      console.log("HTTP/2 session terminated");
      return;
    }
    
    if (err.code === "ERR_HTTP2_INVALID_STREAM") {
      res.status(400).json({ error: "Invalid stream" });
      return;
    }
  }
  
  next(err);
});

// Session-level error handling
app.on("sessionError", (error, session) => {
  console.error("HTTP/2 session error:", error);
  session.destroy();
});

app.on("streamError", (error, stream) => {
  console.error("HTTP/2 stream error:", error);
  stream.close();
});
```

## Monitoring and Debugging

### HTTP/2 Metrics

```typescript
import { Http2Metrics } from "verb/monitoring";

const metrics = new Http2Metrics();

app.use(metrics.middleware());

app.get("/metrics/http2", (req, res) => {
  res.json({
    connections: metrics.getActiveConnections(),
    streams: metrics.getActiveStreams(),
    pushStreams: metrics.getPushStreamCount(),
    settingsExchanges: metrics.getSettingsExchanges(),
    goAwayCount: metrics.getGoAwayCount(),
    frameErrors: metrics.getFrameErrors()
  });
});
```

### Debug Logging

```typescript
app.withOptions({
  http2: {
    debug: true,
    
    // Custom debug logger
    debugLogger: (level, message, data) => {
      console.log(`[HTTP2:${level}] ${message}`, data);
    }
  }
});

// Stream debugging
app.use((req, res, next) => {
  if (req.stream && process.env.DEBUG_HTTP2) {
    console.log("Stream info:", {
      id: req.stream.id,
      state: req.stream.state,
      priority: req.stream.priority,
      pending: req.stream.pending
    });
  }
  
  next();
});
```

## Testing HTTP/2 Server

```typescript
import { test, expect } from "bun:test";
import { createHttp2Client } from "http2";

test("HTTP/2 server responds correctly", async () => {
  const client = createHttp2Client("https://localhost:443", {
    rejectUnauthorized: false // For testing with self-signed certs
  });
  
  const request = client.request({
    ":method": "GET",
    ":path": "/"
  });
  
  let responseData = "";
  
  request.on("data", (chunk) => {
    responseData += chunk;
  });
  
  await new Promise((resolve) => {
    request.on("end", resolve);
  });
  
  const response = JSON.parse(responseData);
  expect(response.protocol).toBe("2.0");
  
  client.close();
});

test("Server push works correctly", async () => {
  const client = createHttp2Client("https://localhost:443", {
    rejectUnauthorized: false
  });
  
  const pushedResources = [];
  
  client.on("stream", (pushedStream, headers) => {
    pushedResources.push(headers[":path"]);
  });
  
  const request = client.request({
    ":method": "GET",
    ":path": "/push-demo"
  });
  
  await new Promise((resolve) => {
    request.on("end", resolve);
  });
  
  expect(pushedResources).toContain("/styles/main.css");
  expect(pushedResources).toContain("/scripts/app.js");
  
  client.close();
});
```

## Best Practices

1. **Enable HTTP/1.1 Fallback**: Support older clients
2. **Use Server Push Wisely**: Only push critical resources
3. **Optimize Headers**: Leverage HPACK compression
4. **Monitor Streams**: Track active streams and performance
5. **Handle Errors Gracefully**: Implement proper error handling
6. **Connection Reuse**: Optimize for multiplexing
7. **Security**: Use TLS 1.2+ with HTTP/2

## See Also

- [HTTPS Server](/api/servers/https) - HTTPS with TLS configuration
- [WebSocket Server](/api/servers/websocket) - WebSocket over HTTP/2
- [Performance Guide](/guide/performance) - HTTP/2 optimization
- [Monitoring](/guide/monitoring) - Server monitoring and metrics
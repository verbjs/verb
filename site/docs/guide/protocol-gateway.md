# Protocol Gateway

Verb's Protocol Gateway enables seamless communication between different protocols, allowing clients using different protocols to interact with each other.

## Overview

The Protocol Gateway provides:
- **Cross-Protocol Communication**: HTTP clients can talk to WebSocket clients
- **Protocol Translation**: Automatic message format conversion
- **Unified API**: Single interface for multiple protocols
- **Performance Optimization**: Efficient protocol bridging

## Basic Gateway Setup

```typescript
import { createGateway, ServerProtocol } from "verb";

const gateway = createGateway();

// Add multiple protocol servers
const httpServer = gateway.addServer(ServerProtocol.HTTP, { port: 3000 });
const wsServer = gateway.addServer(ServerProtocol.WEBSOCKET, { port: 3001 });
const grpcServer = gateway.addServer(ServerProtocol.GRPC, { port: 50051 });

// Start all servers
gateway.start();
```

## Message Routing

Route messages between protocols:

```typescript
// HTTP to WebSocket bridge
httpServer.post("/api/broadcast", (req, res) => {
  const { message, room } = req.body;
  
  // Send to all WebSocket clients in room
  gateway.broadcast("websocket", {
    type: "message",
    room,
    data: message
  });
  
  res.json({ success: true });
});

// WebSocket to HTTP bridge
wsServer.websocket({
  message: (ws, message) => {
    const data = JSON.parse(message);
    
    if (data.type === "api_request") {
      // Forward to HTTP handlers
      gateway.route("http", {
        method: data.method,
        path: data.path,
        body: data.body,
        callback: (response) => {
          ws.send(JSON.stringify({
            type: "api_response",
            requestId: data.requestId,
            response
          }));
        }
      });
    }
  }
});
```

## Chat Application Example

Complete chat system with multiple protocol support:

```typescript
import { createGateway, ServerProtocol } from "verb";

const gateway = createGateway();
const chatRooms = new Map();
const users = new Map();

// HTTP API Server
const httpServer = gateway.addServer(ServerProtocol.HTTP, { port: 3000 });

httpServer.use(middleware.json());
httpServer.use(middleware.cors());

// Get room messages
httpServer.get("/api/rooms/:room/messages", (req, res) => {
  const { room } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  const messages = chatRooms.get(room)?.messages || [];
  const result = messages.slice(offset, offset + limit);
  
  res.json(result);
});

// Send message via HTTP
httpServer.post("/api/rooms/:room/messages", (req, res) => {
  const { room } = req.params;
  const { message, userId } = req.body;
  
  const messageData = {
    id: Date.now().toString(),
    userId,
    message,
    timestamp: new Date().toISOString(),
    protocol: "http"
  };
  
  // Add to room
  addMessageToRoom(room, messageData);
  
  // Broadcast to all protocols
  gateway.broadcast("all", {
    type: "new_message",
    room,
    message: messageData
  });
  
  res.status(201).json(messageData);
});

// WebSocket Server
const wsServer = gateway.addServer(ServerProtocol.WEBSOCKET, { port: 3001 });

wsServer.websocket({
  open: (ws) => {
    ws.userId = null;
    ws.rooms = new Set();
  },
  
  message: (ws, message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case "join":
        ws.userId = data.userId;
        users.set(data.userId, { ...data, protocol: "websocket", socket: ws });
        
        ws.send(JSON.stringify({
          type: "joined",
          userId: data.userId
        }));
        break;
        
      case "join_room":
        ws.rooms.add(data.room);
        
        // Send recent messages
        const messages = chatRooms.get(data.room)?.messages || [];
        ws.send(JSON.stringify({
          type: "room_history",
          room: data.room,
          messages: messages.slice(-20)
        }));
        break;
        
      case "send_message":
        const messageData = {
          id: Date.now().toString(),
          userId: ws.userId,
          message: data.message,
          timestamp: new Date().toISOString(),
          protocol: "websocket"
        };
        
        addMessageToRoom(data.room, messageData);
        
        // Broadcast to all protocols
        gateway.broadcast("all", {
          type: "new_message",
          room: data.room,
          message: messageData
        });
        break;
    }
  },
  
  close: (ws) => {
    if (ws.userId) {
      users.delete(ws.userId);
    }
  }
});

// gRPC Server
const grpcServer = gateway.addServer(ServerProtocol.GRPC, { port: 50051 });

grpcServer.addService({
  name: "ChatService",
  methods: {
    SendMessage: {
      handler: async (request) => {
        const { room, userId, message } = request;
        
        const messageData = {
          id: Date.now().toString(),
          userId,
          message,
          timestamp: new Date().toISOString(),
          protocol: "grpc"
        };
        
        addMessageToRoom(room, messageData);
        
        // Broadcast to all protocols
        gateway.broadcast("all", {
          type: "new_message",
          room,
          message: messageData
        });
        
        return { success: true, messageId: messageData.id };
      }
    },
    
    GetMessages: {
      handler: async (request) => {
        const { room, limit = 50, offset = 0 } = request;
        const messages = chatRooms.get(room)?.messages || [];
        
        return {
          messages: messages.slice(offset, offset + limit),
          total: messages.length
        };
      }
    },
    
    StreamMessages: {
      handler: async function* (request) {
        const { room } = request;
        
        // Send existing messages
        const messages = chatRooms.get(room)?.messages || [];
        for (const message of messages) {
          yield message;
        }
        
        // Stream new messages
        const subscription = gateway.subscribe("new_message", (data) => {
          if (data.room === room) {
            return data.message;
          }
        });
        
        for await (const message of subscription) {
          yield message;
        }
      }
    }
  }
});

// Helper functions
function addMessageToRoom(room, message) {
  if (!chatRooms.has(room)) {
    chatRooms.set(room, {
      messages: [],
      users: new Set()
    });
  }
  
  const roomData = chatRooms.get(room);
  roomData.messages.push(message);
  
  // Keep only last 1000 messages
  if (roomData.messages.length > 1000) {
    roomData.messages = roomData.messages.slice(-1000);
  }
}

// Configure gateway message handling
gateway.onMessage((protocolType, data) => {
  switch (data.type) {
    case "new_message":
      // Broadcast to WebSocket clients
      if (protocolType !== "websocket") {
        gateway.broadcastToProtocol("websocket", (ws) => {
          if (ws.rooms.has(data.room)) {
            ws.send(JSON.stringify(data));
          }
        });
      }
      
      // Notify gRPC subscribers
      if (protocolType !== "grpc") {
        gateway.notifyGrpcSubscribers("new_message", data);
      }
      break;
  }
});

gateway.start();
console.log("Multi-protocol chat server started");
console.log("HTTP API: http://localhost:3000");
console.log("WebSocket: ws://localhost:3001");
console.log("gRPC: localhost:50051");
```

## Load Balancing

Distribute traffic across multiple servers:

```typescript
const gateway = createGateway();

// Multiple HTTP servers for load balancing
const servers = [
  gateway.addServer(ServerProtocol.HTTP, { port: 3000 }),
  gateway.addServer(ServerProtocol.HTTP, { port: 3001 }),
  gateway.addServer(ServerProtocol.HTTP, { port: 3002 })
];

// Round-robin load balancing
let currentServer = 0;

gateway.loadBalancer({
  strategy: "round-robin",
  healthCheck: true,
  healthCheckInterval: 30000,
  
  route: (request) => {
    const server = servers[currentServer];
    currentServer = (currentServer + 1) % servers.length;
    return server;
  }
});

// Weighted load balancing
gateway.loadBalancer({
  strategy: "weighted",
  weights: {
    "server-1": 3,
    "server-2": 2,
    "server-3": 1
  }
});
```

## Protocol Translation

Automatic message format conversion:

```typescript
gateway.addTranslator("http-to-websocket", {
  from: ServerProtocol.HTTP,
  to: ServerProtocol.WEBSOCKET,
  
  translate: (httpRequest) => {
    return {
      type: "http_request",
      method: httpRequest.method,
      url: httpRequest.url,
      headers: Object.fromEntries(httpRequest.headers.entries()),
      body: httpRequest.body
    };
  }
});

gateway.addTranslator("websocket-to-grpc", {
  from: ServerProtocol.WEBSOCKET,
  to: ServerProtocol.GRPC,
  
  translate: (wsMessage) => {
    const data = JSON.parse(wsMessage);
    
    return {
      service: "ApiService",
      method: data.method,
      request: data.data
    };
  }
});

gateway.addTranslator("grpc-to-http", {
  from: ServerProtocol.GRPC,
  to: ServerProtocol.HTTP,
  
  translate: (grpcResponse) => {
    return new Response(JSON.stringify(grpcResponse), {
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

## API Gateway

Create a unified API gateway:

```typescript
const apiGateway = createGateway();

// API versioning
apiGateway.version("v1", {
  prefix: "/api/v1",
  servers: [
    { protocol: ServerProtocol.HTTP, port: 3001 },
    { protocol: ServerProtocol.WEBSOCKET, port: 3002 }
  ]
});

apiGateway.version("v2", {
  prefix: "/api/v2",
  servers: [
    { protocol: ServerProtocol.HTTP, port: 3003 },
    { protocol: ServerProtocol.GRPC, port: 50051 }
  ]
});

// Rate limiting
apiGateway.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
});

// Authentication
apiGateway.authenticate({
  jwt: {
    secret: "your-secret-key",
    algorithms: ["HS256"]
  },
  
  apiKey: {
    header: "x-api-key",
    validate: async (key) => {
      return await validateApiKey(key);
    }
  }
});

// Request logging
apiGateway.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${req.ip}`);
  next();
});

// Service discovery
apiGateway.discover({
  consul: {
    host: "localhost",
    port: 8500
  },
  
  services: ["user-service", "order-service", "payment-service"]
});
```

## Monitoring and Metrics

Monitor gateway performance:

```typescript
gateway.metrics({
  enabled: true,
  endpoint: "/metrics",
  
  collect: [
    "request_count",
    "request_duration",
    "error_rate",
    "protocol_distribution",
    "active_connections"
  ]
});

gateway.onMetric((metric) => {
  switch (metric.type) {
    case "request_count":
      console.log(`Requests: ${metric.value}`);
      break;
    case "error_rate":
      if (metric.value > 0.05) { // 5% error rate
        console.warn(`High error rate: ${metric.value * 100}%`);
      }
      break;
  }
});

// Health checks
gateway.healthCheck({
  endpoint: "/health",
  checks: [
    {
      name: "database",
      check: async () => {
        return await checkDatabaseConnection();
      }
    },
    {
      name: "cache",
      check: async () => {
        return await checkCacheConnection();
      }
    }
  ]
});
```

## Security

Implement gateway security:

```typescript
gateway.security({
  cors: {
    origin: ["https://example.com", "https://app.example.com"],
    credentials: true
  },
  
  helmet: {
    contentSecurityPolicy: true,
    hsts: true
  },
  
  ddos: {
    maxConnections: 100,
    blacklist: ["192.168.1.100"]
  }
});

// Request validation
gateway.validate({
  headers: {
    "user-agent": { required: true },
    "content-type": { 
      allowed: ["application/json", "text/plain"] 
    }
  },
  
  body: {
    maxSize: "10mb",
    validate: (body, contentType) => {
      if (contentType === "application/json") {
        try {
          JSON.parse(body);
          return true;
        } catch {
          return false;
        }
      }
      return true;
    }
  }
});
```

## Configuration

Gateway configuration options:

```typescript
const gateway = createGateway({
  // Connection settings
  maxConnections: 10000,
  timeout: 30000,
  keepAlive: true,
  
  // Protocol settings
  protocols: {
    http: {
      maxRequestSize: "10mb",
      compression: true
    },
    websocket: {
      maxConnections: 1000,
      pingInterval: 30000
    },
    grpc: {
      maxReceiveMessageLength: "4mb",
      keepaliveTimeMs: 30000
    }
  },
  
  // Logging
  logging: {
    level: "info",
    format: "json",
    destination: "console"
  },
  
  // Clustering
  cluster: {
    enabled: true,
    workers: 4,
    sticky: true
  }
});
```

## Best Practices

1. **Design for Scale**: Plan for high traffic scenarios
2. **Monitor Performance**: Track metrics and health
3. **Implement Caching**: Cache responses when appropriate
4. **Handle Failures**: Implement circuit breakers
5. **Secure by Default**: Always implement security measures
6. **Version APIs**: Plan for API evolution

## Use Cases

- **Microservices**: Connect different service protocols
- **Legacy Integration**: Bridge old and new systems
- **Multi-Platform Apps**: Support different client types
- **API Aggregation**: Combine multiple APIs
- **Protocol Migration**: Gradual protocol transitions

## Next Steps

- [Performance](/guide/performance) - Optimization techniques
- [Security](/guide/security) - Security best practices
- [Testing](/guide/testing) - Testing strategies
# Protocol Gateway

API reference for Verb's Protocol Gateway that enables seamless communication between different protocols (HTTP, WebSocket, gRPC, UDP, TCP) with automatic translation and routing.

## Overview

The Protocol Gateway allows you to create unified APIs that can accept requests from multiple protocols and route them to appropriate handlers, enabling clients to interact with your services using their preferred protocol.

## Creating Protocol Gateway

### Basic Gateway Setup

```typescript
import { createProtocolGateway } from "verb";

const gateway = createProtocolGateway({
  protocols: ["http", "websocket", "grpc", "udp"],
  port: 8080
});

// Define service handlers
gateway.addService("UserService", {
  getUser: async (request) => {
    const { id } = request;
    return await getUserFromDatabase(id);
  },
  
  createUser: async (request) => {
    const userData = request;
    return await createUserInDatabase(userData);
  },
  
  updateUser: async (request) => {
    const { id, ...data } = request;
    return await updateUserInDatabase(id, data);
  }
});

gateway.listen();
console.log("Protocol Gateway running on port 8080");
```

### Multi-Protocol Server

```typescript
import { createServer, ProtocolGateway } from "verb";

const app = createServer();

// Create gateway instance
const gateway = new ProtocolGateway({
  enableHTTP: true,
  enableWebSocket: true,
  enableGRPC: true,
  enableUDP: true,
  enableTCP: true,
  
  // Protocol-specific configurations
  http: {
    basePath: "/api",
    enableCORS: true
  },
  
  websocket: {
    path: "/ws",
    enableCompression: true
  },
  
  grpc: {
    reflection: true,
    maxMessageSize: 4 * 1024 * 1024
  },
  
  udp: {
    maxPacketSize: 65507
  },
  
  tcp: {
    keepAlive: true,
    noDelay: true
  }
});

// Attach gateway to server
app.use("/gateway", gateway.middleware());

app.withOptions({
  port: 8080,
  websocket: gateway.getWebSocketConfig(),
  grpc: gateway.getGRPCConfig(),
  udp: gateway.getUDPConfig(),
  tcp: gateway.getTCPConfig()
});

app.listen(8080);
```

## Service Definition

### Unified Service Interface

```typescript
interface ServiceDefinition {
  name: string;
  methods: Record<string, ServiceMethod>;
  middleware?: MiddlewareFunction[];
  authentication?: AuthenticationConfig;
  rateLimit?: RateLimitConfig;
}

interface ServiceMethod {
  handler: (request: any, context: RequestContext) => Promise<any>;
  input?: ValidationSchema;
  output?: ValidationSchema;
  streaming?: "none" | "client" | "server" | "bidirectional";
  authentication?: boolean;
  rateLimit?: RateLimitConfig;
}

// Define a complete service
gateway.addService("UserService", {
  name: "UserService",
  
  methods: {
    getUser: {
      handler: async (request, context) => {
        const { id } = request;
        
        // Access protocol-specific information
        const protocol = context.protocol; // "http", "websocket", "grpc", etc.
        const clientInfo = context.client;
        
        const user = await getUserFromDatabase(id);
        if (!user) {
          throw new ServiceError("USER_NOT_FOUND", "User not found", 404);
        }
        
        return user;
      },
      
      input: {
        type: "object",
        properties: {
          id: { type: "string", required: true }
        }
      },
      
      output: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" }
        }
      },
      
      authentication: true
    },
    
    streamUsers: {
      handler: async function* (request, context) {
        const { filter, limit } = request;
        
        for await (const user of getUserStream(filter, limit)) {
          yield user;
        }
      },
      
      streaming: "server"
    },
    
    uploadUsers: {
      handler: async (requestStream, context) => {
        const users = [];
        
        for await (const userData of requestStream) {
          const user = await createUser(userData);
          users.push(user);
        }
        
        return { count: users.length, users };
      },
      
      streaming: "client"
    }
  },
  
  middleware: [
    loggingMiddleware,
    validationMiddleware
  ],
  
  authentication: {
    required: true,
    methods: ["jwt", "apikey"]
  },
  
  rateLimit: {
    requests: 100,
    window: 60000 // 1 minute
  }
});
```

## Protocol Translation

### HTTP to Service Mapping

```typescript
// HTTP requests are automatically mapped to service methods
gateway.configureHTTP({
  basePath: "/api/v1",
  
  // Custom route mapping
  routes: {
    "GET /users/:id": "UserService.getUser",
    "POST /users": "UserService.createUser",
    "PUT /users/:id": "UserService.updateUser",
    "DELETE /users/:id": "UserService.deleteUser",
    "GET /users/stream": "UserService.streamUsers"
  },
  
  // Request transformation
  transformRequest: (req, method) => {
    // Transform HTTP request to service format
    switch (method) {
      case "UserService.getUser":
        return { id: req.params.id };
      case "UserService.createUser":
        return req.body;
      case "UserService.updateUser":
        return { id: req.params.id, ...req.body };
      default:
        return req.body || req.params;
    }
  },
  
  // Response transformation
  transformResponse: (result, method, req) => {
    // Add metadata to HTTP responses
    return {
      data: result,
      timestamp: Date.now(),
      method,
      version: "1.0"
    };
  }
});

// Example HTTP calls:
// GET /api/v1/users/123 -> UserService.getUser({ id: "123" })
// POST /api/v1/users -> UserService.createUser(requestBody)
```

### WebSocket Message Routing

```typescript
gateway.configureWebSocket({
  path: "/ws",
  
  // Message format
  messageFormat: "json", // or "binary", "msgpack"
  
  // Message routing
  routeMessage: (message) => {
    // Route based on message type
    const { service, method, data, id } = message;
    return {
      service,
      method,
      request: data,
      messageId: id
    };
  },
  
  // Response formatting
  formatResponse: (result, messageId, method) => {
    return {
      id: messageId,
      type: "response",
      method,
      data: result,
      timestamp: Date.now()
    };
  },
  
  // Streaming support
  handleStreaming: {
    server: (stream, socket, messageId) => {
      // Handle server streaming
      stream.on("data", (chunk) => {
        socket.send(JSON.stringify({
          id: messageId,
          type: "stream",
          data: chunk
        }));
      });
      
      stream.on("end", () => {
        socket.send(JSON.stringify({
          id: messageId,
          type: "stream_end"
        }));
      });
    },
    
    client: (socket, messageId) => {
      // Return a writable stream for client streaming
      const stream = new WritableStream();
      return stream;
    }
  }
});

// Example WebSocket message:
// {
//   "id": "req_123",
//   "service": "UserService",
//   "method": "getUser",
//   "data": { "id": "123" }
// }
```

### gRPC Service Integration

```typescript
gateway.configureGRPC({
  protoFiles: ["./protos/user.proto"],
  
  // Service mapping
  services: {
    "user.UserService": "UserService" // Proto service -> Gateway service
  },
  
  // Method mapping
  methodMapping: {
    "GetUser": "getUser",
    "CreateUser": "createUser",
    "UpdateUser": "updateUser",
    "ListUsers": "streamUsers"
  },
  
  // Custom message transformation
  transformRequest: (protoRequest, methodName) => {
    // Convert protobuf message to service format
    return protoRequest.toObject();
  },
  
  transformResponse: (serviceResult, methodName) => {
    // Convert service result to protobuf message
    return serviceResult;
  }
});
```

### UDP/TCP Binary Protocol

```typescript
gateway.configureUDP({
  port: 8081,
  
  // Binary protocol definition
  protocol: {
    // Message format: [version:1][type:1][length:4][payload:length]
    parseMessage: (buffer) => {
      const version = buffer.readUInt8(0);
      const type = buffer.readUInt8(1);
      const length = buffer.readUInt32BE(2);
      const payload = buffer.slice(6, 6 + length);
      
      return {
        version,
        type,
        data: JSON.parse(payload.toString())
      };
    },
    
    formatResponse: (result, type) => {
      const payload = Buffer.from(JSON.stringify(result));
      const response = Buffer.alloc(6 + payload.length);
      
      response.writeUInt8(1, 0); // version
      response.writeUInt8(type, 1); // response type
      response.writeUInt32BE(payload.length, 2); // length
      payload.copy(response, 6);
      
      return response;
    }
  },
  
  // Service routing
  routeMessage: (message) => {
    const { service, method, data } = message.data;
    return { service, method, request: data };
  }
});
```

## Request Context

### Context Information

```typescript
interface RequestContext {
  protocol: "http" | "websocket" | "grpc" | "udp" | "tcp";
  client: ClientInfo;
  headers: Record<string, string>;
  metadata: Record<string, any>;
  authentication?: AuthenticationInfo;
  tracing: TracingInfo;
}

interface ClientInfo {
  id: string;
  address: string;
  port: number;
  userAgent?: string;
  version?: string;
}

// Using context in service handlers
gateway.addService("UserService", {
  methods: {
    getUser: async (request, context) => {
      // Protocol-specific handling
      switch (context.protocol) {
        case "http":
          // HTTP-specific logic
          const userAgent = context.headers["user-agent"];
          break;
          
        case "grpc":
          // gRPC-specific logic
          const deadline = context.metadata.deadline;
          break;
          
        case "websocket":
          // WebSocket-specific logic
          const connectionId = context.client.id;
          break;
      }
      
      // Unified business logic
      return await getUserFromDatabase(request.id);
    }
  }
});
```

## Authentication & Authorization

### Multi-Protocol Authentication

```typescript
gateway.configureAuthentication({
  providers: {
    jwt: {
      secret: "your-jwt-secret",
      algorithms: ["HS256"],
      
      // Extract JWT from different protocols
      extractToken: {
        http: (req) => req.headers.authorization?.replace("Bearer ", ""),
        websocket: (message) => message.auth?.token,
        grpc: (metadata) => metadata.get("authorization")?.[0],
        udp: (message) => message.auth?.token,
        tcp: (message) => message.auth?.token
      }
    },
    
    apikey: {
      header: "X-API-Key",
      
      validate: async (apiKey, context) => {
        const key = await getAPIKey(apiKey);
        return key && key.active;
      }
    },
    
    oauth: {
      issuer: "https://auth.example.com",
      audience: "api://gateway"
    }
  },
  
  // Per-protocol authentication rules
  rules: {
    http: ["jwt", "apikey", "oauth"],
    websocket: ["jwt", "apikey"],
    grpc: ["jwt"],
    udp: ["apikey"],
    tcp: ["apikey"]
  }
});

// Service-level authentication
gateway.addService("UserService", {
  authentication: {
    required: true,
    methods: ["jwt", "apikey"],
    
    // Custom authorization
    authorize: async (user, method, request) => {
      switch (method) {
        case "deleteUser":
          return user.role === "admin";
        case "updateUser":
          return user.role === "admin" || user.id === request.id;
        default:
          return true;
      }
    }
  }
});
```

## Error Handling

### Unified Error Responses

```typescript
class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// Error translation for different protocols
gateway.configureErrorHandling({
  transformError: (error, protocol) => {
    switch (protocol) {
      case "http":
        return {
          status: error.statusCode || 500,
          body: {
            error: error.code || "INTERNAL_ERROR",
            message: error.message,
            details: error.details
          }
        };
        
      case "grpc":
        return {
          code: mapToGrpcStatus(error.statusCode),
          message: error.message,
          details: error.details
        };
        
      case "websocket":
        return {
          type: "error",
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
        
      default:
        return {
          error: error.code,
          message: error.message,
          details: error.details
        };
    }
  }
});

const mapToGrpcStatus = (httpStatus) => {
  switch (httpStatus) {
    case 400: return 3; // INVALID_ARGUMENT
    case 401: return 16; // UNAUTHENTICATED  
    case 403: return 7; // PERMISSION_DENIED
    case 404: return 5; // NOT_FOUND
    case 409: return 6; // ALREADY_EXISTS
    case 429: return 8; // RESOURCE_EXHAUSTED
    default: return 13; // INTERNAL
  }
};
```

## Monitoring & Observability

### Cross-Protocol Metrics

```typescript
gateway.configureMonitoring({
  metrics: {
    enabled: true,
    
    // Collect metrics across all protocols
    collectors: [
      "request_count",
      "request_duration", 
      "error_rate",
      "active_connections",
      "throughput"
    ],
    
    // Protocol-specific metrics
    protocolMetrics: {
      http: ["status_codes", "user_agents"],
      websocket: ["connection_duration", "message_frequency"],
      grpc: ["stream_count", "rpc_latency"],
      udp: ["packet_loss", "packet_size"],
      tcp: ["connection_pool", "buffer_utilization"]
    }
  },
  
  tracing: {
    enabled: true,
    provider: "jaeger", // or "zipkin", "datadog"
    
    // Trace requests across protocol boundaries
    correlationHeader: "X-Trace-ID",
    
    // Custom span attributes
    spanAttributes: (context) => ({
      "protocol": context.protocol,
      "client.address": context.client.address,
      "service.name": context.service,
      "method.name": context.method
    })
  },
  
  logging: {
    level: "info",
    format: "json",
    
    // Structured logging across protocols
    fields: [
      "timestamp",
      "protocol", 
      "service",
      "method",
      "client_id",
      "duration",
      "status"
    ]
  }
});

// Access metrics
app.get("/metrics", (req, res) => {
  const metrics = gateway.getMetrics();
  res.json(metrics);
});

// Metrics output example:
// {
//   "requests_total": {
//     "http": 1250,
//     "websocket": 890,
//     "grpc": 450,
//     "udp": 120,
//     "tcp": 80
//   },
//   "avg_response_time": {
//     "http": 45.2,
//     "websocket": 12.1,
//     "grpc": 23.8,
//     "udp": 5.1,
//     "tcp": 8.7
//   }
// }
```

## Load Balancing & Routing

### Service Discovery Integration

```typescript
gateway.configureServiceDiscovery({
  provider: "consul", // or "etcd", "kubernetes", "zookeeper"
  
  services: {
    "UserService": {
      strategy: "round_robin", // or "least_connections", "weighted"
      healthCheck: "/health",
      instances: [
        { host: "user-service-1", port: 3001, weight: 1 },
        { host: "user-service-2", port: 3002, weight: 2 },
        { host: "user-service-3", port: 3003, weight: 1 }
      ]
    },
    
    "OrderService": {
      strategy: "least_connections",
      instances: "auto-discover" // Use service discovery
    }
  },
  
  // Protocol-specific routing
  routing: {
    http: {
      sticky_sessions: true,
      session_header: "X-Session-ID"
    },
    
    websocket: {
      connection_affinity: true
    },
    
    grpc: {
      load_balancing: "round_robin"
    }
  }
});
```

## Testing Protocol Gateway

```typescript
import { test, expect } from "bun:test";
import { createProtocolGateway } from "verb";

test("gateway handles HTTP requests", async () => {
  const gateway = createProtocolGateway({
    protocols: ["http"]
  });
  
  gateway.addService("TestService", {
    methods: {
      echo: async (request) => {
        return { message: request.message };
      }
    }
  });
  
  const response = await fetch("http://localhost:8080/api/TestService/echo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello Gateway!" })
  });
  
  const result = await response.json();
  expect(result.data.message).toBe("Hello Gateway!");
});

test("gateway handles WebSocket messages", async () => {
  const gateway = createProtocolGateway({
    protocols: ["websocket"]
  });
  
  gateway.addService("TestService", {
    methods: {
      echo: async (request) => {
        return { message: request.message };
      }
    }
  });
  
  const ws = new WebSocket("ws://localhost:8080/ws");
  
  ws.send(JSON.stringify({
    id: "test_1",
    service: "TestService", 
    method: "echo",
    data: { message: "Hello WebSocket!" }
  }));
  
  const response = await new Promise((resolve) => {
    ws.onmessage = (event) => {
      resolve(JSON.parse(event.data));
    };
  });
  
  expect(response.data.message).toBe("Hello WebSocket!");
});
```

## Best Practices

1. **Protocol Agnostic Services**: Design services to work across all protocols
2. **Consistent Error Handling**: Use unified error response formats
3. **Authentication Strategy**: Implement flexible multi-protocol authentication
4. **Request Validation**: Validate inputs regardless of protocol
5. **Monitoring**: Track metrics across all protocol endpoints
6. **Load Balancing**: Distribute load effectively across service instances
7. **Documentation**: Document protocol-specific API differences

## See Also

- [HTTP Server](/api/servers/http) - HTTP protocol implementation
- [WebSocket Server](/api/servers/websocket) - WebSocket protocol implementation  
- [gRPC Server](/api/servers/grpc) - gRPC protocol implementation
- [UDP Server](/api/servers/udp) - UDP protocol implementation
- [TCP Server](/api/servers/tcp) - TCP protocol implementation
- [Authentication Guide](/guide/authentication) - Multi-protocol authentication
- [Monitoring Guide](/guide/monitoring) - Cross-protocol observability
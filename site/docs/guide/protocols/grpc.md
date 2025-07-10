# gRPC

Verb provides built-in support for gRPC (Google Remote Procedure Call) for high-performance, language-agnostic service communication.

## Overview

gRPC offers several advantages:
- **High Performance**: Binary protocol with HTTP/2
- **Language Agnostic**: Generate clients in multiple languages
- **Streaming**: Bidirectional streaming support
- **Type Safety**: Strong typing with Protocol Buffers

## Creating a gRPC Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.GRPC);

app.addService({
  name: "UserService",
  methods: {
    GetUser: {
      handler: async (request) => {
        const { id } = request;
        return {
          id,
          name: `User ${id}`,
          email: `user${id}@example.com`
        };
      }
    },
    
    CreateUser: {
      handler: async (request) => {
        const { name, email } = request;
        return {
          id: Date.now().toString(),
          name,
          email,
          createdAt: new Date().toISOString()
        };
      }
    }
  }
});

app.listen(50051);
```

## Protocol Buffers

Define your service interface:

```
// user.proto
syntax = "proto3";

package user;

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc StreamUsers(stream CreateUserRequest) returns (stream User);
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  string created_at = 4;
}

message GetUserRequest {
  string id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message ListUsersRequest {
  int32 page = 1;
  int32 limit = 2;
}
```

## Server Streaming

Send multiple responses for a single request:

```typescript
app.addService({
  name: "UserService",
  methods: {
    ListUsers: {
      handler: async function* (request) {
        const { page = 1, limit = 10 } = request;
        const users = await getUsersFromDB(page, limit);
        
        for (const user of users) {
          yield user;
        }
      }
    }
  }
});
```

## Client Streaming

Accept multiple requests and send a single response:

```typescript
app.addService({
  name: "UserService", 
  methods: {
    CreateUsers: {
      handler: async (requestStream) => {
        const users = [];
        
        for await (const request of requestStream) {
          const user = await createUser(request);
          users.push(user);
        }
        
        return {
          count: users.length,
          users
        };
      }
    }
  }
});
```

## Bidirectional Streaming

Handle real-time communication:

```typescript
app.addService({
  name: "ChatService",
  methods: {
    Chat: {
      handler: async function* (requestStream) {
        for await (const message of requestStream) {
          // Process incoming message
          const response = await processMessage(message);
          
          // Send response back
          yield response;
          
          // Broadcast to other clients
          broadcastMessage(message);
        }
      }
    }
  }
});
```

## Error Handling

Proper gRPC error responses:

```typescript
import { GrpcError, GrpcStatus } from "verb";

app.addService({
  name: "UserService",
  methods: {
    GetUser: {
      handler: async (request) => {
        const { id } = request;
        const user = await findUser(id);
        
        if (!user) {
          throw new GrpcError(
            GrpcStatus.NOT_FOUND,
            `User with ID ${id} not found`
          );
        }
        
        return user;
      }
    }
  }
});
```

## Middleware

Add middleware for authentication, logging, etc:

```typescript
// Authentication middleware
app.use(async (call, next) => {
  const metadata = call.metadata;
  const token = metadata.get("authorization")?.[0];
  
  if (!token) {
    throw new GrpcError(
      GrpcStatus.UNAUTHENTICATED,
      "Missing authorization token"
    );
  }
  
  const user = await verifyToken(token);
  call.user = user;
  
  return next();
});

// Logging middleware
app.use(async (call, next) => {
  const start = Date.now();
  console.log(`gRPC call: ${call.method}`);
  
  try {
    return await next();
  } finally {
    const duration = Date.now() - start;
    console.log(`gRPC call completed in ${duration}ms`);
  }
});
```

## Client Example

Using the gRPC service:

```typescript
import { createClient } from "verb/grpc";

const client = createClient("UserService", "localhost:50051");

// Simple call
const user = await client.GetUser({ id: "123" });
console.log(user);

// Server streaming
const usersStream = client.ListUsers({ page: 1, limit: 10 });
for await (const user of usersStream) {
  console.log("User:", user);
}

// Client streaming
const createStream = client.CreateUsers();
createStream.write({ name: "John", email: "john@example.com" });
createStream.write({ name: "Jane", email: "jane@example.com" });
const result = await createStream.end();
console.log("Created users:", result);
```

## Advanced Configuration

```typescript
app.withOptions({
  port: 50051,
  grpc: {
    maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
    maxSendMessageLength: 4 * 1024 * 1024,    // 4MB
    keepaliveTimeMs: 30000,
    keepaliveTimeoutMs: 5000,
    keepalivePermitWithoutCalls: true,
    http2MaxPingsWithoutData: 0,
    http2MinTimeBetweenPingsMs: 10000,
    http2MaxPingStrikes: 2
  }
});
```

## Load Balancing

Client-side load balancing:

```typescript
const client = createClient("UserService", [
  "server1.example.com:50051",
  "server2.example.com:50051", 
  "server3.example.com:50051"
], {
  loadBalancing: "round_robin"
});
```

## Testing

Testing gRPC services:

```typescript
import { test, expect } from "bun:test";

test("gRPC GetUser", async () => {
  const client = createTestClient("UserService");
  
  const response = await client.GetUser({ id: "123" });
  
  expect(response.id).toBe("123");
  expect(response.name).toBeDefined();
  expect(response.email).toBeDefined();
});

test("gRPC streaming", async () => {
  const client = createTestClient("UserService");
  
  const users = [];
  const stream = client.ListUsers({ page: 1, limit: 5 });
  
  for await (const user of stream) {
    users.push(user);
  }
  
  expect(users).toHaveLength(5);
});
```

## Best Practices

1. **Use Protocol Buffers**: Define clear service interfaces
2. **Handle Errors Properly**: Use appropriate gRPC status codes
3. **Implement Timeouts**: Set reasonable call timeouts
4. **Add Middleware**: Use middleware for cross-cutting concerns
5. **Monitor Performance**: Track gRPC-specific metrics
6. **Version Services**: Plan for service evolution

## Next Steps

- [UDP](/guide/protocols/udp) - Connectionless protocol
- [TCP](/guide/protocols/tcp) - Connection-oriented protocol  
- [Performance](/guide/performance) - Optimization strategies
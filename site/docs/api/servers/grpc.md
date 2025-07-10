# gRPC Server

API reference for creating high-performance gRPC servers with Protocol Buffers, streaming, and service definitions.

## Creating gRPC Server

### Basic gRPC Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.GRPC);

app.withOptions({
  port: 50051,
  grpc: {
    maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
    maxSendMessageLength: 4 * 1024 * 1024,    // 4MB
  }
});

// Add a service
app.addService({
  name: "UserService",
  methods: {
    GetUser: {
      handler: async (request) => {
        const { id } = request;
        return {
          id,
          name: `User ${id}`,
          email: `user${id}@example.com`,
          createdAt: new Date().toISOString()
        };
      }
    },
    
    CreateUser: {
      handler: async (request) => {
        const { name, email } = request;
        return {
          id: generateUserId(),
          name,
          email,
          createdAt: new Date().toISOString()
        };
      }
    }
  }
});

app.listen(50051);
console.log("gRPC server running on port 50051");
```

### Service from Proto Definition

```typescript
// Load service from .proto file
const userServiceDef = await loadProtoDefinition("./protos/user.proto");

app.addService({
  definition: userServiceDef.UserService,
  implementation: {
    GetUser: async (call) => {
      const { id } = call.request;
      
      const user = await getUserFromDatabase(id);
      if (!user) {
        throw new GrpcError(
          GrpcStatus.NOT_FOUND,
          `User with ID ${id} not found`
        );
      }
      
      return user;
    },
    
    CreateUser: async (call) => {
      const userData = call.request;
      
      // Validate input
      validateUserData(userData);
      
      const user = await createUserInDatabase(userData);
      return user;
    },
    
    UpdateUser: async (call) => {
      const { id, ...updateData } = call.request;
      
      const user = await updateUserInDatabase(id, updateData);
      return user;
    },
    
    DeleteUser: async (call) => {
      const { id } = call.request;
      
      await deleteUserFromDatabase(id);
      return { success: true };
    }
  }
});
```

## Protocol Buffer Definitions

### User Service Proto

```
// user.proto
syntax = "proto3";

package user;

service UserService {
  // Unary RPC
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
  
  // Server streaming RPC
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc SearchUsers(SearchUsersRequest) returns (stream User);
  
  // Client streaming RPC
  rpc CreateMultipleUsers(stream CreateUserRequest) returns (CreateMultipleUsersResponse);
  
  // Bidirectional streaming RPC
  rpc ChatWithUsers(stream ChatMessage) returns (stream ChatMessage);
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  string phone = 4;
  Address address = 5;
  repeated string roles = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
}

message Address {
  string street = 1;
  string city = 2;
  string state = 3;
  string zip_code = 4;
  string country = 5;
}

message GetUserRequest {
  string id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
  string phone = 3;
  Address address = 4;
  repeated string roles = 5;
}

message UpdateUserRequest {
  string id = 1;
  optional string name = 2;
  optional string email = 3;
  optional string phone = 4;
  optional Address address = 5;
  repeated string roles = 6;
}

message DeleteUserRequest {
  string id = 1;
}

message DeleteUserResponse {
  bool success = 1;
}

message ListUsersRequest {
  int32 page = 1;
  int32 limit = 2;
  string sort_by = 3;
  string sort_order = 4;
}

message SearchUsersRequest {
  string query = 1;
  repeated string fields = 2;
  int32 limit = 3;
}

message CreateMultipleUsersResponse {
  int32 count = 1;
  repeated User users = 2;
}

message ChatMessage {
  string user_id = 1;
  string message = 2;
  google.protobuf.Timestamp timestamp = 3;
}
```

## Streaming RPCs

### Server Streaming

```typescript
app.addService({
  name: "UserService",
  methods: {
    ListUsers: {
      handler: async function* (request) {
        const { page = 1, limit = 10, sortBy = "created_at" } = request;
        
        // Stream users in batches
        let offset = (page - 1) * limit;
        let hasMore = true;
        
        while (hasMore) {
          const users = await getUsersBatch(offset, limit, sortBy);
          
          if (users.length === 0) {
            hasMore = false;
            break;
          }
          
          for (const user of users) {
            yield user;
          }
          
          offset += limit;
          hasMore = users.length === limit;
        }
      }
    },
    
    StreamUserUpdates: {
      handler: async function* (request) {
        const { userId } = request;
        
        // Subscribe to user updates
        const subscription = await subscribeToUserUpdates(userId);
        
        try {
          for await (const update of subscription) {
            yield {
              userId: update.userId,
              field: update.field,
              oldValue: update.oldValue,
              newValue: update.newValue,
              timestamp: new Date().toISOString()
            };
          }
        } finally {
          await subscription.close();
        }
      }
    }
  }
});
```

### Client Streaming

```typescript
app.addService({
  name: "UserService",
  methods: {
    CreateMultipleUsers: {
      handler: async (requestStream) => {
        const users = [];
        const errors = [];
        
        try {
          for await (const userRequest of requestStream) {
            try {
              // Validate each user
              validateUserData(userRequest);
              
              const user = await createUserInDatabase(userRequest);
              users.push(user);
            } catch (error) {
              errors.push({
                request: userRequest,
                error: error.message
              });
            }
          }
          
          return {
            count: users.length,
            users,
            errors: errors.length > 0 ? errors : undefined
          };
        } catch (error) {
          throw new GrpcError(
            GrpcStatus.INTERNAL,
            `Batch user creation failed: ${error.message}`
          );
        }
      }
    },
    
    UploadUserData: {
      handler: async (requestStream) => {
        let totalRecords = 0;
        let processedRecords = 0;
        let errorCount = 0;
        
        for await (const chunk of requestStream) {
          totalRecords += chunk.records.length;
          
          const results = await Promise.allSettled(
            chunk.records.map(record => processUserRecord(record))
          );
          
          results.forEach(result => {
            if (result.status === "fulfilled") {
              processedRecords++;
            } else {
              errorCount++;
            }
          });
        }
        
        return {
          totalRecords,
          processedRecords,
          errorCount,
          successRate: processedRecords / totalRecords
        };
      }
    }
  }
});
```

### Bidirectional Streaming

```typescript
app.addService({
  name: "ChatService",
  methods: {
    Chat: {
      handler: async function* (requestStream) {
        const chatRoom = new Map(); // In-memory chat room
        
        // Process incoming messages
        const messageProcessor = async () => {
          for await (const message of requestStream) {
            // Broadcast message to all connected clients
            const broadcastMessage = {
              userId: message.userId,
              message: message.message,
              timestamp: new Date().toISOString(),
              id: generateMessageId()
            };
            
            // Store message
            chatRoom.set(broadcastMessage.id, broadcastMessage);
            
            // Yield to all clients (simplified - in real app, would use proper broadcasting)
            yield broadcastMessage;
          }
        };
        
        // Start processing messages in background
        messageProcessor().catch(console.error);
        
        // Send welcome message
        yield {
          userId: "system",
          message: "Welcome to the chat!",
          timestamp: new Date().toISOString(),
          id: generateMessageId()
        };
        
        // Keep connection alive and handle new messages
        while (true) {
          // In a real implementation, you'd listen for new messages
          // and yield them as they come in
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    },
    
    StreamData: {
      handler: async function* (requestStream) {
        const dataProcessor = new StreamDataProcessor();
        
        for await (const input of requestStream) {
          const processed = await dataProcessor.process(input);
          
          if (processed) {
            yield processed;
          }
        }
        
        // Send final summary
        yield dataProcessor.getSummary();
      }
    }
  }
});
```

## Error Handling

### gRPC Status Codes

```typescript
import { GrpcError, GrpcStatus } from "verb/grpc";

app.addService({
  name: "UserService",
  methods: {
    GetUser: {
      handler: async (request) => {
        const { id } = request;
        
        // Validation errors
        if (!id) {
          throw new GrpcError(
            GrpcStatus.INVALID_ARGUMENT,
            "User ID is required"
          );
        }
        
        if (!isValidUserId(id)) {
          throw new GrpcError(
            GrpcStatus.INVALID_ARGUMENT,
            "Invalid user ID format"
          );
        }
        
        try {
          const user = await getUserFromDatabase(id);
          
          if (!user) {
            throw new GrpcError(
              GrpcStatus.NOT_FOUND,
              `User with ID ${id} not found`
            );
          }
          
          return user;
        } catch (error) {
          if (error instanceof GrpcError) {
            throw error;
          }
          
          // Database or other internal errors
          throw new GrpcError(
            GrpcStatus.INTERNAL,
            "Failed to retrieve user"
          );
        }
      }
    },
    
    CreateUser: {
      handler: async (request) => {
        const { email } = request;
        
        // Check if user already exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
          throw new GrpcError(
            GrpcStatus.ALREADY_EXISTS,
            `User with email ${email} already exists`
          );
        }
        
        // Rate limiting
        const rateLimited = await checkRateLimit(request.clientIp);
        if (rateLimited) {
          throw new GrpcError(
            GrpcStatus.RESOURCE_EXHAUSTED,
            "Rate limit exceeded"
          );
        }
        
        return await createUser(request);
      }
    }
  }
});
```

### Error Middleware

```typescript
// Global error handling middleware
app.use(async (call, next) => {
  try {
    return await next();
  } catch (error) {
    console.error("gRPC Error:", error);
    
    // Log error details
    const errorDetails = {
      method: call.method,
      metadata: call.metadata.getMap(),
      error: error.message,
      stack: error.stack
    };
    
    await logError(errorDetails);
    
    // Convert to appropriate gRPC error
    if (error instanceof GrpcError) {
      throw error;
    }
    
    // Handle specific error types
    if (error.name === "ValidationError") {
      throw new GrpcError(
        GrpcStatus.INVALID_ARGUMENT,
        error.message
      );
    }
    
    if (error.name === "DatabaseError") {
      throw new GrpcError(
        GrpcStatus.UNAVAILABLE,
        "Database temporarily unavailable"
      );
    }
    
    // Default to internal error
    throw new GrpcError(
      GrpcStatus.INTERNAL,
      "Internal server error"
    );
  }
});
```

## Middleware

### Authentication Middleware

```typescript
app.use(async (call, next) => {
  const metadata = call.metadata;
  const token = metadata.get("authorization")?.[0];
  
  // Skip authentication for certain methods
  const publicMethods = ["GetPublicInfo", "HealthCheck"];
  if (publicMethods.includes(call.method)) {
    return next();
  }
  
  if (!token) {
    throw new GrpcError(
      GrpcStatus.UNAUTHENTICATED,
      "Missing authorization token"
    );
  }
  
  try {
    const user = await verifyToken(token.replace("Bearer ", ""));
    call.user = user;
    
    return next();
  } catch (error) {
    throw new GrpcError(
      GrpcStatus.UNAUTHENTICATED,
      "Invalid or expired token"
    );
  }
});
```

### Logging Middleware

```typescript
app.use(async (call, next) => {
  const start = Date.now();
  const requestId = generateRequestId();
  
  console.log(`[${requestId}] gRPC ${call.method} started`);
  
  try {
    const result = await next();
    
    const duration = Date.now() - start;
    console.log(`[${requestId}] gRPC ${call.method} completed in ${duration}ms`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[${requestId}] gRPC ${call.method} failed in ${duration}ms:`, error.message);
    
    throw error;
  }
});
```

### Rate Limiting Middleware

```typescript
import { RateLimiter } from "verb/middleware";

const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (call) => {
    return call.getPeer(); // Use client IP
  }
});

app.use(async (call, next) => {
  const allowed = await rateLimiter.checkLimit(call);
  
  if (!allowed) {
    throw new GrpcError(
      GrpcStatus.RESOURCE_EXHAUSTED,
      "Rate limit exceeded"
    );
  }
  
  return next();
});
```

## Client Code Generation

### TypeScript Client

```typescript
// Generated from proto definition
export interface UserServiceClient {
  getUser(request: GetUserRequest): Promise<User>;
  createUser(request: CreateUserRequest): Promise<User>;
  updateUser(request: UpdateUserRequest): Promise<User>;
  deleteUser(request: DeleteUserRequest): Promise<DeleteUserResponse>;
  listUsers(request: ListUsersRequest): AsyncIterable<User>;
  createMultipleUsers(requests: AsyncIterable<CreateUserRequest>): Promise<CreateMultipleUsersResponse>;
  chat(messages: AsyncIterable<ChatMessage>): AsyncIterable<ChatMessage>;
}

// Client usage
import { createGrpcClient } from "verb/grpc-client";

const client = createGrpcClient<UserServiceClient>({
  address: "localhost:50051",
  credentials: "insecure" // Use SSL credentials in production
});

// Unary call
const user = await client.getUser({ id: "123" });
console.log(user);

// Server streaming
for await (const user of client.listUsers({ page: 1, limit: 10 })) {
  console.log("User:", user);
}

// Client streaming
async function* generateUsers() {
  for (let i = 0; i < 100; i++) {
    yield {
      name: `User ${i}`,
      email: `user${i}@example.com`
    };
  }
}

const result = await client.createMultipleUsers(generateUsers());
console.log(`Created ${result.count} users`);
```

## Performance Optimization

### Connection Pooling

```typescript
app.withOptions({
  grpc: {
    // Connection settings
    maxReceiveMessageLength: 4 * 1024 * 1024,
    maxSendMessageLength: 4 * 1024 * 1024,
    
    // Performance settings
    keepaliveTimeMs: 30000,
    keepaliveTimeoutMs: 5000,
    keepalivePermitWithoutCalls: true,
    
    // HTTP/2 settings
    http2MaxPingsWithoutData: 0,
    http2MinTimeBetweenPingsMs: 10000,
    http2MaxPingStrikes: 2,
    
    // Connection pool
    maxConnectionIdle: 300000, // 5 minutes
    maxConnectionAge: 1800000, // 30 minutes
    maxConnectionAgeGrace: 60000, // 1 minute
  }
});
```

### Message Compression

```typescript
app.withOptions({
  grpc: {
    // Enable compression
    compression: "gzip",
    
    // Compression options
    compressionOptions: {
      level: 6, // Compression level (1-9)
      threshold: 1024 // Only compress messages > 1KB
    }
  }
});
```

## Health Checks

### gRPC Health Service

```typescript
app.addService({
  name: "Health",
  methods: {
    Check: {
      handler: async (request) => {
        const { service } = request;
        
        // Check specific service health
        if (service) {
          const healthy = await checkServiceHealth(service);
          return {
            status: healthy ? "SERVING" : "NOT_SERVING"
          };
        }
        
        // Check overall health
        const overallHealth = await checkOverallHealth();
        return {
          status: overallHealth ? "SERVING" : "NOT_SERVING"
        };
      }
    },
    
    Watch: {
      handler: async function* (request) {
        const { service } = request;
        
        while (true) {
          const status = await getHealthStatus(service);
          yield { status };
          
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }
});

const checkServiceHealth = async (serviceName) => {
  // Implement service-specific health checks
  switch (serviceName) {
    case "UserService":
      return await checkDatabaseConnection();
    case "NotificationService":
      return await checkRedisConnection();
    default:
      return true;
  }
};
```

## Testing gRPC Services

```typescript
import { test, expect } from "bun:test";
import { createGrpcTestClient } from "verb/testing";

test("UserService.GetUser returns user", async () => {
  const client = createGrpcTestClient("UserService");
  
  const response = await client.GetUser({ id: "123" });
  
  expect(response.id).toBe("123");
  expect(response.name).toBeDefined();
  expect(response.email).toBeDefined();
});

test("UserService.CreateUser creates new user", async () => {
  const client = createGrpcTestClient("UserService");
  
  const response = await client.CreateUser({
    name: "John Doe",
    email: "john@example.com"
  });
  
  expect(response.id).toBeDefined();
  expect(response.name).toBe("John Doe");
  expect(response.email).toBe("john@example.com");
});

test("UserService.ListUsers streams users", async () => {
  const client = createGrpcTestClient("UserService");
  
  const users = [];
  for await (const user of client.ListUsers({ page: 1, limit: 5 })) {
    users.push(user);
  }
  
  expect(users).toHaveLength(5);
  expect(users[0]).toHaveProperty("id");
  expect(users[0]).toHaveProperty("name");
});

test("handles gRPC errors correctly", async () => {
  const client = createGrpcTestClient("UserService");
  
  try {
    await client.GetUser({ id: "nonexistent" });
    expect.fail("Should have thrown an error");
  } catch (error) {
    expect(error.code).toBe(GrpcStatus.NOT_FOUND);
    expect(error.message).toContain("not found");
  }
});
```

## Best Practices

1. **Use Protocol Buffers**: Define clear, versioned service interfaces
2. **Handle Errors Properly**: Use appropriate gRPC status codes
3. **Implement Streaming**: Use streaming for large datasets
4. **Add Middleware**: Use middleware for cross-cutting concerns
5. **Monitor Performance**: Track gRPC-specific metrics
6. **Version Services**: Plan for service evolution
7. **Use Compression**: Enable compression for large messages
8. **Health Checks**: Implement health check endpoints

## See Also

- [HTTP/2 Server](/api/servers/http2) - HTTP/2 foundation for gRPC
- [Protocol Buffers Guide](/guide/protobuf) - Working with Protocol Buffers
- [Microservices Guide](/guide/microservices) - Building microservices with gRPC
- [Performance Guide](/guide/performance) - gRPC optimization
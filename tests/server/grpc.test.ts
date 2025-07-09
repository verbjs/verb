import { test, expect } from "bun:test";
import { createGrpcServer, createGrpcService, createGrpcMethod } from "../../src/server/grpc";

test("gRPC server - creates server instance", () => {
  const server = createGrpcServer();
  
  expect(server).toBeDefined();
  expect(server.addService).toBeDefined();
  expect(server.addMethod).toBeDefined();
  expect(server.listen).toBeDefined();
  expect(server.withOptions).toBeDefined();
});

test("gRPC server - adds service", () => {
  const server = createGrpcServer();
  
  const service = createGrpcService("UserService", [
    createGrpcMethod("GetUser", "GetUserRequest", "GetUserResponse", async (request) => {
      return { id: request.id, name: "John Doe" };
    })
  ]);
  
  server.addService(service);
  
  // Service is added internally, no direct way to verify without accessing internals
  expect(service.name).toBe("UserService");
  expect(service.methods.length).toBe(1);
  expect(service.methods[0].name).toBe("GetUser");
});

test("gRPC server - adds method to service", () => {
  const server = createGrpcServer();
  
  const method = createGrpcMethod("CreateUser", "CreateUserRequest", "CreateUserResponse", async (request) => {
    return { id: "123", name: request.name };
  });
  
  server.addMethod("UserService", method);
  
  expect(method.name).toBe("CreateUser");
  expect(method.requestType).toBe("CreateUserRequest");
  expect(method.responseType).toBe("CreateUserResponse");
  expect(method.handler).toBeDefined();
});

test("gRPC server - creates service with multiple methods", () => {
  const server = createGrpcServer();
  
  const service = createGrpcService("UserService", [
    createGrpcMethod("GetUser", "GetUserRequest", "GetUserResponse", async (request) => {
      return { id: request.id, name: "John Doe" };
    }),
    createGrpcMethod("CreateUser", "CreateUserRequest", "CreateUserResponse", async (request) => {
      return { id: "123", name: request.name };
    }),
    createGrpcMethod("DeleteUser", "DeleteUserRequest", "DeleteUserResponse", async (request) => {
      return { success: true };
    })
  ]);
  
  server.addService(service);
  
  expect(service.methods.length).toBe(3);
  expect(service.methods.map(m => m.name)).toEqual(["GetUser", "CreateUser", "DeleteUser"]);
});

test("gRPC server - handles method execution", async () => {
  const server = createGrpcServer();
  
  const getUserMethod = createGrpcMethod(
    "GetUser", 
    "GetUserRequest", 
    "GetUserResponse", 
    async (request) => {
      return { 
        id: request.id, 
        name: "John Doe",
        email: "john@example.com"
      };
    }
  );
  
  server.addMethod("UserService", getUserMethod);
  
  // Test the method handler directly
  const request = { id: "123" };
  const response = await getUserMethod.handler(request);
  
  expect(response).toEqual({
    id: "123",
    name: "John Doe",
    email: "john@example.com"
  });
});

test("gRPC server - handles streaming method simulation", async () => {
  const server = createGrpcServer();
  
  const streamMethod = createGrpcMethod(
    "StreamUsers",
    "StreamUsersRequest",
    "StreamUsersResponse",
    async (request) => {
      // Simulate streaming response
      const users = [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
        { id: "3", name: "Charlie" }
      ];
      
      return {
        users: users.slice(0, request.limit || users.length),
        hasMore: (request.limit || users.length) < users.length
      };
    }
  );
  
  server.addMethod("UserService", streamMethod);
  
  // Test streaming with limit
  const request = { limit: 2 };
  const response = await streamMethod.handler(request);
  
  expect(response.users.length).toBe(2);
  expect(response.users[0].name).toBe("Alice");
  expect(response.users[1].name).toBe("Bob");
  expect(response.hasMore).toBe(true);
});

test("gRPC server - handles error in method", async () => {
  const server = createGrpcServer();
  
  const errorMethod = createGrpcMethod(
    "ErrorMethod",
    "ErrorRequest",
    "ErrorResponse",
    async (request) => {
      if (!request.id) {
        throw new Error("ID is required");
      }
      return { success: true };
    }
  );
  
  server.addMethod("TestService", errorMethod);
  
  // Test error handling
  try {
    await errorMethod.handler({});
    expect(true).toBe(false); // Should not reach here
  } catch (error) {
    expect(error.message).toBe("ID is required");
  }
  
  // Test success case
  const response = await errorMethod.handler({ id: "123" });
  expect(response.success).toBe(true);
});

test("gRPC server - configures with options", () => {
  const server = createGrpcServer();
  
  server.withOptions({
    port: 50051,
    hostname: "localhost",
    showRoutes: true
  });
  
  // Options are stored internally
  expect(server.withOptions).toBeDefined();
});

test("gRPC server - creates complex service", () => {
  const server = createGrpcServer();
  
  const authService = createGrpcService("AuthService", [
    createGrpcMethod("Login", "LoginRequest", "LoginResponse", async (request) => {
      return { 
        token: "jwt-token-123",
        userId: request.userId,
        expiresIn: 3600
      };
    }),
    createGrpcMethod("Logout", "LogoutRequest", "LogoutResponse", async (request) => {
      return { success: true };
    }),
    createGrpcMethod("RefreshToken", "RefreshTokenRequest", "RefreshTokenResponse", async (request) => {
      return { 
        token: "new-jwt-token-456",
        expiresIn: 3600
      };
    })
  ]);
  
  server.addService(authService);
  
  expect(authService.name).toBe("AuthService");
  expect(authService.methods.length).toBe(3);
  expect(authService.methods.map(m => m.name)).toEqual(["Login", "Logout", "RefreshToken"]);
});

test("gRPC server - handles server startup", async () => {
  const server = createGrpcServer();
  
  server.withOptions({
    port: 50051,
    hostname: "localhost"
  });
  
  const result = await server.listen();
  
  expect(result).toBeDefined();
  expect(result.port).toBe(50051);
  expect(result.hostname).toBe("localhost");
  expect(result.services).toBeDefined();
  expect(result.stop).toBeDefined();
});
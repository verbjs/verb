import { test, expect } from "bun:test";
import { 
  createServer, 
  createHttpServer, 
  createHttp2Server, 
  createWebSocketServer, 
  createGrpcServer, 
  createUdpServer, 
  createTcpServer 
} from "../../src/server";

test("Server index - exports all server types", () => {
  expect(createServer).toBeDefined();
  expect(createHttpServer).toBeDefined();
  expect(createHttp2Server).toBeDefined();
  expect(createWebSocketServer).toBeDefined();
  expect(createGrpcServer).toBeDefined();
  expect(createUdpServer).toBeDefined();
  expect(createTcpServer).toBeDefined();
});

test("Server index - createServer is HTTP server for backwards compatibility", () => {
  const server = createServer();
  const httpServer = createHttpServer();
  
  // Both should have the same interface
  expect(server).toBeDefined();
  expect(server.get).toBeDefined();
  expect(server.post).toBeDefined();
  expect(server.put).toBeDefined();
  expect(server.delete).toBeDefined();
  expect(server.patch).toBeDefined();
  expect(server.head).toBeDefined();
  expect(server.options).toBeDefined();
  expect(server.use).toBeDefined();
  expect(server.route).toBeDefined();
  expect(server.listen).toBeDefined();
  
  // Should have the same methods as HTTP server
  expect(typeof server.get).toBe(typeof httpServer.get);
  expect(typeof server.post).toBe(typeof httpServer.post);
  expect(typeof server.use).toBe(typeof httpServer.use);
  expect(typeof server.listen).toBe(typeof httpServer.listen);
});

test("Server index - HTTP server works correctly", async () => {
  const server = createHttpServer();
  
  server.get("/test", (req, res) => {
    res.json({ protocol: "http" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe("http");
});

test("Server index - HTTP/2 server works correctly", async () => {
  const server = createHttp2Server();
  
  server.get("/test", (req, res) => {
    res.json({ protocol: "http2" });
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe("http2");
});

test("Server index - WebSocket server works correctly", async () => {
  const server = createWebSocketServer();
  
  server.get("/test", (req, res) => {
    res.json({ protocol: "websocket" });
  });
  
  server.websocket({
    open: (ws) => {
      console.log("WebSocket opened");
    },
    message: (ws, message) => {
      console.log("WebSocket message:", message);
    }
  });
  
  const fetchHandler = server.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe("websocket");
  
  // Verify WebSocket method exists
  expect(server.websocket).toBeDefined();
});

test("Server index - gRPC server works correctly", async () => {
  const server = createGrpcServer();
  
  server.addMethod("TestService", {
    name: "TestMethod",
    requestType: "TestRequest",
    responseType: "TestResponse",
    handler: async (request) => {
      return { success: true, data: request.data };
    }
  });
  
  const result = await server.listen(50051);
  
  expect(result).toBeDefined();
  expect(result.port).toBe(50051);
  expect(result.services).toBeDefined();
});

test("Server index - UDP server works correctly", async () => {
  const server = createUdpServer();
  
  let receivedMessage = null;
  
  server.onMessage((message) => {
    receivedMessage = message;
  });
  
  const result = await server.listen(3000);
  
  expect(result).toBeDefined();
  expect(result.port).toBe(3000);
  expect(result.type).toBe("udp");
  
  // Simulate message
  result._simulateMessage("Hello UDP", "127.0.0.1", 12345);
  
  expect(receivedMessage).toBeDefined();
  expect(receivedMessage.data.toString()).toBe("Hello UDP");
});

test("Server index - TCP server works correctly", async () => {
  const server = createTcpServer();
  
  let receivedConnection = null;
  
  server.onConnection((connection) => {
    receivedConnection = connection;
  });
  
  const result = await server.listen(3000);
  
  expect(result).toBeDefined();
  expect(result.port).toBe(3000);
  expect(result.type).toBe("tcp");
  
  // Simulate connection
  const connection = result._simulateConnection("127.0.0.1", 12345);
  
  expect(receivedConnection).toBeDefined();
  expect(receivedConnection.remoteAddress).toBe("127.0.0.1");
  expect(receivedConnection.remotePort).toBe(12345);
});

test("Server index - all servers have consistent options interface", () => {
  const httpServer = createHttpServer();
  const http2Server = createHttp2Server();
  const wsServer = createWebSocketServer();
  const grpcServer = createGrpcServer();
  const udpServer = createUdpServer();
  const tcpServer = createTcpServer();
  
  // All should have withOptions method
  expect(httpServer.withOptions).toBeDefined();
  expect(http2Server.withOptions).toBeDefined();
  expect(wsServer.withOptions).toBeDefined();
  expect(grpcServer.withOptions).toBeDefined();
  expect(udpServer.withOptions).toBeDefined();
  expect(tcpServer.withOptions).toBeDefined();
  
  // All should have listen method
  expect(httpServer.listen).toBeDefined();
  expect(http2Server.listen).toBeDefined();
  expect(wsServer.listen).toBeDefined();
  expect(grpcServer.listen).toBeDefined();
  expect(udpServer.listen).toBeDefined();
  expect(tcpServer.listen).toBeDefined();
});

test("Server index - HTTP-based servers have consistent routing interface", () => {
  const httpServer = createHttpServer();
  const http2Server = createHttp2Server();
  const wsServer = createWebSocketServer();
  
  // All HTTP-based servers should have routing methods
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'use', 'route'];
  
  httpMethods.forEach(method => {
    expect(httpServer[method]).toBeDefined();
    expect(http2Server[method]).toBeDefined();
    expect(wsServer[method]).toBeDefined();
  });
});

test("Server index - protocol-specific servers have unique features", () => {
  const wsServer = createWebSocketServer();
  const grpcServer = createGrpcServer();
  const udpServer = createUdpServer();
  const tcpServer = createTcpServer();
  
  // WebSocket server should have websocket method
  expect(wsServer.websocket).toBeDefined();
  
  // gRPC server should have addService and addMethod
  expect(grpcServer.addService).toBeDefined();
  expect(grpcServer.addMethod).toBeDefined();
  
  // UDP server should have onMessage and send
  expect(udpServer.onMessage).toBeDefined();
  expect(udpServer.send).toBeDefined();
  
  // TCP server should have onConnection and onData
  expect(tcpServer.onConnection).toBeDefined();
  expect(tcpServer.onData).toBeDefined();
});
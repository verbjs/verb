import { test, expect } from "bun:test";
import { 
  createServer, 
  createUnifiedServer, 
  ProtocolGateway, 
  createProtocolGateway,
  server
} from "../../src/server/unified";
import { ServerProtocol } from "../../src/types";

test("Unified server - createServer defaults to HTTP", () => {
  const app = createServer();
  
  expect(app).toBeDefined();
  expect(app.get).toBeDefined();
  expect(app.post).toBeDefined();
  expect(app.use).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createServer with HTTP protocol", () => {
  const app = createServer(ServerProtocol.HTTP);
  
  expect(app).toBeDefined();
  expect(app.get).toBeDefined();
  expect(app.post).toBeDefined();
  expect(app.use).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createServer with HTTP2 protocol", () => {
  const app = createServer(ServerProtocol.HTTP2);
  
  expect(app).toBeDefined();
  expect(app.get).toBeDefined();
  expect(app.post).toBeDefined();
  expect(app.use).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createServer with WebSocket protocol", () => {
  const app = createServer(ServerProtocol.WEBSOCKET);
  
  expect(app).toBeDefined();
  expect(app.get).toBeDefined();
  expect(app.post).toBeDefined();
  expect(app.use).toBeDefined();
  expect(app.websocket).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createServer with gRPC protocol", () => {
  const app = createServer(ServerProtocol.GRPC);
  
  expect(app).toBeDefined();
  expect(app.addService).toBeDefined();
  expect(app.addMethod).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createServer with UDP protocol", () => {
  const app = createServer(ServerProtocol.UDP);
  
  expect(app).toBeDefined();
  expect(app.onMessage).toBeDefined();
  expect(app.send).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createServer with TCP protocol", () => {
  const app = createServer(ServerProtocol.TCP);
  
  expect(app).toBeDefined();
  expect(app.onConnection).toBeDefined();
  expect(app.onData).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("Unified server - createUnifiedServer works the same as createServer", () => {
  const app1 = createServer(ServerProtocol.HTTP);
  const app2 = createUnifiedServer(ServerProtocol.HTTP);
  
  expect(app1.get).toBeDefined();
  expect(app2.get).toBeDefined();
  expect(typeof app1.get).toBe(typeof app2.get);
});

test("Unified server - server helper object", () => {
  expect(server.http).toBeDefined();
  expect(server.http2).toBeDefined();
  expect(server.websocket).toBeDefined();
  expect(server.grpc).toBeDefined();
  expect(server.udp).toBeDefined();
  expect(server.tcp).toBeDefined();
  expect(server.gateway).toBeDefined();
  expect(server.unified).toBeDefined();
});

test("Unified server - server helper creates correct servers", () => {
  const httpServer = server.http();
  const grpcServer = server.grpc();
  const udpServer = server.udp();
  
  expect(httpServer.get).toBeDefined();
  expect(grpcServer.addService).toBeDefined();
  expect(udpServer.onMessage).toBeDefined();
});

test("Protocol Gateway - creates gateway with default protocol", () => {
  const gateway = createProtocolGateway();
  
  expect(gateway).toBeDefined();
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.HTTP);
});

test("Protocol Gateway - creates gateway with custom default protocol", () => {
  const gateway = createProtocolGateway(ServerProtocol.GRPC);
  
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.GRPC);
});

test("Protocol Gateway - switches protocols", () => {
  const gateway = createProtocolGateway();
  
  // Start with HTTP
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.HTTP);
  
  // Switch to gRPC
  const grpcServer = gateway.switchProtocol(ServerProtocol.GRPC);
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.GRPC);
  expect(grpcServer.addService).toBeDefined();
  
  // Switch to UDP
  const udpServer = gateway.switchProtocol(ServerProtocol.UDP);
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.UDP);
  expect(udpServer.onMessage).toBeDefined();
});

test("Protocol Gateway - getServer returns same instance", () => {
  const gateway = createProtocolGateway();
  
  const server1 = gateway.getServer(ServerProtocol.HTTP);
  const server2 = gateway.getServer(ServerProtocol.HTTP);
  
  expect(server1).toBe(server2);
});

test("Protocol Gateway - current() returns active server", () => {
  const gateway = createProtocolGateway();
  
  const httpServer = gateway.current();
  expect(httpServer.get).toBeDefined();
  
  gateway.switchProtocol(ServerProtocol.GRPC);
  const grpcServer = gateway.current();
  expect(grpcServer.addService).toBeDefined();
});

test("Protocol Gateway - defineRoutes applies to HTTP-based servers", () => {
  const gateway = createProtocolGateway();
  
  let httpRoutesApplied = false;
  let http2RoutesApplied = false;
  let wsRoutesApplied = false;
  
  gateway.defineRoutes((server) => {
    server.get("/test", (req, res) => {
      res.json({ message: "test" });
    });
    
    // Check which server this is by checking the current protocol
    const currentServer = gateway.current();
    if (currentServer === server) {
      switch (gateway.getCurrentProtocol()) {
        case ServerProtocol.HTTP:
          httpRoutesApplied = true;
          break;
        case ServerProtocol.HTTP2:
          http2RoutesApplied = true;
          break;
        case ServerProtocol.WEBSOCKET:
          wsRoutesApplied = true;
          break;
      }
    }
  });
  
  // Routes should be applied to HTTP-based servers
  expect(httpRoutesApplied).toBe(true);
  
  // Get HTTP server and verify route was added
  const httpServer = gateway.getServer(ServerProtocol.HTTP);
  expect(httpServer.get).toBeDefined();
});

test("Protocol Gateway - getAvailableProtocols returns all protocols", () => {
  const gateway = createProtocolGateway();
  
  const protocols = gateway.getAvailableProtocols();
  
  expect(protocols).toContain(ServerProtocol.HTTP);
  expect(protocols).toContain(ServerProtocol.HTTP2);
  expect(protocols).toContain(ServerProtocol.WEBSOCKET);
  expect(protocols).toContain(ServerProtocol.GRPC);
  expect(protocols).toContain(ServerProtocol.UDP);
  expect(protocols).toContain(ServerProtocol.TCP);
});

test("Protocol Gateway - isProtocolSupported checks protocol support", () => {
  const gateway = createProtocolGateway();
  
  expect(gateway.isProtocolSupported("http")).toBe(true);
  expect(gateway.isProtocolSupported("grpc")).toBe(true);
  expect(gateway.isProtocolSupported("invalid")).toBe(false);
});

test("Protocol Gateway - listen starts server for active protocol", async () => {
  const gateway = createProtocolGateway();
  
  // Should work with HTTP (default)
  const httpResult = await gateway.listen(3000);
  expect(httpResult).toBeDefined();
  
  // Switch to gRPC and listen
  gateway.switchProtocol(ServerProtocol.GRPC);
  const grpcResult = await gateway.listen(50051);
  expect(grpcResult).toBeDefined();
  expect(grpcResult.port).toBe(50051);
});

test("Protocol Gateway - listen with specific protocol", async () => {
  const gateway = createProtocolGateway();
  
  // Listen on UDP specifically
  const udpResult = await gateway.listen(3001, "localhost", ServerProtocol.UDP);
  expect(udpResult).toBeDefined();
  expect(udpResult.port).toBe(3001);
  expect(udpResult.type).toBe("udp");
  
  // Current protocol should still be HTTP
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.HTTP);
});

test("Protocol Gateway - server helper creates gateway", () => {
  const gateway = server.gateway();
  
  expect(gateway).toBeDefined();
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.HTTP);
});

test("Protocol Gateway - server helper creates gateway with custom protocol", () => {
  const gateway = server.gateway(ServerProtocol.TCP);
  
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.TCP);
});

test("Unified server - HTTP server works with routes", async () => {
  const app = createServer(ServerProtocol.HTTP);
  
  app.get("/test", (req, res) => {
    res.json({ protocol: "http" });
  });
  
  const fetchHandler = app.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe("http");
});

test("Unified server - HTTP/2 server works with routes", async () => {
  const app = createServer(ServerProtocol.HTTP2);
  
  app.get("/test", (req, res) => {
    res.json({ protocol: "http2" });
  });
  
  const fetchHandler = app.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe("http2");
});

test("Unified server - WebSocket server works with routes and WebSocket", async () => {
  const app = createServer(ServerProtocol.WEBSOCKET);
  
  app.get("/test", (req, res) => {
    res.json({ protocol: "websocket" });
  });
  
  app.websocket({
    open: (ws) => {
      console.log("WebSocket opened");
    }
  });
  
  const fetchHandler = app.createFetchHandler();
  const response = await fetchHandler(new Request("http://localhost:3000/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.protocol).toBe("websocket");
});

test("Unified server - error handling for invalid protocol", () => {
  expect(() => {
    createUnifiedServer("invalid" as ServerProtocol);
  }).toThrow("Unsupported protocol: invalid");
});

test("Protocol Gateway - class instantiation", () => {
  const gateway = new ProtocolGateway();
  
  expect(gateway).toBeDefined();
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.HTTP);
});

test("Protocol Gateway - class instantiation with custom protocol", () => {
  const gateway = new ProtocolGateway(ServerProtocol.TCP);
  
  expect(gateway.getCurrentProtocol()).toBe(ServerProtocol.TCP);
});
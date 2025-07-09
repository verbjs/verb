import { createServer, ProtocolGateway, server } from "../src/server";
import { ServerProtocol } from "../src/types";

// ================================
// 1. Simple Protocol Selection
// ================================

// Create HTTP server (default)
const httpServer = createServer();
httpServer.get("/", (req, res) => {
  res.json({ message: "Hello from HTTP!" });
});

// Create HTTP/2 server
const http2Server = createServer(ServerProtocol.HTTP2);
http2Server.get("/", (req, res) => {
  res.json({ message: "Hello from HTTP/2!" });
});

// Create WebSocket server
const wsServer = createServer(ServerProtocol.WEBSOCKET);
wsServer.get("/", (req, res) => {
  res.json({ message: "Hello from WebSocket HTTP!" });
});
wsServer.websocket({
  open: (ws) => {
    ws.send("Welcome to WebSocket!");
  },
  message: (ws, message) => {
    ws.send(`Echo: ${message}`);
  }
});

// Create gRPC server
const grpcServer = createServer(ServerProtocol.GRPC);
grpcServer.addMethod("UserService", {
  name: "GetUser",
  requestType: "GetUserRequest",
  responseType: "GetUserResponse",
  handler: async (request) => {
    return { id: request.id, name: "John Doe" };
  }
});

// Create UDP server
const udpServer = createServer(ServerProtocol.UDP);
udpServer.onMessage((message) => {
  console.log("UDP message:", message.data.toString());
});

// Create TCP server
const tcpServer = createServer(ServerProtocol.TCP);
tcpServer.onConnection((connection) => {
  console.log("TCP connection:", connection.remoteAddress);
  connection.write("Welcome to TCP server!");
});

// ================================
// 2. Using the Server Helper
// ================================

// Fluent API for creating servers
const httpApp = server.http();
const http2App = server.http2();
const wsApp = server.websocket();
const grpcApp = server.grpc();
const udpApp = server.udp();
const tcpApp = server.tcp();

// ================================
// 3. Protocol Gateway - Runtime Switching
// ================================

const gateway = new ProtocolGateway();

// Define routes that work across HTTP-based protocols
gateway.defineRoutes((app) => {
  app.get("/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      protocol: gateway.getCurrentProtocol(),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/users/:id", (req, res) => {
    res.json({ 
      id: req.params.id, 
      name: "User " + req.params.id,
      protocol: gateway.getCurrentProtocol()
    });
  });

  app.post("/api/users", (req, res) => {
    res.json({ 
      message: "User created", 
      protocol: gateway.getCurrentProtocol()
    });
  });
});

// Start with HTTP
console.log("Starting with HTTP...");
gateway.listen(3000);

// Switch to HTTP/2 after 5 seconds
setTimeout(() => {
  console.log("Switching to HTTP/2...");
  gateway.switchProtocol(ServerProtocol.HTTP2);
  gateway.listen(3001);
}, 5000);

// Switch to WebSocket after 10 seconds
setTimeout(() => {
  console.log("Switching to WebSocket...");
  const wsServer = gateway.switchProtocol(ServerProtocol.WEBSOCKET);
  
  // Add WebSocket-specific functionality
  wsServer.websocket({
    open: (ws) => {
      ws.send("Connected to WebSocket server!");
    },
    message: (ws, message) => {
      ws.send(`Server received: ${message}`);
    }
  });
  
  gateway.listen(3002);
}, 10000);

// ================================
// 4. Multi-Protocol Application
// ================================

class MultiProtocolApp {
  private gateway: ProtocolGateway;
  
  constructor() {
    this.gateway = new ProtocolGateway();
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // HTTP/WebSocket routes
    this.gateway.defineRoutes((app) => {
      app.get("/", (req, res) => {
        res.json({ 
          message: "Multi-Protocol API",
          protocol: this.gateway.getCurrentProtocol(),
          availableProtocols: this.gateway.getAvailableProtocols()
        });
      });
      
      app.get("/switch/:protocol", (req, res) => {
        const protocol = req.params.protocol as ServerProtocol;
        
        if (this.gateway.isProtocolSupported(protocol)) {
          this.gateway.switchProtocol(protocol);
          res.json({ 
            message: `Switched to ${protocol}`, 
            currentProtocol: this.gateway.getCurrentProtocol()
          });
        } else {
          res.status(400).json({ 
            error: "Unsupported protocol",
            supportedProtocols: this.gateway.getAvailableProtocols()
          });
        }
      });
    });
  }
  
  async startHTTP(port = 3000) {
    this.gateway.switchProtocol(ServerProtocol.HTTP);
    return await this.gateway.listen(port);
  }
  
  async startHTTP2(port = 3001) {
    this.gateway.switchProtocol(ServerProtocol.HTTP2);
    return await this.gateway.listen(port);
  }
  
  async startWebSocket(port = 3002) {
    const wsServer = this.gateway.switchProtocol(ServerProtocol.WEBSOCKET);
    
    wsServer.websocket({
      open: (ws) => {
        ws.send(JSON.stringify({ 
          type: "welcome", 
          message: "Connected to WebSocket server" 
        }));
      },
      message: (ws, message) => {
        try {
          const data = JSON.parse(message.toString());
          ws.send(JSON.stringify({ 
            type: "response", 
            echo: data,
            protocol: "websocket"
          }));
        } catch (e) {
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Invalid JSON" 
          }));
        }
      }
    });
    
    return await this.gateway.listen(port);
  }
  
  async startGRPC(port = 50051) {
    const grpcServer = this.gateway.switchProtocol(ServerProtocol.GRPC);
    
    grpcServer.addMethod("ApiService", {
      name: "GetInfo",
      requestType: "GetInfoRequest",
      responseType: "GetInfoResponse",
      handler: async (request) => {
        return {
          message: "gRPC API Response",
          protocol: "grpc",
          requestId: request.id || "unknown"
        };
      }
    });
    
    return await this.gateway.listen(port);
  }
  
  async startUDP(port = 3003) {
    const udpServer = this.gateway.switchProtocol(ServerProtocol.UDP);
    
    udpServer.onMessage((message) => {
      console.log(`UDP received: ${message.data.toString()}`);
      // Echo back the message
      udpServer.send(
        `Echo: ${message.data.toString()}`,
        message.remotePort,
        message.remoteAddress
      );
    });
    
    return await this.gateway.listen(port);
  }
  
  async startTCP(port = 3004) {
    const tcpServer = this.gateway.switchProtocol(ServerProtocol.TCP);
    
    tcpServer.onConnection((connection) => {
      console.log(`TCP connection from ${connection.remoteAddress}:${connection.remotePort}`);
      connection.write("Welcome to TCP server!\n");
    });
    
    tcpServer.onData((connection, data) => {
      console.log(`TCP data: ${data.toString()}`);
      connection.write(`Echo: ${data.toString()}`);
    });
    
    return await this.gateway.listen(port);
  }
}

// ================================
// 5. Usage Examples
// ================================

// Example 1: Simple protocol selection
async function example1() {
  const app = createServer(ServerProtocol.HTTP);
  
  app.get("/", (req, res) => {
    res.json({ message: "Hello World!" });
  });
  
  app.listen(3000);
}

// Example 2: Protocol switching at runtime
async function example2() {
  const gateway = server.gateway();
  
  // Define common routes
  gateway.defineRoutes((app) => {
    app.get("/api/status", (req, res) => {
      res.json({ 
        status: "ok", 
        protocol: gateway.getCurrentProtocol() 
      });
    });
  });
  
  // Start with HTTP
  await gateway.listen(3000);
  
  // Switch to HTTP/2
  gateway.switchProtocol(ServerProtocol.HTTP2);
  await gateway.listen(3001);
}

// Example 3: Multi-protocol application
async function example3() {
  const app = new MultiProtocolApp();
  
  // Start all protocols
  await app.startHTTP(3000);
  await app.startHTTP2(3001);
  await app.startWebSocket(3002);
  await app.startGRPC(50051);
  await app.startUDP(3003);
  await app.startTCP(3004);
  
  console.log("All protocols started!");
}

// Example 4: Dynamic protocol selection
async function example4() {
  const protocols = [
    ServerProtocol.HTTP,
    ServerProtocol.HTTP2,
    ServerProtocol.WEBSOCKET
  ];
  
  const gateway = new ProtocolGateway();
  
  gateway.defineRoutes((app) => {
    app.get("/", (req, res) => {
      res.json({ 
        message: "Dynamic Protocol Server",
        currentProtocol: gateway.getCurrentProtocol(),
        availableProtocols: protocols
      });
    });
  });
  
  // Switch protocols every 10 seconds
  let currentIndex = 0;
  setInterval(() => {
    const nextProtocol = protocols[currentIndex % protocols.length];
    console.log(`Switching to ${nextProtocol}...`);
    gateway.switchProtocol(nextProtocol);
    currentIndex++;
  }, 10000);
  
  await gateway.listen(3000);
}

// Export examples for testing
export { 
  example1, 
  example2, 
  example3, 
  example4, 
  MultiProtocolApp 
};

// Run example if this file is executed directly
if (import.meta.main) {
  console.log("Running multi-protocol example...");
  example3();
}
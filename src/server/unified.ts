import { ServerProtocol } from "../types";
import { createHttpServer } from "./http";
import { createHttp2Server } from "./http2";
import { createWebSocketServer, type WebSocketServerInstance } from "./websocket";
import { createGrpcServer, type GrpcServerInstance } from "./grpc";
import { createUdpServer, type UdpServerInstance } from "./udp";
import { createTcpServer, type TcpServerInstance } from "./tcp";

// Union type for all server instances
export type UnifiedServerInstance = 
  | ReturnType<typeof createHttpServer>
  | ReturnType<typeof createHttp2Server>
  | WebSocketServerInstance
  | GrpcServerInstance
  | UdpServerInstance
  | TcpServerInstance;

// Gateway function to create servers with protocol switching
export const createUnifiedServer = (protocol: ServerProtocol = ServerProtocol.HTTP): UnifiedServerInstance => {
  switch (protocol) {
    case ServerProtocol.HTTP:
      return createHttpServer();
    case ServerProtocol.HTTP2:
      return createHttp2Server();
    case ServerProtocol.WEBSOCKET:
      return createWebSocketServer();
    case ServerProtocol.GRPC:
      return createGrpcServer();
    case ServerProtocol.UDP:
      return createUdpServer();
    case ServerProtocol.TCP:
      return createTcpServer();
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
};

// Enhanced createServer function that accepts protocol parameter
export const createServer = (protocol?: ServerProtocol): UnifiedServerInstance => {
  return createUnifiedServer(protocol || ServerProtocol.HTTP);
};

// Protocol gateway - allows switching between protocols at runtime
export class ProtocolGateway {
  private servers: Map<ServerProtocol, UnifiedServerInstance> = new Map();
  private activeProtocol: ServerProtocol = ServerProtocol.HTTP;

  constructor(defaultProtocol: ServerProtocol = ServerProtocol.HTTP) {
    this.activeProtocol = defaultProtocol;
  }

  // Get or create server for a specific protocol
  getServer(protocol: ServerProtocol): UnifiedServerInstance {
    if (!this.servers.has(protocol)) {
      this.servers.set(protocol, createUnifiedServer(protocol));
    }
    return this.servers.get(protocol)!;
  }

  // Switch to a different protocol
  switchProtocol(protocol: ServerProtocol): UnifiedServerInstance {
    this.activeProtocol = protocol;
    return this.getServer(protocol);
  }

  // Get current active server
  current(): UnifiedServerInstance {
    return this.getServer(this.activeProtocol);
  }

  // Get current protocol
  getCurrentProtocol(): ServerProtocol {
    return this.activeProtocol;
  }

  // Define routes that work across all HTTP-based protocols
  defineRoutes(routeDefiner: (server: any) => void) {
    // Apply routes to HTTP-based servers
    const httpProtocols = [ServerProtocol.HTTP, ServerProtocol.HTTP2, ServerProtocol.WEBSOCKET];
    
    httpProtocols.forEach(protocol => {
      const server = this.getServer(protocol);
      if (this.isHttpBasedServer(server)) {
        routeDefiner(server);
      }
    });
  }

  // Helper to check if server supports HTTP routes
  private isHttpBasedServer(server: any): boolean {
    return server.get && server.post && server.put && server.delete;
  }

  // Start all servers or specific protocol
  async listen(port?: number, hostname?: string, protocol?: ServerProtocol): Promise<any> {
    const targetProtocol = protocol || this.activeProtocol;
    const server = this.getServer(targetProtocol);
    
    if (server.listen) {
      return server.listen(port, hostname);
    } else {
      throw new Error(`Server for protocol ${targetProtocol} does not support listen method`);
    }
  }

  // Stop all servers
  stop() {
    this.servers.forEach((server, protocol) => {
      if (server && typeof (server as any).stop === 'function') {
        (server as any).stop();
      }
    });
  }

  // List all available protocols
  getAvailableProtocols(): ServerProtocol[] {
    return Object.values(ServerProtocol);
  }

  // Check if a protocol is supported
  isProtocolSupported(protocol: string): boolean {
    return Object.values(ServerProtocol).includes(protocol as ServerProtocol);
  }
}

// Convenience function to create a protocol gateway
export const createProtocolGateway = (defaultProtocol?: ServerProtocol): ProtocolGateway => {
  return new ProtocolGateway(defaultProtocol);
};

// Helper function to create servers with fluent API
export const server = {
  http: () => createServer(ServerProtocol.HTTP),
  http2: () => createServer(ServerProtocol.HTTP2),
  websocket: () => createServer(ServerProtocol.WEBSOCKET),
  grpc: () => createServer(ServerProtocol.GRPC),
  udp: () => createServer(ServerProtocol.UDP),
  tcp: () => createServer(ServerProtocol.TCP),
  
  // Create server with protocol switching capability
  gateway: (defaultProtocol?: ServerProtocol) => createProtocolGateway(defaultProtocol),
  
  // Create unified server
  unified: (protocol?: ServerProtocol) => createServer(protocol)
};
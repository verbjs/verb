import { ServerProtocol } from "../types";
import { createHttpServer } from "./http";
import { createHttpsServer, type HttpsServerInstance } from "./https";
import { createHttp2Server } from "./http2";
import { createHttp2sServer, type Http2sServerInstance } from "./http2s";
import { createWebSocketServer, type WebSocketServerInstance } from "./websocket";
import { createWebSocketsServer, type WebSocketsServerInstance } from "./websockets";
import { createGrpcServer, type GrpcServerInstance } from "./grpc";
import { createUdpServer, type UdpServerInstance } from "./udp";
import { createDtlsServer, type DtlsServerInstance } from "./dtls";
import { createTcpServer, type TcpServerInstance } from "./tcp";
import { createTlsServer, type TlsServerInstance } from "./tls";

// Base interface for HTTP-based servers that support withRoutes
export interface HttpBasedServerInstance {
  get: (path: string | string[], ...handlers: any[]) => void;
  post: (path: string | string[], ...handlers: any[]) => void;
  put: (path: string | string[], ...handlers: any[]) => void;
  delete: (path: string | string[], ...handlers: any[]) => void;
  patch: (path: string | string[], ...handlers: any[]) => void;
  head: (path: string | string[], ...handlers: any[]) => void;
  options: (path: string | string[], ...handlers: any[]) => void;
  use: (pathOrMiddleware: string | any, ...middlewares: any[]) => void;
  route: (path: string) => any;
  withRoutes: (routes: any) => void;
  withOptions: (options: any) => void;
  listen: (port?: number, hostname?: string) => any;
}

// Union type for all server instances
export type UnifiedServerInstance = 
  | (ReturnType<typeof createHttpServer> & HttpBasedServerInstance)
  | (HttpsServerInstance & HttpBasedServerInstance)
  | (ReturnType<typeof createHttp2Server> & HttpBasedServerInstance)
  | (Http2sServerInstance & HttpBasedServerInstance)
  | (WebSocketServerInstance & HttpBasedServerInstance)
  | (WebSocketsServerInstance & HttpBasedServerInstance)
  | GrpcServerInstance
  | UdpServerInstance
  | DtlsServerInstance
  | TcpServerInstance
  | TlsServerInstance;

// Gateway function to create servers with protocol switching
export const createUnifiedServer = (protocol: ServerProtocol = ServerProtocol.HTTP): UnifiedServerInstance => {
  switch (protocol) {
    case ServerProtocol.HTTP:
      return createHttpServer();
    case ServerProtocol.HTTPS:
      return createHttpsServer();
    case ServerProtocol.HTTP2:
      return createHttp2Server();
    case ServerProtocol.HTTP2S:
      return createHttp2sServer();
    case ServerProtocol.WEBSOCKET:
      return createWebSocketServer();
    case ServerProtocol.WEBSOCKETS:
      return createWebSocketsServer();
    case ServerProtocol.GRPC:
      return createGrpcServer();
    case ServerProtocol.UDP:
      return createUdpServer();
    case ServerProtocol.DTLS:
      return createDtlsServer();
    case ServerProtocol.TCP:
      return createTcpServer();
    case ServerProtocol.TLS:
      return createTlsServer();
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
};

// Enhanced createServer function that accepts protocol parameter
export function createServer(): ReturnType<typeof createHttpServer> & HttpBasedServerInstance;
export function createServer(protocol: ServerProtocol): UnifiedServerInstance;
export function createServer(protocol?: ServerProtocol): UnifiedServerInstance {
  return createUnifiedServer(protocol || ServerProtocol.HTTP);
}

// Protocol gateway state
type ProtocolGatewayState = {
  servers: Map<ServerProtocol, UnifiedServerInstance>;
  activeProtocol: ServerProtocol;
};

// Create protocol gateway state
const createProtocolGatewayState = (defaultProtocol: ServerProtocol = ServerProtocol.HTTP): ProtocolGatewayState => ({
  servers: new Map(),
  activeProtocol: defaultProtocol,
});

// Get or create server for a specific protocol
const getServerForProtocol = (state: ProtocolGatewayState, protocol: ServerProtocol): UnifiedServerInstance => {
  if (!state.servers.has(protocol)) {
    state.servers.set(protocol, createUnifiedServer(protocol));
  }
  return state.servers.get(protocol)!;
};

// Switch to a different protocol
const switchProtocol = (state: ProtocolGatewayState, protocol: ServerProtocol): UnifiedServerInstance => {
  state.activeProtocol = protocol;
  return getServerForProtocol(state, protocol);
};

// Get current active server
const getCurrentServer = (state: ProtocolGatewayState): UnifiedServerInstance => {
  return getServerForProtocol(state, state.activeProtocol);
};

// Get current protocol
const getCurrentProtocol = (state: ProtocolGatewayState): ServerProtocol => {
  return state.activeProtocol;
};

// Helper to check if server supports HTTP routes
const isHttpBasedServer = (server: any): boolean => {
  return server.get && server.post && server.put && server.delete;
};

// Define routes that work across all HTTP-based protocols
const defineRoutes = (state: ProtocolGatewayState, routeDefiner: (server: any) => void) => {
  // Apply routes to HTTP-based servers
  const httpProtocols = [
    ServerProtocol.HTTP, 
    ServerProtocol.HTTPS,
    ServerProtocol.HTTP2, 
    ServerProtocol.HTTP2S,
    ServerProtocol.WEBSOCKET,
    ServerProtocol.WEBSOCKETS
  ];
  
  httpProtocols.forEach(protocol => {
    const server = getServerForProtocol(state, protocol);
    if (isHttpBasedServer(server)) {
      routeDefiner(server);
    }
  });
};

// Start server for specific protocol
const listenWithGateway = async (
  state: ProtocolGatewayState, 
  port?: number, 
  hostname?: string, 
  protocol?: ServerProtocol
): Promise<any> => {
  const targetProtocol = protocol || state.activeProtocol;
  const server = getServerForProtocol(state, targetProtocol);
  
  if (server.listen) {
    return server.listen(port, hostname);
  } else {
    throw new Error(`Server for protocol ${targetProtocol} does not support listen method`);
  }
};

// Stop all servers
const stopAllServers = (state: ProtocolGatewayState) => {
  state.servers.forEach((server, protocol) => {
    if (server && typeof (server as any).stop === 'function') {
      (server as any).stop();
    }
  });
};

// List all available protocols
const getAvailableProtocols = (): ServerProtocol[] => {
  return Object.values(ServerProtocol);
};

// Check if a protocol is supported
const isProtocolSupported = (protocol: string): boolean => {
  return Object.values(ServerProtocol).includes(protocol as ServerProtocol);
};

// Protocol gateway interface - functional approach
export type ProtocolGateway = {
  getServer: (protocol: ServerProtocol) => UnifiedServerInstance;
  switchProtocol: (protocol: ServerProtocol) => UnifiedServerInstance;
  current: () => UnifiedServerInstance;
  getCurrentProtocol: () => ServerProtocol;
  defineRoutes: (routeDefiner: (server: any) => void) => void;
  listen: (port?: number, hostname?: string, protocol?: ServerProtocol) => Promise<any>;
  stop: () => void;
  getAvailableProtocols: () => ServerProtocol[];
  isProtocolSupported: (protocol: string) => boolean;
};

// Create protocol gateway with functional approach
export const createProtocolGatewayWithState = (defaultProtocol?: ServerProtocol): ProtocolGateway => {
  const state = createProtocolGatewayState(defaultProtocol);
  
  return {
    getServer: (protocol: ServerProtocol) => getServerForProtocol(state, protocol),
    switchProtocol: (protocol: ServerProtocol) => switchProtocol(state, protocol),
    current: () => getCurrentServer(state),
    getCurrentProtocol: () => getCurrentProtocol(state),
    defineRoutes: (routeDefiner: (server: any) => void) => defineRoutes(state, routeDefiner),
    listen: (port?: number, hostname?: string, protocol?: ServerProtocol) => 
      listenWithGateway(state, port, hostname, protocol),
    stop: () => stopAllServers(state),
    getAvailableProtocols,
    isProtocolSupported,
  };
};

// Convenience function to create a protocol gateway
export const createProtocolGateway = (defaultProtocol?: ServerProtocol): ProtocolGateway => {
  return createProtocolGatewayWithState(defaultProtocol);
};

// Helper function to create servers with fluent API
export const server = {
  http: () => createServer(ServerProtocol.HTTP),
  https: () => createServer(ServerProtocol.HTTPS),
  http2: () => createServer(ServerProtocol.HTTP2),
  http2s: () => createServer(ServerProtocol.HTTP2S),
  websocket: () => createServer(ServerProtocol.WEBSOCKET),
  websockets: () => createServer(ServerProtocol.WEBSOCKETS),
  grpc: () => createServer(ServerProtocol.GRPC),
  udp: () => createServer(ServerProtocol.UDP),
  dtls: () => createServer(ServerProtocol.DTLS),
  tcp: () => createServer(ServerProtocol.TCP),
  tls: () => createServer(ServerProtocol.TLS),
  
  // Create server with protocol switching capability
  gateway: (defaultProtocol?: ServerProtocol) => createProtocolGateway(defaultProtocol),
  
  // Create unified server
  unified: (protocol?: ServerProtocol) => createServer(protocol)
};
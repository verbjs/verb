# API Reference

Welcome to the Verb API reference. This section provides comprehensive documentation for all Verb APIs, types, and interfaces.

## Core APIs

### [`createServer(protocol?)`](/api/create-server)
Create a new server instance with optional protocol specification.

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer();                    // HTTP by default
const httpsApp = createServer(ServerProtocol.HTTPS);
const wsApp = createServer(ServerProtocol.WEBSOCKET);
```

### [`ServerProtocol`](/api/server-protocol)
Enum defining all supported protocols.

```typescript
enum ServerProtocol {
  HTTP = "http",
  HTTPS = "https",
  HTTP2 = "http2",
  HTTP2S = "http2s",
  WEBSOCKET = "websocket",
  WEBSOCKETS = "websockets",
  GRPC = "grpc",
  GRPCS = "grpcs",
  UDP = "udp",
  DTLS = "dtls",
  TCP = "tcp",
  TLS = "tls"
}
```

### [`createProtocolGateway(defaultProtocol?)`](/api/protocol-gateway)
Create a protocol gateway for runtime protocol switching.

```typescript
import { createProtocolGateway, ServerProtocol } from "verb";

const gateway = createProtocolGateway();
const httpsGateway = createProtocolGateway(ServerProtocol.HTTPS);
```

## Server Types

### HTTP-based Servers
- [`HTTP Server`](/api/servers/http) - Standard HTTP/1.1 server
- [`HTTPS Server`](/api/servers/https) - Secure HTTP server with TLS
- [`HTTP/2 Server`](/api/servers/http2) - HTTP/2 server with multiplexing
- [`HTTP/2 Secure Server`](/api/servers/http2s) - HTTP/2 with TLS
- [`WebSocket Server`](/api/servers/websocket) - WebSocket server with HTTP fallback
- [`WebSocket Secure Server`](/api/servers/websockets) - Secure WebSocket server

### Non-HTTP Servers
- [`gRPC Server`](/api/servers/grpc) - gRPC service server
- [`gRPC Secure Server`](/api/servers/grpcs) - Secure gRPC server
- [`UDP Server`](/api/servers/udp) - UDP message server
- [`DTLS Server`](/api/servers/dtls) - Secure UDP server
- [`TCP Server`](/api/servers/tcp) - TCP connection server
- [`TLS Server`](/api/servers/tls) - Secure TCP server

## Common Interface

All HTTP-based servers share a common interface:

```typescript
interface HttpServerInstance {
  // HTTP Methods
  get(path: string, ...handlers: MiddlewareHandler[]): void;
  post(path: string, ...handlers: MiddlewareHandler[]): void;
  put(path: string, ...handlers: MiddlewareHandler[]): void;
  delete(path: string, ...handlers: MiddlewareHandler[]): void;
  patch(path: string, ...handlers: MiddlewareHandler[]): void;
  head(path: string, ...handlers: MiddlewareHandler[]): void;
  options(path: string, ...handlers: MiddlewareHandler[]): void;
  
  // Middleware
  use(middleware: Middleware): void;
  use(path: string, ...middlewares: Middleware[]): void;
  
  // Routing
  route(path: string): RouteInstance;
  
  // Configuration
  withRoutes(routes: RouteConfig): void;
  withOptions(options: ListenOptions): void;
  
  // Server Control
  listen(port?: number, hostname?: string): any;
  createFetchHandler(): (req: Request) => Promise<Response>;
}
```

## Types

### Request & Response

```typescript
type Request = globalThis.Request & {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
  ip?: string;
  path?: string;
  hostname?: string;
  protocol?: string;
  secure?: boolean;
  // ... additional properties
};

type Response = {
  send(data: string | object | number | boolean): Response;
  json(data: any): Response;
  status(code: number): Response;
  redirect(url: string, code?: number): Response;
  html(content: string): Response;
  text(content: string): Response;
  header(name: string, value: string): Response;
  cookie(name: string, value: string, options?: any): Response;
  // ... additional methods
};
```

### Handler Types

```typescript
type Handler = (
  req: Request,
  res: Response,
) => void | Promise<void> | Response | Promise<Response>;

type Middleware = (
  req: Request,
  res: Response,
  next: () => void,
) => void | Promise<void>;

type ErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: () => void,
) => void | Promise<void>;
```

### TLS Configuration

```typescript
type TlsOptions = {
  cert: string | ArrayBuffer | BunFile;
  key: string | ArrayBuffer | BunFile;
  passphrase?: string;
  ca?: string | ArrayBuffer | BunFile;
  dhParamsFile?: string;
  lowMemoryMode?: boolean;
  secureOptions?: number;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
};
```

## Fluent API

Verb provides a fluent API for creating servers:

```typescript
import { server } from "verb";

// Create servers using fluent API
const httpApp = server.http();
const httpsApp = server.https();
const wsApp = server.websocket();
const grpcApp = server.grpc();
const udpApp = server.udp();
const tcpApp = server.tcp();

// Create gateway
const gateway = server.gateway();
const httpsGateway = server.gateway(ServerProtocol.HTTPS);
```

## Error Handling

Verb provides comprehensive error handling:

```typescript
// Built-in error types
class HttpError extends Error {
  constructor(statusCode: number, message: string, expose?: boolean);
}

class BadRequestError extends HttpError {}
class UnauthorizedError extends HttpError {}
class ForbiddenError extends HttpError {}
class NotFoundError extends HttpError {}
class InternalServerError extends HttpError {}

// Error handlers
const defaultErrorHandler: ErrorHandler;
const notFoundHandler: Handler;
const asyncHandler: (handler: Handler) => Handler;
```

## Middleware

Built-in middleware functions:

```typescript
// JSON middleware
const jsonMiddleware: (options?: JsonOptions) => Middleware;

// Static file middleware
const staticMiddleware: (root: string, options?: StaticOptions) => Middleware;

// CORS middleware
const corsMiddleware: (options?: CorsOptions) => Middleware;

// Body parser middleware
const bodyParserMiddleware: (options?: BodyParserOptions) => Middleware;
```

## Development Features

### Performance Monitoring
```typescript
// Enable performance monitoring
enablePerformanceMonitoring(enabled: boolean): void;

// Get performance metrics
getPerformanceMetrics(): PerformanceMetrics;

// Reset metrics
resetPerformanceMetrics(): void;
```

### Health Checks
```typescript
// Register health check
registerHealthCheck(name: string, check: HealthCheck): void;

// Run health checks
runHealthChecks(): Promise<HealthCheckResult>;

// Built-in health checks
registerBuiltInHealthChecks(): void;
```

### Route Debugging
```typescript
// Enable route debugging
enableRouteDebug(enabled: boolean): void;

// Get debug logs
getRouteDebugLogs(): RouteDebugLog[];

// Clear debug logs
clearRouteDebugLogs(): void;
```

## TypeScript Support

Verb is built with TypeScript and provides full type safety:

```typescript
import { 
  createServer, 
  ServerProtocol, 
  Request, 
  Response, 
  Handler, 
  Middleware,
  type HttpServerInstance,
  type ProtocolGateway 
} from "verb";

const app = createServer();

// Fully typed handler
app.get("/typed", (req: Request, res: Response) => {
  // IntelliSense and type checking
  res.json({ message: "Type-safe response" });
});
```

## Examples

Quick examples for common use cases:

```typescript
// Basic HTTP server
const app = createServer();
app.get("/", (req, res) => res.json({ hello: "world" }));
app.listen(3000);

// HTTPS server with TLS
const httpsApp = createServer(ServerProtocol.HTTPS);
httpsApp.withTLS({ cert: certFile, key: keyFile });
httpsApp.get("/", (req, res) => res.json({ secure: true }));
httpsApp.listen(443);

// WebSocket server
const wsApp = createServer(ServerProtocol.WEBSOCKET);
wsApp.websocket({
  open: (ws) => ws.send("Connected"),
  message: (ws, msg) => ws.send(`Echo: ${msg}`)
});
wsApp.listen(3001);

// Protocol gateway
const gateway = createProtocolGateway();
gateway.defineRoutes((app) => {
  app.get("/api/status", (req, res) => {
    res.json({ status: "ok", protocol: gateway.getCurrentProtocol() });
  });
});
gateway.listen(3002);
```

## Next Steps

- Explore specific [server types](/api/servers/http)
- Check out [examples](/examples/) for real-world usage
- Learn about [protocol-specific features](/guide/protocols/http)
- Review [performance optimization](/guide/performance)
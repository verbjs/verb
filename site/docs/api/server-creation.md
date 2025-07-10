# Server Creation

This reference covers the APIs for creating and configuring servers in Verb.

## `createServer(protocol?)`

Creates a new server instance with optional protocol specification.

### Signature

```typescript
function createServer(protocol?: ServerProtocol): UnifiedServerInstance
```

### Parameters

- `protocol` (optional): The protocol to use for the server. Defaults to `ServerProtocol.HTTP`.

### Returns

Returns a unified server instance that implements the appropriate server interface based on the protocol.

### Example

```typescript
import { createServer, ServerProtocol } from "verb";

// Default HTTP server
const app = createServer();

// Explicit HTTP server
const httpApp = createServer(ServerProtocol.HTTP);

// HTTPS server
const httpsApp = createServer(ServerProtocol.HTTPS);

// WebSocket server
const wsApp = createServer(ServerProtocol.WEBSOCKET);
```

## `createUnifiedServer(protocol?)`

Alternative API for creating servers, identical to `createServer()`.

### Signature

```typescript
function createUnifiedServer(protocol?: ServerProtocol): UnifiedServerInstance
```

### Parameters

- `protocol` (optional): The protocol to use for the server. Defaults to `ServerProtocol.HTTP`.

### Returns

Returns a unified server instance.

### Example

```typescript
import { createUnifiedServer, ServerProtocol } from "verb";

const app = createUnifiedServer(ServerProtocol.HTTP2);
```

## `server` Object

Fluent API for creating servers with a more readable syntax.

### Properties

All methods return a server instance configured for the specified protocol.

#### `server.http()`

Creates an HTTP server.

```typescript
const app = server.http();
```

#### `server.https()`

Creates an HTTPS server.

```typescript
const app = server.https();
```

#### `server.http2()`

Creates an HTTP/2 server.

```typescript
const app = server.http2();
```

#### `server.http2s()`

Creates an HTTP/2 Secure server.

```typescript
const app = server.http2s();
```

#### `server.websocket()`

Creates a WebSocket server.

```typescript
const app = server.websocket();
```

#### `server.websockets()`

Creates a WebSocket Secure server.

```typescript
const app = server.websockets();
```

#### `server.grpc()`

Creates a gRPC server.

```typescript
const app = server.grpc();
```

#### `server.grpcs()`

Creates a gRPC Secure server.

```typescript
const app = server.grpcs();
```

#### `server.udp()`

Creates a UDP server.

```typescript
const app = server.udp();
```

#### `server.dtls()`

Creates a DTLS (secure UDP) server.

```typescript
const app = server.dtls();
```

#### `server.tcp()`

Creates a TCP server.

```typescript
const app = server.tcp();
```

#### `server.tls()`

Creates a TLS (secure TCP) server.

```typescript
const app = server.tls();
```

#### `server.gateway(defaultProtocol?)`

Creates a protocol gateway.

```typescript
const gateway = server.gateway();
const httpsGateway = server.gateway(ServerProtocol.HTTPS);
```

#### `server.unified(protocol?)`

Creates a unified server (alias for `createServer`).

```typescript
const app = server.unified(ServerProtocol.HTTP2);
```

## `ServerProtocol` Enum

Enum defining all supported protocols.

### Values

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

### Protocol Groups

#### HTTP-based Protocols
- `HTTP` - Standard HTTP/1.1
- `HTTPS` - HTTP/1.1 with TLS
- `HTTP2` - HTTP/2 without TLS
- `HTTP2S` - HTTP/2 with TLS

#### WebSocket Protocols
- `WEBSOCKET` - WebSocket without TLS
- `WEBSOCKETS` - WebSocket with TLS (WSS)

#### RPC Protocols
- `GRPC` - gRPC without TLS
- `GRPCS` - gRPC with TLS

#### Connection-oriented Protocols
- `TCP` - TCP without TLS
- `TLS` - TCP with TLS

#### Connectionless Protocols
- `UDP` - UDP without TLS
- `DTLS` - UDP with TLS

## `UnifiedServerInstance` Type

The unified server instance type that adapts based on the protocol.

### Type Definition

```typescript
type UnifiedServerInstance = 
  | HttpServerInstance
  | HttpsServerInstance
  | Http2ServerInstance
  | Http2sServerInstance
  | WebSocketServerInstance
  | WebSocketsServerInstance
  | GrpcServerInstance
  | GrpcsServerInstance
  | UdpServerInstance
  | DtlsServerInstance
  | TcpServerInstance
  | TlsServerInstance;
```

### Common Interface

All server instances share some common methods:

```typescript
interface BaseServerInstance {
  listen(port?: number, hostname?: string): any;
  withOptions(options: ListenOptions): void;
}
```

### HTTP-based Server Interface

HTTP-based servers (HTTP, HTTPS, HTTP2, HTTP2S, WebSocket, WebSockets) implement:

```typescript
interface HttpServerInstance extends BaseServerInstance {
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
  
  // Bun Native Routes
  withRoutes(routes: RouteConfig): void;
  
  // Testing
  createFetchHandler(): (req: Request) => Promise<Response>;
  
  // Application Configuration
  set(key: string, value: any): void;
  getSetting(key: string): any;
  locals: Record<string, any>;
  mountpath: string;
  path(): string;
}
```

## Configuration

### `ListenOptions`

Options for server configuration.

```typescript
interface ListenOptions {
  port?: number;
  hostname?: string;
  development?: DevelopmentOptions;
  showRoutes?: boolean;
}
```

### `DevelopmentOptions`

Development-specific options.

```typescript
interface DevelopmentOptions {
  hmr?: boolean;      // Hot module reloading
  console?: boolean;  // Enhanced console logging
}
```

### Example Configuration

```typescript
const app = createServer();

app.withOptions({
  port: 3000,
  hostname: "localhost",
  showRoutes: true,
  development: {
    hmr: true,
    console: true
  }
});

app.listen();
```

## Server Methods

### `listen(port?, hostname?)`

Starts the server on the specified port and hostname.

```typescript
// Use configured options
app.listen();

// Override port
app.listen(3000);

// Override port and hostname
app.listen(3000, "0.0.0.0");
```

### `withOptions(options)`

Configures server options.

```typescript
app.withOptions({
  port: 3000,
  hostname: "localhost",
  showRoutes: true
});
```

### `withRoutes(routes)` (HTTP-based servers only)

Configures Bun native routes.

```typescript
app.withRoutes({
  "/": new Response("Hello World"),
  "/api/users": {
    GET: () => Response.json({ users: [] })
  }
});
```

## Application Configuration

### `set(key, value)`

Sets an application setting.

```typescript
app.set("trust proxy", true);
app.set("view engine", "ejs");
```

### `getSetting(key)`

Gets an application setting.

```typescript
const env = app.getSetting("env");
const trustProxy = app.getSetting("trust proxy");
```

### `locals`

Application-wide variables.

```typescript
app.locals.title = "My App";
app.locals.version = "1.0.0";

// Access in routes
app.get("/", (req, res) => {
  res.json({ title: app.locals.title });
});
```

### `mountpath`

The path at which the server is mounted.

```typescript
console.log(app.mountpath); // "/"
```

### `path()`

Returns the canonical path of the server.

```typescript
console.log(app.path()); // "/"
```

## Error Handling

### Server Creation Errors

```typescript
try {
  const app = createServer(ServerProtocol.HTTP);
} catch (error) {
  console.error("Failed to create server:", error);
}
```

### Listen Errors

```typescript
try {
  app.listen(3000);
} catch (error) {
  console.error("Failed to start server:", error);
}
```

## Examples

### Basic HTTP Server

```typescript
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.listen(3000);
```

### HTTPS Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.HTTPS);

app.withOptions({
  port: 443,
  hostname: "localhost"
});

app.get("/", (req, res) => {
  res.json({ secure: true });
});

app.listen();
```

### WebSocket Server

```typescript
import { createServer, ServerProtocol } from "verb";

const app = createServer(ServerProtocol.WEBSOCKET);

app.websocket({
  open: (ws) => {
    ws.send("Connected to WebSocket server");
  },
  message: (ws, message) => {
    ws.send(`Echo: ${message}`);
  }
});

app.listen(3001);
```

### Multiple Servers

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP server
const httpApp = createServer(ServerProtocol.HTTP);
httpApp.get("/", (req, res) => res.json({ protocol: "http" }));
httpApp.listen(3000);

// WebSocket server
const wsApp = createServer(ServerProtocol.WEBSOCKET);
wsApp.websocket({
  open: (ws) => ws.send("WebSocket connected")
});
wsApp.listen(3001);

// gRPC server
const grpcApp = createServer(ServerProtocol.GRPC);
grpcApp.addMethod("TestService", {
  name: "Test",
  handler: async () => ({ success: true })
});
grpcApp.listen(50051);
```

### Fluent API

```typescript
import { server } from "verb";

// Create multiple servers with fluent API
const httpApp = server.http();
const httpsApp = server.https();
const wsApp = server.websocket();
const grpcApp = server.grpc();

// Configure and start
httpApp.get("/", (req, res) => res.json({ type: "http" }));
httpApp.listen(3000);

httpsApp.get("/", (req, res) => res.json({ type: "https" }));
httpsApp.listen(443);

wsApp.websocket({
  open: (ws) => ws.send("WebSocket ready")
});
wsApp.listen(3001);

grpcApp.addMethod("Service", {
  name: "Method",
  handler: async () => ({ result: "success" })
});
grpcApp.listen(50051);
```

## See Also

- [Protocol Gateway](/guide/protocol-gateway) - Runtime protocol switching
- [HTTP Server](/guide/protocols/http) - HTTP server specifics
- [WebSocket Server](/guide/protocols/websocket) - WebSocket server specifics
- [gRPC Server](/guide/protocols/grpc) - gRPC server specifics
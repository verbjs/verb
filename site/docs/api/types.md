# TypeScript Types

Complete TypeScript type definitions for Verb's API interfaces, types, and configuration options.

## Core Types

### ServerProtocol

Enum defining supported server protocols:

```typescript
enum ServerProtocol {
  HTTP = "http",
  HTTPS = "https",
  HTTP2 = "http2",
  WEBSOCKET = "websocket",
  GRPC = "grpc",
  UDP = "udp",
  TCP = "tcp"
}
```

### VerbServer

Main server interface:

```typescript
interface VerbServer {
  // HTTP Methods
  get(path: string, ...handlers: RouteHandler[]): VerbServer;
  post(path: string, ...handlers: RouteHandler[]): VerbServer;
  put(path: string, ...handlers: RouteHandler[]): VerbServer;
  patch(path: string, ...handlers: RouteHandler[]): VerbServer;
  delete(path: string, ...handlers: RouteHandler[]): VerbServer;
  head(path: string, ...handlers: RouteHandler[]): VerbServer;
  options(path: string, ...handlers: RouteHandler[]): VerbServer;
  
  // Route management
  route(path: string): RouteBuilder;
  all(path: string, ...handlers: RouteHandler[]): VerbServer;
  use(path: string | MiddlewareHandler, ...handlers: MiddlewareHandler[]): VerbServer;
  
  // Configuration
  withOptions(options: ServerOptions): VerbServer;
  withRoutes(routes: BunRoutes): VerbServer;
  
  // Server control
  listen(port: number, hostname?: string): Promise<void>;
  close(): Promise<void>;
  
  // HTTP handler
  createFetchHandler(): (request: Request) => Promise<Response>;
}
```

## Request & Response Types

### VerbRequest

Enhanced request interface:

```typescript
interface VerbRequest extends globalThis.Request {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
  ip?: string;
  path?: string;
  hostname?: string;
  protocol?: string;
  secure?: boolean;
  xhr?: boolean;
  get(header: string): string | undefined;
  accepts(types?: string | string[]): string | string[] | null;
  acceptsCharsets(charsets?: string | string[]): string | string[] | null;
  acceptsEncodings(encodings?: string | string[]): string | string[] | null;
  acceptsLanguages(languages?: string | string[]): string | string[] | null;
}
```

### VerbResponse

Enhanced response interface:

```typescript
interface VerbResponse {
  send(data: string | object | number | boolean): VerbResponse;
  json(data: any): VerbResponse;
  status(code: number): VerbResponse;
  redirect(url: string, code?: number): VerbResponse;
  html(content: string): VerbResponse;
  text(content: string): VerbResponse;
  header(name: string, value: string): VerbResponse;
  headers(headers: Record<string, string>): VerbResponse;
  cookie(name: string, value: string, options?: CookieOptions): VerbResponse;
  clearCookie(name: string): VerbResponse;
  type(contentType: string): VerbResponse;
  attachment(filename?: string): VerbResponse;
  download(path: string, filename?: string): Promise<VerbResponse>;
  sendFile(path: string): Promise<VerbResponse>;
  vary(header: string): VerbResponse;
  end(): VerbResponse;
}
```

## Handler Types

### RouteHandler

Function signature for route handlers:

```typescript
type RouteHandler = (
  req: VerbRequest,
  res: VerbResponse,
  next?: NextFunction
) => void | Promise<void>;
```

### MiddlewareHandler

Function signature for middleware:

```typescript
type MiddlewareHandler = (
  req: VerbRequest,
  res: VerbResponse,
  next: NextFunction
) => void | Promise<void>;
```

### NextFunction

Callback to continue request processing:

```typescript
type NextFunction = (error?: Error) => void;
```

### ErrorHandler

Error handling middleware signature:

```typescript
type ErrorHandler = (
  error: Error,
  req: VerbRequest,
  res: VerbResponse,
  next: NextFunction
) => void | Promise<void>;
```

## Configuration Types

### ServerOptions

Server configuration options:

```typescript
interface ServerOptions {
  port?: number;
  hostname?: string;
  development?: {
    hmr?: boolean;
    console?: boolean;
  };
  websocket?: WebSocketOptions;
  tls?: TLSOptions;
  http2?: HTTP2Options;
  grpc?: GrpcOptions;
  cors?: CorsOptions;
  compression?: CompressionOptions;
  rateLimit?: RateLimitOptions;
  static?: StaticOptions;
  session?: SessionOptions;
  security?: SecurityOptions;
}
```

### WebSocketOptions

WebSocket server configuration:

```typescript
interface WebSocketOptions {
  maxCompressedSize?: number;
  maxBackpressure?: number;
  closeOnBackpressureLimit?: boolean;
  message?: (ws: WebSocket, message: string | Buffer) => void;
  open?: (ws: WebSocket) => void;
  close?: (ws: WebSocket, code: number, reason: string) => void;
  drain?: (ws: WebSocket) => void;
  ping?: (ws: WebSocket, data: Buffer) => void;
  pong?: (ws: WebSocket, data: Buffer) => void;
}
```

### TLSOptions

HTTPS/TLS configuration:

```typescript
interface TLSOptions {
  cert?: string | Buffer;
  key?: string | Buffer;
  ca?: string | Buffer;
  pfx?: string | Buffer;
  passphrase?: string;
  rejectUnauthorized?: boolean;
  secureProtocol?: string;
  ciphers?: string;
}
```

### HTTP2Options

HTTP/2 specific configuration:

```typescript
interface HTTP2Options {
  allowHTTP1?: boolean;
  maxDeflateDynamicTableSize?: number;
  maxSettings?: number;
  maxSessionMemory?: number;
  maxHeaderListPairs?: number;
  maxOutstandingPings?: number;
  maxSendHeaderBlockLength?: number;
  paddingStrategy?: number;
  peerMaxConcurrentStreams?: number;
  settings?: HTTP2Settings;
}
```

### GrpcOptions

gRPC server configuration:

```typescript
interface GrpcOptions {
  maxReceiveMessageLength?: number;
  maxSendMessageLength?: number;
  keepaliveTimeMs?: number;
  keepaliveTimeoutMs?: number;
  keepalivePermitWithoutCalls?: boolean;
  http2MaxPingsWithoutData?: number;
  http2MinTimeBetweenPingsMs?: number;
  http2MaxPingStrikes?: number;
}
```

## Middleware Types

### CorsOptions

CORS middleware configuration:

```typescript
interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}
```

### CompressionOptions

Compression middleware configuration:

```typescript
interface CompressionOptions {
  threshold?: number;
  level?: number;
  chunkSize?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
  filter?: (req: VerbRequest, res: VerbResponse) => boolean;
}
```

### RateLimitOptions

Rate limiting configuration:

```typescript
interface RateLimitOptions {
  windowMs?: number;
  max?: number | ((req: VerbRequest) => number);
  message?: string | object;
  statusCode?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: VerbRequest) => string;
  skip?: (req: VerbRequest) => boolean;
  handler?: (req: VerbRequest, res: VerbResponse) => void;
}
```

### StaticOptions

Static file serving configuration:

```typescript
interface StaticOptions {
  root: string;
  index?: string | string[];
  dotfiles?: "allow" | "deny" | "ignore";
  etag?: boolean;
  extensions?: string[];
  fallthrough?: boolean;
  immutable?: boolean;
  lastModified?: boolean;
  maxAge?: number;
  redirect?: boolean;
  setHeaders?: (res: VerbResponse, path: string) => void;
}
```

### SessionOptions

Session middleware configuration:

```typescript
interface SessionOptions {
  secret: string | string[];
  name?: string;
  cookie?: SessionCookieOptions;
  store?: SessionStore;
  resave?: boolean;
  saveUninitialized?: boolean;
  rolling?: boolean;
  unset?: "destroy" | "keep";
}
```

### SessionCookieOptions

Session cookie configuration:

```typescript
interface SessionCookieOptions {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean | "auto";
  sameSite?: boolean | "lax" | "strict" | "none";
  domain?: string;
  path?: string;
}
```

## Cookie Types

### CookieOptions

Cookie configuration:

```typescript
interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  domain?: string;
  path?: string;
}
```

## Routing Types

### RouteBuilder

Route builder interface:

```typescript
interface RouteBuilder {
  get(...handlers: RouteHandler[]): RouteBuilder;
  post(...handlers: RouteHandler[]): RouteBuilder;
  put(...handlers: RouteHandler[]): RouteBuilder;
  patch(...handlers: RouteHandler[]): RouteBuilder;
  delete(...handlers: RouteHandler[]): RouteBuilder;
  head(...handlers: RouteHandler[]): RouteBuilder;
  options(...handlers: RouteHandler[]): RouteBuilder;
  all(...handlers: RouteHandler[]): RouteBuilder;
  use(...handlers: MiddlewareHandler[]): RouteBuilder;
}
```

### BunRoutes

Bun native routes configuration:

```typescript
interface BunRoutes {
  [pattern: string]: {
    GET?: RouteHandler;
    POST?: RouteHandler;
    PUT?: RouteHandler;
    PATCH?: RouteHandler;
    DELETE?: RouteHandler;
    HEAD?: RouteHandler;
    OPTIONS?: RouteHandler;
  } | RouteHandler;
}
```

## Protocol-Specific Types

### UDPOptions

UDP server configuration:

```typescript
interface UDPOptions {
  port: number;
  address?: string;
  reuseAddr?: boolean;
  ipv6Only?: boolean;
  onMessage?: (message: Buffer, rinfo: UDPRemoteInfo) => void;
  onError?: (error: Error) => void;
  onListening?: () => void;
}
```

### UDPRemoteInfo

UDP remote address information:

```typescript
interface UDPRemoteInfo {
  address: string;
  family: "IPv4" | "IPv6";
  port: number;
  size: number;
}
```

### TCPOptions

TCP server configuration:

```typescript
interface TCPOptions {
  port: number;
  host?: string;
  backlog?: number;
  exclusive?: boolean;
  readableHighWaterMark?: number;
  writableHighWaterMark?: number;
  allowHalfOpen?: boolean;
  pauseOnConnect?: boolean;
  onConnection?: (socket: TCPSocket) => void;
  onError?: (error: Error) => void;
  onListening?: () => void;
}
```

### TCPSocket

TCP socket interface:

```typescript
interface TCPSocket {
  write(data: string | Buffer): boolean;
  end(data?: string | Buffer): void;
  destroy(error?: Error): void;
  pause(): TCPSocket;
  resume(): TCPSocket;
  setTimeout(timeout: number, callback?: () => void): TCPSocket;
  setKeepAlive(enable?: boolean, initialDelay?: number): TCPSocket;
  setNoDelay(noDelay?: boolean): TCPSocket;
  ref(): TCPSocket;
  unref(): TCPSocket;
  
  // Properties
  destroyed: boolean;
  readable: boolean;
  writable: boolean;
  readyState: string;
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  
  // Events
  on(event: "data", listener: (data: Buffer) => void): TCPSocket;
  on(event: "end", listener: () => void): TCPSocket;
  on(event: "error", listener: (error: Error) => void): TCPSocket;
  on(event: "close", listener: (hadError: boolean) => void): TCPSocket;
  on(event: "connect", listener: () => void): TCPSocket;
  on(event: "drain", listener: () => void): TCPSocket;
  on(event: "timeout", listener: () => void): TCPSocket;
}
```

## Error Types

### VerbError

Base error class:

```typescript
class VerbError extends Error {
  statusCode: number;
  code?: string;
  details?: any;
  
  constructor(message: string, statusCode?: number, code?: string, details?: any);
}
```

### GrpcError

gRPC specific error:

```typescript
class GrpcError extends VerbError {
  grpcCode: GrpcStatus;
  
  constructor(grpcCode: GrpcStatus, message: string, details?: any);
}
```

### GrpcStatus

gRPC status codes:

```typescript
enum GrpcStatus {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16
}
```

## Utility Types

### DeepPartial

Make all properties optional recursively:

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

### RequestHandler

Union type for request handlers:

```typescript
type RequestHandler = RouteHandler | MiddlewareHandler | ErrorHandler;
```

### HttpMethod

HTTP method type:

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
```

### ContentType

Common content types:

```typescript
type ContentType = 
  | "application/json"
  | "application/xml"
  | "text/html"
  | "text/plain"
  | "text/css"
  | "text/javascript"
  | "application/javascript"
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/svg+xml"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded";
```

## Type Guards

Utility functions for type checking:

```typescript
// Check if object is VerbRequest
function isVerbRequest(obj: any): obj is VerbRequest;

// Check if object is VerbResponse  
function isVerbResponse(obj: any): obj is VerbResponse;

// Check if function is RouteHandler
function isRouteHandler(fn: any): fn is RouteHandler;

// Check if function is MiddlewareHandler
function isMiddlewareHandler(fn: any): fn is MiddlewareHandler;

// Check if function is ErrorHandler
function isErrorHandler(fn: any): fn is ErrorHandler;
```

## Module Declarations

```typescript
declare module "verb" {
  export function createServer(protocol?: ServerProtocol): VerbServer;
  export { ServerProtocol, VerbServer, VerbRequest, VerbResponse };
  export * from "./types";
}

declare module "verb/middleware" {
  export function cors(options?: CorsOptions): MiddlewareHandler;
  export function compression(options?: CompressionOptions): MiddlewareHandler;
  export function rateLimit(options?: RateLimitOptions): MiddlewareHandler;
  export function staticFiles(options: StaticOptions): MiddlewareHandler;
  export function session(options: SessionOptions): MiddlewareHandler;
  export function json(options?: JsonOptions): MiddlewareHandler;
  export function urlencoded(options?: UrlencodedOptions): MiddlewareHandler;
}

declare module "verb/grpc" {
  export function createClient(serviceName: string, address: string | string[], options?: GrpcClientOptions): any;
  export { GrpcError, GrpcStatus };
}
```

## Examples

### Basic Type Usage

```typescript
import { createServer, VerbRequest, VerbResponse, RouteHandler } from "verb";

const handler: RouteHandler = (req: VerbRequest, res: VerbResponse) => {
  const userId: string = req.params.id;
  const page: number = parseInt(req.query.page || "1");
  
  res.status(200).json({
    userId,
    page,
    timestamp: new Date().toISOString()
  });
};

const app = createServer();
app.get("/users/:id", handler);
```

### Custom Middleware Type

```typescript
const authMiddleware: MiddlewareHandler = async (req, res, next) => {
  const token = req.get("authorization");
  
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const user = await verifyToken(token);
    req.user = user; // Type augmentation needed
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
```

### Type Augmentation

Extend request object with custom properties:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}
```

## See Also

- [Request API](/api/request) - Request object reference
- [Response API](/api/response) - Response object reference  
- [Server Creation](/api/server-creation) - Server configuration
- [Middleware API](/api/middleware) - Middleware development
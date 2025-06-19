---
title: Server API Reference
description: Complete reference for the Verb server package
---

# Verb Server API Reference

This document provides a comprehensive reference for the Verb server package, which is the core of the Verb library. The server package provides a high-performance HTTP server with routing, middleware, and various utilities for building web applications.

## Core Server

### createServer

Creates a high-performance HTTP server with routing and middleware support.

```typescript
const createServer = (options?: ServerOptions) => ServerInstance;
```

**Parameters:**
- `options`: Server configuration options
  - `port`: Port to listen on (default: 3000)
  - `hostname`: Hostname to bind to (default: "0.0.0.0")
  - `maxRequestBodySize`: Maximum request body size in bytes (default: 10MB)
  - `http2`: Enable HTTP/2 support (requires TLS)
  - `tls`: TLS configuration for HTTPS/HTTP2
  - `development`: Development mode (allows self-signed certificates)
  - `router`: Router configuration

**Returns:** Server instance with route registration methods

**Example:**
```typescript
// HTTP/1.1 server
const app = createServer({ port: 3000 });

// HTTP/2 server with TLS
const app2 = createServer({
  port: 3443,
  http2: true,
  tls: {
    cert: "./cert.pem",
    key: "./key.pem"
  }
});

app.get("/", () => text("Hello World"));
app.post("/users", async (req) => {
  const body = await parseBody(req);
  return json(body, 201);
});

app.use(async (req, next) => {
  console.log(`${req.method} ${req.url}`);
  return next();
});
```

### ServerInstance Methods

The server instance returned by `createServer` provides the following methods:

- **get(path, handler)**: Register a GET route
- **post(path, handler)**: Register a POST route
- **put(path, handler)**: Register a PUT route
- **delete(path, handler)**: Register a DELETE route
- **patch(path, handler)**: Register a PATCH route
- **head(path, handler)**: Register a HEAD route
- **options(path, handler)**: Register an OPTIONS route
- **use(middleware)**: Add middleware to the stack
- **mount(basePath, app)**: Mount a sub-application at a base path
- **register(plugin, options)**: Register a plugin
- **startPlugins()**: Start the plugin manager
- **stopPlugins()**: Stop the plugin manager

### HTTP/2 Support

```typescript
const createHttp2Server = (options: ServerOptions) => ServerInstance;
```

Creates an HTTP/2 server with TLS support. Requires TLS configuration.

**HTTP/2 Utilities:**
- `createPushHeader(path, options)`: Create HTTP/2 server push header
- `responseWithPush(response, pushes)`: Add server push to a response
- `createHttp2Headers(headers)`: Convert headers to HTTP/2 format
- `http2Middleware(options)`: Middleware for HTTP/2 optimization
- `generateDevCert(options)`: Generate development certificates
- `isHttp2Preface(buffer)`: Check if a buffer contains HTTP/2 preface

## WebSocket Support

```typescript
const createWebSocketServer = (options: WebSocketServerOptions) => WebSocketServerInstance;
```

Creates a WebSocket server for real-time communication.

**WebSocket Utilities:**
- `createEchoServer(options)`: Create a simple echo WebSocket server
- `createChatServer(options)`: Create a simple chat WebSocket server
- `WebSocketClient`: Client for WebSocket connections

## UDP Support

```typescript
const createUDPServer = (options: UDPServerOptions) => UDPServerInstance;
```

Creates a UDP server for lightweight, connectionless communication.

**UDP Utilities:**
- `createUDPEchoServer(options)`: Create a simple echo UDP server
- `createDiscoveryServer(options)`: Create a service discovery UDP server
- `createMulticastGroup(options)`: Create a UDP multicast group
- `UDPClient`: Client for UDP connections

## Request Handling

### parseBody

Parses the request body with automatic content type detection.

```typescript
const parseBody = async (req: Request): Promise<unknown>;
```

**Example:**
```typescript
// JSON body
const data = await parseBody(req); // { name: "John", age: 30 }

// Form data
const form = await parseBody(req); // { username: "john", password: "secret" }

// Plain text
const text = await parseBody(req); // "Hello World"
```

### getQuery

Extracts query parameters from the request URL.

```typescript
const getQuery = (req: Request): Record<string, string>;
```

**Example:**
```typescript
// URL: /search?q=hello&limit=10
const query = getQuery(req); // { q: "hello", limit: "10" }
```

### getCookies

Parses cookies from the request headers.

```typescript
const getCookies = (req: Request): Record<string, string>;
```

**Example:**
```typescript
// Cookie header: "session=abc123; theme=dark"
const cookies = getCookies(req); // { session: "abc123", theme: "dark" }
```

### Request Type Checks

- `isJsonRequest(req)`: Check if request has JSON content type
- `isGetRequest(req)`: Check if request method is GET
- `isPostRequest(req)`: Check if request method is POST
- `isPutRequest(req)`: Check if request method is PUT
- `isDeleteRequest(req)`: Check if request method is DELETE

## Response Handling

### json

Creates a JSON response with proper content-type header.

```typescript
const json = (data: unknown, status = 200): Response;
```

**Example:**
```typescript
json({ message: "Hello" }) // 200 OK
json({ error: "Not found" }, 404) // 404 with JSON error
```

### text

Creates a plain text response.

```typescript
const text = (data: string, status = 200): Response;
```

**Example:**
```typescript
text("Hello World") // 200 OK with text
text("Not Found", 404) // 404 with text message
```

### html

Creates an HTML response.

```typescript
const html = (data: string, status = 200): Response;
```

**Example:**
```typescript
html("<h1>Welcome</h1>") // 200 OK with HTML
html("<h1>404</h1>", 404) // 404 with HTML page
```

### error

Creates a JSON error response.

```typescript
const error = (message: string, status = 500): Response;
```

**Example:**
```typescript
error("Bad Request", 400) // { error: "Bad Request" } with 400 status
error("Server Error") // { error: "Server Error" } with 500 status
```

### Other Response Helpers

- `notFound()`: Creates a standard 404 Not Found response
- `redirect(location, status)`: Creates a redirect response
- `stream(stream, contentType, headers)`: Creates a streaming response
- `streamFile(filePath, contentType)`: Streams a file from the filesystem
- `streamSSE(generator)`: Creates a Server-Sent Events stream
- `streamJSON(generator)`: Streams JSON objects line by line
- `streamText(chunks, contentType, delay)`: Creates a chunked text stream
- `noContent()`: Creates a 204 No Content response

## Routing

### createRouter

Creates a manual router for handling routes.

```typescript
const createRouter = () => Router;
```

### addRoute

Adds a route to a router.

```typescript
const addRoute = (router: Router, method: Method, path: string, handler: Handler) => void;
```

### createFilesystemRouter

Creates a filesystem-based router that automatically maps files to routes.

```typescript
const createFilesystemRouter = (options?: FilesystemRouterOptions) => FilesystemRouterState;
```

### createUniversalRouter

Creates a universal router that can be either manual or filesystem-based.

```typescript
const createUniversalRouter = (type: RouterType, options?: FilesystemRouterOptions) => UniversalRouter;
```

## Middleware

Middleware functions process requests before they reach route handlers.

```typescript
type Middleware = (req: Request, next: () => Promise<Response>) => Promise<Response>;
```

**Example:**
```typescript
app.use(async (req, next) => {
  console.log(`${req.method} ${req.url}`);
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;
  console.log(`Request took ${duration}ms`);
  return response;
});
```

## Validation

### validateSchema

Validates a value against a JSON schema.

```typescript
function validateSchema(value: any, schema: JsonSchema, fieldPath = ""): ValidationError[];
```

### withSchema

Creates a schema-validated handler wrapper.

```typescript
function withSchema(schema: RouteSchema, handler: Handler): Handler;
```

### schema

Convenience function to create a validated route handler.

```typescript
function schema(routeSchema: RouteSchema) => (handler: Handler) => Handler;
```

**Example:**
```typescript
const userSchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2 },
      email: { type: "string", format: "email" },
      age: { type: "integer", minimum: 18 }
    },
    required: ["name", "email"]
  }
};

app.post("/users", schema(userSchema)(async (req) => {
  const body = await parseBody(req);
  // Body is already validated
  return json({ id: 1, ...body }, 201);
}));
```

## Session Management

### createSessionMiddleware

Creates a session middleware for managing user sessions.

```typescript
const createSessionMiddleware = (state: SessionManagerState) => Middleware;
```

### Session Stores

- `createMemorySessionStore()`: Creates an in-memory session store
- `createRedisSessionStore(redisClient, options)`: Creates a Redis-backed session store

### Session Utilities

- `generateSessionId()`: Generates a secure session ID
- `sign(value, secret)`: Signs a value using HMAC
- `unsign(signedValue, secret)`: Unsigns a signed value
- `parseCookies(cookieHeader)`: Parses cookies from a header string
- `serializeCookie(name, value, options)`: Serializes a cookie for Set-Cookie header

**Example:**
```typescript
const sessionManager = createSessionManagerState({
  secret: "my-secret-key",
  cookie: {
    maxAge: 3600000, // 1 hour
    secure: true,
    httpOnly: true
  }
});

const sessionMiddleware = createSessionMiddleware(sessionManager);
app.use(sessionMiddleware);

app.get("/profile", async (req) => {
  const session = await getSession(req);
  if (!session.data.userId) {
    return redirect("/login");
  }
  return json({ user: session.data.user });
});
```

## Security

### securityHeaders

Adds security headers to responses.

```typescript
const securityHeaders = (options?: SecurityOptions) => Middleware;
```

### csrfProtection

Adds CSRF protection to forms.

```typescript
const csrfProtection = (options?: CSRFOptions) => Middleware;
```

### inputSanitization

Sanitizes input to prevent XSS attacks.

```typescript
const inputSanitization = (options?: SanitizationOptions) => Middleware;
```

### Other Security Utilities

- `generateCSRFToken()`: Generates a CSRF token
- `stripHtml(input)`: Removes HTML tags from input
- `stripScripts(input)`: Removes script tags from input
- `removeNullBytes(input)`: Removes null bytes from input
- `sanitizeString(input)`: Sanitizes a string
- `sanitizeObject(obj)`: Recursively sanitizes an object

## Rate Limiting

### rateLimit

Generic rate limiting middleware.

```typescript
const rateLimit = (options?: RateLimitOptions) => Middleware;
```

### Specialized Rate Limiters

- `rateLimitByIP(options)`: Rate limit by client IP
- `rateLimitByEndpoint(options)`: Rate limit by endpoint
- `rateLimitByUser(options)`: Rate limit by user ID
- `strictRateLimit(options)`: Strict rate limiting with token bucket algorithm

### Rate Limit Stores

- `createMemoryStore(options)`: In-memory rate limit store
- `createSlidingWindowStore(options)`: Sliding window rate limit store
- `createTokenBucketStore(options)`: Token bucket rate limit store

## Compression

### compression

Generic compression middleware.

```typescript
const compression = (options?: CompressionOptions) => Middleware;
```

### Compression Algorithms

- `gzip(options)`: Gzip compression middleware
- `deflate(options)`: Deflate compression middleware
- `productionCompression(options)`: Optimized compression for production
- `developmentCompression(options)`: Lighter compression for development

## Static File Serving

### serveStatic

Serves static files from a directory.

```typescript
const serveStatic = (directory: string, options?: StaticOptions) => Middleware;
```

### staticFiles

Mounts a directory of static files at a path.

```typescript
const staticFiles = (basePath: string, directory: string, options?: StaticOptions) => (router: Router) => void;
```

## Error Handling

### createVerbError

Creates a Verb error with status code and details.

```typescript
const createVerbError = (message: string, statusCode: number, details?: any) => VerbError;
```

### Error Types

- `createBadRequestError(message, details)`: 400 Bad Request
- `createUnauthorizedError(message, details)`: 401 Unauthorized
- `createForbiddenError(message, details)`: 403 Forbidden
- `createNotFoundError(message, details)`: 404 Not Found
- `createConflictError(message, details)`: 409 Conflict
- `createValidationError(message, details)`: 422 Unprocessable Entity
- `createRateLimitError(message, details)`: 429 Too Many Requests
- `createInternalServerError(message, details)`: 500 Internal Server Error

### Error Handling Utilities

- `errorHandler(options)`: Creates an error handling middleware
- `defaultErrorHandler`: Default error handler middleware
- `asyncHandler(handler)`: Wraps an async handler to catch errors
- `createErrorBoundary()`: Creates an error boundary for isolating errors
- `errorBoundaryMiddleware(options)`: Middleware that creates an error boundary

## Logging

### Logger

```typescript
const createLoggerState = (options?: LoggerOptions) => LoggerState;
```

Creates a logger state with configurable destinations and log levels.

### Log Levels

- `trace`: Detailed debugging information
- `debug`: Debugging information
- `info`: Informational messages
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Critical errors that cause the application to crash

### Logging Utilities

- `createDevelopmentLogger(options)`: Creates a logger optimized for development
- `createProductionLogger(options)`: Creates a logger optimized for production
- `requestLogger(options)`: Middleware that logs requests
- `performanceLogger(options)`: Middleware that logs request performance
- `errorLogger(options)`: Middleware that logs errors

## Plugin System

### createPluginManager

Creates a plugin manager for extending the server.

```typescript
const createPluginManager = (server?: any, router?: any) => PluginManager;
```

### Plugin Management

- `registerPlugin(plugin, options)`: Registers a plugin
- `startPlugins()`: Starts all registered plugins
- `stopPlugins()`: Stops all registered plugins
- `getPlugin(name)`: Gets a plugin by name
- `getPlugins()`: Gets all registered plugins
- `hasPlugin(name)`: Checks if a plugin is registered

### Plugin Creation

- `createPluginBuilder()`: Creates a plugin builder
- `createPlugin(options)`: Creates a plugin with options
- `plugin(options)`: Shorthand for creating a plugin

**Example:**
```typescript
const myPlugin = createPlugin({
  name: "my-plugin",
  version: "1.0.0",
  description: "My custom plugin",
  async onRegister(context) {
    console.log("Plugin registered");
  },
  async onStart(context) {
    console.log("Plugin started");
  },
  async onStop(context) {
    console.log("Plugin stopped");
  }
});

app.register(myPlugin);
```

## React Integration

### reactComponent

Renders a React component to a response.

```typescript
const reactComponent = (component: React.ReactElement, options?: RenderOptions) => Response;
```

### React Rendering

- `renderToString(component, options)`: Renders a React component to a string
- `renderToStream(component, options)`: Renders a React component to a stream
- `createReactRendererPlugin(config)`: Creates a React renderer plugin

**Example:**
```typescript
import { React } from "verb/server";

const App = ({ name }) => <h1>Hello, {name}!</h1>;

app.get("/", () => reactComponent(<App name="World" />));
```

## File Upload Handling

### parseMultipart

Parses multipart form data from a request.

```typescript
const parseMultipart = (req: Request, options?: MultipartOptions) => Promise<MultipartData>;
```

### Upload Utilities

- `isMultipartRequest(req)`: Checks if a request is multipart/form-data
- `saveFile(file, path)`: Saves an uploaded file to disk
- `createTempFile(file)`: Creates a temporary file from an upload

**Example:**
```typescript
app.post("/upload", async (req) => {
  if (!isMultipartRequest(req)) {
    return error("Expected multipart/form-data", 400);
  }
  
  const data = await parseMultipart(req);
  
  for (const file of data.files) {
    await saveFile(file, `./uploads/${file.filename}`);
  }
  
  return json({ 
    message: "Files uploaded successfully",
    count: data.files.length
  });
});
```

## Caching

The server includes an internal caching system for optimizing route lookups and responses.

- Routes are cached based on method and path
- Common responses are cached for better performance
- Cache is automatically invalidated when routes change

## Performance Optimizations

The Verb server includes several performance optimizations:

- Pre-allocated header objects to reduce GC pressure
- Optimized string operations for parsing
- Response caching for common responses
- Efficient middleware execution
- HTTP/2 support for faster connections
- Streaming responses for large data
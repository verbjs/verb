---
title: Middleware & Plugins API Reference
description: Complete reference for Verb middleware and plugin system
---

# Middleware & Plugins API Reference

This document provides a comprehensive reference for the Verb middleware and plugin system, which allows extending the functionality of Verb applications.

## Middleware System

Middleware functions process requests before they reach route handlers and can modify both requests and responses.

### Middleware Function Signature

```typescript
type Middleware = (
  req: Request, 
  next: () => Promise<Response>
) => Promise<Response>;
```

**Parameters:**
- `req`: The HTTP request object
- `next`: Function to call the next middleware or route handler

**Returns:** HTTP response

### Adding Middleware

```typescript
app.use(middleware);
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

### Middleware Execution Order

Middleware functions are executed in the order they are added. The request flows through each middleware function, and the response flows back through them in reverse order.

```
Request →  Middleware 1 → Middleware 2 → Middleware 3 → Route Handler
Response ← Middleware 1 ← Middleware 2 ← Middleware 3 ← Route Handler
```

### Early Response

Middleware can return a response early without calling `next()`:

```typescript
app.use(async (req, next) => {
  if (!req.headers.get("Authorization")) {
    return json({ error: "Unauthorized" }, 401);
  }
  return next();
});
```

## Built-in Middleware

### Security Middleware

#### securityHeaders

Adds security headers to responses.

```typescript
const securityHeaders = (options?: SecurityOptions) => Middleware;
```

**Options:**
- `xssProtection`: Enable X-XSS-Protection header (default: true)
- `contentTypeOptions`: Enable X-Content-Type-Options header (default: true)
- `frameOptions`: X-Frame-Options value (default: "SAMEORIGIN")
- `contentSecurityPolicy`: Content-Security-Policy value
- `strictTransportSecurity`: Strict-Transport-Security value
- `referrerPolicy`: Referrer-Policy value (default: "no-referrer-when-downgrade")

**Example:**
```typescript
app.use(securityHeaders({
  contentSecurityPolicy: "default-src 'self'",
  strictTransportSecurity: "max-age=31536000; includeSubDomains"
}));
```

#### csrfProtection

Adds CSRF protection to forms.

```typescript
const csrfProtection = (options?: CSRFOptions) => Middleware;
```

**Options:**
- `cookieName`: Name of the CSRF cookie (default: "csrf")
- `headerName`: Name of the CSRF header (default: "X-CSRF-Token")
- `formFieldName`: Name of the CSRF form field (default: "_csrf")
- `secret`: Secret for signing tokens (default: random)
- `ignoreMethods`: HTTP methods to ignore (default: ["GET", "HEAD", "OPTIONS"])

**Example:**
```typescript
app.use(csrfProtection({
  cookieName: "xsrf-token",
  headerName: "X-XSRF-TOKEN"
}));
```

#### inputSanitization

Sanitizes input to prevent XSS attacks.

```typescript
const inputSanitization = (options?: SanitizationOptions) => Middleware;
```

**Options:**
- `sanitizeBody`: Sanitize request body (default: true)
- `sanitizeQuery`: Sanitize query parameters (default: true)
- `sanitizeParams`: Sanitize route parameters (default: true)
- `sanitizeHeaders`: Sanitize headers (default: false)
- `sanitizers`: Custom sanitizer functions

**Example:**
```typescript
app.use(inputSanitization({
  sanitizeHeaders: true,
  sanitizers: [
    (input) => input.replace(/script/gi, "")
  ]
}));
```

### Rate Limiting Middleware

#### rateLimit

Generic rate limiting middleware.

```typescript
const rateLimit = (options?: RateLimitOptions) => Middleware;
```

**Options:**
- `windowMs`: Time window in milliseconds (default: 60000)
- `max`: Maximum requests per window (default: 100)
- `message`: Error message (default: "Too many requests")
- `statusCode`: Error status code (default: 429)
- `headers`: Include rate limit headers (default: true)
- `keyGenerator`: Function to generate keys (default: IP-based)
- `skip`: Function to skip rate limiting for certain requests
- `store`: Custom store for tracking requests

**Example:**
```typescript
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests, please try again later"
}));
```

#### Specialized Rate Limiters

- `rateLimitByIP(options)`: Rate limit by client IP
- `rateLimitByEndpoint(options)`: Rate limit by endpoint
- `rateLimitByUser(options)`: Rate limit by user ID
- `strictRateLimit(options)`: Strict rate limiting with token bucket algorithm

### Compression Middleware

#### compression

Generic compression middleware.

```typescript
const compression = (options?: CompressionOptions) => Middleware;
```

**Options:**
- `level`: Compression level (default: 6)
- `threshold`: Minimum size to compress (default: 1024)
- `filter`: Function to determine if response should be compressed
- `strategy`: Compression strategy

**Example:**
```typescript
app.use(compression({
  level: 9, // Maximum compression
  threshold: 0 // Compress all responses
}));
```

#### Compression Algorithms

- `gzip(options)`: Gzip compression middleware
- `deflate(options)`: Deflate compression middleware
- `productionCompression(options)`: Optimized compression for production
- `developmentCompression(options)`: Lighter compression for development

### Session Middleware

#### createSessionMiddleware

Creates a session middleware for managing user sessions.

```typescript
const createSessionMiddleware = (state: SessionManagerState) => Middleware;
```

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
```

### Static File Middleware

#### serveStatic

Serves static files from a directory.

```typescript
const serveStatic = (directory: string, options?: StaticOptions) => Middleware;
```

**Options:**
- `index`: Index file to serve (default: "index.html")
- `dotfiles`: How to handle dotfiles (default: "ignore")
- `etag`: Enable ETag generation (default: true)
- `lastModified`: Enable Last-Modified header (default: true)
- `maxAge`: Cache control max age in seconds (default: 0)
- `immutable`: Add immutable directive to Cache-Control (default: false)
- `extensions`: Try these extensions if file not found (default: [])
- `fallthrough`: Fall through to next middleware if file not found (default: true)

**Example:**
```typescript
app.use(serveStatic("./public", {
  maxAge: 86400, // 1 day
  extensions: ["html", "htm"]
}));
```

### Logging Middleware

#### requestLogger

Middleware that logs requests.

```typescript
const requestLogger = (options?: LoggerOptions) => Middleware;
```

**Example:**
```typescript
app.use(requestLogger({
  level: "info",
  format: "${method} ${url} ${status} ${time}ms"
}));
```

#### performanceLogger

Middleware that logs request performance.

```typescript
const performanceLogger = (options?: PerformanceLoggerOptions) => Middleware;
```

**Example:**
```typescript
app.use(performanceLogger({
  threshold: 1000, // Log requests that take more than 1000ms
  level: "warn"
}));
```

#### errorLogger

Middleware that logs errors.

```typescript
const errorLogger = (options?: ErrorLoggerOptions) => Middleware;
```

**Example:**
```typescript
app.use(errorLogger({
  level: "error",
  includeStack: true
}));
```

### Error Handling Middleware

#### errorHandler

Creates an error handling middleware.

```typescript
const errorHandler = (options?: ErrorHandlerOptions) => Middleware;
```

**Options:**
- `log`: Whether to log errors (default: true)
- `includeErrorMessage`: Include error message in response (default: true)
- `includeStackTrace`: Include stack trace in development (default: true)
- `fallbackMessage`: Message for non-Verb errors (default: "Internal Server Error")
- `formatError`: Function to format error responses

**Example:**
```typescript
app.use(errorHandler({
  includeStackTrace: process.env.NODE_ENV !== "production",
  formatError: (err) => ({
    error: err.message,
    code: err.statusCode || 500,
    timestamp: new Date().toISOString()
  })
}));
```

#### errorBoundaryMiddleware

Middleware that creates an error boundary for isolating errors.

```typescript
const errorBoundaryMiddleware = (options?: ErrorBoundaryOptions) => Middleware;
```

**Example:**
```typescript
app.use(errorBoundaryMiddleware({
  onError: (err, req) => {
    console.error(`Error in ${req.method} ${req.url}:`, err);
  }
}));
```

### HTTP/2 Middleware

#### http2Middleware

Middleware for HTTP/2 optimization.

```typescript
const http2Middleware = (options?: Http2Options) => Middleware;
```

**Options:**
- `push`: Enable server push (default: true)
- `pushAssets`: Assets to push with each response
- `pushMap`: Map of paths to assets to push

**Example:**
```typescript
app.use(http2Middleware({
  pushAssets: [
    { path: "/styles.css", as: "style" },
    { path: "/app.js", as: "script" }
  ]
}));
```

## Creating Custom Middleware

You can create custom middleware to add functionality to your application:

```typescript
// Authentication middleware
const authenticate = (options?: AuthOptions) => {
  return async (req: Request, next: () => Promise<Response>) => {
    const token = req.headers.get("Authorization")?.split(" ")[1];
    
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }
    
    try {
      const user = verifyToken(token, options?.secret);
      // Attach user to request for handlers
      (req as any).user = user;
      return next();
    } catch (error) {
      return json({ error: "Invalid token" }, 401);
    }
  };
};

// Usage
app.use(authenticate({ secret: "my-secret" }));
```

## Plugin System

Plugins provide a way to extend Verb applications with reusable functionality.

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version?: string;
  description?: string;
  dependencies?: string[];
  onRegister?: (context: PluginContext) => Promise<void>;
  onStart?: (context: PluginContext) => Promise<void>;
  onStop?: (context: PluginContext) => Promise<void>;
  [key: string]: any;
}
```

### Plugin Context

```typescript
interface PluginContext {
  server: any;
  router: any;
  config: any;
  services: Map<string, any>;
  plugins: Map<string, Plugin>;
}
```

### Creating Plugins

#### createPlugin

Creates a plugin with options.

```typescript
const createPlugin = (options: Plugin) => Plugin;
```

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
    // Add middleware
    context.server.use(async (req, next) => {
      console.log("Plugin middleware");
      return next();
    });
  },
  async onStop(context) {
    console.log("Plugin stopped");
  }
});
```

#### createPluginBuilder

Creates a plugin builder for fluent API.

```typescript
const createPluginBuilder = () => PluginBuilder;
```

**Example:**
```typescript
const myPlugin = createPluginBuilder()
  .setName("my-plugin")
  .setVersion("1.0.0")
  .setDescription("My custom plugin")
  .setDependencies(["auth-plugin"])
  .onRegister(async (context) => {
    console.log("Plugin registered");
  })
  .onStart(async (context) => {
    console.log("Plugin started");
  })
  .onStop(async (context) => {
    console.log("Plugin stopped");
  })
  .buildPlugin();
```

### Plugin Manager

#### createPluginManager

Creates a plugin manager for extending the server.

```typescript
const createPluginManager = (server?: any, router?: any) => PluginManager;
```

**Example:**
```typescript
const pluginManager = createPluginManager(server, router);
pluginManager.register(myPlugin);
pluginManager.start();
```

### Plugin Management

- `registerPlugin(plugin, options)`: Registers a plugin
- `startPlugins()`: Starts all registered plugins
- `stopPlugins()`: Stops all registered plugins
- `getPlugin(name)`: Gets a plugin by name
- `getPlugins()`: Gets all registered plugins
- `hasPlugin(name)`: Checks if a plugin is registered
- `getService(name)`: Gets a service provided by a plugin
- `getServices()`: Gets all services provided by plugins

### Using Plugins

```typescript
// Register a plugin
app.register(myPlugin, { config: { enabled: true } });

// Start plugins (automatically called by server)
app.startPlugins();

// Stop plugins
app.stopPlugins();
```

## Built-in Plugins

### React Renderer Plugin

```typescript
const createReactRendererPlugin = (config?: ReactRendererConfig) => Plugin;
```

**Config:**
- `cache`: Enable component caching (default: true)
- `streaming`: Enable streaming rendering (default: true)
- `hydrate`: Enable client-side hydration (default: true)
- `template`: HTML template for rendering

**Example:**
```typescript
app.register(createReactRendererPlugin({
  cache: true,
  streaming: true,
  template: (html, head) => `
    <!DOCTYPE html>
    <html>
      <head>${head}</head>
      <body>
        <div id="root">${html}</div>
        <script src="/app.js"></script>
      </body>
    </html>
  `
}));
```

## Creating Custom Plugins

You can create custom plugins to add reusable functionality to your applications:

```typescript
// Authentication plugin
const authPlugin = createPlugin({
  name: "auth-plugin",
  version: "1.0.0",
  description: "Authentication plugin",
  
  // Called when plugin is registered
  async onRegister(context) {
    // Add services
    context.services.set("auth", {
      verifyToken: (token) => { /* ... */ },
      generateToken: (user) => { /* ... */ }
    });
  },
  
  // Called when server starts
  async onStart(context) {
    // Add middleware
    context.server.use(async (req, next) => {
      const token = req.headers.get("Authorization")?.split(" ")[1];
      if (token) {
        try {
          const authService = context.services.get("auth");
          const user = authService.verifyToken(token);
          (req as any).user = user;
        } catch (error) {
          // Token invalid, continue without user
        }
      }
      return next();
    });
    
    // Add routes
    context.server.post("/login", async (req) => {
      const body = await parseBody(req);
      // Authenticate user
      const authService = context.services.get("auth");
      const token = authService.generateToken({ id: 1, username: body.username });
      return json({ token });
    });
  },
  
  // Called when server stops
  async onStop(context) {
    // Clean up resources
  }
});

// Usage
app.register(authPlugin);
```

## Best Practices

### Middleware Best Practices

1. **Keep Middleware Focused**: Each middleware should have a single responsibility
2. **Order Matters**: Place middleware in the correct order (e.g., logging before authentication)
3. **Error Handling**: Always handle errors in middleware
4. **Performance**: Be mindful of performance in middleware that runs on every request
5. **Avoid Blocking**: Use async/await for asynchronous operations
6. **Composition**: Compose complex middleware from simpler ones

### Plugin Best Practices

1. **Naming**: Use descriptive names for plugins
2. **Versioning**: Include version information
3. **Dependencies**: Specify plugin dependencies
4. **Documentation**: Document plugin functionality and configuration
5. **Cleanup**: Clean up resources in onStop
6. **Configuration**: Make plugins configurable
7. **Services**: Expose functionality through services
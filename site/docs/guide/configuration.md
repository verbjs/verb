# Configuration

This guide covers how to configure Verb servers with various options, environment variables, and settings.

## Application Configuration

Verb provides a flexible configuration system similar to Express.js for managing application settings.

### Basic Configuration

```typescript
import { createServer } from "verb";

const app = createServer();

// Set application settings
app.set("trust proxy", true);
app.set("view engine", "ejs");
app.set("views", "./views");
app.set("case sensitive routing", false);
app.set("strict routing", false);

// Get settings
const trustProxy = app.getSetting("trust proxy");
const env = app.getSetting("env"); // development/production
```

### Default Settings

Verb automatically configures settings based on the environment:

```typescript
// Default settings
const defaultSettings = {
  env: process.env.VERB_ENV || process.env.BUN_ENV || process.env.NODE_ENV || "development",
  "trust proxy": env === "production",
  "case sensitive routing": false,
  "strict routing": false,
  "view cache": env === "production",
  "views": process.cwd() + "/views",
  "jsonp callback name": "callback"
};
```

### Application Locals

Store application-wide variables:

```typescript
const app = createServer();

// Set locals
app.locals.title = "My App";
app.locals.version = "1.0.0";
app.locals.user = { name: "John", role: "admin" };

// Access in routes
app.get("/", (req, res) => {
  res.json({
    title: app.locals.title,
    version: app.locals.version,
    user: app.locals.user
  });
});
```

## Server Options

Configure server behavior with `withOptions()`:

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
```

### Available Options

```typescript
interface ListenOptions {
  port?: number;           // Server port (default: 3000)
  hostname?: string;       // Server hostname (default: "localhost")
  showRoutes?: boolean;    // Show routes on startup (default: false)
  development?: {
    hmr?: boolean;         // Hot module reloading (default: false)
    console?: boolean;     // Enhanced console logging (default: false)
  };
}
```

## Environment Variables

Verb respects multiple environment variables:

### Environment Detection

```bash
# Environment detection (in order of precedence)
VERB_ENV=production      # Verb-specific environment
BUN_ENV=development      # Bun runtime environment
NODE_ENV=development     # Node.js compatible environment
```

### Common Environment Variables

```bash
# Server configuration
PORT=3000                # Server port
HOST=localhost           # Server hostname

# Application settings
TRUST_PROXY=true         # Trust proxy headers
VIEW_CACHE=true          # Enable view caching

# Development
DEBUG=true               # Enable debug mode
HOT_RELOAD=true          # Enable hot reloading

# Security
CORS_ORIGIN=*            # CORS allowed origins
RATE_LIMIT=100           # Rate limiting per minute
```

### Environment File

Create a `.env` file:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Environment
NODE_ENV=development
DEBUG=true

# Features
ENABLE_CORS=true
TRUST_PROXY=false
SHOW_ROUTES=true
```

Load environment variables:

```typescript
// Bun automatically loads .env files
const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";
const debug = process.env.DEBUG === "true";

const app = createServer();

app.withOptions({
  port: Number(port),
  hostname: host,
  showRoutes: debug
});
```

## Protocol-Specific Configuration

### HTTP/HTTPS Configuration

```typescript
import { createServer, ServerProtocol } from "verb";

// HTTP server
const httpServer = createServer(ServerProtocol.HTTP);

// HTTPS server with TLS options
const httpsServer = createServer(ServerProtocol.HTTPS);
httpsServer.withOptions({
  // TLS options would go here
  // (implementation depends on Bun's TLS support)
});
```

### WebSocket Configuration

```typescript
const wsServer = createServer(ServerProtocol.WEBSOCKET);

wsServer.websocket({
  maxPayloadLength: 16 * 1024 * 1024, // 16MB
  idleTimeout: 120, // 2 minutes
  compression: true,
  
  open: (ws) => {
    console.log("WebSocket connection opened");
  },
  
  message: (ws, message) => {
    console.log("Received:", message);
  },
  
  close: (ws, code, reason) => {
    console.log("WebSocket closed:", code, reason);
  }
});
```

### gRPC Configuration

```typescript
const grpcServer = createServer(ServerProtocol.GRPC);

grpcServer.withOptions({
  port: 50051,
  hostname: "0.0.0.0",
  // gRPC-specific options
  maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
  maxSendMessageLength: 4 * 1024 * 1024,    // 4MB
  keepaliveTimeMs: 30000,
  keepaliveTimeoutMs: 5000
});
```

## Middleware Configuration

### Global Middleware

```typescript
import { createServer, middleware } from "verb";

const app = createServer();

// Built-in middleware
app.use(middleware.json({ limit: "10mb" }));
app.use(middleware.urlencoded({ extended: true }));
app.use(middleware.cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

// Custom middleware
app.use((req, res, next) => {
  req.timestamp = new Date().toISOString();
  next();
});
```

### Path-Specific Middleware

```typescript
// API middleware
app.use("/api", (req, res, next) => {
  res.header("X-API-Version", "v1");
  next();
});

// Static files
app.use("/static", middleware.staticFiles("public", {
  maxAge: 3600000, // 1 hour
  index: false
}));
```

## Bun Native Routes Configuration

Configure fullstack applications with Bun's native routing:

```typescript
import { createServer } from "verb";
import homepage from "./index.html";

const app = createServer();

app.withRoutes({
  "/": homepage,
  "/api/users": {
    GET: async (req) => {
      return Response.json(await getUsers());
    }
  }
});

app.withOptions({
  development: {
    hmr: true,      // Hot module reloading
    console: true   // Enhanced console output
  },
  showRoutes: true
});
```

## Error Handling Configuration

```typescript
const app = createServer();

// Custom error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);
  
  const isDevelopment = app.getSetting("env") === "development";
  
  res.status(500).json({
    error: "Internal Server Error",
    message: isDevelopment ? error.message : "Something went wrong",
    stack: isDevelopment ? error.stack : undefined
  });
});
```

## Performance Configuration

### Route Precompilation

```typescript
const app = createServer();

// Enable route precompilation for better performance
app.withOptions({
  precompileRoutes: true,
  routeCache: true,
  cacheSize: 1000
});
```

### Memory Management

```typescript
const app = createServer();

// Configure memory limits
app.withOptions({
  maxRequestSize: 50 * 1024 * 1024, // 50MB
  maxHeaderSize: 16 * 1024,         // 16KB
  timeout: 30000,                   // 30 seconds
  keepAlive: true,
  keepAliveTimeout: 5000
});
```

## Security Configuration

### CORS Configuration

```typescript
app.use(middleware.cors({
  origin: ["https://example.com", "https://app.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400 // 24 hours
}));
```

### Rate Limiting

```typescript
app.use(middleware.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
  message: "Too many requests",
  standardHeaders: true,
  legacyHeaders: false
}));
```

### Security Headers

```typescript
app.use(middleware.securityHeaders({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Development vs Production

### Development Configuration

```typescript
const app = createServer();

if (app.getSetting("env") === "development") {
  app.withOptions({
    showRoutes: true,
    development: {
      hmr: true,
      console: true
    }
  });
  
  // Development middleware
  app.use(middleware.logger("dev"));
  app.use(middleware.errorHandler({ detailed: true }));
}
```

### Production Configuration

```typescript
const app = createServer();

if (app.getSetting("env") === "production") {
  // Production optimizations
  app.set("trust proxy", true);
  app.set("view cache", true);
  
  // Production middleware
  app.use(middleware.compression());
  app.use(middleware.helmet());
  app.use(middleware.rateLimit());
  
  // Error handling without stack traces
  app.use((error, req, res, next) => {
    res.status(500).json({ error: "Internal Server Error" });
  });
}
```

## Configuration Examples

### Basic Web Server

```typescript
import { createServer, middleware } from "verb";

const app = createServer();

// Application settings
app.set("trust proxy", process.env.TRUST_PROXY === "true");
app.locals.appName = "My Web App";

// Middleware
app.use(middleware.json());
app.use(middleware.cors());
app.use(middleware.staticFiles("public"));

// Server options
app.withOptions({
  port: Number(process.env.PORT) || 3000,
  hostname: process.env.HOST || "localhost",
  showRoutes: process.env.NODE_ENV === "development"
});

app.listen();
```

### API Server

```typescript
import { createServer, middleware } from "verb";

const app = createServer();

// API configuration
app.set("json spaces", 2);
app.use(middleware.json({ limit: "10mb" }));
app.use(middleware.cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["*"]
}));

// Rate limiting
app.use("/api", middleware.rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// API versioning
app.use("/api/v1", (req, res, next) => {
  res.header("X-API-Version", "1.0");
  next();
});

app.listen(3000);
```

## Configuration Best Practices

1. **Use Environment Variables**: Store configuration in environment variables
2. **Validate Configuration**: Validate configuration at startup
3. **Separate Environments**: Use different configurations for development/production
4. **Security First**: Always configure security middleware in production
5. **Performance**: Optimize settings for your use case
6. **Documentation**: Document all configuration options

## Next Steps

- [Server Creation](/guide/server-creation) - Learn about creating different server types
- [Middleware](/guide/middleware) - Understand middleware configuration
- [Security](/guide/security) - Security configuration best practices
- [Performance](/guide/performance) - Performance optimization settings
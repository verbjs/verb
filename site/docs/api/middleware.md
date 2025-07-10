# Middleware API

Complete API reference for Verb's middleware system including built-in middleware and custom middleware creation.

## Middleware Types

### Basic Middleware

```typescript
type MiddlewareHandler = (
  req: VerbRequest,
  res: VerbResponse,
  next: NextFunction
) => void | Promise<void>;
```

### Error Middleware

```typescript
type ErrorHandler = (
  error: Error,
  req: VerbRequest,
  res: VerbResponse,
  next: NextFunction
) => void | Promise<void>;
```

### Next Function

```typescript
type NextFunction = (error?: Error) => void;
```

## Built-in Middleware

### middleware.json(options?)

Parse JSON request bodies.

```typescript
middleware.json(options?: JsonOptions): MiddlewareHandler
```

**Options:**
```typescript
interface JsonOptions {
  limit?: string | number;     // Size limit (default: "100kb")
  strict?: boolean;           // Strict JSON parsing (default: true)
  type?: string | string[];   // Content-Type to parse (default: "application/json")
  verify?: (req: Request, body: string) => void; // Verification function
}
```

**Example:**
```typescript
app.use(middleware.json({
  limit: "50mb",
  strict: false,
  type: ["application/json", "text/json"]
}));
```

### middleware.urlencoded(options?)

Parse URL-encoded request bodies.

```typescript
middleware.urlencoded(options?: UrlEncodedOptions): MiddlewareHandler
```

**Options:**
```typescript
interface UrlEncodedOptions {
  limit?: string | number;     // Size limit
  extended?: boolean;         // Use qs library (default: false)
  parameterLimit?: number;    // Max parameters (default: 1000)
  type?: string | string[];   // Content-Type to parse
}
```

**Example:**
```typescript
app.use(middleware.urlencoded({
  extended: true,
  limit: "10mb"
}));
```

### middleware.cors(options?)

Enable Cross-Origin Resource Sharing.

```typescript
middleware.cors(options?: CorsOptions): MiddlewareHandler
```

**Options:**
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

**Example:**
```typescript
app.use(middleware.cors({
  origin: ["https://example.com", "https://app.example.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
```

### middleware.staticFiles(root, options?)

Serve static files.

```typescript
middleware.staticFiles(root: string, options?: StaticOptions): MiddlewareHandler
```

**Options:**
```typescript
interface StaticOptions {
  maxAge?: number;           // Cache max-age in ms
  immutable?: boolean;       // Cache-Control immutable
  fallthrough?: boolean;     // Fall through to next middleware
  index?: string | false;    // Directory index file
  extensions?: string[];     // File extensions to try
  dotfiles?: "allow" | "deny" | "ignore";
  etag?: boolean;           // Generate ETags
  lastModified?: boolean;   // Set Last-Modified header
}
```

**Example:**
```typescript
app.use("/public", middleware.staticFiles("./public", {
  maxAge: 86400000, // 1 day
  etag: true,
  extensions: ["html", "htm"]
}));
```

### middleware.compression(options?)

Compress response bodies.

```typescript
middleware.compression(options?: CompressionOptions): MiddlewareHandler
```

**Options:**
```typescript
interface CompressionOptions {
  threshold?: number;        // Minimum size to compress
  level?: number;           // Compression level (1-9)
  filter?: (req: Request, res: Response) => boolean;
  chunkSize?: number;       // Chunk size for streaming
}
```

**Example:**
```typescript
app.use(middleware.compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    // Don't compress images
    return !req.path.match(/\.(jpg|jpeg|png|gif)$/);
  }
}));
```

### middleware.rateLimit(options)

Rate limiting middleware.

```typescript
middleware.rateLimit(options: RateLimitOptions): MiddlewareHandler
```

**Options:**
```typescript
interface RateLimitOptions {
  windowMs: number;          // Time window in ms
  max: number;              // Max requests per window
  message?: string;         // Error message
  statusCode?: number;      // Error status code
  headers?: boolean;        // Include rate limit headers
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request) => void;
}
```

**Example:**
```typescript
app.use("/api", middleware.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests",
  keyGenerator: (req) => req.ip
}));
```

### middleware.helmet(options?)

Security headers middleware.

```typescript
middleware.helmet(options?: HelmetOptions): MiddlewareHandler
```

**Options:**
```typescript
interface HelmetOptions {
  contentSecurityPolicy?: CSPOptions | false;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  dnsPrefetchControl?: boolean;
  frameguard?: FrameguardOptions | false;
  hidePoweredBy?: boolean;
  hsts?: HSTSOptions | false;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: ReferrerPolicyOptions;
  xssFilter?: boolean;
}
```

**Example:**
```typescript
app.use(middleware.helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

### middleware.logger(format?, options?)

Request logging middleware.

```typescript
middleware.logger(format?: string, options?: LoggerOptions): MiddlewareHandler
```

**Formats:**
- `"combined"` - Apache combined log format
- `"common"` - Apache common log format
- `"dev"` - Concise colored output for development
- `"short"` - Shorter than default
- `"tiny"` - Minimal output

**Options:**
```typescript
interface LoggerOptions {
  skip?: (req: Request, res: Response) => boolean;
  stream?: WritableStream;
  immediate?: boolean;
}
```

**Example:**
```typescript
app.use(middleware.logger("combined", {
  skip: (req) => req.path.startsWith("/health")
}));
```

### middleware.session(options)

Session management middleware.

```typescript
middleware.session(options: SessionOptions): MiddlewareHandler
```

**Options:**
```typescript
interface SessionOptions {
  secret: string | string[];
  name?: string;
  resave?: boolean;
  saveUninitialized?: boolean;
  cookie?: CookieOptions;
  store?: SessionStore;
  genid?: () => string;
  rolling?: boolean;
  proxy?: boolean;
}
```

**Example:**
```typescript
app.use(middleware.session({
  secret: "your-secret-key",
  name: "sessionId",
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));
```

### middleware.multipart(options?)

Parse multipart/form-data.

```typescript
middleware.multipart(options?: MultipartOptions): MiddlewareHandler
```

**Options:**
```typescript
interface MultipartOptions {
  maxFiles?: number;         // Max number of files
  maxFileSize?: number;      // Max file size in bytes
  maxFieldSize?: number;     // Max field size in bytes
  allowedTypes?: string[];   // Allowed MIME types
  uploadDir?: string;        // Upload directory
  keepExtensions?: boolean;  // Keep file extensions
}
```

**Example:**
```typescript
app.use(middleware.multipart({
  maxFiles: 5,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ["image/*", "application/pdf"],
  uploadDir: "./uploads"
}));
```

## Custom Middleware

### Basic Middleware

```typescript
const customMiddleware = (req, res, next) => {
  // Add custom property
  req.customData = { timestamp: Date.now() };
  
  // Modify response
  res.setHeader("X-Custom-Header", "value");
  
  // Continue to next middleware
  next();
};

app.use(customMiddleware);
```

### Async Middleware

```typescript
const asyncMiddleware = async (req, res, next) => {
  try {
    const data = await fetchSomeData();
    req.data = data;
    next();
  } catch (error) {
    next(error); // Pass error to error handler
  }
};

app.use(asyncMiddleware);
```

### Conditional Middleware

```typescript
const conditionalMiddleware = (condition) => {
  return (req, res, next) => {
    if (condition(req)) {
      // Apply middleware logic
      req.conditional = true;
    }
    next();
  };
};

app.use(conditionalMiddleware((req) => req.path.startsWith("/api")));
```

### Factory Middleware

```typescript
const createAuthMiddleware = (options = {}) => {
  const { secret, algorithms = ["HS256"] } = options;
  
  return async (req, res, next) => {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      
      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }
      
      const decoded = jwt.verify(token, secret, { algorithms });
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  };
};

app.use("/api/protected", createAuthMiddleware({
  secret: process.env.JWT_SECRET
}));
```

## Error Middleware

### Basic Error Handler

```typescript
const errorHandler = (error, req, res, next) => {
  console.error("Error:", error);
  
  res.status(error.status || 500).json({
    error: error.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack })
  });
};

// Error middleware must be last
app.use(errorHandler);
```

### Typed Error Handler

```typescript
class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "HttpError";
  }
}

const typedErrorHandler = (error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code
    });
  }
  
  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: error.details
    });
  }
  
  // Default error
  res.status(500).json({ error: "Internal Server Error" });
};

app.use(typedErrorHandler);
```

### 404 Handler

```typescript
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
};

// 404 handler should be after all routes but before error handler
app.use(notFoundHandler);
```

## Middleware Composition

### Combining Middleware

```typescript
const authAndLog = [
  middleware.logger("dev"),
  authenticate,
  authorize("admin")
];

app.get("/admin/users", ...authAndLog, getUsersHandler);
```

### Middleware Pipeline

```typescript
class MiddlewarePipeline {
  constructor() {
    this.middleware = [];
  }
  
  use(fn) {
    this.middleware.push(fn);
    return this;
  }
  
  execute() {
    return (req, res, next) => {
      let index = 0;
      
      const dispatch = (i) => {
        if (i >= this.middleware.length) return next();
        
        const fn = this.middleware[i];
        try {
          fn(req, res, () => dispatch(i + 1));
        } catch (error) {
          next(error);
        }
      };
      
      dispatch(0);
    };
  }
}

const pipeline = new MiddlewarePipeline()
  .use(middleware.logger("dev"))
  .use(authenticate)
  .use(authorize("admin"));

app.use("/admin", pipeline.execute());
```

## Middleware Context

### Sharing Data

```typescript
// Add data to request
const addContextMiddleware = (req, res, next) => {
  req.context = {
    requestId: generateId(),
    startTime: Date.now(),
    user: null
  };
  next();
};

// Use data in later middleware
const useContextMiddleware = (req, res, next) => {
  console.log(`Request ${req.context.requestId} processing`);
  next();
};
```

### Response Helpers

```typescript
const responseHelpersMiddleware = (req, res, next) => {
  res.success = (data, message = "Success") => {
    return res.json({ success: true, data, message });
  };
  
  res.error = (message, status = 400, code = null) => {
    return res.status(status).json({ success: false, error: message, code });
  };
  
  res.paginate = (data, page, limit, total) => {
    return res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  };
  
  next();
};

app.use(responseHelpersMiddleware);
```

## Testing Middleware

```typescript
import { test, expect } from "bun:test";

test("custom middleware", async () => {
  const app = createServer();
  
  const testMiddleware = (req, res, next) => {
    req.testValue = "middleware-value";
    next();
  };
  
  app.use(testMiddleware);
  app.get("/test", (req, res) => {
    res.json({ value: req.testValue });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/test"));
  
  const data = await response.json();
  expect(data.value).toBe("middleware-value");
});

test("error middleware", async () => {
  const app = createServer();
  
  app.get("/error", (req, res) => {
    throw new Error("Test error");
  });
  
  app.use((error, req, res, next) => {
    res.status(500).json({ error: error.message });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/error"));
  
  expect(response.status).toBe(500);
  const data = await response.json();
  expect(data.error).toBe("Test error");
});
```

## Performance Considerations

### Middleware Order

```typescript
// Correct order for performance
app.use(middleware.compression());     // First - compress early
app.use(middleware.staticFiles());     // Second - serve static files
app.use(middleware.cors());           // Third - CORS headers
app.use(middleware.json());           // Fourth - parse bodies
app.use(middleware.logger());         // Fifth - log requests

// Routes
app.get("/api/users", handler);

// Error handling last
app.use(errorHandler);
```

### Conditional Application

```typescript
// Only apply heavy middleware when needed
app.use("/api", middleware.json());              // Only for API routes
app.use("/upload", middleware.multipart());      // Only for upload routes
app.use("/admin", authenticate);                 // Only for admin routes
```

### Async Considerations

```typescript
// Wrap async middleware to handle rejections
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

app.use(asyncHandler(async (req, res, next) => {
  req.data = await fetchData();
  next();
}));
```

## Common Patterns

### Authentication Middleware

```typescript
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
```

### Authorization Middleware

```typescript
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
};
```

### Validation Middleware

```typescript
const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
  };
};
```

## Type Definitions

```typescript
interface MiddlewareHandler {
  (req: VerbRequest, res: VerbResponse, next: NextFunction): void | Promise<void>;
}

interface ErrorHandler {
  (error: Error, req: VerbRequest, res: VerbResponse, next: NextFunction): void | Promise<void>;
}

interface NextFunction {
  (error?: Error): void;
}

interface MiddlewareOptions {
  [key: string]: any;
}
```
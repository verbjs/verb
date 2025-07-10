# Middleware

This guide covers Verb's comprehensive middleware system, including built-in middleware and custom middleware patterns.

## Understanding Middleware

Middleware functions are functions that have access to the request object (`req`), response object (`res`), and the next middleware function in the application's request-response cycle.

### Middleware Signature

```typescript
type Middleware = (
  req: Request,
  res: Response,
  next: () => void
) => void | Promise<void>;
```

## Basic Middleware

### Global Middleware

Applied to all routes:

```typescript
import { createServer } from "verb";

const app = createServer();

// Logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Authentication middleware
app.use((req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Verify token logic...
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});
```

### Path-Specific Middleware

Applied to specific paths:

```typescript
const app = createServer();

// API middleware
app.use("/api", (req, res, next) => {
  res.header("X-API-Version", "1.0");
  res.header("Content-Type", "application/json");
  next();
});

// Admin middleware
app.use("/admin", (req, res, next) => {
  // Admin authentication
  const isAdmin = checkAdminRole(req);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});
```

### Route-Specific Middleware

Applied to individual routes:

```typescript
const app = createServer();

const authenticate = (req, res, next) => {
  // Authentication logic
  next();
};

const authorize = (req, res, next) => {
  // Authorization logic
  next();
};

// Single middleware
app.get("/protected", authenticate, (req, res) => {
  res.json({ message: "Protected resource" });
});

// Multiple middleware
app.get("/admin/users", authenticate, authorize, (req, res) => {
  res.json({ users: [] });
});
```

## Built-in Middleware

Verb provides several built-in middleware functions:

### JSON Parser

```typescript
import { createServer, middleware } from "verb";

const app = createServer();

// Parse JSON bodies
app.use(middleware.json());

// With options
app.use(middleware.json({
  limit: "10mb",
  strict: true
}));

app.post("/users", (req, res) => {
  console.log(req.body); // Parsed JSON object
  res.json({ received: req.body });
});
```

### URL-Encoded Parser

```typescript
const app = createServer();

// Parse URL-encoded bodies
app.use(middleware.urlencoded());

// With options
app.use(middleware.urlencoded({
  extended: true,
  limit: "1mb"
}));

app.post("/form", (req, res) => {
  console.log(req.body); // Parsed form data
  res.json({ received: req.body });
});
```

### Static Files

```typescript
const app = createServer();

// Serve static files
app.use(middleware.staticFiles("public"));

// With options
app.use("/static", middleware.staticFiles("assets", {
  maxAge: 3600000, // 1 hour
  index: false,
  etag: true
}));
```

### CORS

```typescript
const app = createServer();

// Basic CORS
app.use(middleware.cors());

// Advanced CORS
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
const app = createServer();

// Basic rate limiting
app.use(middleware.rateLimit());

// Advanced rate limiting
app.use(middleware.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: "Rate limit exceeded" });
  }
}));
```

### Security Headers

```typescript
const app = createServer();

// Basic security headers
app.use(middleware.securityHeaders());

// Advanced security headers
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
  },
  noSniff: true,
  xssFilter: true,
  frameOptions: "DENY"
}));
```

## Custom Middleware

### Authentication Middleware

```typescript
const app = createServer();

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
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

app.use("/api/protected", authenticate);
```

### Request Logging

```typescript
const app = createServer();

const logger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`→ ${req.method} ${req.path}`);
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    console.log(`← ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    return originalJson.call(this, data);
  };
  
  next();
};

app.use(logger);
```

### Request Validation

```typescript
const app = createServer();

const validateUser = (req, res, next) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      error: "Name and email are required" 
    });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ 
      error: "Invalid email format" 
    });
  }
  
  next();
};

app.post("/users", validateUser, (req, res) => {
  // User data is validated
  res.json({ message: "User created" });
});
```

### Response Transformation

```typescript
const app = createServer();

const addMetadata = (req, res, next) => {
  // Override res.json to add metadata
  const originalJson = res.json;
  res.json = function(data) {
    const enhanced = {
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        path: req.path
      }
    };
    return originalJson.call(this, enhanced);
  };
  
  next();
};

app.use("/api", addMetadata);
```

## Error Handling Middleware

### Error Handler Signature

```typescript
type ErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: () => void
) => void | Promise<void>;
```

### Basic Error Handler

```typescript
const app = createServer();

app.get("/error", (req, res) => {
  throw new Error("Something went wrong!");
});

// Error handling middleware (must be last)
app.use((error, req, res, next) => {
  console.error("Error:", error);
  
  res.status(500).json({
    error: "Internal Server Error",
    message: error.message
  });
});
```

### Advanced Error Handler

```typescript
const app = createServer();

const errorHandler = (error, req, res, next) => {
  console.error("Error:", error);
  
  // Development vs production
  const isDevelopment = app.getSetting("env") === "development";
  
  // Different error types
  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      details: error.details
    });
  }
  
  if (error.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid credentials"
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: "Internal Server Error",
    message: isDevelopment ? error.message : "Something went wrong",
    stack: isDevelopment ? error.stack : undefined
  });
};

app.use(errorHandler);
```

## Async Middleware

### Async Error Handling

```typescript
const app = createServer();

const asyncMiddleware = async (req, res, next) => {
  try {
    // Async operation
    const user = await fetchUserFromDatabase(req.userId);
    req.user = user;
    next();
  } catch (error) {
    next(error); // Pass error to error handler
  }
};

app.use("/api/user", asyncMiddleware);
```

### Promise-Based Middleware

```typescript
const app = createServer();

const promiseMiddleware = (req, res, next) => {
  someAsyncOperation()
    .then(result => {
      req.result = result;
      next();
    })
    .catch(error => {
      next(error);
    });
};

app.use(promiseMiddleware);
```

## Middleware Composition

### Composing Middleware

```typescript
const app = createServer();

const compose = (...middlewares) => {
  return (req, res, next) => {
    let index = 0;
    
    const dispatch = (i) => {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }
      index = i;
      
      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) return Promise.resolve();
      
      try {
        return Promise.resolve(fn(req, res, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    
    return dispatch(0);
  };
};

// Usage
const authFlow = compose(
  authenticate,
  authorize,
  validatePermissions
);

app.use("/admin", authFlow);
```

### Conditional Middleware

```typescript
const app = createServer();

const conditionalMiddleware = (condition, middleware) => {
  return (req, res, next) => {
    if (condition(req)) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
};

// Usage
app.use(conditionalMiddleware(
  (req) => req.path.startsWith("/api"),
  authenticate
));
```

## Router Middleware

### Router-Level Middleware

```typescript
import { Router } from "verb";

const userRouter = Router();

// Router-level middleware
userRouter.use((req, res, next) => {
  console.log("User router middleware");
  next();
});

userRouter.get("/", (req, res) => {
  res.json({ users: [] });
});

const app = createServer();
app.use("/users", userRouter);
```

### Sub-Application Middleware

```typescript
const app = createServer();
const apiApp = createServer();

// API-specific middleware
apiApp.use((req, res, next) => {
  res.header("X-API-Version", "1.0");
  next();
});

apiApp.get("/status", (req, res) => {
  res.json({ status: "ok" });
});

// Mount API app
app.use("/api", apiApp);
```

## Performance Optimization

### Middleware Caching

```typescript
const app = createServer();

const cache = new Map();

const cachingMiddleware = (req, res, next) => {
  const key = req.path;
  
  if (cache.has(key)) {
    return res.json(cache.get(key));
  }
  
  // Override res.json to cache response
  const originalJson = res.json;
  res.json = function(data) {
    cache.set(key, data);
    return originalJson.call(this, data);
  };
  
  next();
};

app.use("/api/static", cachingMiddleware);
```

### Middleware Ordering

```typescript
const app = createServer();

// Order matters - most specific first
app.use(middleware.cors());        // 1. CORS headers
app.use(middleware.compression()); // 2. Compression
app.use(middleware.json());        // 3. Body parsing
app.use(middleware.rateLimit());   // 4. Rate limiting
app.use(authenticate);             // 5. Authentication
app.use(authorize);                // 6. Authorization

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

// Error handling (last)
app.use(errorHandler);
```

## Testing Middleware

### Unit Testing

```typescript
import { test, expect } from "bun:test";

const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

test("authentication middleware", async () => {
  const req = { headers: {} };
  const res = {
    status: (code) => ({ json: (data) => ({ status: code, data }) })
  };
  
  const result = authenticate(req, res, () => {});
  
  expect(result.status).toBe(401);
  expect(result.data.error).toBe("Unauthorized");
});
```

### Integration Testing

```typescript
import { test, expect } from "bun:test";
import { createServer } from "verb";

test("middleware integration", async () => {
  const app = createServer();
  
  app.use((req, res, next) => {
    req.middlewareRan = true;
    next();
  });
  
  app.get("/test", (req, res) => {
    res.json({ middlewareRan: req.middlewareRan });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/test"));
  const data = await response.json();
  
  expect(data.middlewareRan).toBe(true);
});
```

## Best Practices

1. **Keep It Simple**: Middleware should do one thing well
2. **Call next()**: Always call `next()` unless you're ending the request
3. **Error Handling**: Use try/catch in async middleware
4. **Order Matters**: Apply middleware in the correct order
5. **Performance**: Avoid heavy computations in middleware
6. **Testing**: Test middleware in isolation and integration

## Common Patterns

### Request Enhancement

```typescript
const enhanceRequest = (req, res, next) => {
  req.timestamp = new Date().toISOString();
  req.requestId = generateUUID();
  req.userAgent = req.headers["user-agent"];
  next();
};
```

### Response Enhancement

```typescript
const enhanceResponse = (req, res, next) => {
  res.success = (data) => res.json({ success: true, data });
  res.error = (message, code = 500) => res.status(code).json({ error: message });
  next();
};
```

### Context Passing

```typescript
const addContext = (req, res, next) => {
  req.context = {
    userId: req.user?.id,
    requestId: req.requestId,
    timestamp: Date.now()
  };
  next();
};
```

## Next Steps

- [Request & Response](/guide/request-response) - Learn about request/response objects
- [Error Handling](/guide/error-handling) - Deep dive into error handling
- [Security](/guide/security) - Security middleware and best practices
- [Performance](/guide/performance) - Performance optimization techniques
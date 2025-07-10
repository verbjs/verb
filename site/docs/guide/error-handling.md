# Error Handling

This guide covers comprehensive error handling strategies in Verb, including built-in error types, custom error handlers, and best practices.

## Global Error Handling

### Basic Error Handler

```typescript
import { createServer } from "verb";

const app = createServer();

// Routes that might throw errors
app.get("/error", (req, res) => {
  throw new Error("Something went wrong!");
});

// Global error handler (must be last middleware)
app.use((error, req, res, next) => {
  console.error("Error:", error);
  
  res.status(500).json({
    error: "Internal Server Error",
    message: error.message
  });
});

app.listen(3000);
```

### Advanced Error Handler

```typescript
const app = createServer();

// Advanced global error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);
  
  // Different error types
  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      message: error.message,
      details: error.details
    });
  }
  
  if (error.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid credentials"
    });
  }
  
  if (error.name === "NotFoundError") {
    return res.status(404).json({
      error: "Not Found",
      message: error.message
    });
  }
  
  // Development vs production
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(error.status || 500).json({
    error: "Internal Server Error",
    message: isDevelopment ? error.message : "Something went wrong",
    stack: isDevelopment ? error.stack : undefined,
    requestId: req.headers["x-request-id"]
  });
});
```

## Custom Error Classes

### HTTP Error Classes

```typescript
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public expose: boolean = true
  ) {
    super(message);
    this.name = "HttpError";
  }
}

class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request", code?: string) {
    super(400, message, code);
    this.name = "BadRequestError";
  }
}

class UnauthorizedError extends HttpError {
  constructor(message: string = "Unauthorized", code?: string) {
    super(401, message, code);
    this.name = "UnauthorizedError";
  }
}

class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden", code?: string) {
    super(403, message, code);
    this.name = "ForbiddenError";
  }
}

class NotFoundError extends HttpError {
  constructor(message: string = "Not Found", code?: string) {
    super(404, message, code);
    this.name = "NotFoundError";
  }
}

class ValidationError extends HttpError {
  constructor(
    message: string = "Validation Error",
    public details: any[] = [],
    code?: string
  ) {
    super(422, message, code);
    this.name = "ValidationError";
  }
}

class InternalServerError extends HttpError {
  constructor(message: string = "Internal Server Error", code?: string) {
    super(500, message, code, false); // Don't expose internal errors
    this.name = "InternalServerError";
  }
}
```

### Using Custom Error Classes

```typescript
const app = createServer();

app.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  
  // Validate ID format
  if (!/^\\d+$/.test(id)) {
    throw new BadRequestError("Invalid user ID format", "INVALID_ID");
  }
  
  const user = await getUserById(id);
  
  if (!user) {
    throw new NotFoundError(`User with ID ${id} not found`, "USER_NOT_FOUND");
  }
  
  res.json(user);
});

app.post("/users", async (req, res) => {
  const { name, email } = req.body;
  
  // Validation
  const errors = [];
  if (!name) errors.push({ field: "name", message: "Name is required" });
  if (!email) errors.push({ field: "email", message: "Email is required" });
  if (email && !isValidEmail(email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }
  
  if (errors.length > 0) {
    throw new ValidationError("Invalid input data", errors, "VALIDATION_FAILED");
  }
  
  const user = await createUser({ name, email });
  res.status(201).json(user);
});
```

## Async Error Handling

### Async Route Handlers

```typescript
const app = createServer();

// Async wrapper to catch promise rejections
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Using async wrapper
app.get("/async-route", asyncHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
}));

// Or handle errors manually
app.get("/manual-async", async (req, res, next) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    next(error);
  }
});
```

### Promise Error Handling

```typescript
const app = createServer();

app.get("/database-operation", (req, res, next) => {
  fetchDataFromDatabase()
    .then(data => {
      res.json(data);
    })
    .catch(error => {
      // Pass error to global error handler
      next(error);
    });
});

// Better: Use async/await with try/catch
app.get("/database-operation-better", async (req, res, next) => {
  try {
    const data = await fetchDataFromDatabase();
    res.json(data);
  } catch (error) {
    next(error);
  }
});
```

## Validation Errors

### Input Validation

```typescript
const app = createServer();

const validateUser = (userData) => {
  const errors = [];
  
  if (!userData.name) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (userData.name.length < 2) {
    errors.push({ field: "name", message: "Name must be at least 2 characters" });
  }
  
  if (!userData.email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(userData.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }
  
  if (userData.age !== undefined && (userData.age < 0 || userData.age > 150)) {
    errors.push({ field: "age", message: "Age must be between 0 and 150" });
  }
  
  return errors;
};

app.post("/users", (req, res) => {
  const validationErrors = validateUser(req.body);
  
  if (validationErrors.length > 0) {
    throw new ValidationError("Validation failed", validationErrors);
  }
  
  // Process valid data
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

### Schema Validation

```typescript
import { z } from "zod"; // Example with Zod

const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional()
});

const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        
        throw new ValidationError(
          "Schema validation failed", 
          validationErrors,
          "SCHEMA_VALIDATION_FAILED"
        );
      }
      next(error);
    }
  };
};

app.post("/users", validateSchema(userSchema), (req, res) => {
  // req.body is now validated and typed
  const user = createUser(req.body);
  res.status(201).json(user);
});
```

## 404 Error Handling

### Custom 404 Handler

```typescript
const app = createServer();

// Regular routes
app.get("/", (req, res) => {
  res.json({ message: "Home page" });
});

app.get("/users", (req, res) => {
  res.json({ users: [] });
});

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    suggestions: [
      "Check the URL for typos",
      "Verify the HTTP method",
      "See API documentation"
    ]
  });
});
```

### Dynamic 404 Suggestions

```typescript
const app = createServer();

// Track registered routes for suggestions
const registeredRoutes = new Set();

const trackRoute = (method, path) => {
  registeredRoutes.add(`${method} ${path}`);
};

app.get = function(path, ...handlers) {
  trackRoute("GET", path);
  return originalGet.call(this, path, ...handlers);
};

// 404 handler with suggestions
app.use((req, res) => {
  const requestedRoute = `${req.method} ${req.path}`;
  
  // Find similar routes
  const suggestions = Array.from(registeredRoutes)
    .filter(route => {
      const similarity = calculateSimilarity(requestedRoute, route);
      return similarity > 0.5;
    })
    .slice(0, 3);
  
  res.status(404).json({
    error: "Not Found",
    message: `Route ${requestedRoute} not found`,
    suggestions: suggestions.length > 0 ? suggestions : [
      "Check the API documentation",
      "Verify the HTTP method",
      "Check for typos in the URL"
    ]
  });
});
```

## Error Logging

### Structured Logging

```typescript
const app = createServer();

const logger = {
  error: (message, meta = {}) => {
    console.error(JSON.stringify({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  info: (message, meta = {}) => {
    console.info(JSON.stringify({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

app.use((error, req, res, next) => {
  // Log error with context
  logger.error("Request error", {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      userAgent: req.get("user-agent"),
      ip: req.ip
    },
    user: req.user?.id,
    requestId: req.headers["x-request-id"]
  });
  
  // Send response
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code
    });
  } else {
    res.status(500).json({
      error: "Internal Server Error"
    });
  }
});
```

### Error Monitoring Integration

```typescript
const app = createServer();

// Example integration with error monitoring service
const sendToMonitoring = (error, req) => {
  // Sentry, Bugsnag, etc.
  monitoringService.captureException(error, {
    user: req.user,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers
    },
    extra: {
      requestId: req.headers["x-request-id"],
      timestamp: new Date().toISOString()
    }
  });
};

app.use((error, req, res, next) => {
  // Send to monitoring service
  if (error.status >= 500 || !error.status) {
    sendToMonitoring(error, req);
  }
  
  // Log locally
  logger.error("Application error", {
    error: error.message,
    stack: error.stack,
    request: req.url
  });
  
  // Send response
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === "development" 
      ? error.message 
      : "Internal Server Error"
  });
});
```

## Circuit Breaker Pattern

### Basic Circuit Breaker

```typescript
class CircuitBreaker {
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  private failures = 0;
  private lastFailureTime = 0;
  private state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker(5, 30000);

app.get("/users", async (req, res, next) => {
  try {
    const users = await dbCircuitBreaker.execute(() => 
      fetchUsersFromDatabase()
    );
    res.json(users);
  } catch (error) {
    if (error.message === "Circuit breaker is OPEN") {
      res.status(503).json({
        error: "Service Temporarily Unavailable",
        message: "Database is experiencing issues"
      });
    } else {
      next(error);
    }
  }
});
```

## Retry Logic

### Exponential Backoff

```typescript
const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

app.get("/external-api", async (req, res, next) => {
  try {
    const data = await retry(
      () => fetchFromExternalAPI(),
      3,
      1000
    );
    res.json(data);
  } catch (error) {
    next(new InternalServerError("External API unavailable"));
  }
});
```

## Error Recovery

### Graceful Degradation

```typescript
const app = createServer();

app.get("/user-profile/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      throw new NotFoundError("User not found");
    }
    
    // Try to get additional data, but don't fail if unavailable
    let preferences = null;
    let recentActivity = null;
    
    try {
      preferences = await getUserPreferences(id);
    } catch (error) {
      logger.warn("Failed to load user preferences", { userId: id, error: error.message });
    }
    
    try {
      recentActivity = await getRecentActivity(id);
    } catch (error) {
      logger.warn("Failed to load recent activity", { userId: id, error: error.message });
    }
    
    res.json({
      user,
      preferences,
      recentActivity,
      warnings: [
        ...(preferences === null ? ["Preferences unavailable"] : []),
        ...(recentActivity === null ? ["Recent activity unavailable"] : [])
      ]
    });
  } catch (error) {
    next(error);
  }
});
```

## Testing Error Handling

### Testing Error Scenarios

```typescript
import { test, expect } from "bun:test";
import { createServer } from "verb";

test("handles validation errors", async () => {
  const app = createServer();
  
  app.post("/users", (req, res) => {
    if (!req.body.name) {
      throw new ValidationError("Name is required", [
        { field: "name", message: "Name is required" }
      ]);
    }
    res.json({ success: true });
  });
  
  app.use((error, req, res, next) => {
    if (error instanceof ValidationError) {
      res.status(422).json({
        error: error.message,
        details: error.details
      });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  }));
  
  expect(response.status).toBe(422);
  const data = await response.json();
  expect(data.error).toBe("Name is required");
  expect(data.details).toEqual([
    { field: "name", message: "Name is required" }
  ]);
});

test("handles 404 errors", async () => {
  const app = createServer();
  
  app.get("/", (req, res) => {
    res.json({ message: "home" });
  });
  
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
  });
  
  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/nonexistent"));
  
  expect(response.status).toBe(404);
});
```

## Best Practices

1. **Always Handle Errors**: Never let errors go unhandled
2. **Use Specific Error Types**: Create meaningful error classes
3. **Log Errors Appropriately**: Include context and stack traces
4. **Don't Expose Internal Details**: Hide sensitive information in production
5. **Provide Helpful Error Messages**: Make errors actionable for users
6. **Use Status Codes Correctly**: Return appropriate HTTP status codes
7. **Implement Circuit Breakers**: Protect against cascading failures
8. **Add Retry Logic**: Handle transient failures gracefully
9. **Monitor Errors**: Use error monitoring services
10. **Test Error Scenarios**: Write tests for error conditions

## Error Response Formats

### Standard API Error Format

```typescript
interface ApiError {
  success: false;
  error: string;
  message?: string;
  code?: string;
  details?: any[];
  timestamp: string;
  requestId?: string;
}
```

### Consistent Error Responses

```typescript
const createErrorResponse = (
  error: Error,
  req: Request,
  status: number = 500
) => {
  return {
    success: false,
    error: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    timestamp: new Date().toISOString(),
    requestId: req.headers["x-request-id"]
  };
};
```

## Next Steps

- [Security](/guide/security) - Security best practices
- [Testing](/guide/testing) - Testing strategies including error scenarios
- [Performance](/guide/performance) - Error handling performance considerations